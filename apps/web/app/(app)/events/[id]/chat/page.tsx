'use client';

import { use, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string; // ISO datetime
}

// "Minh Anh" is the simulated current user for event 1; "Lan" for event 2.
const CURRENT_USER: Record<string, string> = {
  '1': 'Minh Anh',
  '2': 'Lan',
};

const SEED_MESSAGES: Record<string, Message[]> = {
  '1': [
    { id: 'msg1', sender: 'Hùng', text: 'Mọi người ơi, đặt khách sạn chưa?', timestamp: '2025-03-14T08:12:00' },
    { id: 'msg2', sender: 'Minh Anh', text: 'Đặt rồi nha, Ana Mandara 2 đêm 😊', timestamp: '2025-03-14T08:15:00' },
    { id: 'msg3', sender: 'Linh', text: 'Oke bạn ơi, mình đặt xe máy nhé?', timestamp: '2025-03-14T08:20:00' },
    { id: 'msg4', sender: 'Minh Anh', text: 'Thuê luôn đi, tiện hơn taxi nhiều', timestamp: '2025-03-14T08:22:00' },
    { id: 'msg5', sender: 'Tuấn', text: 'Sáng thứ 6 mọi người khởi hành lúc mấy giờ?', timestamp: '2025-03-15T07:00:00' },
    { id: 'msg6', sender: 'Hùng', text: 'Mình đề xuất 6h sáng nha, để kịp ăn sáng Đà Lạt', timestamp: '2025-03-15T07:05:00' },
    { id: 'msg7', sender: 'Minh Anh', text: 'Ổn, 6h mình có mặt 👌', timestamp: '2025-03-15T07:08:00' },
  ],
  '2': [
    { id: 'msg8', sender: 'Lan', text: 'Đặt bàn nhà hàng Hoa Sen lúc 7h tối nha mọi người', timestamp: '2025-01-19T14:00:00' },
    { id: 'msg9', sender: 'Dũng', text: 'Được bạn ơi, mình sẽ đến đúng giờ', timestamp: '2025-01-19T14:10:00' },
    { id: 'msg10', sender: 'Nam', text: 'Mình mang theo vợ được không?', timestamp: '2025-01-19T14:15:00' },
    { id: 'msg11', sender: 'Lan', text: 'Dĩ nhiên rồi, nhớ báo thêm người để đặt bàn lớn hơn nha', timestamp: '2025-01-19T14:18:00' },
  ],
};

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

let nextId = 200;

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [messages, setMessages] = useState<Message[]>(SEED_MESSAGES[id] ?? []);
  const [draft, setDraft] = useState('');
  const currentUser = CURRENT_USER[id] ?? 'Bạn';
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `new-${++nextId}`,
        sender: currentUser,
        text,
        timestamp: new Date().toISOString(),
      },
    ]);
    setDraft('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col gap-0 rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 22rem)' }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="font-medium text-sm">Chưa có tin nhắn nào</p>
              <p className="text-muted-foreground text-sm">Hãy là người đầu tiên nhắn gì đó!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = msg.sender === currentUser;
            const prev = messages[i - 1];
            const showDateSep = !prev || !isSameDay(prev.timestamp, msg.timestamp);
            const showSender = !isMe && (!prev || prev.sender !== msg.sender || showDateSep);

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDateLabel(msg.timestamp)}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div className={cn('flex gap-2.5 mt-1', isMe && 'flex-row-reverse')}>
                  {/* Avatar — only for others, only when sender changes */}
                  {!isMe && (
                    <div
                      className={cn(
                        'h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold shrink-0 mt-0.5',
                        !showSender && 'invisible',
                      )}
                    >
                      {msg.sender.charAt(0)}
                    </div>
                  )}

                  <div className={cn('max-w-[72%] space-y-0.5', isMe && 'items-end flex flex-col')}>
                    {showSender && (
                      <p className="text-xs text-muted-foreground px-1">{msg.sender}</p>
                    )}
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                        isMe
                          ? 'bg-foreground text-background rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm',
                      )}
                    >
                      {msg.text}
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 px-1">
                      {formatTime(msg.timestamp)}
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
          onClick={handleSend}
          disabled={!draft.trim()}
          aria-label="Gửi"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
