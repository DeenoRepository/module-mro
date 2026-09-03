export class MaintenanceService {
  isMaintenanceDue(currentHours: number, lastMaintenanceHours: number, intervalHours: number): boolean {
    if (intervalHours <= 0) throw new Error('Interval must be positive');
    return (currentHours - lastMaintenanceHours) >= intervalHours;
  }

  validateChecklistCompletion(checklist: { task: string; completed: boolean }[]): boolean {
    if (checklist.length === 0) return false;
    return checklist.every(item => item.completed);
  }
}
