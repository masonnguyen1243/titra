'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useResendVerification } from '@/lib/hooks/use-auth';
import { ApiError } from '@/lib/api';

/**
 * Inner component that reads the pending email from sessionStorage.
 *
 * The email is stored by register/page.tsx before navigating here so that
 * it never appears as a URL query param — keeping it out of browser history,
 * server access logs, and Referer headers.
 *
 * Wrapped in <Suspense> by the default export so the skeleton is shown during
 * the brief client-side navigation render before the effect fires.
 */
function CheckEmailContent() {
  const [email, setEmail] = useState('');

  useEffect(() => {
    const stored = sessionStorage.getItem('pendingVerificationEmail') ?? '';
    if (stored) setEmail(stored);
    // The key is intentionally kept in sessionStorage (not cleared here) so
    // that the "Gửi lại email" button can still work if the component
    // re-mounts. sessionStorage is ephemeral — it expires when the tab closes.
  }, []);

  const { mutate: resend, isPending } = useResendVerification();

  function handleResend() {
    if (!email) return;
    resend(email, {
      onSuccess: () => {
        toast.success('Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư đến.');
      },
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : 'Đã xảy ra lỗi, vui lòng thử lại';
        toast.error(message);
      },
    });
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl">
          ✉️
        </div>
        <CardTitle>Kiểm tra email của bạn</CardTitle>
        <CardDescription>
          {email ? (
            <>
              Chúng tôi đã gửi một liên kết xác thực đến{' '}
              <span className="font-medium text-foreground">{email}</span>. Vui lòng kiểm tra
              hộp thư đến (và thư mục spam nếu không thấy).
            </>
          ) : (
            'Chúng tôi đã gửi một liên kết xác thực đến email của bạn. Vui lòng kiểm tra hộp thư đến (và thư mục spam nếu không thấy).'
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Liên kết sẽ hết hạn sau <span className="font-medium text-foreground">24 giờ</span>.
        </p>
        {email ? (
          <Button
            className="w-full"
            variant="outline"
            onClick={handleResend}
            disabled={isPending}
          >
            {isPending ? 'Đang gửi…' : 'Gửi lại email xác thực'}
          </Button>
        ) : (
          <Button className="w-full" variant="outline" asChild>
            <Link href="/register">Quay lại đăng ký</Link>
          </Button>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Nhớ mật khẩu rồi?{' '}
          <Link href="/login" className="text-foreground font-medium hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

/** Skeleton shown while the Suspense boundary resolves during client-side navigation. */
function CheckEmailSkeleton() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl">
          ✉️
        </div>
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-3/4 mx-auto mt-1" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-56 mx-auto" />
        <Skeleton className="h-9 w-full" />
      </CardContent>
      <CardFooter className="justify-center">
        <Skeleton className="h-4 w-40" />
      </CardFooter>
    </Card>
  );
}

export default function CheckEmailPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
        <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
      </div>

      <Suspense fallback={<CheckEmailSkeleton />}>
        <CheckEmailContent />
      </Suspense>
    </div>
  );
}
