import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);
  private readonly apiKeyPrefix = 'sk_';
  private readonly lastUsedUpdateThresholdMinutes = 5;

  constructor(private readonly prisma: PrismaService) {}

  generateApiKey(companyId: string, name: string, prefix = this.apiKeyPrefix) {
    const randomBytesValue = randomBytes(32).toString('hex');
    const plainKey = `${prefix}${randomBytesValue}`;
    const keyHash = this.hashApiKey(plainKey);

    return this.prisma.apiKey
      .create({
        data: {
          companyId,
          name,
          prefix,
          keyHash,
        },
        select: {
          id: true,
          companyId: true,
          name: true,
          prefix: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      })
      .then((apiKey) => ({
        ...apiKey,
        plainKey,
      }));
  }

  async validateApiKey(apiKey: string): Promise<{ companyId: string } | null> {
    if (!apiKey || typeof apiKey !== 'string') {
      return null;
    }

    const keyHash = this.hashApiKey(apiKey);

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        id: true,
        companyId: true,
        revokedAt: true,
        lastUsedAt: true,
      },
    });

    if (!apiKeyRecord || apiKeyRecord.revokedAt) {
      return null;
    }

    await this.updateLastUsedAtIfNeeded(
      apiKeyRecord.id,
      apiKeyRecord.lastUsedAt,
    );

    return {
      companyId: apiKeyRecord.companyId,
    };
  }

  async revokeApiKey(id: string, companyId: string) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id, companyId },
      select: { id: true },
    });

    if (!apiKey) {
      throw new NotFoundException(
        'API key not found for this company or it has already been revoked.',
      );
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private hashApiKey(apiKey: string) {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private async updateLastUsedAtIfNeeded(
    id: string,
    lastUsedAt: Date | null,
  ): Promise<void> {
    const now = new Date();
    const threshold = this.lastUsedUpdateThresholdMinutes * 60 * 1000;

    if (!lastUsedAt) {
      await this.prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: now },
      });
      return;
    }

    if (now.getTime() - lastUsedAt.getTime() >= threshold) {
      await this.prisma.apiKey.update({
        where: { id },
        data: { lastUsedAt: now },
      });
    }
  }
}
