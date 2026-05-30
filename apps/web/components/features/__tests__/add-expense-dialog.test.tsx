import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddExpenseDialog from '../add-expense-dialog';

// Focus on validation logic; avoid portal/animation complexity
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Render both tab panels (no switching needed for EQUAL-mode tests)
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Upload hook is not under test here
vi.mock('@/lib/hooks/use-upload', () => ({
  useCloudinaryUpload: () => ({
    mutateAsync: vi.fn().mockResolvedValue('https://example.com/receipt.jpg'),
  }),
}));

const MEMBERS = [
  { id: 'm1', name: 'An' },
  { id: 'm2', name: 'Bình' },
];

describe('AddExpenseDialog — formTouched + error derivation', () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn().mockResolvedValue(undefined);
    onOpenChange = vi.fn();
  });

  function renderDialog(props: Partial<React.ComponentProps<typeof AddExpenseDialog>> = {}) {
    render(
      <AddExpenseDialog
        open={true}
        onOpenChange={onOpenChange}
        members={MEMBERS}
        onSubmit={onSubmit}
        {...props}
      />,
    );
  }

  it('shows no validation errors before the first submit attempt', () => {
    renderDialog();
    expect(screen.queryByText('Vui lòng nhập mô tả chi phí')).not.toBeInTheDocument();
    expect(screen.queryByText('Số tiền phải lớn hơn 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Chọn ít nhất một thành viên')).not.toBeInTheDocument();
  });

  it('shows description error after submitting with empty description', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(screen.getByText('Vui lòng nhập mô tả chi phí')).toBeInTheDocument();
  });

  it('shows amount error after submitting with description but no amount', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Mô tả/), 'Bữa tối');
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(screen.getByText('Số tiền phải lớn hơn 0')).toBeInTheDocument();
  });

  it('shows equal-split error when all member checkboxes are unchecked', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Uncheck all member checkboxes (EQUAL mode is the default)
    for (const cb of screen.getAllByRole('checkbox')) {
      await user.click(cb);
    }
    await user.type(screen.getByLabelText(/Mô tả/), 'Bữa tối');
    await user.type(screen.getByLabelText(/Số tiền/), '50000');
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(screen.getByText('Chọn ít nhất một thành viên')).toBeInTheDocument();
  });

  it('does not call onSubmit when the form is invalid', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with the correct payload when the form is valid', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Mô tả/), 'Bữa tối');
    await user.type(screen.getByLabelText(/Số tiền/), '100000');
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Bữa tối',
        amount: 100000,
        splitType: 'EQUAL',
        paidById: 'm1',
      }),
    );
  });

  it('shows submit error inline when onSubmit rejects', async () => {
    const user = userEvent.setup();
    onSubmit = vi.fn().mockRejectedValue(new Error('Lỗi mạng'));
    renderDialog();
    await user.type(screen.getByLabelText(/Mô tả/), 'Bữa tối');
    await user.type(screen.getByLabelText(/Số tiền/), '100000');
    await user.click(screen.getByRole('button', { name: 'Thêm chi phí' }));
    expect(await screen.findByText('Lỗi mạng')).toBeInTheDocument();
  });
});
