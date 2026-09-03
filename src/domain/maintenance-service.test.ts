import { describe, it, expect } from 'vitest';
import { MaintenanceService } from './maintenance-service.js';

describe('MaintenanceService (TDD)', () => {
  const service = new MaintenanceService();

  it('determines when maintenance is due based on operating hours', () => {
    expect(service.isMaintenanceDue(1500, 1000, 500)).toBe(true);
    expect(service.isMaintenanceDue(1450, 1000, 500)).toBe(false);
  });

  it('validates checklist completion before order closure', () => {
    const valid = [{ task: 'Lubricate bearings', completed: true }, { task: 'Check seals', completed: true }];
    const invalid = [{ task: 'Lubricate bearings', completed: true }, { task: 'Check seals', completed: false }];
    expect(service.validateChecklistCompletion(valid)).toBe(true);
    expect(service.validateChecklistCompletion(invalid)).toBe(false);
  });
});
