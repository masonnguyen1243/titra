'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { use } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Users, ArrowLeft } from 'lucide-react';

type EventType = 'TRIP' | 'MEAL' | 'OTHER';
type EventStatus = 'ACTIVE' | 'SETTLED' | 'ARCHIVED';

interface MockEvent {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  memberCount: number;
  description?: string;
}

const MOCK_EVENTS: Record<string, MockEvent> = {
  '1': {
    id: '1',
    name: 'Đà Lạt Weekend',
    type: 'TRIP',
    status: 'ACTIVE',
    memberCount: 6,
    description: 'Chuyến đi Đà Lạt 3 ngày 2 đêm',
  },
  '2': {
    id: '2',
    name: 'Tất niên 2025',
    type: 'MEAL',
    status: 'SETTLED',
    memberCount: 12,
    description: 'Bữa tất niên cùng team',
  },
  '3': {
    id: '3',
    name: 'Phú Quốc',
    type: 'TRIP',
    status: 'ARCHIVED',
    memberCount: 4,
    description: 'Nghỉ hè Phú Quốc',
  },
};

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

const TABS = [
  { label: 'Chi phí', segment: 'expenses' },
  { label: 'Số dư', segment: 'balances' },
  { label: 'Thanh toán', segment: 'settlements' },
  { label: 'Trò chuyện', segment: 'chat' },
  { label: 'Thành viên', segment: 'members' },
] as const;

export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const event = MOCK_EVENTS[id] ?? {
    id,
    name: `Chuyến đi #${id}`,
    type: 'OTHER' as EventType,
    status: 'ACTIVE' as EventStatus,
    memberCount: 0,
  };

  return (
    <div className="space-y-0">
      {/* Event header */}
      <div className="space-y-3 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Quay lại
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            {event.description && (
              <p className="text-muted-foreground text-sm">{event.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-0.5">
              <Users className="h-3.5 w-3.5" />
              {event.memberCount} thành viên
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline">{TYPE_LABELS[event.type]}</Badge>
            <Badge variant={STATUS_VARIANTS[event.status]}>{STATUS_LABELS[event.status]}</Badge>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <nav aria-label="Tab điều hướng sự kiện" className="-mb-px flex gap-0 overflow-x-auto">
          {TABS.map(({ label, segment }) => {
            const href = `/events/${id}/${segment}`;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={segment}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-6">{children}</div>
    </div>
  );
}
