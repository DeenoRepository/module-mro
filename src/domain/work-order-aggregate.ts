import {
  ChecklistItemResult,
  MaintenanceUsedPart,
  DowntimeRecord,
  FailureReason
} from './maintenance-models.js';

export type WorkOrderStatus = 'PLANNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrderProps {
  id: string;
  equipmentId: string;
  title: string;
  description?: string | null;
  assignedEngineer?: string | null;
  status: WorkOrderStatus;
  scheduledDate?: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  operatingHoursAtCompletion?: number | null;
  checklistResults?: ChecklistItemResult[];
  usedParts?: MaintenanceUsedPart[];
  downtime?: DowntimeRecord | null;
}

export interface MroOutboxRecord {
  id: string;
  aggregateType: 'WorkOrder';
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  published: boolean;
}

export class WorkOrderAggregate {
  private _props: WorkOrderProps;
  private _outbox: MroOutboxRecord[] = [];

  constructor(props: WorkOrderProps) {
    this._props = {
      ...props,
      description: props.description ?? null,
      assignedEngineer: props.assignedEngineer ?? null,
      startedAt: props.startedAt ?? null,
      completedAt: props.completedAt ?? null,
      operatingHoursAtCompletion: props.operatingHoursAtCompletion ?? null,
      checklistResults: props.checklistResults ? [...props.checklistResults] : [],
      usedParts: props.usedParts ? [...props.usedParts] : [],
      downtime: props.downtime ?? null
    };
  }

  static create(props: Omit<WorkOrderProps, 'status' | 'checklistResults' | 'usedParts' | 'downtime'>): WorkOrderAggregate {
    const aggregate = new WorkOrderAggregate({
      ...props,
      status: 'PLANNED',
      checklistResults: [],
      usedParts: [],
      downtime: null
    });

    aggregate.recordOutbox('mro.work_order.created', {
      workOrderId: props.id,
      equipmentId: props.equipmentId,
      title: props.title,
      scheduledDate: props.scheduledDate?.toISOString() ?? new Date().toISOString()
    });

    return aggregate;
  }

  get props(): Readonly<WorkOrderProps> {
    return Object.freeze({ ...this._props });
  }

  get id(): string {
    return this._props.id;
  }

  get equipmentId(): string {
    return this._props.equipmentId;
  }

  get status(): WorkOrderStatus {
    return this._props.status;
  }

  get outboxEvents(): readonly MroOutboxRecord[] {
    return this._outbox;
  }

  get usedParts(): readonly MaintenanceUsedPart[] {
    return this._props.usedParts ?? [];
  }

  get checklistResults(): readonly ChecklistItemResult[] {
    return this._props.checklistResults ?? [];
  }

  get downtime(): DowntimeRecord | null {
    return this._props.downtime ?? null;
  }

  assignEngineer(engineerId: string): void {
    if (this._props.status === 'COMPLETED' || this._props.status === 'CANCELLED') {
      throw new Error(`Cannot assign engineer to ${this._props.status} work order`);
    }

    this._props.assignedEngineer = engineerId;
    if (this._props.status === 'PLANNED') {
      this._props.status = 'ASSIGNED';
    }

    this.recordOutbox('mro.work_order.assigned', {
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      assignedEngineer: engineerId
    });
  }

  startWork(startedAt?: Date): void {
    if (this._props.status !== 'PLANNED' && this._props.status !== 'ASSIGNED') {
      throw new Error(`Only PLANNED or ASSIGNED work orders can be started. Current status: ${this._props.status}`);
    }

    const startDate = startedAt ?? new Date();
    this._props.status = 'IN_PROGRESS';
    this._props.startedAt = startDate;

    this.recordOutbox('mro.work_order.started', {
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      startedAt: startDate.toISOString()
    });
  }

  recordDowntime(reason: FailureReason, description?: string, loggedById?: string, startedAt?: Date): void {
    if (this._props.downtime && !this._props.downtime.endedAt) {
      throw new Error('An active downtime incident is already recorded for this work order');
    }

    const record: DowntimeRecord = {
      id: crypto.randomUUID(),
      equipmentId: this._props.equipmentId,
      workOrderId: this._props.id,
      startedAt: startedAt ?? new Date(),
      endedAt: null,
      reason,
      description: description ?? null,
      loggedById: loggedById ?? '00000000-0000-0000-0000-000000000000'
    };

    this._props.downtime = record;

    this.recordOutbox('mro.equipment.downtime_started', {
      downtimeId: record.id,
      equipmentId: this._props.equipmentId,
      workOrderId: this._props.id,
      reason,
      startedAt: record.startedAt.toISOString()
    });
  }

