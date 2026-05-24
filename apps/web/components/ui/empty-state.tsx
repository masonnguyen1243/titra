import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  /** Wraps content in a rounded dashed-border box (used on the dashboard event list). */
  bordered?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  bordered = false,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-4',
        bordered ? 'rounded-xl border border-dashed py-20' : 'py-16',
        className,
      )}
    >
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="font-medium text-sm">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {children}
    </div>
  );
}
