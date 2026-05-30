'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Users, CalendarDays, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useAdminStats,
  useAdminUsers,
  useAdminEvents,
  useUpdateUserStatus,
  useArchiveEvent,
  adminKeys,
} from '@/lib/hooks/use-admin';

type PendingAction =
  | { type: 'deactivate'; userId: string; name: string; isActive: boolean }
  | { type: 'archive'; eventId: string; name: string };

const PAGE_SIZE = 20;

function formatVND(amount: number): string {
  return Math.round(amount).toLocaleString('vi-VN') + ' ₫';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          {Array.from({ length: cols - 1 }).map((__, j) => (
            <Skeleton key={j} className="h-6 w-20 rounded-full" />
          ))}
          <Skeleton className="h-8 w-24 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [userPage, setUserPage] = useState(1);
  const [eventPage, setEventPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading, isError: statsError } = useAdminStats();
  const { data: usersData, isLoading: usersLoading, isError: usersError } = useAdminUsers({ page: userPage, limit: PAGE_SIZE });
  const { data: eventsData, isLoading: eventsLoading, isError: eventsError } = useAdminEvents({ page: eventPage, limit: PAGE_SIZE });

  const updateUserStatus = useUpdateUserStatus();
  const archiveEvent = useArchiveEvent();

  const isConfirming = updateUserStatus.isPending || archiveEvent.isPending;

  async function confirmAction() {
    if (!pending) return;
    try {
      if (pending.type === 'deactivate') {
        await updateUserStatus.mutateAsync({
          id: pending.userId,
          payload: { isActive: !pending.isActive },
        });
        toast.success(pending.isActive ? 'Đã vô hiệu hoá tài khoản' : 'Đã kích hoạt tài khoản');
      } else {
        await archiveEvent.mutateAsync(pending.eventId);
        toast.success('Đã lưu trữ sự kiện');
      }
      setPending(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : pending.type === 'deactivate'
            ? 'Không thể cập nhật trạng thái'
            : 'Không thể lưu trữ sự kiện';
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị</h1>
        <p className="text-sm text-muted-foreground mt-1">Tổng quan hệ thống Titra</p>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : statsError ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <p className="text-sm text-destructive">Không thể tải thống kê. Vui lòng thử lại.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void qc.invalidateQueries({ queryKey: adminKeys.stats() })}
          >
            Thử lại
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng người dùng
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalUsers ?? 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng sự kiện
              </CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{stats?.totalEvents ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.activeEvents ?? 0} đang hoạt động · {stats?.archivedEvents ?? 0} đã lưu trữ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tổng VNĐ theo dõi
              </CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{formatVND(stats?.totalVnd ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">Trên tất cả sự kiện</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Người dùng</h2>
          {usersData && (
            <span className="text-sm text-muted-foreground">{usersData.total} tài khoản</span>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          {usersLoading ? (
            <TableSkeleton cols={4} />
          ) : usersError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <p className="text-sm text-destructive">Không thể tải danh sách người dùng. Vui lòng thử lại.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void qc.invalidateQueries({ queryKey: adminKeys.users({ page: userPage, limit: PAGE_SIZE }) })}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vai trò</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Ngày đăng ký
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(usersData?.items ?? []).map((user) => {
                  const isActing =
                    updateUserStatus.isPending && updateUserStatus.variables?.id === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                          {user.role === 'ADMIN' ? 'Quản trị' : 'Người dùng'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                          {user.isActive ? 'Hoạt động' : 'Đã vô hiệu'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.role !== 'ADMIN' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isActing}
                            onClick={() =>
                              setPending({
                                type: 'deactivate',
                                userId: user.id,
                                name: user.name,
                                isActive: user.isActive,
                              })
                            }
                            className={
                              user.isActive
                                ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                                : ''
                            }
                          >
                            {isActing ? '…' : user.isActive ? 'Vô hiệu hoá' : 'Kích hoạt'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {usersData && usersData.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">
              Trang {usersData.page} / {usersData.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={userPage <= 1}
              onClick={() => setUserPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={userPage >= usersData.totalPages}
              onClick={() => setUserPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Events table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sự kiện</h2>
          {eventsData && (
            <span className="text-sm text-muted-foreground">{eventsData.total} sự kiện</span>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden">
          {eventsLoading ? (
            <TableSkeleton cols={3} />
          ) : eventsError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <p className="text-sm text-destructive">Không thể tải danh sách sự kiện. Vui lòng thử lại.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void qc.invalidateQueries({ queryKey: adminKeys.events({ page: eventPage, limit: PAGE_SIZE }) })}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Tên sự kiện
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Trạng thái
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Thành viên
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {(eventsData?.items ?? []).map((event) => {
                  const isArchiving =
                    archiveEvent.isPending && archiveEvent.variables === event.id;
                  return (
                    <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{event.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Ban tổ chức: {event.organizer.name}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={event.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {event._count.members} người
                      </td>
                      <td className="px-4 py-3 text-right">
                        {event.status !== 'ARCHIVED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isArchiving}
                            onClick={() =>
                              setPending({ type: 'archive', eventId: event.id, name: event.name })
                            }
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            {isArchiving ? '…' : 'Lưu trữ'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {eventsData && eventsData.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">
              Trang {eventsData.page} / {eventsData.totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={eventPage <= 1}
              onClick={() => setEventPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={eventPage >= eventsData.totalPages}
              onClick={() => setEventPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.type === 'deactivate'
                ? pending.isActive
                  ? 'Vô hiệu hoá tài khoản'
                  : 'Kích hoạt tài khoản'
                : 'Lưu trữ sự kiện'}
            </DialogTitle>
            <DialogDescription>
              {pending?.type === 'deactivate'
                ? pending.isActive
                  ? `Tài khoản của ${pending.name} sẽ bị khoá ngay lập tức và tất cả phiên đăng nhập sẽ bị thu hồi. Bạn có chắc chắn không?`
                  : `Tài khoản của ${pending.name} sẽ được kích hoạt trở lại. Bạn có chắc chắn không?`
                : `Sự kiện "${pending?.name}" sẽ được chuyển sang trạng thái Đã lưu trữ và không thể chỉnh sửa thêm. Bạn có chắc chắn không?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isConfirming} onClick={() => setPending(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={isConfirming}
              onClick={() => void confirmAction()}
            >
              {isConfirming ? '…' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
