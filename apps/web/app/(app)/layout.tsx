import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { LogoutButton } from '@/components/features/logout-button';
import { cookies } from 'next/headers';

async function getRoleFromAccessToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('access_token')?.value;
    if (!token) return null;
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    const payload = JSON.parse(
      Buffer.from(payloadBase64, 'base64url').toString('utf-8'),
    ) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRoleFromAccessToken();
  const isAdmin = role === 'ADMIN';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b flex items-center px-6 gap-4 shrink-0">
        <span className="font-semibold text-lg tracking-tight">Titra</span>
        <Separator orientation="vertical" className="h-5" />
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground transition-colors">
            Chuyến đi
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-foreground transition-colors">
              Quản trị
            </Link>
          )}
        </nav>
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 container max-w-5xl mx-auto py-8 px-4">{children}</main>
    </div>
  );
}
