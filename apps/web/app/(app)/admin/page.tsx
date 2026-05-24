import { Users, CalendarDays, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCard {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
}

const STATS: StatCard[] = [
  {
    title: 'Tổng người dùng',
    value: '128',
    description: '+12 trong 30 ngày qua',
    icon: Users,
  },
  {
    title: 'Tổng sự kiện',
    value: '47',
    description: '32 đang hoạt động · 15 đã huề',
    icon: CalendarDays,
  },
  {
    title: 'Tổng VNĐ theo dõi',
    value: '12.450.000 ₫',
    description: 'Trên tất cả sự kiện',
    icon: Banknote,
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quản trị</h1>
        <p className="text-sm text-muted-foreground mt-1">Tổng quan hệ thống Titra</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
