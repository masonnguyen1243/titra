'use client';

import { use } from 'react';
import Link from 'next/link';
import { Users, MapPin, Utensils, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

// Placeholder — replaced with real API call when Phase 4 connects the frontend
const MOCK_EVENT = {
  name: 'Đà Lạt Weekend',
  type: 'TRIP',
  description: 'Chuyến đi Đà Lạt 3 ngày 2 đêm',
  memberCount: 6,
};

export default function JoinEventPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const TypeIcon = TYPE_ICONS[MOCK_EVENT.type] ?? MoreHorizontal;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
          <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TypeIcon className="h-4 w-4" />
              {TYPE_LABELS[MOCK_EVENT.type]}
            </div>
            <CardTitle>{MOCK_EVENT.name}</CardTitle>
            {MOCK_EVENT.description && (
              <CardDescription>{MOCK_EVENT.description}</CardDescription>
            )}
          </CardHeader>

          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{MOCK_EVENT.memberCount} thành viên đã tham gia</span>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link href={`/login?redirect=/join/${token}`}>Tham gia sự kiện</Link>
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Bạn cần đăng nhập để tham gia. Nếu chưa có tài khoản,{' '}
              <Link href={`/register?redirect=/join/${token}`} className="underline underline-offset-2">
                đăng ký miễn phí
              </Link>
              .
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
