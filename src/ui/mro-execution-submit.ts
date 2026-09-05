export interface ChecklistAnswer {
  value: unknown;
  note?: string;
}

export interface ChecklistItemDefinition {
  id: string;
  description: string;
  itemType: 'BOOLEAN' | 'NUMERIC' | 'TEXT';
}

export interface UsedPartPayload {
  nomenclatureId: string;
  warehouseId: string;
  quantity: number;
}

export interface MroExecutionSubmitPayload {
  status: 'COMPLETED';
  notes?: string;
  checklistItems: Array<{
    itemId: string;
    description: string;
    itemType: ChecklistItemDefinition['itemType'];
    value: unknown;
    note?: string;
  }>;
  usedParts: UsedPartPayload[];
}

export function buildMroExecutionSubmitPayload({
  notes,
  checklistAnswers,
  checklistItems,
  usedParts,
}: {
  notes: string;
  checklistAnswers: Record<string, ChecklistAnswer>;
  checklistItems: ChecklistItemDefinition[];
  usedParts: UsedPartPayload[];
}): MroExecutionSubmitPayload {
  const formattedChecklist = Object.entries(checklistAnswers).map(([itemId, answer]) => {
    const itemDefinition = checklistItems.find((item) => item.id === itemId);
    return {
      itemId,
      description: itemDefinition?.description || '',
      itemType: itemDefinition?.itemType || 'BOOLEAN',
      value: answer.value,
      note: answer.note,
    };
  });

  return {
    status: 'COMPLETED',
    notes: notes.trim() || undefined,
    checklistItems: formattedChecklist,
    usedParts,
  };
}
