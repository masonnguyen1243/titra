'use client';

import Link from 'next/link';
import { Users, Calendar, MapPin } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { EventCardsSkeleton } from '@/components/ui/skeletons';
import { useEvents, type EventType } from '@/lib/hooks/use-events';

const TYPE_LABELS: Record<EventType, string> = {
  TRIP: 'Chuyến đi',
  MEAL: 'Bữa ăn',
  OTHER: 'Khác',
};

export default function DashboardPage() {
  const { data: events, isLoading, isError } = useEvents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chuyến đi của tôi</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý chi tiêu cho các chuyến đi và bữa ăn nhóm.
          </p>
        </div>
        <Button asChild>
          <Link href="/events/new">Tạo chuyến đi</Link>
        </Button>
      </div>

      {isLoading && <EventCardsSkeleton count={3} />}

      {isError && (
        <EmptyState
          icon={MapPin}
          title="Không thể tải danh sách chuyến đi"
          description="Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại."
          bordered
        >
          <Button variant="outline" onClick={() => window.location.reload()}>
            Thử lại
          </Button>
        </EmptyState>
      )}

      {!isLoading && !isError && events?.length === 0 && (
        <EmptyState
          icon={MapPin}
          title="Bạn chưa có chuyến đi nào"
          description="Tạo chuyến đi đầu tiên và mời bạn bè cùng theo dõi chi tiêu."
          bordered
        >
          <Button asChild>
            <Link href="/events/new">Tạo chuyến đi đầu tiên</Link>
          </Button>
        </EmptyState>
      )}

      {!isLoading && !isError && events && events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{event.name}</CardTitle>
                  <StatusBadge status={event.status} className="shrink-0" />
                </div>
                {event.description && (
                  <CardDescription>{event.description}</CardDescription>
                )}
              </CardHeader>

              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {event._count.members} thành viên
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(event.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </CardContent>

              <CardFooter className="flex items-center justify-between pt-0">
                <Badge variant="outline">{TYPE_LABELS[event.type]}</Badge>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/events/${event.id}`}>Xem chi tiết →</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
