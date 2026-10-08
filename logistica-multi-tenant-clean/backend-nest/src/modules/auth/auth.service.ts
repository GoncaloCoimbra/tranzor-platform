import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Role } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type MulterFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  //  REGISTER
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, name } = registerDto;

    this.logger.log(`🔵 Starting registration for: ${email}`);

    // Check se o email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn(` Email already exists: ${email}`);
      throw new ConflictException('Email is already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    //  CORREÇÃO: Usar transação para garantir que tudo seja salvo
    await this.prisma.$transaction(async (tx) => {
      this.logger.log(` Creating default company for: ${name}`);

      const company = await tx.company.create({
        data: {
          name: `${name}'s Company`,
          nif: `TEMP-${Date.now()}`,
          email,
          phone: null,
          address: null,
          isActive: true,
        },
      });

      this.logger.log(` Company created with ID: ${company.id}`);

      // Create o usuário
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: Role.OPERATOR,
          companyId: company.id,
        },
      });

      this.logger.log(` User created with ID: ${user.id}`);
      return user;
    });

    //  VERIFICAÇÃO: Confirmar que o usuário foi salvo
    const savedUser = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!savedUser) {
      this.logger.error(
        ` CRITICAL ERROR: User not found after creation: ${email}`,
      );
      throw new Error('Error creating user');
    }

    this.logger.log(`[Auth] User confirmed in database: ${savedUser.id}`);
    this.logger.log(`🏢 Associated company: ${savedUser.companyId || 'None'}`);

    const tokens = await this.generateTokens(
      savedUser.id,
      savedUser.email,
      savedUser.role,
      savedUser.companyId,
      savedUser.isActive,
    );

    return {
      ...tokens,
      user: this.formatUser(savedUser),
    };
  }

  //  LOGIN
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    this.logger.log(`🔵 Login attempt for: ${email}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { company: true }, // Include company in date
      });

      if (!user) {
        this.logger.warn(` LOGIN FAILED: Email "${email}" not found`);
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(
        `🔍 User found: ${user.id} | Role: ${user.role} | Active: ${user.isActive}`,
      );

      if (!user.isActive) {
        this.logger.warn(` LOGIN FAILED: User "${email}" is inactive`);
        throw new UnauthorizedException('User inactive');
      }

      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        this.logger.warn(` LOGIN FAILED: Incorrect password for "${email}"`);
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(
        ` LOGIN SUCCESS: ${email} | Company: ${user.companyId || 'None'}`,
      );

      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.companyId,
        user.isActive,
      );

      return {
        ...tokens,
        user: this.formatUser(user),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Login error for ${email}: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  //  VALIDATE USER
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      return this.formatUser(user);
    }
    return null;
  }

  //  UPDATE PROFILE
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const { name, email } = updateProfileDto;

    if (email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('This email is already in use');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
    });

    this.logger.log(`Profile updated: ${updatedUser.email}`);
    return { user: this.formatUser(updatedUser) };
  }

  //  CHANGE PASSWORD
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    this.logger.log(`Password changed: ${user.email}`);
    return { message: 'Password changed successfully' };
  }

  //  UPLOAD AVATAR
  async uploadAvatar(userId: string, file: MulterFile) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${userId}-${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (user?.avatarUrl) {
      const oldAvatarPath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    const avatarUrl = `/uploads/avatars/${fileName}`;
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl } as any,
    });

    this.logger.log(`Avatar updated: ${updatedUser.email}`);
    return { user: this.formatUser(updatedUser) };
  }

  //  REFRESH TOKEN
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      // Verify the refresh token
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_SECRET || 'replace-with-a-secure-random-secret',
      });

      // Check if refresh token exists and is not revoked
      const tokens = await (this.prisma as any).refreshToken.findMany({
        where: {
          userId: payload.sub,
          revoked: false,
          expiresAt: { gt: new Date() },
        },
      });

      let validToken = false;
      for (const t of tokens) {
        if (await bcrypt.compare(refreshToken, t.tokenHash)) {
          validToken = true;
          // Revoke the used refresh token
          await (this.prisma as any).refreshToken.update({
            where: { id: t.id },
            data: { revoked: true },
          });
        }
      }

      if (!validToken) {
        throw new UnauthorizedException('Refresh token inválido ou expirado');
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { company: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found ou inactive');
      }

      // Generate new tokens
      const newTokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.companyId,
        user.isActive,
      );

      return {
        ...newTokens,
        user: this.formatUser(user),
      };
    } catch (error) {
      this.logger.error('Error renewing token:', error.message);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  //  REMOVE AVATAR
  async removeAvatar(userId: string) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
    })) as any;

    if (user?.avatarUrl) {
      const avatarPath = path.join(process.cwd(), user.avatarUrl);
      if (fs.existsSync(avatarPath)) {
        fs.unlinkSync(avatarPath);
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null } as any,
    });

    this.logger.log(`Avatar removed: ${updatedUser.email}`);
    return { user: this.formatUser(updatedUser) };
  }

  //  PRIVATE METHODS
  private async generateTokens(
    userId: string,
    email: string,
    role: Role,
    companyId: string | null,
    isActive: boolean,
  ) {
    const payload = { sub: userId, email, role, companyId, isActive };

    const token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'replace-with-a-secure-random-secret',
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'replace-with-a-secure-random-secret',
      expiresIn: '30d',
      jwtid: randomUUID(),
    });

    // Persist refresh token (hashed) for revocation support
    try {
      const hash = await bcrypt.hash(refreshToken, 10);
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      await (this.prisma as any).refreshToken.create({
        data: {
          tokenHash: hash,
          userId,
          expiresAt,
        },
      });
    } catch (err) {
      this.logger.error('Error saving refresh token', err?.message || err);
    }

    return { token, refreshToken };
  }

  // Revoke a refresh token (find by comparing hashes)
  async revokeRefreshToken(refreshToken: string) {
    const tokens = await (this.prisma as any).refreshToken.findMany({
      where: { revoked: false },
    });
    let revoked = false;
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        await (this.prisma as any).refreshToken.update({
          where: { id: t.id },
          data: { revoked: true },
        });
        revoked = true;
      }
    }
    return { revoked };
  }

  private formatUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId ?? null,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl ?? null,
    };
  }
}
