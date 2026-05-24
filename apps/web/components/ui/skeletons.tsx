import { Skeleton } from './skeleton';

export function EventCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-xl border p-6">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20 shrink-0" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ExpenseListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="divide-y rounded-lg border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BalanceSkeleton({ memberCount = 4 }: { memberCount?: number }) {
  return (
    <div className="space-y-6">
      <section>
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: memberCount }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Skeleton className="h-3 w-24 mb-3" />
        <div className="divide-y rounded-lg border">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-4" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function SettlementListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="divide-y rounded-lg border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24 shrink-0" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div
      className="flex flex-col gap-0 rounded-lg border overflow-hidden"
      style={{ height: 'calc(100vh - 22rem)' }}
    >
      <div className="flex-1 overflow-hidden p-4 space-y-4">
        {/* Incoming message */}
        <div className="flex gap-2.5">
          <Skeleton className="h-7 w-7 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-56 rounded-2xl rounded-tl-sm" />
          </div>
        </div>
        {/* Outgoing message */}
        <div className="flex flex-row-reverse gap-2.5">
          <div className="space-y-0.5 items-end flex flex-col">
            <Skeleton className="h-9 w-44 rounded-2xl rounded-tr-sm" />
          </div>
        </div>
        {/* Incoming message */}
        <div className="flex gap-2.5">
          <Skeleton className="h-7 w-7 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-1">
            <Skeleton className="h-9 w-72 rounded-2xl rounded-tl-sm" />
          </div>
        </div>
        {/* Outgoing message */}
        <div className="flex flex-row-reverse gap-2.5">
          <div className="space-y-0.5 items-end flex flex-col">
            <Skeleton className="h-9 w-60 rounded-2xl rounded-tr-sm" />
          </div>
        </div>
        {/* Incoming */}
        <div className="flex gap-2.5">
          <Skeleton className="h-7 w-7 rounded-full shrink-0 mt-0.5" />
          <div className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-9 w-48 rounded-2xl rounded-tl-sm" />
          </div>
        </div>
      </div>
      <div className="border-t px-3 py-2.5 flex items-center gap-2 bg-background shrink-0">
        <Skeleton className="flex-1 h-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md shrink-0" />
      </div>
    </div>
  );
}

export function AdminStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  {j === 0 ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                  ) : j === cols - 1 ? (
                    <div className="flex justify-end">
                      <Skeleton className="h-8 w-20" />
                    </div>
                  ) : (
                    <Skeleton className="h-5 w-20" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
