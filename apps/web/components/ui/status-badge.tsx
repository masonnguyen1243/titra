import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type AppStatus =
  | 'ACTIVE'
  | 'SETTLED'
  | 'ARCHIVED'
  | 'PENDING'
  | 'CONFIRMED'
  | 'INACTIVE';

const STATUS_CONFIG: Record<
  AppStatus,
  {
    label: string;
    variant: 'success' | 'warning' | 'secondary' | 'outline' | 'destructive';
    icon?: React.ElementType;
  }
> = {
  ACTIVE: { label: 'Đang diễn ra', variant: 'success' },
  SETTLED: { label: 'Đã huề', variant: 'outline' },
  ARCHIVED: { label: 'Đã lưu trữ', variant: 'secondary' },
  PENDING: { label: 'Chờ xác nhận', variant: 'warning', icon: Clock },
  CONFIRMED: { label: 'Đã xác nhận', variant: 'success', icon: CheckCircle2 },
  INACTIVE: { label: 'Đã vô hiệu', variant: 'destructive' },
};

interface StatusBadgeProps {
  status: AppStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, variant, icon: Icon } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className={cn(Icon && 'gap-1', className)}>
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
}
