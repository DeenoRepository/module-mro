import { describe, it, expect } from 'vitest';
import { WorkOrderAggregate } from './work-order-aggregate.js';

describe('WorkOrderAggregate Domain & Outbox (TDD)', () => {
  it('creates work order and records mro.work_order.created event', () => {
    const wo = WorkOrderAggregate.create({
      id: 'WO-101',
      equipmentId: 'EQ-55',
      title: 'Bearing Replacement',
      assignedEngineer: 'Ivanov I.'
    });

    expect(wo.props.status).toBe('PLANNED');
    expect(wo.outboxEvents[0].eventType).toBe('mro.work_order.created');
  });

  it('progresses to completed state with operating hours event', () => {
    const wo = WorkOrderAggregate.create({
      id: 'WO-102',
      equipmentId: 'EQ-56',
      title: 'Annual Inspection',
      assignedEngineer: 'Ivanov I.'
    });

    wo.startWork();
    expect(wo.props.status).toBe('IN_PROGRESS');

    wo.complete(1250);
    expect(wo.props.status).toBe('COMPLETED');
    expect(wo.props.operatingHoursAtCompletion).toBe(1250);
    expect(wo.outboxEvents.some(e => e.eventType === 'mro.maintenance.completed')).toBe(true);
  });
});
