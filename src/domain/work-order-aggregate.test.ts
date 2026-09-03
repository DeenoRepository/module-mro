import { describe, it, expect } from 'vitest';
import { WorkOrderAggregate } from './work-order-aggregate.js';

describe('WorkOrderAggregate', () => {
  const baseWorkOrder = {
    id: 'wo-1',
    equipmentId: 'eq-100',
    title: 'Quarterly Pump Inspection',
    description: 'Scheduled maintenance for main coolant pump',
    scheduledDate: new Date('2026-06-01')
  };

  it('creates work order with PLANNED status and outbox event', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);

    expect(aggregate.id).toBe('wo-1');
    expect(aggregate.equipmentId).toBe('eq-100');
    expect(aggregate.status).toBe('PLANNED');
    expect(aggregate.usedParts.length).toBe(0);
    expect(aggregate.checklistResults.length).toBe(0);
    expect(aggregate.downtime).toBeNull();

    expect(aggregate.outboxEvents.length).toBe(1);
    expect(aggregate.outboxEvents[0].eventType).toBe('mro.work_order.created');
    expect(aggregate.outboxEvents[0].payload.title).toBe('Quarterly Pump Inspection');
  });

  it('transitions through ASSIGNED -> IN_PROGRESS -> COMPLETED lifecycle', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);

    aggregate.assignEngineer('eng-55');
    expect(aggregate.status).toBe('ASSIGNED');
    expect(aggregate.props.assignedEngineer).toBe('eng-55');

    aggregate.startWork();
    expect(aggregate.status).toBe('IN_PROGRESS');
    expect(aggregate.props.startedAt).not.toBeNull();

    aggregate.complete(1450);
    expect(aggregate.status).toBe('COMPLETED');
    expect(aggregate.props.operatingHoursAtCompletion).toBe(1450);
    expect(aggregate.props.completedAt).not.toBeNull();

    const compEvent = aggregate.outboxEvents.find(e => e.eventType === 'mro.maintenance.completed');
    expect(compEvent).toBeDefined();
    expect(compEvent?.payload.operatingHours).toBe(1450);
  });

  it('records downtime and auto-closes on completion', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    aggregate.startWork();

    const start = new Date('2026-06-01T08:00:00Z');
    aggregate.recordDowntime('MECHANICAL_WEAR', 'Bearing failure during run', 'user-1', start);

    expect(aggregate.downtime).not.toBeNull();
    expect(aggregate.downtime?.reason).toBe('MECHANICAL_WEAR');
    expect(aggregate.downtime?.endedAt).toBeNull();

    const end = new Date('2026-06-01T10:30:00Z');
    aggregate.complete(1460, end);

    expect(aggregate.downtime?.endedAt).toEqual(end);
    const downtimeEndEvent = aggregate.outboxEvents.find(e => e.eventType === 'mro.equipment.downtime_ended');
    expect(downtimeEndEvent).toBeDefined();
    expect(downtimeEndEvent?.payload.durationMinutes).toBe(150); // 2.5 hours = 150 minutes
  });

  it('throws when starting or completing in invalid state', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    expect(() => aggregate.complete(100)).toThrow('Only IN_PROGRESS work orders can be completed');

    aggregate.assignEngineer('eng-1');
    aggregate.startWork();
    expect(() => aggregate.startWork()).toThrow('Only PLANNED or ASSIGNED work orders can be started');

    expect(() => aggregate.complete(-10)).toThrow('cannot be negative');
  });

  it('requests and confirms spare parts issuance', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    aggregate.assignEngineer('eng-1');

    const part = aggregate.requestSparePart({
      nomenclatureId: 'part-bearing-6204',
      warehouseId: 'wh-main',
      quantity: 2,
      unit: 'pcs'
    });

    expect(aggregate.usedParts.length).toBe(1);
    expect(part.issued).toBe(false);

    aggregate.confirmPartIssued(part.id, 'res-999');
    expect(aggregate.usedParts[0].issued).toBe(true);
    expect(aggregate.usedParts[0].reservationId).toBe('res-999');

    const issuedEvent = aggregate.outboxEvents.find(e => e.eventType === 'mro.parts.issued');
    expect(issuedEvent).toBeDefined();
  });

  it('throws on invalid spare part operations', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    expect(() => aggregate.requestSparePart({
      nomenclatureId: 'p1',
      warehouseId: 'wh1',
      quantity: 1
    })).toThrow('Spare parts can only be requested for ASSIGNED or IN_PROGRESS');

    aggregate.assignEngineer('eng-1');
    expect(() => aggregate.requestSparePart({
      nomenclatureId: 'p1',
      warehouseId: 'wh1',
      quantity: 0
    })).toThrow('Part quantity must be positive');

    expect(() => aggregate.confirmPartIssued('non-existent-part')).toThrow('not found on work order');
  });

  it('records and verifies checklist evaluations', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    aggregate.startWork();

    const results = [
      {
        itemId: 'item-1',
        description: 'Vibration check',
        itemType: 'BOOLEAN' as const,
        value: true,
        passed: true
      }
    ];

    aggregate.submitChecklistResults(results);
    expect(aggregate.checklistResults.length).toBe(1);
    expect(aggregate.checklistResults[0].passed).toBe(true);

    const event = aggregate.outboxEvents.find(e => e.eventType === 'mro.checklist.evaluated');
    expect(event).toBeDefined();
    expect(event?.payload.allPassed).toBe(true);
  });

  it('throws when submitting checklist outside IN_PROGRESS status', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    expect(() => aggregate.submitChecklistResults([])).toThrow('Checklist results can only be submitted while work order is IN_PROGRESS');
  });

  it('cancels work order and records cancellation event', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    aggregate.assignEngineer('eng-1');

    aggregate.cancel('Equipment was decommissioned before inspection');
    expect(aggregate.status).toBe('CANCELLED');

    const event = aggregate.outboxEvents.find(e => e.eventType === 'mro.work_order.cancelled');
    expect(event).toBeDefined();
    expect(event?.payload.reason).toBe('Equipment was decommissioned before inspection');

    expect(() => aggregate.cancel('repeat cancel')).toThrow('Work order is already cancelled');
    expect(() => aggregate.assignEngineer('eng-2')).toThrow('Cannot assign engineer to CANCELLED');
  });

  it('throws when ending downtime with invalid parameters', () => {
    const aggregate = WorkOrderAggregate.create(baseWorkOrder);
    expect(() => aggregate.endDowntime()).toThrow('No active downtime record to close');

    aggregate.recordDowntime('ELECTRICAL_FAULT', 'Power surge', 'user-1', new Date('2026-06-01T12:00:00Z'));
    expect(() => aggregate.recordDowntime('OTHER')).toThrow('An active downtime incident is already recorded');

    expect(() => aggregate.endDowntime(new Date('2026-06-01T10:00:00Z'))).toThrow('cannot be earlier than start date');
  });
});
