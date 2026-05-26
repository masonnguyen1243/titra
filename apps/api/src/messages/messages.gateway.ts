import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/types/jwt-payload.interface';
import { MessagesService } from './messages.service';

interface AuthSocket extends Socket {
  user?: JwtPayload;
}

/** Sliding-window rate limit state tracked per connected socket. */
interface RateLimitBucket {
  count: number;
  windowStart: number;
}

/** 10 messages per 10-second window per socket. */
const WS_RATE_LIMIT = { limit: 10, windowMs: 10_000 };

@WebSocketGateway({
  cors: {
    origin: process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly rateLimitMap = new Map<string, RateLimitBucket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly messagesService: MessagesService,
  ) {}

  handleConnection(socket: AuthSocket) {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? '';
      const cookieMatch = cookieHeader.match(/access_token=([^;]+)/);
      const token = cookieMatch?.[1] ?? (socket.handshake.auth?.token as string | undefined);

      if (!token) throw new Error('No token');

      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env['JWT_SECRET'],
      });
      socket.user = payload;
    } catch {
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthSocket) {
    this.rateLimitMap.delete(socket.id);
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { eventId: string },
  ) {
    if (!socket.user) throw new WsException('Unauthorized');
    const ok = await this.messagesService.isActiveMember(data.eventId, socket.user.sub);
    if (!ok) throw new WsException('Bạn không phải thành viên của sự kiện này');
    await socket.join(`event:${data.eventId}`);
    return { ok: true };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { eventId: string },
  ) {
    void socket.leave(`event:${data.eventId}`);
    return { ok: true };
  }

  private checkRateLimit(socketId: string) {
    const now = Date.now();
    const bucket = this.rateLimitMap.get(socketId);
    if (!bucket || now - bucket.windowStart >= WS_RATE_LIMIT.windowMs) {
      this.rateLimitMap.set(socketId, { count: 1, windowStart: now });
      return;
    }
    if (bucket.count >= WS_RATE_LIMIT.limit) {
      const retryAfter = Math.ceil((WS_RATE_LIMIT.windowMs - (now - bucket.windowStart)) / 1000);
      throw new WsException(
        `Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau ${retryAfter} giây.`,
      );
    }
    bucket.count += 1;
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { eventId: string; content: string },
  ) {
    if (!socket.user) throw new WsException('Unauthorized');
    this.checkRateLimit(socket.id);

    const content = typeof data.content === 'string' ? data.content.trim() : '';
    if (!content) throw new WsException('Nội dung tin nhắn không được để trống');
    if (content.length > 2000)
      throw new WsException('Nội dung tin nhắn không được vượt quá 2000 ký tự');

    const message = await this.messagesService.createMessage(
      data.eventId,
      socket.user.sub,
      content,
    );
    // Broadcast to the room excluding the sender — the sender receives the
    // message via the acknowledgment return value, so emitting to the full
    // room (this.server.to) would cause the sender to display it twice.
    socket.to(`event:${data.eventId}`).emit('newMessage', message);
    return message;
  }

  /** Called by the REST controller so clients on WebSocket still get the message. */
  broadcastMessage(eventId: string, message: unknown) {
    this.server.to(`event:${eventId}`).emit('newMessage', message);
  }
}
