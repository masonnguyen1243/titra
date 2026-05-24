import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
}

export function CurrencyDisplay({ amount, className }: CurrencyDisplayProps) {
  const formatted = amount.toLocaleString('vi-VN') + ' ₫';
  return <span className={cn('tabular-nums', className)}>{formatted}</span>;
}
