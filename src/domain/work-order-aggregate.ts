export type WorkOrderStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface WorkOrderProps {
  id: string;
  equipmentId: string;
  title: string;
  assignedEngineer: string;
  status: WorkOrderStatus;
  operatingHoursAtCompletion?: number;
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
  private _outbox: MroOutboxRecord[] = [];

  constructor(private props: WorkOrderProps) {}

  static create(props: Omit<WorkOrderProps, 'status'>): WorkOrderAggregate {
    const aggregate = new WorkOrderAggregate({
      ...props,
      status: 'PLANNED'
    });

    aggregate.recordOutbox('mro.work_order.created', {
      workOrderId: props.id,
      equipmentId: props.equipmentId,
      title: props.title
    });

    return aggregate;
  }

  get props(): Readonly<WorkOrderProps> {
    return Object.freeze({ ...this.props });
  }

  get outboxEvents(): readonly MroOutboxRecord[] {
    return this._outbox;
  }

  startWork(): void {
    if (this.props.status !== 'PLANNED') {
      throw new Error('Only PLANNED work orders can be started');
    }
    this.props.status = 'IN_PROGRESS';
    this.recordOutbox('mro.work_order.started', {
      workOrderId: this.props.id,
      equipmentId: this.props.equipmentId
    });
  }

  complete(operatingHours: number): void {
    if (this.props.status !== 'IN_PROGRESS') {
      throw new Error('Only IN_PROGRESS work orders can be completed');
    }
    this.props.status = 'COMPLETED';
    this.props.operatingHoursAtCompletion = operatingHours;

    this.recordOutbox('mro.maintenance.completed', {
      workOrderId: this.props.id,
      equipmentId: this.props.equipmentId,
      completedAt: new Date().toISOString(),
      operatingHours
    });
  }

  private recordOutbox(eventType: string, payload: Record<string, unknown>): void {
    this._outbox.push({
      id: crypto.randomUUID(),
      aggregateType: 'WorkOrder',
      aggregateId: this.props.id,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
      published: false
    });
  }
}
