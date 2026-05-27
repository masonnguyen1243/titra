'use client';

import { use } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, ArrowRight, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBalances, balanceKeys } from '@/lib/hooks/use-balances';

function formatVND(amount: number): string {
  return Math.round(amount).toLocaleString('vi-VN') + ' ₫';
}

function BalancesSkeleton() {
  return (
    <div className="space-y-6">
      <section>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </section>

      <section>
        <Skeleton className="h-4 w-28 mb-3" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function BalancesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading, isError } = useBalances(id);

  if (isLoading) {
    return <BalancesSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-sm text-destructive">
          Không thể tải dữ liệu số dư. Vui lòng thử lại.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void qc.invalidateQueries({ queryKey: balanceKeys.detail(id) })}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  const members = data?.members ?? [];
  const settlements = data?.settlements ?? [];
  const allSettled = settlements.length === 0;

  return (
    <div className="space-y-6">
      {/* Per-member net balances */}
      {members.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Số dư từng người
          </h2>
          <div className="divide-y rounded-lg border">
            {members.map((member) => {
              const balance = member.net;
              const isPositive = balance > 0;
              const isNegative = balance < 0;

              return (
                <div
                  key={member.memberId}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar name={member.nickname} size="md" />
                    <span className="text-sm font-medium">{member.nickname}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPositive && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
                    {isNegative && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                    {!isPositive && !isNegative && (
                      <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums',
                        isPositive && 'text-emerald-600',
                        isNegative && 'text-red-500',
                        !isPositive && !isNegative && 'text-muted-foreground',
                      )}
                    >
                      {isPositive ? '+' : ''}
                      {formatVND(balance)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Simplified settlement suggestions */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Ai cần trả ai
        </h2>

        {allSettled ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <PartyPopper className="h-10 w-10 text-emerald-500" />
            <p className="font-medium">Mọi người đã huề cả làng 🎉</p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {settlements.map((t, i) => (
              <div
                key={`${t.fromMemberId}-${t.toMemberId}-${i}`}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <span className="font-medium truncate">{t.fromNickname}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{t.toNickname}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {formatVND(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
