'use client';

import { use } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Placeholder — replaced with real API call in Phase 4
const MOCK_EVENT_NAME = 'Đà Lạt Weekend';

export default function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  // token is consumed by the backend POST /invitations/:token/accept
  void use(params);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
          <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
        </div>

        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mb-2" />
            <CardTitle>Lời mời tham gia</CardTitle>
            <CardDescription>
              Bạn được mời tham gia sự kiện{' '}
              <span className="font-semibold text-foreground">{MOCK_EVENT_NAME}</span>.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-center text-sm text-muted-foreground">
            Nhấn nút bên dưới để chấp nhận lời mời và truy cập sự kiện. Lời mời có hiệu lực trong 48 giờ kể từ khi được gửi.
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full">Chấp nhận lời mời</Button>
            <Button variant="ghost" className="w-full" asChild>
              <Link href="/dashboard">Bỏ qua</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
