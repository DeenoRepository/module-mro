import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMroExecutionSubmitPayload } from './mro-execution-submit';

describe('MRO execution submit helpers', () => {
  test('formats checklist answers, trims notes, and preserves used parts', () => {
    const payload = buildMroExecutionSubmitPayload({
      notes: '  Completed during planned shutdown  ',
      checklistAnswers: {
        'check-1': { value: true, note: '  Passed  ' },
        'check-2': { value: 12 },
        'unknown': { value: 'free text' },
      },
      checklistItems: [
        { id: 'check-1', description: 'Inspect belt', itemType: 'BOOLEAN' },
        { id: 'check-2', description: 'Measure vibration', itemType: 'NUMERIC' },
      ],
      usedParts: [{ nomenclatureId: 'nom-1', warehouseId: 'wh-1', quantity: 2 }],
    });

    assert.deepEqual(payload, {
      status: 'COMPLETED',
      notes: 'Completed during planned shutdown',
      checklistItems: [
        { itemId: 'check-1', description: 'Inspect belt', itemType: 'BOOLEAN', value: true, note: '  Passed  ' },
        { itemId: 'check-2', description: 'Measure vibration', itemType: 'NUMERIC', value: 12, note: undefined },
        { itemId: 'unknown', description: '', itemType: 'BOOLEAN', value: 'free text', note: undefined },
      ],
      usedParts: [{ nomenclatureId: 'nom-1', warehouseId: 'wh-1', quantity: 2 }],
    });
  });

  test('omits blank notes while retaining completed status', () => {
    const payload = buildMroExecutionSubmitPayload({
      notes: '   ',
      checklistAnswers: {},
      checklistItems: [],
      usedParts: [],
    });
    assert.equal(payload.status, 'COMPLETED');
    assert.equal(payload.notes, undefined);
    assert.deepEqual(payload.checklistItems, []);
  });
});
