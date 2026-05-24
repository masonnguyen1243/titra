'use client';

import { useState } from 'react';
import { Users, CalendarDays, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';

type UserRole = 'ADMIN' | 'USER';
type UserStatus = 'ACTIVE' | 'INACTIVE';
type EventStatus = 'ACTIVE' | 'SETTLED' | 'ARCHIVED';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  registeredAt: string;
}

interface AdminEvent {
  id: string;
  name: string;
  organizerName: string;
  status: EventStatus;
  memberCount: number;
}

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

const MOCK_USERS: AdminUser[] = [
  { id: 'u1', name: 'Nguyễn Minh Anh', email: 'minhanh@example.com', role: 'ADMIN', status: 'ACTIVE', registeredAt: '2026-01-10' },
  { id: 'u2', name: 'Trần Văn Hùng', email: 'hung@example.com', role: 'USER', status: 'ACTIVE', registeredAt: '2026-02-14' },
  { id: 'u3', name: 'Phạm Thị Linh', email: 'linh@example.com', role: 'USER', status: 'ACTIVE', registeredAt: '2026-03-01' },
  { id: 'u4', name: 'Lê Quốc Tuấn', email: 'tuan@example.com', role: 'USER', status: 'INACTIVE', registeredAt: '2026-03-22' },
  { id: 'u5', name: 'Võ Thị Lan', email: 'lan@example.com', role: 'USER', status: 'ACTIVE', registeredAt: '2026-04-05' },
  { id: 'u6', name: 'Đặng Văn Dũng', email: 'dung@example.com', role: 'USER', status: 'ACTIVE', registeredAt: '2026-04-18' },
];

const MOCK_EVENTS: AdminEvent[] = [
  { id: 'e1', name: 'Đà Lạt Weekend', organizerName: 'Nguyễn Minh Anh', status: 'ACTIVE', memberCount: 6 },
  { id: 'e2', name: 'Tất niên 2025', organizerName: 'Võ Thị Lan', status: 'SETTLED', memberCount: 12 },
  { id: 'e3', name: 'Phú Quốc hè 2026', organizerName: 'Trần Văn Hùng', status: 'ACTIVE', memberCount: 8 },
  { id: 'e4', name: 'Sinh nhật Minh', organizerName: 'Phạm Thị Linh', status: 'ARCHIVED', memberCount: 5 },
  { id: 'e5', name: 'Team building Q1', organizerName: 'Đặng Văn Dũng', status: 'ACTIVE', memberCount: 20 },
];


function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>(MOCK_USERS);
  const [events, setEvents] = useState<AdminEvent[]>(MOCK_EVENTS);

  function toggleStatus(id: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : u,
      ),
    );
  }

  function archiveEvent(id: string) {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'ARCHIVED' as EventStatus } : e)),
    );
  }

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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Người dùng</h2>
          <span className="text-sm text-muted-foreground">{users.length} tài khoản</span>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vai trò</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ngày đăng ký</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                      {user.role === 'ADMIN' ? 'Quản trị' : 'Người dùng'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={user.status === 'ACTIVE' ? 'outline' : 'destructive'}>
                      {user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã vô hiệu'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatDate(user.registeredAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.role !== 'ADMIN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(user.id)}
                        className={
                          user.status === 'ACTIVE'
                            ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                            : ''
                        }
                      >
                        {user.status === 'ACTIVE' ? 'Vô hiệu hoá' : 'Kích hoạt'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sự kiện</h2>
          <span className="text-sm text-muted-foreground">{events.length} sự kiện</span>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tên sự kiện</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Thành viên</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{event.name}</p>
                    <p className="text-xs text-muted-foreground">Ban tổ chức: {event.organizerName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={event.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {event.memberCount} người
                  </td>
                  <td className="px-4 py-3 text-right">
                    {event.status !== 'ARCHIVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveEvent(event.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Lưu trữ
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
