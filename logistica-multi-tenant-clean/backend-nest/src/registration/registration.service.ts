import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { getJwtSecret } from '../config/jwt-secret';

interface RegisterCompanyDto {
  companyName: string;
  companyNif: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: string;
  userName: string;
  userEmail: string;
  userPassword: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async registerCompanyAndUser(data: RegisterCompanyDto) {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('📝 Starting company + user registration');
    this.logger.log(`🏢 Company: ${data.companyName}`);
    this.logger.log(`👤 User: ${data.userName} (${data.userEmail})`);

    // Log to check if Prisma is connected
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      this.logger.log('✓ Prisma connected successfully');
    } catch (err: any) {
      this.logger.error('❌ ERROR: Prisma is not connected!');
      this.logger.error('Error:', err.message);
      throw new InternalServerErrorException('Database connection error');
    }

    // 1. VALIDATIONS

    this.logger.log('[Registration] Validating data...');

    if (!data.companyName || !data.companyNif || !data.companyEmail) {
      throw new BadRequestException('Company data incomplete');
    }

    if (!data.userName || !data.userEmail || !data.userPassword) {
      throw new BadRequestException('User data incomplete');
    }

    if (data.userPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // 2. CHECK IF COMPANY ALREADY EXISTS

    this.logger.log('[Registration] Checking if company already exists...');

    const existingCompany = await this.prisma.company.findFirst({
      where: {
        OR: [{ nif: data.companyNif }, { email: data.companyEmail }],
      },
    });

    if (existingCompany) {
      if (existingCompany.nif === data.companyNif) {
        this.logger.error(`❌ NIF ${data.companyNif} is already in use`);
        throw new ConflictException('A company with this NIF already exists');
      }
      if (existingCompany.email === data.companyEmail) {
        this.logger.error(`❌ Email ${data.companyEmail} is already in use`);
        throw new ConflictException('A company with this email already exists');
      }
    }

    // 3. CHECK IF USER ALREADY EXISTS

    this.logger.log('[Registration] Checking if user already exists...');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.userEmail },
    });

    if (existingUser) {
      this.logger.error(`❌ User email ${data.userEmail} is already in use`);
      throw new ConflictException('This email is already in use');
    }

    // 4. HASH PASSWORD

    this.logger.log('🔒 Generating password hash...');
    const hashedPassword = await bcrypt.hash(data.userPassword, 10);

    try {
      // 5. CREATE COMPANY AND USER (TRANSACTION)

      this.logger.log('🔄 Starting transaction...');
      const result = await this.prisma.$transaction(async (tx) => {
        this.logger.log('📍 INSIDE TRANSACTION - started');

        // 5.1 Create company
        this.logger.log('📍 Creating company...');
        const company = await tx.company.create({
          data: {
            name: data.companyName,
            nif: data.companyNif,
            email: data.companyEmail,
            phone: data.companyPhone || null,
            address: data.companyAddress || null,
            isActive: true,
          },
        });

        this.logger.log(`✓ Company created: ${company.id} - ${company.name}`);

        // 5.2 Create ADMIN user
        this.logger.log('👤 Creating admin user...');
        const user = await tx.user.create({
          data: {
            name: data.userName,
            email: data.userEmail,
            password: hashedPassword,
            role: Role.ADMIN,
            companyId: company.id,
            isActive: true,
          },
        });

        this.logger.log(`✓ User created: ${user.id} - ${user.name} (ADMIN)`);
        this.logger.log(`   Email stored: ${user.email}`);
        this.logger.log(`   isActive: ${user.isActive}`);

        // 5.3 Create default Settings
        this.logger.log('⚙️ Creating default Settings...');
        await tx.settings.create({
          data: {
            companyId: company.id,
            taxRate: 0.23, // Default IVA PT
          },
        });

        this.logger.log('✓ Settings created');
        this.logger.log('📍 INSIDE TRANSACTION - finalizing...');

        return { company, user };
      });

      this.logger.log('📍 TRANSACTION COMPLETED SUCCESSFULLY');

      // 6. VERIFY USER WAS CREATED

      this.logger.log(
        '[Registration] Verifying if user was really created in database...',
      );
      const userInDb = await this.prisma.user.findUnique({
        where: { email: result.user.email },
      });

      if (!userInDb) {
        this.logger.error(
          '❌ CRITICAL: User NOT found in database after transaction!',
        );
        this.logger.error(`   Email searched: ${result.user.email}`);
        throw new InternalServerErrorException(
          'Verification failed: user was not created',
        );
      }

      this.logger.log('✓ Verification OK - user exists in database');

      // 7. GENERATE JWT TOKENS

      this.logger.log('🔑 Generating JWT tokens...');
      const tokens = await this.generateTokens(
        result.user.id,
        result.user.email,
        result.user.role,
      );

      this.logger.log('✓ Tokens generated successfully');
      this.logger.log('✓ REGISTRATION COMPLETE!');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // 8. RETURN RESPONSE

      const responseData = {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          companyId: result.user.companyId,
          companyName: result.company.name,
          isActive: result.user.isActive,
        },
      };

      this.logger.log('📤 Responding to client with:');
      this.logger.log(`   - Token: ${tokens.token.substring(0, 20)}...`);
      this.logger.log(`   - User Email: ${responseData.user.email}`);
      this.logger.log(`   - User ID: ${responseData.user.id}`);
      this.logger.log(`   - Company ID: ${responseData.user.companyId}`);

      return responseData;
    } catch (error) {
      this.logger.error('❌ Error creating company and user:', error.message);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(
        'Error processing registration. Please try again.',
      );
    }
  }

  // MÉTODO AUXILIAR: GERAR TOKENS

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload = {
      sub: userId,
      email,
      role,
    };

    const token = await this.jwtService.signAsync(payload, {
      secret: getJwtSecret(),
      expiresIn: '7d',
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: getJwtSecret(),
      expiresIn: '30d',
    });

    return { token, refreshToken };
  }
}
