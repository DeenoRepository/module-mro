import { z } from 'zod';

export const MaintenanceFrequencySchema = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
  'CUSTOM'
]);

export type MaintenanceFrequency = z.infer<typeof MaintenanceFrequencySchema>;

export const ChecklistItemTypeSchema = z.enum(['BOOLEAN', 'NUMERIC', 'TEXT']);
export type ChecklistItemType = z.infer<typeof ChecklistItemTypeSchema>;

export const ChecklistTemplateItemSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string().uuid(),
  description: z.string().min(1).max(255),
  itemType: ChecklistItemTypeSchema,
  sortOrder: z.number().int().default(0),
  isRequired: z.boolean().default(true),
  minValue: z.number().optional(),
  maxValue: z.number().optional()
});

export type ChecklistTemplateItem = z.infer<typeof ChecklistTemplateItemSchema>;

export const ChecklistItemResultSchema = z.object({
  itemId: z.string().uuid(),
  description: z.string(),
  itemType: ChecklistItemTypeSchema,
  value: z.union([z.boolean(), z.number(), z.string()]),
  passed: z.boolean(),
  notes: z.string().max(255).nullable().optional()
});

export type ChecklistItemResult = z.infer<typeof ChecklistItemResultSchema>;

export const MaintenanceUsedPartSchema = z.object({
  id: z.string().uuid(),
  workOrderId: z.string().uuid(),
  nomenclatureId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().default('pcs'),
  reservationId: z.string().uuid().nullable().optional(),
  issued: z.boolean().default(false)
});

export type MaintenanceUsedPart = z.infer<typeof MaintenanceUsedPartSchema>;

export const FailureReasonSchema = z.enum([
  'MECHANICAL_WEAR',
  'ELECTRICAL_FAULT',
  'OPERATOR_ERROR',
  'SCHEDULED_OVERHAUL',
  'LACK_OF_SPARE_PARTS',
  'OTHER'
]);

export type FailureReason = z.infer<typeof FailureReasonSchema>;

export const DowntimeRecordSchema = z.object({
  id: z.string().uuid(),
  equipmentId: z.string().uuid(),
  workOrderId: z.string().uuid().nullable().optional(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable().optional(),
  reason: FailureReasonSchema,
  description: z.string().max(500).nullable().optional(),
  loggedById: z.string().uuid()
});

export type DowntimeRecord = z.infer<typeof DowntimeRecordSchema>;
