'use client';

import { use, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Copy, Link2, UserX } from 'lucide-react';

type MemberRole = 'ORGANIZER' | 'MEMBER' | 'GUEST';

interface EventMember {
  id: string;
  name: string;
  email?: string;
  role: MemberRole;
}

// Simulated current user per event
const CURRENT_USER_ID: Record<string, string> = {
  '1': 'm1', // Minh Anh is the organizer
  '2': 'm1', // Lan is the organizer
};

const MOCK_MEMBERS: Record<string, EventMember[]> = {
  '1': [
    { id: 'm1', name: 'Minh Anh', email: 'minhanh@example.com', role: 'ORGANIZER' },
    { id: 'm2', name: 'Hùng', email: 'hung@example.com', role: 'MEMBER' },
    { id: 'm3', name: 'Linh', email: 'linh@example.com', role: 'MEMBER' },
    { id: 'm4', name: 'Tuấn', email: 'tuan@example.com', role: 'MEMBER' },
    { id: 'm5', name: 'An', role: 'GUEST' },
    { id: 'm6', name: 'Ngọc', role: 'GUEST' },
  ],
  '2': [
    { id: 'm1', name: 'Lan', email: 'lan@example.com', role: 'ORGANIZER' },
    { id: 'm2', name: 'Dũng', email: 'dung@example.com', role: 'MEMBER' },
    { id: 'm3', name: 'Nam', email: 'nam@example.com', role: 'MEMBER' },
    { id: 'm4', name: 'Phương', email: 'phuong@example.com', role: 'MEMBER' },
    { id: 'm5', name: 'Hà', email: 'ha@example.com', role: 'MEMBER' },
    { id: 'm6', name: 'Khoa', role: 'GUEST' },
    { id: 'm7', name: 'Thắng', role: 'GUEST' },
  ],
};

const DEFAULT_MEMBERS: EventMember[] = [
  { id: 'u1', name: 'Bạn', role: 'ORGANIZER' },
];

const INVITE_TOKENS: Record<string, string> = {
  '1': 'inv_1a2b3c4d5e6f',
  '2': 'inv_9z8y7x6w5v4u',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  ORGANIZER: 'Ban tổ chức',
  MEMBER: 'Thành viên',
  GUEST: 'Khách',
};

const ROLE_VARIANTS: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  ORGANIZER: 'default',
  MEMBER: 'secondary',
  GUEST: 'outline',
};

export default function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [members, setMembers] = useState<EventMember[]>(MOCK_MEMBERS[id] ?? DEFAULT_MEMBERS);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    const token = INVITE_TOKENS[id] ?? 'inv_demo';
    setInviteUrl(`${window.location.origin}/join/${token}`);
  }, [id]);

  const currentUserId = CURRENT_USER_ID[id] ?? members[0]?.id;
  const currentMember = members.find((m) => m.id === currentUserId);
  const isOrganizer = currentMember?.role === 'ORGANIZER';

  const confirmTarget = members.find((m) => m.id === confirmId);

  function handleCopy() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleRemoveConfirmed() {
    if (!confirmId) return;
    setMembers((prev) => prev.filter((m) => m.id !== confirmId));
    setConfirmId(null);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Link mời tham gia</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono truncate">
              {inviteUrl || '…'}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? (
                <Check className="h-4 w-4 mr-1.5 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 mr-1.5" />
              )}
              {copied ? 'Đã sao chép' : 'Sao chép'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{members.length} thành viên</p>

        <div className="divide-y rounded-lg border">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            const canRemove = isOrganizer && !isSelf && member.role !== 'ORGANIZER';

            return (
              <div key={member.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={member.name} size="lg" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {member.name}
                        {isSelf && (
                          <span className="text-muted-foreground font-normal"> (bạn)</span>
                        )}
                      </span>
                      <Badge variant={ROLE_VARIANTS[member.role]} className="text-xs">
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </div>
                    {member.email && (
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    )}
                  </div>
                </div>

                {canRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setConfirmId(member.id)}
                  >
                    <UserX className="h-4 w-4 mr-1.5" />
                    Xoá
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá thành viên</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn xoá{' '}
            <span className="font-semibold text-foreground">{confirmTarget?.name}</span> khỏi sự
            kiện? Các chi phí đã ghi nhận của họ vẫn được giữ lại và tính vào số dư.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleRemoveConfirmed}>
              Xoá thành viên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