  endDowntime(endedAt?: Date): void {
    if (!this._props.downtime || this._props.downtime.endedAt) {
      throw new Error('No active downtime record to close');
    }

    const endDate = endedAt ?? new Date();
    if (endDate < this._props.downtime.startedAt) {
      throw new Error('Downtime end date cannot be earlier than start date');
    }

    this._props.downtime.endedAt = endDate;
    const durationMinutes = Math.round((endDate.getTime() - this._props.downtime.startedAt.getTime()) / 60000);

    this.recordOutbox('mro.equipment.downtime_ended', {
      downtimeId: this._props.downtime.id,
      equipmentId: this._props.equipmentId,
      workOrderId: this._props.id,
      startedAt: this._props.downtime.startedAt.toISOString(),
      endedAt: endDate.toISOString(),
      durationMinutes
    });
  }

  requestSparePart(input: {
    nomenclatureId: string;
    warehouseId: string;
    quantity: number;
    unit?: string;
  }): MaintenanceUsedPart {
    if (this._props.status !== 'IN_PROGRESS' && this._props.status !== 'ASSIGNED') {
      throw new Error('Spare parts can only be requested for ASSIGNED or IN_PROGRESS work orders');
    }
    if (input.quantity <= 0) {
      throw new Error('Part quantity must be positive');
    }

    const part: MaintenanceUsedPart = {
      id: crypto.randomUUID(),
      workOrderId: this._props.id,
      nomenclatureId: input.nomenclatureId,
      warehouseId: input.warehouseId,
      quantity: input.quantity,
      unit: input.unit ?? 'pcs',
      reservationId: null,
      issued: false
    };

    this._props.usedParts?.push(part);

    this.recordOutbox('mro.parts.requested', {
      partUsageId: part.id,
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      nomenclatureId: input.nomenclatureId,
      warehouseId: input.warehouseId,
      quantity: input.quantity
    });

    return part;
  }

  confirmPartIssued(partId: string, reservationId?: string): void {
    const part = this._props.usedParts?.find(p => p.id === partId);
    if (!part) {
      throw new Error(`Part usage ${partId} not found on work order`);
    }
    part.issued = true;
    if (reservationId) part.reservationId = reservationId;

    this.recordOutbox('mro.parts.issued', {
      partUsageId: part.id,
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      nomenclatureId: part.nomenclatureId,
      quantity: part.quantity
    });
  }

  submitChecklistResults(results: ChecklistItemResult[]): void {
    if (this._props.status !== 'IN_PROGRESS') {
      throw new Error('Checklist results can only be submitted while work order is IN_PROGRESS');
    }

    this._props.checklistResults = [...results];

    this.recordOutbox('mro.checklist.evaluated', {
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      totalItems: results.length,
      allPassed: results.every(r => r.passed)
    });
  }

  complete(operatingHours: number, completedAt?: Date): void {
    if (this._props.status !== 'IN_PROGRESS') {
      throw new Error(`Only IN_PROGRESS work orders can be completed. Current status: ${this._props.status}`);
    }
    if (operatingHours < 0) {
      throw new Error('Operating hours at completion cannot be negative');
    }

    // Auto-close downtime if still open
    const compDate = completedAt ?? new Date();
    if (this._props.downtime && !this._props.downtime.endedAt) {
      this.endDowntime(compDate);
    }

    this._props.status = 'COMPLETED';
    this._props.operatingHoursAtCompletion = operatingHours;
    this._props.completedAt = compDate;

    this.recordOutbox('mro.maintenance.completed', {
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      completedAt: compDate.toISOString(),
      operatingHours
    });
  }

  cancel(reason: string): void {
    if (this._props.status === 'COMPLETED') {
      throw new Error('Cannot cancel already completed work order');
    }
    if (this._props.status === 'CANCELLED') {
      throw new Error('Work order is already cancelled');
    }

    this._props.status = 'CANCELLED';

    // Auto-close downtime if open
    if (this._props.downtime && !this._props.downtime.endedAt) {
      this.endDowntime(new Date());
    }

    this.recordOutbox('mro.work_order.cancelled', {
      workOrderId: this._props.id,
      equipmentId: this._props.equipmentId,
      reason
    });
  }

  private recordOutbox(eventType: string, payload: Record<string, unknown>): void {
    this._outbox.push({
      id: crypto.randomUUID(),
      aggregateType: 'WorkOrder',
      aggregateId: this._props.id,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
      published: false
    });
  }
}
