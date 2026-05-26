'use client';

import { use, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface ApiMessage {
  id: string;
  content: string;
  createdAt: string;
  member: {
    id: string;
    nickname: string | null;
    user: { name: string; avatarUrl: string | null } | null;
  };
}

interface CurrentUser {
  id: string;
  name: string;
}

function senderName(msg: ApiMessage): string {
  return msg.member.user?.name ?? msg.member.nickname ?? 'Guest';
}

function mergeMessages(existing: ApiMessage[], incoming: ApiMessage[]): ApiMessage[] {
  const seen = new Set(existing.map((m) => m.id));
  const fresh = incoming.filter((m) => !seen.has(m.id));
  if (!fresh.length) return existing;
  return [...existing, ...fresh].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

async function apiFetchMessages(eventId: string): Promise<ApiMessage[]> {
  const res = await fetch(`${API}/api/v1/events/${eventId}/messages`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('fetch-failed');
  const data = (await res.json()) as { messages: ApiMessage[] };
  return data.messages;
}

async function apiPostMessage(eventId: string, content: string): Promise<ApiMessage> {
  const res = await fetch(`${API}/api/v1/events/${eventId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('send-failed');
  return res.json() as Promise<ApiMessage>;
}

async function apiGetMe(): Promise<CurrentUser> {
  const res = await fetch(`${API}/api/v1/users/me`, { credentials: 'include' });
  if (!res.ok) throw new Error('auth-failed');
  return res.json() as Promise<CurrentUser>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

type ConnectionStatus = 'connecting' | 'connected' | 'polling';

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch current user
  useEffect(() => {
    void apiGetMe()
      .then(setCurrentUser)
      .catch(() => {});
  }, []);

  // WebSocket + polling fallback
  useEffect(() => {
    let polling: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    function startPolling() {
      if (polling) return;
      if (mounted) setStatus('polling');
      polling = setInterval(() => {
        void apiFetchMessages(id)
          .then((msgs) => {
            if (mounted) setMessages((prev) => mergeMessages(prev, msgs));
          })
          .catch(() => {});
      }, 5000);
    }

    function stopPolling() {
      if (polling) {
        clearInterval(polling);
        polling = null;
      }
    }

    // Initial message load
    void apiFetchMessages(id)
      .then((msgs) => {
        if (mounted) setMessages(msgs);
      })
      .catch(() => {});

    // Attempt WebSocket connection
    const socket = io(API, {
      withCredentials: true,
      transports: ['websocket'],
      timeout: 5000,
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      if (!mounted) return;
      setStatus('connected');
      stopPolling();
      socket.emit('joinRoom', { eventId: id });
    });

    socket.on('connect_error', () => {
      if (!mounted || socket.connected) return;
      startPolling();
    });

    socket.on('disconnect', () => {
      if (!mounted) return;
      startPolling();
    });

    socket.on('newMessage', (msg: ApiMessage) => {
      if (!mounted) return;
      setMessages((prev) => mergeMessages(prev, [msg]));
    });

    // Hard timeout — if not connected within 5s, start polling
    const connectTimeout = setTimeout(() => {
      if (!socket.connected && mounted) startPolling();
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(connectTimeout);
      stopPolling();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id]);

  async function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('sendMessage', { eventId: id, content: text }, (msg: ApiMessage) => {
        setMessages((prev) => mergeMessages(prev, [msg]));
      });
    } else {
      try {
        const msg = await apiPostMessage(id, text);
        setMessages((prev) => mergeMessages(prev, [msg]));
      } catch {
        setDraft(text);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      className="flex flex-col gap-0 rounded-lg border overflow-hidden"
      style={{ height: 'calc(100vh - 22rem)' }}
    >
      {/* Polling banner */}
      {status === 'polling' && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-amber-50 border-b text-xs text-amber-700">
          <WifiOff className="h-3 w-3 shrink-0" />
          Không kết nối được WebSocket — đang tự động cập nhật mỗi 5 giây
        </div>
      )}
      {status === 'connecting' && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/50 border-b text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
          Đang kết nối…
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Chưa có tin nhắn nào"
            description="Hãy là người đầu tiên nhắn gì đó!"
            className="h-full py-0"
          />
        ) : (
          messages.map((msg, i) => {
            const isMe = !!currentUser && senderName(msg) === currentUser.name;
            const prev = messages[i - 1];
            const showDateSep = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const showSender =
              !isMe && (!prev || senderName(prev) !== senderName(msg) || showDateSep);

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDateLabel(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className={cn('flex gap-2.5 mt-1', isMe && 'flex-row-reverse')}>
                  {!isMe && (
                    <Avatar
                      name={senderName(msg)}
                      src={msg.member.user?.avatarUrl ?? undefined}
                      size="sm"
                      className={cn('mt-0.5', !showSender && 'invisible')}
                    />
                  )}

                  <div className={cn('max-w-[72%] space-y-0.5', isMe && 'items-end flex flex-col')}>
                    {showSender && (
                      <p className="text-xs text-muted-foreground px-1">{senderName(msg)}</p>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                        isMe
                          ? 'bg-foreground text-background rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm',
                      )}
                    >
                      {msg.content}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 px-1">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t px-3 py-2.5 flex items-center gap-2 bg-background shrink-0">
        <Input
          className="flex-1 h-9 text-sm"
          placeholder="Nhập tin nhắn…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => void handleSend()}
          disabled={!draft.trim()}
          aria-label="Gửi"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
