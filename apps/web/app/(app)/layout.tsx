import { Separator } from '@/components/ui/separator';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b flex items-center px-6 gap-4 shrink-0">
        <span className="font-semibold text-lg tracking-tight">Titra</span>
        <Separator orientation="vertical" className="h-5" />
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <a href="/dashboard" className="hover:text-foreground transition-colors">
            Chuyến đi
          </a>
          <a href="/admin" className="hover:text-foreground transition-colors">
            Quản trị
          </a>
        </nav>
      </header>
      <main className="flex-1 container max-w-5xl mx-auto py-8 px-4">{children}</main>
    </div>
  );
}
