'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useLogout } from '@/lib/hooks/use-auth';

/**
 * Logout button rendered in the app shell header.
 * Calls POST /auth/logout, clears the TanStack Query cache (via useLogout),
 * then redirects to /login.
 */
export function LogoutButton() {
  const router = useRouter();
  const { mutate: logout, isPending } = useLogout();

  function handleLogout() {
    logout(undefined, {
      onSuccess: () => {
        router.push('/login');
      },
      onError: () => {
        // Even if the API call fails, clear local state and redirect —
        // the HttpOnly cookies will expire or be rejected by the API anyway.
        toast.error('Đã xảy ra lỗi khi đăng xuất, vui lòng thử lại.');
      },
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
      className="text-muted-foreground hover:text-foreground"
    >
      {isPending ? 'Đang đăng xuất…' : 'Đăng xuất'}
    </Button>
  );
}
