'use client';

import { use, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Check, Copy, Link2, UserX } from 'lucide-react';
import {
  useEventDetail,
  useInviteLink,
  useRemoveMember,
  type MemberRole,
} from '@/lib/hooks/use-events';
import { useMe } from '@/lib/hooks/use-user';

const ROLE_LABELS: Record<MemberRole, string> = {
  ORGANIZER: 'Ban tổ chức',
  MEMBER: 'Thành viên',
};

const ROLE_VARIANTS: Record<MemberRole, 'default' | 'secondary'> = {
  ORGANIZER: 'default',
  MEMBER: 'secondary',
};

export default function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: event, isLoading, isError } = useEventDetail(id);
  const { data: me } = useMe();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Determine current user's role in this event
  const myMember = event?.members.find((m) => m.userId !== null && m.userId === me?.id);
  const isOrganizer = myMember?.role === 'ORGANIZER';

  // Invite link is only accessible to organizers (backend enforces 403 for non-organizers)
  const { data: inviteData, isLoading: isInviteLoading } = useInviteLink(isOrganizer ? id : '');

  const { mutate: removeMember, isPending: isRemoving } = useRemoveMember(id);

  const members = event?.members ?? [];
  const confirmTarget = members.find((m) => m.id === confirmId);

  function handleCopy() {
    const url = inviteData?.inviteLink;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error('Không thể sao chép liên kết. Vui lòng sao chép thủ công.');
    });
  }

  function handleRemoveConfirmed() {
    if (!confirmId) return;
    removeMember(confirmId, {
      onSuccess: () => {
        toast.success('Đã xoá thành viên.');
        setConfirmId(null);
      },
      onError: () => {
        toast.error('Không thể xoá thành viên. Vui lòng thử lại.');
        setConfirmId(null);
      },
    });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Invite link — only visible to organizer */}
        {isOrganizer && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Link mời tham gia</p>
            </div>
            <div className="flex items-center gap-2">
              {isInviteLoading ? (
                <Skeleton className="flex-1 h-9 rounded-md" />
              ) : (
                <div className="flex-1 min-w-0 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono truncate">
                  {inviteData?.inviteLink ?? '—'}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={isInviteLoading || !inviteData?.inviteLink}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 mr-1.5 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 mr-1.5" />
                )}
                {copied ? 'Đã sao chép' : 'Sao chép'}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="divide-y rounded-lg border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Không thể tải danh sách thành viên. Vui lòng thử tải lại trang.</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{members.length} thành viên</p>

            <div className="divide-y rounded-lg border">
              {members.map((member) => {
                const isGuest = member.userId === null;
                const isSelf = !isGuest && member.userId === me?.id;
                const canRemove = isOrganizer && !isSelf && member.role !== 'ORGANIZER';

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={member.nickname} size="lg" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {member.nickname}
                            {isSelf && (
                              <span className="text-muted-foreground font-normal"> (bạn)</span>
                            )}
                          </span>
                          {isGuest ? (
                            <Badge variant="outline" className="text-xs">
                              Khách
                            </Badge>
                          ) : (
                            <Badge variant={ROLE_VARIANTS[member.role]} className="text-xs">
                              {ROLE_LABELS[member.role]}
                            </Badge>
                          )}
                        </div>
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
          </>
        )}
      </div>

      <Dialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá thành viên</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Bạn có chắc muốn xoá{' '}
            <span className="font-semibold text-foreground">{confirmTarget?.nickname}</span> khỏi
            sự kiện? Các chi phí đã ghi nhận của họ vẫn được giữ lại và tính vào số dư.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmId(null)}
              disabled={isRemoving}
            >
              Huỷ
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveConfirmed}
              disabled={isRemoving}
            >
              {isRemoving ? 'Đang xoá…' : 'Xoá thành viên'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
