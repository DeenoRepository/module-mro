import {
  MaintenanceFrequency,
  ChecklistTemplateItem,
  ChecklistItemResult
} from './maintenance-models.js';

export class MaintenanceService {
  isMaintenanceDue(currentHours: number, lastMaintenanceHours: number, intervalHours: number): boolean {
    if (intervalHours <= 0) throw new Error('Interval must be positive');
    return (currentHours - lastMaintenanceHours) >= intervalHours;
  }

  calculateNextScheduledDate(lastDate: Date, frequency: MaintenanceFrequency, customIntervalDays?: number): Date {
    const next = new Date(lastDate);
    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
      case 'CUSTOM':
        if (!customIntervalDays || customIntervalDays <= 0) {
          throw new Error('Custom frequency requires a positive intervalDays value');
        }
        next.setDate(next.getDate() + customIntervalDays);
        break;
    }
    return next;
  }

  evaluateChecklist(
    templates: ChecklistTemplateItem[],
    answers: Array<{ itemId: string; value: boolean | number | string; notes?: string | null }>
  ): ChecklistItemResult[] {
    const results: ChecklistItemResult[] = [];

    for (const template of templates) {
      const answer = answers.find(a => a.itemId === template.id);

      if (!answer) {
        if (template.isRequired) {
          throw new Error(`Missing required checklist item: "${template.description}"`);
        }
        continue;
      }

      let passed = true;
      if (template.itemType === 'BOOLEAN') {
        passed = answer.value === true;
      } else if (template.itemType === 'NUMERIC') {
        const numVal = Number(answer.value);
        if (Number.isNaN(numVal)) {
          passed = false;
        } else {
          if (template.minValue !== undefined && numVal < template.minValue) passed = false;
          if (template.maxValue !== undefined && numVal > template.maxValue) passed = false;
        }
      } else if (template.itemType === 'TEXT') {
        passed = typeof answer.value === 'string' && answer.value.trim().length > 0;
      }

      results.push({
        itemId: template.id,
        description: template.description,
        itemType: template.itemType,
        value: answer.value,
        passed,
        notes: answer.notes ?? null
      });
    }

    return results;
  }

  validateChecklistCompletion(checklist: { task?: string; completed?: boolean; passed?: boolean }[]): boolean {
    if (checklist.length === 0) return false;
    return checklist.every(item => item.completed === true || item.passed === true);
  }
}
