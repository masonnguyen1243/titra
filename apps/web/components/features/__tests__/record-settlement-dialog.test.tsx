import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RecordSettlementDialog from '../record-settlement-dialog';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/hooks/use-upload', () => ({
  useCloudinaryUpload: () => ({
    mutateAsync: vi.fn().mockResolvedValue('https://example.com/proof.jpg'),
  }),
}));

const MEMBERS = [
  { id: 'm1', name: 'An' },
  { id: 'm2', name: 'Bình' },
];

describe('RecordSettlementDialog — formTouched + error derivation', () => {
  let onAdd: ReturnType<typeof vi.fn>;
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAdd = vi.fn().mockResolvedValue(undefined);
    onOpenChange = vi.fn();
  });

  function renderDialog(props: Partial<React.ComponentProps<typeof RecordSettlementDialog>> = {}) {
    render(
      <RecordSettlementDialog
        open={true}
        onOpenChange={onOpenChange}
        members={MEMBERS}
        onAdd={onAdd}
        {...props}
      />,
    );
  }

  it('shows no validation errors before the first submit attempt', () => {
    renderDialog();
    expect(screen.queryByText('Số tiền phải lớn hơn 0')).not.toBeInTheDocument();
    expect(screen.queryByText('Vui lòng chọn hình thức thanh toán')).not.toBeInTheDocument();
  });

  it('shows amount error after submitting with amount 0', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Ghi nhận' }));
    expect(screen.getByText('Số tiền phải lớn hơn 0')).toBeInTheDocument();
  });

  it('does not call onAdd when the form is invalid', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Ghi nhận' }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows same-person error immediately when payer and recipient are the same', async () => {
    const user = userEvent.setup();
    renderDialog();
    // Select "An" as recipient (she is already the payer by default)
    const recipientButtons = screen.getAllByRole('button', { name: 'An' });
    // The second "An" button is in the "Trả cho" section
    await user.click(recipientButtons[recipientButtons.length - 1]);
    expect(
      screen.getByText('Người trả và người nhận không được giống nhau.'),
    ).toBeInTheDocument();
  });

  it('calls onAdd with the correct payload when the form is valid', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Số tiền/), '50000');
    await user.click(screen.getByRole('button', { name: 'Ghi nhận' }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        fromMemberId: 'm1',
        toMemberId: 'm2',
        amount: 50000,
        method: 'MOMO',
      }),
    );
  });
});
