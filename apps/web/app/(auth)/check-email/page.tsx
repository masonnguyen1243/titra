import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CheckEmailPage() {
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
            Chúng tôi đã gửi một liên kết đến email của bạn. Vui lòng kiểm tra hộp thư đến (và thư mục spam nếu không thấy).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Liên kết sẽ hết hạn sau <span className="font-medium text-foreground">15 phút</span>.
          </p>
          <Button className="w-full" variant="outline" asChild>
            <Link href="/forgot-password">Gửi lại email</Link>
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
