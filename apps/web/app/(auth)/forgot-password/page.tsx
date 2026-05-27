'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForgotPassword } from '@/lib/hooks/use-auth';
import { ApiError } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { mutate: forgotPassword, isPending } = useForgotPassword();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    forgotPassword(email, {
      onSuccess: () => {
        setSubmitted(true);
      },
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : 'Đã xảy ra lỗi, vui lòng thử lại';
        toast.error(message);
      },
    });
  }

  function handleResend() {
    forgotPassword(email, {
      onSuccess: () => {
        toast.success('Đã gửi lại email đặt lại mật khẩu.');
      },
      onError: (err) => {
        const message =
          err instanceof ApiError ? err.message : 'Đã xảy ra lỗi, vui lòng thử lại';
        toast.error(message);
      },
    });
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
          <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-3xl">
              ✉️
            </div>
            <CardTitle>Kiểm tra email của bạn</CardTitle>
            <CardDescription>
              Chúng tôi đã gửi liên kết đặt lại mật khẩu đến{' '}
              <span className="font-medium text-foreground">{email}</span>. Vui lòng kiểm tra hộp
              thư đến (và thư mục spam nếu không thấy).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-center text-sm text-muted-foreground">
              Liên kết sẽ hết hạn sau <span className="font-medium text-foreground">1 giờ</span>.
            </p>
            <Button
              className="w-full"
              variant="outline"
              onClick={handleResend}
              disabled={isPending}
            >
              {isPending ? 'Đang gửi…' : 'Gửi lại email'}
            </Button>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Titra</h1>
        <p className="text-sm text-muted-foreground mt-1">Chia tiền thông minh cho nhóm bạn</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quên mật khẩu</CardTitle>
          <CardDescription>
            Nhập email của bạn để nhận liên kết đặt lại mật khẩu
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="ban@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending ? 'Đang gửi…' : 'Gửi liên kết đặt lại mật khẩu'}
            </Button>
          </form>
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
    </div>
  );
}
