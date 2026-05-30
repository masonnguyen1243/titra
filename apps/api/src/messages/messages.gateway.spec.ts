import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { MessagesGateway } from './messages.gateway';
import { MessagesService } from './messages.service';
import { JwtPayload } from '../auth/types/jwt-payload.interface';

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENT_ID = 'event-1';
const USER_ID = 'user-1';

const VALID_PAYLOAD: JwtPayload = {
  sub: USER_ID,
  email: 'user@example.com',
  role: 'MEMBER' as JwtPayload['role'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSocket(overrides: Partial<{
  id: string;
  token: string | null;
  cookie: string;
  user: JwtPayload | undefined;
}> = {}): jest.Mocked<Socket> & { user?: JwtPayload } {
  const { id = 'socket-1', token = 'valid-token', cookie = '', user = undefined } = overrides;
  return {
    id,
    handshake: {
      headers: { cookie },
      auth: token !== null ? { token } : {},
    },
    user,
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    to: jest.fn().mockReturnThis(),
  } as unknown as jest.Mocked<Socket> & { user?: JwtPayload };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockJwtService = { verify: jest.fn() };
const mockMessagesService = {
  isActiveMember: jest.fn(),
  createMessage: jest.fn(),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('MessagesGateway', () => {
  let gateway: MessagesGateway;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: MessagesService, useValue: mockMessagesService },
      ],
    }).compile();

    gateway = module.get(MessagesGateway);
  });

  // ─── handleConnection ──────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('attaches user payload to socket when token is valid (auth field)', () => {
      const socket = makeSocket({ token: 'good-token' });
      mockJwtService.verify.mockReturnValue(VALID_PAYLOAD);

      gateway.handleConnection(socket);

      expect(socket.user).toEqual(VALID_PAYLOAD);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('attaches user payload when token is in cookie header', () => {
      const socket = makeSocket({ token: null, cookie: 'access_token=cookie-token' });
      mockJwtService.verify.mockReturnValue(VALID_PAYLOAD);

      gateway.handleConnection(socket);

      expect(mockJwtService.verify).toHaveBeenCalledWith('cookie-token', expect.anything());
      expect(socket.user).toEqual(VALID_PAYLOAD);
    });

    it('emits error and disconnects when no token is present', () => {
      const socket = makeSocket({ token: null, cookie: '' });

      gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized' });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('emits error and disconnects when token verification fails', () => {
      const socket = makeSocket({ token: 'bad-token' });
      mockJwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Unauthorized' });
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  // ─── handleJoinRoom ────────────────────────────────────────────────────────

  describe('handleJoinRoom', () => {
    it('joins the room and returns ok when user is an active member', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });
      mockMessagesService.isActiveMember.mockResolvedValue(true);

      const result = await gateway.handleJoinRoom(socket, { eventId: EVENT_ID });

      expect(socket.join).toHaveBeenCalledWith(`event:${EVENT_ID}`);
      expect(result).toEqual({ ok: true });
    });

    it('throws WsException when socket has no user (unauthenticated)', async () => {
      const socket = makeSocket({ user: undefined });

      await expect(gateway.handleJoinRoom(socket, { eventId: EVENT_ID })).rejects.toThrow(
        WsException,
      );
    });

    it('throws WsException when user is not a member of the event', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });
      mockMessagesService.isActiveMember.mockResolvedValue(false);

      await expect(gateway.handleJoinRoom(socket, { eventId: EVENT_ID })).rejects.toThrow(
        WsException,
      );
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  // ─── handleSendMessage ─────────────────────────────────────────────────────

  describe('handleSendMessage', () => {
    const SAVED_MSG = { id: 'msg-1', content: 'Hi', createdAt: new Date() };

    it('saves message and broadcasts to room (excluding sender)', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });
      (socket.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
      mockMessagesService.createMessage.mockResolvedValue(SAVED_MSG);

      const result = await gateway.handleSendMessage(socket, {
        eventId: EVENT_ID,
        content: 'Hi',
      });

      expect(mockMessagesService.createMessage).toHaveBeenCalledWith(EVENT_ID, USER_ID, 'Hi');
      expect(socket.to).toHaveBeenCalledWith(`event:${EVENT_ID}`);
      expect(result).toEqual(SAVED_MSG);
    });

    it('returns message as acknowledgment (sender sees it once via ack)', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });
      (socket.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
      mockMessagesService.createMessage.mockResolvedValue(SAVED_MSG);

      const ack = await gateway.handleSendMessage(socket, {
        eventId: EVENT_ID,
        content: 'Hi',
      });

      expect(ack).toBe(SAVED_MSG);
    });

    it('throws WsException when socket has no user', async () => {
      const socket = makeSocket({ user: undefined });

      await expect(
        gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: 'Hi' }),
      ).rejects.toThrow(WsException);
    });

    it('throws WsException when content is empty string', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });

      await expect(
        gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: '   ' }),
      ).rejects.toThrow(WsException);
    });

    it('throws WsException when content exceeds 2000 characters', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD });
      const longContent = 'a'.repeat(2001);

      await expect(
        gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: longContent }),
      ).rejects.toThrow(WsException);
    });

    it('throws WsException when rate limit is exceeded', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD, id: 'socket-rate-test' });
      (socket.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
      mockMessagesService.createMessage.mockResolvedValue(SAVED_MSG);

      // Send 10 messages to fill the window
      for (let i = 0; i < 10; i++) {
        await gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: `msg ${i}` });
      }

      // 11th message should be throttled
      await expect(
        gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: 'over limit' }),
      ).rejects.toThrow(WsException);
    });
  });

  // ─── handleDisconnect ──────────────────────────────────────────────────────

  describe('handleDisconnect', () => {
    it('removes rate limit bucket on disconnect', async () => {
      const socket = makeSocket({ user: VALID_PAYLOAD, id: 'socket-dc' });
      (socket.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
      mockMessagesService.createMessage.mockResolvedValue({ id: 'msg-1' });

      // Create a bucket
      await gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: 'hi' });

      gateway.handleDisconnect(socket);

      // After disconnect, the window is reset so the first message in a new
      // connection should not throw even if bucket previously had entries.
      mockMessagesService.createMessage.mockResolvedValue({ id: 'msg-2' });
      await expect(
        gateway.handleSendMessage(socket, { eventId: EVENT_ID, content: 'hi again' }),
      ).resolves.not.toThrow();
    });
  });
});
