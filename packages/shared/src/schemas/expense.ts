import { z } from 'zod';

export const ExpenseCategorySchema = z.enum([
  'FOOD',
  'TRANSPORT',
  'ACCOMMODATION',
  'ACTIVITY',
  'OTHER',
]);
export type ExpenseCategory = z.infer<typeof ExpenseCategorySchema>;

export const SplitTypeSchema = z.enum(['EQUAL', 'CUSTOM']);
export type SplitType = z.infer<typeof SplitTypeSchema>;

export const CreateExpenseSchema = z.object({
  paidById: z.string().uuid('Người trả không hợp lệ'),
  amount: z.number().int().positive('Số tiền phải lớn hơn 0'),
  description: z.string().min(1, 'Vui lòng nhập mô tả'),
  category: ExpenseCategorySchema.default('OTHER'),
  splitType: SplitTypeSchema.default('EQUAL'),
  memberIds: z.array(z.string().uuid()).min(1, 'Chọn ít nhất 1 thành viên'),
  customSplits: z
    .array(z.object({ memberId: z.string().uuid(), amount: z.number().int().positive() }))
    .optional(),
});
export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
