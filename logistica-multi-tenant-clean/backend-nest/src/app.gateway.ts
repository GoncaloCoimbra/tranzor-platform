import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './database/prisma.service';

export const COMPANY_ROOM_PREFIX = 'company:';

export type AppGatewayEvent =
  | 'stock:updated'
  | 'stock:reservation-created'
  | 'stock:reservation-confirmed'
  | 'stock:reservation-released'
  | 'stock:reservation-expired'
  | 'transport:created'
  | 'transport:updated'
  | 'transport:delivered';

export interface StockUpdatedPayload {
  companyId: string;
  productId: string;
  availableQuantity: number;
  timestamp: string;
}

export interface ReservationEventPayload {
  companyId: string;
  reservationId: string;
  productId: string;
  quantity: number;
  status: 'RESERVED' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';
  transportId?: string | null;
  timestamp: string;
}

export interface TransportCreatedPayload {
  companyId: string;
  transportId: string;
  status: string;
  timestamp: string;
}

export interface TransportStatusChangedPayload {
  companyId: string;
  transportId: string;
  previousStatus: string;
  status: string;
  timestamp: string;
}

export type AppGatewayPayload =
  | StockUpdatedPayload
  | ReservationEventPayload
  | TransportCreatedPayload
  | TransportStatusChangedPayload;

export interface SocketUser {
  userId: string;
  email: string;
  role: string;
  companyId: string | null;
}

const developmentCorsOrigins = [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3003',
];
const gatewayCorsOrigins = ['production', 'staging'].includes(
  process.env.NODE_ENV ?? '',
)
  ? (process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : developmentCorsOrigins;

@WebSocketGateway({
  cors: {
    origin: gatewayCorsOrigins,
    credentials: true,
  },
  path: '/ws',
})
@Injectable()
export class AppGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);

      if (!user.companyId) {
        throw new UnauthorizedException(
          'WebSocket connections require a company tenant.',
        );
      }

      const room = this.companyRoom(user.companyId);
      client.data.user = user;
      client.data.companyId = user.companyId;
      await client.join(room);

      this.logger.log(`Client ${client.id} joined tenant room ${room}`);
    } catch {
      this.logger.warn(`Rejected WebSocket connection ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitToCompany(
    companyId: string,
    event: AppGatewayEvent,
    payload: AppGatewayPayload,
  ): void {
    if (payload.companyId !== companyId) {
      throw new UnauthorizedException(
        'Event payload companyId does not match the target room.',
      );
    }

    this.server.to(this.companyRoom(companyId)).emit(event, payload);
  }

  companyRoom(companyId: string): string {
    return `${COMPANY_ROOM_PREFIX}${companyId}`;
  }

  private async authenticateSocket(client: Socket): Promise<SocketUser> {
    const token = this.extractToken(client);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new UnauthorizedException('JWT_SECRET is not configured.');
    }

    const payload = await this.jwtService.verifyAsync(token, {
      secret: jwtSecret,
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        companyId: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive.');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    const authorization = client.handshake.headers.authorization;
    const rawToken = authToken || authorization;

    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('WebSocket JWT is required.');
    }

    return rawToken.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length)
      : rawToken;
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): string {
    this.logger.log(`Message received from ${client.id}:`, data);
    return 'Hello from server!';
  }
}
