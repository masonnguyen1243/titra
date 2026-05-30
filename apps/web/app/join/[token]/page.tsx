'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, MapPin, Utensils, MoreHorizontal, LinkIcon, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

interface EventPreview {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
}

const TYPE_LABELS: Record<string, string> = {
  TRIP: 'Chuyến đi',
  MEAL: 'Bữa ăn',
  OTHER: 'Khác',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  TRIP: MapPin,
  MEAL: Utensils,
  OTHER: MoreHorizontal,
};

export default function JoinEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const { data: event, isLoading, isError, error } = useQuery({
    queryKey: ['join', token],
    queryFn: () => api.get<EventPreview>(`/join/${token}`),
    retry: false,
  });

  const joinMutation = useMutation({
    mutationFn: () => api.post<{ eventId: string }>(`/join/${token}`),
    onSuccess: (data) => {
      toast.success('Đã tham gia sự kiện!');
      router.push(`/events/${data.eventId}`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) return; // api.ts redirects to /login
      const msg = err instanceof ApiError ? err.message : 'Không thể tham gia. Vui lòng thử lại.';
      toast.error(msg);
    },
  });

  const TypeIcon = TYPE_ICONS[event?.type ?? 'OTHER'] ?? MoreHorizontal;

  const is404 = isError && error instanceof ApiError && error.status === 404;
  const isSettled = event?.status === 'SETTLED' || event?.status === 'ARCHIVED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
          <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
        </div>

        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-32" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        )}

        {isError && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-destructive mb-1">
                <AlertCircle className="h-5 w-5" />
                <CardTitle className="text-base">
                  {is404 ? 'Link mời không hợp lệ' : 'Có lỗi xảy ra'}
                </CardTitle>
              </div>
              <CardDescription>
                {is404
                  ? 'Link mời này đã hết hạn hoặc không tồn tại. Vui lòng yêu cầu người tổ chức gửi lại link mới.'
                  : 'Không thể tải thông tin sự kiện. Vui lòng thử lại sau.'}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3">
              <Button className="w-full" variant="outline" asChild>
                <Link href="/register">
                  Đăng ký tài khoản mới
                </Link>
              </Button>
              <Button className="w-full" variant="ghost" asChild>
                <Link href="/login">Đăng nhập</Link>
              </Button>
            </CardFooter>
          </Card>
        )}

        {event && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TypeIcon className="h-4 w-4" />
                {TYPE_LABELS[event.type] ?? event.type}
              </div>
              <CardTitle>{event.name}</CardTitle>
              {event.description && (
                <CardDescription>{event.description}</CardDescription>
              )}
            </CardHeader>

            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Sự kiện nhóm</span>
              </div>
              {isSettled && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                  Sự kiện này đã kết thúc — bạn có thể xem nhưng không thể thêm chi phí mới.
                </p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button
                className="w-full"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending || isSettled}
              >
                {joinMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang tham gia…
                  </>
                ) : isSettled ? (
                  'Sự kiện đã kết thúc'
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Tham gia sự kiện
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Bạn cần đăng nhập để tham gia. Nếu chưa có tài khoản,{' '}
                <Link
                  href="/register"
                  className="underline underline-offset-2"
                  onClick={() => sessionStorage.setItem('pendingJoinToken', token)}
                >
                  đăng ký miễn phí
                </Link>
                .
              </p>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
