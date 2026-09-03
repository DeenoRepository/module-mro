import { describe, it, expect } from 'vitest';
import { MaintenanceService } from './maintenance-service.js';
import { ChecklistTemplateItem } from './maintenance-models.js';

describe('MaintenanceService', () => {
  const service = new MaintenanceService();

  describe('isMaintenanceDue', () => {
    it('returns true when hours difference meets or exceeds interval', () => {
      expect(service.isMaintenanceDue(1500, 1000, 500)).toBe(true);
      expect(service.isMaintenanceDue(1505, 1000, 500)).toBe(true);
    });

    it('returns false when hours difference is less than interval', () => {
      expect(service.isMaintenanceDue(1400, 1000, 500)).toBe(false);
    });

    it('throws when interval is non-positive', () => {
      expect(() => service.isMaintenanceDue(1000, 1000, 0)).toThrow('Interval must be positive');
      expect(() => service.isMaintenanceDue(1000, 1000, -10)).toThrow('Interval must be positive');
    });
  });

  describe('calculateNextScheduledDate', () => {
    const base = new Date('2026-05-10T10:00:00Z');

    it('calculates DAILY (+1 day)', () => {
      const next = service.calculateNextScheduledDate(base, 'DAILY');
      expect(next.getDate()).toBe(11);
    });

    it('calculates WEEKLY (+7 days)', () => {
      const next = service.calculateNextScheduledDate(base, 'WEEKLY');
      expect(next.getDate()).toBe(17);
    });

    it('calculates MONTHLY (+1 month)', () => {
      const next = service.calculateNextScheduledDate(base, 'MONTHLY');
      expect(next.getMonth()).toBe(5); // June (0-indexed 5)
    });

    it('calculates QUARTERLY (+3 months)', () => {
      const next = service.calculateNextScheduledDate(base, 'QUARTERLY');
      expect(next.getMonth()).toBe(7); // August
    });

    it('calculates YEARLY (+1 year)', () => {
      const next = service.calculateNextScheduledDate(base, 'YEARLY');
      expect(next.getFullYear()).toBe(2027);
    });

    it('calculates CUSTOM with interval days', () => {
      const next = service.calculateNextScheduledDate(base, 'CUSTOM', 45);
      const diffDays = Math.round((next.getTime() - base.getTime()) / (1000 * 3600 * 24));
      expect(diffDays).toBe(45);
    });

    it('throws on invalid custom interval', () => {
      expect(() => service.calculateNextScheduledDate(base, 'CUSTOM', 0)).toThrow('positive intervalDays');
      expect(() => service.calculateNextScheduledDate(base, 'CUSTOM')).toThrow('positive intervalDays');
    });
  });

  describe('evaluateChecklist', () => {
    const templates: ChecklistTemplateItem[] = [
      {
        id: '11111111-1111-4111-8111-111111111111',
        templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        description: 'Check oil level',
        itemType: 'BOOLEAN',
        sortOrder: 1,
        isRequired: true
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        description: 'Measure bearing temperature (C)',
        itemType: 'NUMERIC',
        sortOrder: 2,
        isRequired: true,
        minValue: 20,
        maxValue: 85
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        templateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        description: 'Visual defect note',
        itemType: 'TEXT',
        sortOrder: 3,
        isRequired: false
      }
    ];

    it('evaluates valid checklist answers', () => {
      const answers = [
        { itemId: '11111111-1111-4111-8111-111111111111', value: true },
        { itemId: '22222222-2222-4222-8222-222222222222', value: 65 },
        { itemId: '33333333-3333-4333-8333-333333333333', value: 'No leaks observed' }
      ];

      const results = service.evaluateChecklist(templates, answers);
      expect(results.length).toBe(3);
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('fails numeric check if out of range or NaN', () => {
      const answers = [
        { itemId: '11111111-1111-4111-8111-111111111111', value: true },
        { itemId: '22222222-2222-4222-8222-222222222222', value: 110 } // exceeds 85
      ];

      const results = service.evaluateChecklist(templates, answers);
      const numRes = results.find(r => r.itemId === '22222222-2222-4222-8222-222222222222');
      expect(numRes?.passed).toBe(false);

      const nanResults = service.evaluateChecklist(templates, [
        { itemId: '11111111-1111-4111-8111-111111111111', value: true },
        { itemId: '22222222-2222-4222-8222-222222222222', value: 'not-a-number' }
      ]);
      expect(nanResults.find(r => r.itemId === '22222222-2222-4222-8222-222222222222')?.passed).toBe(false);
    });

    it('throws error when required item answer is missing', () => {
      const answers = [
        { itemId: '22222222-2222-4222-8222-222222222222', value: 50 }
      ];

      expect(() => service.evaluateChecklist(templates, answers)).toThrow('Missing required checklist item');
    });
  });

  describe('validateChecklistCompletion', () => {
    it('validates empty and filled checklist completion lists', () => {
      expect(service.validateChecklistCompletion([])).toBe(false);
      expect(service.validateChecklistCompletion([{ completed: true }, { passed: true }])).toBe(true);
      expect(service.validateChecklistCompletion([{ completed: true }, { passed: false }])).toBe(false);
    });
  });
});
