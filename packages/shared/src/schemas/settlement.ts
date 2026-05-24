import { z } from 'zod';

export const SettlementMethodSchema = z.enum(['MOMO', 'VNPAY', 'CASH', 'OTHER']);
export type SettlementMethod = z.infer<typeof SettlementMethodSchema>;

export const SettlementStatusSchema = z.enum(['PENDING', 'CONFIRMED']);
export type SettlementStatus = z.infer<typeof SettlementStatusSchema>;

export const CreateSettlementSchema = z.object({
  toMemberId: z.string().uuid('Người nhận không hợp lệ'),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0'),
  method: SettlementMethodSchema,
});
export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;
