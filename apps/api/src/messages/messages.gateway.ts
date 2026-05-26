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

@WebSocketGateway({
  cors: {
    origin: true, // reflect request origin; restrict via allowlist in production
    credentials: true,
  },
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

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

  handleDisconnect(_socket: AuthSocket) {
    // no-op — Socket.io cleans up rooms automatically on disconnect
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

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { eventId: string; content: string },
  ) {
    if (!socket.user) throw new WsException('Unauthorized');
    const message = await this.messagesService.createMessage(
      data.eventId,
      socket.user.sub,
      data.content,
    );
    this.server.to(`event:${data.eventId}`).emit('newMessage', message);
    return message;
  }

  /** Called by the REST controller so clients on WebSocket still get the message. */
  broadcastMessage(eventId: string, message: unknown) {
    this.server.to(`event:${eventId}`).emit('newMessage', message);
  }
}
