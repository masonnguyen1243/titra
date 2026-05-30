import {
  Document,
  DocumentProps,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import React from 'react';
import { BalanceResult } from '../expenses/balance.service';

interface PdfExpense {
  description: string;
  amount: number;
  category: string | null;
  createdAt: Date;
  paidBy: { nickname: string } | null;
  splits: Array<{ amount: number; member: { nickname: string } }>;
}

interface PdfSettlement {
  amount: number;
  method: string;
  status: string;
  createdAt: Date;
  fromMember: { nickname: string };
  toMember: { nickname: string };
}

interface PdfEvent {
  name: string;
  description?: string | null;
  type: string;
  status: string;
  createdAt: Date;
  expenses: PdfExpense[];
  settlements: PdfSettlement[];
}

export interface PdfInput {
  event: PdfEvent;
  balances: BalanceResult;
}

const S = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#555', marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, fontFamily: 'Helvetica-Bold', color: '#444' },
  value: { flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', padding: 6, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '30%' },
  col2: { width: '20%' },
  col3: { width: '20%' },
  col4: { flex: 1, textAlign: 'right' },
  balancePos: { color: '#16a34a', fontFamily: 'Helvetica-Bold' },
  balanceNeg: { color: '#dc2626', fontFamily: 'Helvetica-Bold' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#aaa', textAlign: 'center' },
  noData: { color: '#888', fontStyle: 'italic' },
  splitRow: { flexDirection: 'row', paddingLeft: 12, paddingTop: 2, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#eee' },
  splitLabel: { width: 60, fontSize: 8, color: '#888', fontFamily: 'Helvetica-Bold' },
  splitValue: { flex: 1, fontSize: 8, color: '#555' },
});

function vnd(amount: number): string {
  return (Math.round(amount / 1000) * 1000).toLocaleString('vi-VN') + ' ₫';
}

function fmtDate(date: Date): string {
  return new Date(date).toLocaleDateString('vi-VN');
}

const SETTLEMENT_STATUS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
};

function fmtSettlementStatus(status: string): string {
  return SETTLEMENT_STATUS_VI[status] ?? status;
}

const el = React.createElement;

function buildDocument(input: PdfInput): React.ReactElement<DocumentProps> {
  const { event, balances } = input;
  const totalExpenses = event.expenses.reduce((s, e) => s + e.amount, 0);

  const expenseDates = event.expenses.map((e) => new Date(e.createdAt).getTime());
  const dateRangeText =
    expenseDates.length > 0
      ? `${fmtDate(new Date(Math.min(...expenseDates)))} – ${fmtDate(new Date(Math.max(...expenseDates)))}`
      : fmtDate(event.createdAt);

  return el(
    Document,
    { title: `Báo cáo: ${event.name}`, author: 'Titra' },
    el(
      Page,
      { size: 'A4', style: S.page },

      // Title
      el(Text, { style: S.title }, event.name),
      el(
        Text,
        { style: S.subtitle },
        `Khoảng thời gian: ${dateRangeText}  |  Loại: ${event.type}  |  Trạng thái: ${event.status}`,
      ),
      ...(event.description
        ? [
            el(
              View,
              { style: S.row },
              el(Text, { style: S.label }, 'Mô tả:'),
              el(Text, { style: S.value }, event.description),
            ),
          ]
        : []),

      // Summary
      el(Text, { style: S.sectionTitle }, 'Tóm tắt'),
      el(View, { style: S.row }, el(Text, { style: S.label }, 'Tổng chi phí:'), el(Text, { style: S.value }, vnd(totalExpenses))),
      el(View, { style: S.row }, el(Text, { style: S.label }, 'Số giao dịch:'), el(Text, { style: S.value }, String(event.expenses.length))),
      el(View, { style: S.row }, el(Text, { style: S.label }, 'Số thanh toán:'), el(Text, { style: S.value }, String(event.settlements.length))),

      // Expenses
      el(Text, { style: S.sectionTitle }, 'Danh sách chi phí'),
      el(
        View,
        { style: S.tableHeader },
        el(Text, { style: S.col1 }, 'Mô tả'),
        el(Text, { style: S.col2 }, 'Người trả'),
        el(Text, { style: S.col3 }, 'Ngày'),
        el(Text, { style: S.col4 }, 'Số tiền'),
      ),
      ...event.expenses.flatMap((exp, i) => [
        el(
          View,
          { key: String(i), style: S.tableRow },
          el(Text, { style: S.col1 }, exp.description),
          el(Text, { style: S.col2 }, exp.paidBy?.nickname ?? '—'),
          el(Text, { style: S.col3 }, fmtDate(exp.createdAt)),
          el(Text, { style: S.col4 }, vnd(exp.amount)),
        ),
        ...(exp.splits.length > 0
          ? [
              el(
                View,
                { key: `split-${i}`, style: S.splitRow },
                el(Text, { style: S.splitLabel }, 'Phân chia:'),
                el(
                  Text,
                  { style: S.splitValue },
                  exp.splits.map((s) => `${s.member.nickname}: ${vnd(s.amount)}`).join('  |  '),
                ),
              ),
            ]
          : []),
      ]),

      // Balances
      el(Text, { style: S.sectionTitle }, 'Số dư thành viên'),
      el(
        View,
        { style: S.tableHeader },
        el(Text, { style: { flex: 1 } }, 'Thành viên'),
        el(Text, { style: { width: '30%', textAlign: 'right' } }, 'Số dư ròng'),
      ),
      ...balances.members.map((m, i) =>
        el(
          View,
          { key: String(i), style: S.tableRow },
          el(Text, { style: { flex: 1 } }, m.nickname),
          el(Text, { style: { width: '30%', textAlign: 'right', ...(m.net >= 0 ? S.balancePos : S.balanceNeg) } }, `${m.net >= 0 ? '+' : ''}${vnd(m.net)}`),
        ),
      ),

      // Suggested settlements
      ...(balances.settlements.length > 0
        ? [
            el(Text, { style: S.sectionTitle }, 'Gợi ý thanh toán (tối giản)'),
            ...balances.settlements.map((s, i) =>
              el(
                View,
                { key: String(i), style: S.tableRow },
                el(Text, { style: { flex: 1 } }, `${s.fromNickname} → ${s.toNickname}`),
                el(Text, { style: { width: '30%', textAlign: 'right' } }, vnd(s.amount)),
              ),
            ),
          ]
        : []),

      // Settlement history
      el(Text, { style: S.sectionTitle }, 'Lịch sử thanh toán'),
      ...(event.settlements.length === 0
        ? [el(Text, { style: S.noData }, 'Chưa có thanh toán nào được ghi nhận.')]
        : [
            el(
              View,
              { style: S.tableHeader },
              el(Text, { style: S.col1 }, 'Người trả'),
              el(Text, { style: S.col1 }, 'Người nhận'),
              el(Text, { style: S.col2 }, 'Trạng thái'),
              el(Text, { style: S.col4 }, 'Số tiền'),
            ),
            ...event.settlements.map((s, i) =>
              el(
                View,
                { key: String(i), style: S.tableRow },
                el(Text, { style: S.col1 }, s.fromMember.nickname),
                el(Text, { style: S.col1 }, s.toMember.nickname),
                el(Text, { style: S.col2 }, fmtSettlementStatus(s.status)),
                el(Text, { style: S.col4 }, vnd(s.amount)),
              ),
            ),
          ]),

      el(
        Text,
        { style: S.footer },
        `Báo cáo được tạo bởi Titra  •  ${new Date().toLocaleString('vi-VN')}`,
      ),
    ),
  );
}

export async function generateEventPdf(input: PdfInput): Promise<Buffer> {
  const doc = buildDocument(input);
  const pdfBuffer = await renderToBuffer(doc);
  return Buffer.from(pdfBuffer);
}
