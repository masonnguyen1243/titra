'use client';

import { Suspense, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVerifyEmail } from '@/lib/hooks/use-auth';
import { ApiError } from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { mutate: verify, isPending, isSuccess, isError, error } = useVerifyEmail();
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;
    verify(token, {
      onSuccess: () => {
        setTimeout(() => router.push('/login'), 1500);
      },
    });
  }, [token, verify, router]);

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle>Liên kết không hợp lệ</CardTitle>
          <CardDescription>
            Liên kết xác thực này không hợp lệ. Vui lòng yêu cầu gửi lại email xác thực.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href="/check-email">Gửi lại email xác thực</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (isPending || (!isSuccess && !isError)) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <CardTitle>Đang xác thực…</CardTitle>
          <CardDescription>Vui lòng chờ trong giây lát.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle>Email đã được xác thực!</CardTitle>
          <CardDescription>
            Tài khoản của bạn đã sẵn sàng. Đang chuyển bạn đến trang đăng nhập…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const message =
    error instanceof ApiError ? error.message : 'Đã xảy ra lỗi, vui lòng thử lại';
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <CardTitle>Xác thực thất bại</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/check-email">Gửi lại email xác thực</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
        <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
      </div>
      <Suspense>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
