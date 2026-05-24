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

type EventType = 'TRIP' | 'MEAL' | 'OTHER';
type EventStatus = 'ACTIVE' | 'SETTLED' | 'ARCHIVED';

interface EventCard {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  memberCount: number;
  description?: string;
  date: string;
}

const MOCK_EVENTS: EventCard[] = [
  {
    id: '1',
    name: 'Đà Lạt Weekend',
    type: 'TRIP',
    status: 'ACTIVE',
    memberCount: 6,
    description: 'Chuyến đi Đà Lạt 3 ngày 2 đêm',
    date: '2026-05-20',
  },
  {
    id: '2',
    name: 'Tất niên 2025',
    type: 'MEAL',
    status: 'SETTLED',
    memberCount: 12,
    description: 'Bữa tất niên cùng team',
    date: '2026-01-15',
  },
  {
    id: '3',
    name: 'Phú Quốc',
    type: 'TRIP',
    status: 'ARCHIVED',
    memberCount: 4,
    description: 'Nghỉ hè Phú Quốc',
    date: '2025-08-10',
  },
];

const TYPE_LABELS: Record<EventType, string> = {
  TRIP: 'Chuyến đi',
  MEAL: 'Bữa ăn',
  OTHER: 'Khác',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  ACTIVE: 'Đang diễn ra',
  SETTLED: 'Đã huề',
  ARCHIVED: 'Đã lưu trữ',
};

const STATUS_VARIANTS: Record<EventStatus, 'success' | 'warning' | 'secondary'> = {
  ACTIVE: 'success',
  SETTLED: 'warning',
  ARCHIVED: 'secondary',
};

export default function DashboardPage() {
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

      {MOCK_EVENTS.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold">Bạn chưa có chuyến đi nào</h2>
          <p className="text-muted-foreground text-sm mt-1 mb-6">
            Tạo chuyến đi đầu tiên và mời bạn bè cùng theo dõi chi tiêu.
          </p>
          <Button asChild>
            <Link href="/events/new">Tạo chuyến đi đầu tiên</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_EVENTS.map((event) => (
            <Card key={event.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{event.name}</CardTitle>
                  <Badge variant={STATUS_VARIANTS[event.status]} className="shrink-0">
                    {STATUS_LABELS[event.status]}
                  </Badge>
                </div>
                {event.description && <CardDescription>{event.description}</CardDescription>}
              </CardHeader>

              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {event.memberCount} thành viên
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(event.date).toLocaleDateString('vi-VN')}
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
