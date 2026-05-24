import { z } from 'zod';

export const EventTypeSchema = z.enum(['TRIP', 'MEAL', 'OTHER']);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EventStatusSchema = z.enum(['ACTIVE', 'SETTLED', 'ARCHIVED']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const MemberRoleSchema = z.enum(['ORGANIZER', 'MEMBER']);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const CreateEventSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sự kiện'),
  type: EventTypeSchema,
  description: z.string().optional(),
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;
