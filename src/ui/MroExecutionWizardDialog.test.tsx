import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '../ui/__tests__/test-utils';
import MroExecutionWizardDialog from './MroExecutionWizardDialog';

const enqueueSnackbar = vi.fn();
const fetchMock = vi.fn();
const onSuccess = vi.fn();
const onClose = vi.fn();

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const schedule = {
  id: 'schedule-1',
  title: 'Quarterly pump maintenance',
  scheduledDate: '2026-09-01',
  notes: null,
  equipment: { id: 'eq-1', name: 'Main pump', inventoryNumber: 'INV-1', location: 'Workshop' },
  plan: {
    id: 'plan-1',
    name: 'Pump plan',
    checklist: {
      id: 'checklist-1',
      name: 'Pump checklist',
      items: [{ id: 'check-1', description: 'Inspect belt', itemType: 'BOOLEAN' as const, isRequired: true, sortOrder: 1 }],
    },
  },
};

beforeEach(() => {
  enqueueSnackbar.mockReset();
  fetchMock.mockReset();
  onSuccess.mockReset();
  onClose.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('MroExecutionWizardDialog', () => {
  it('requires mandatory checklist items before advancing', async () => {
    renderWithProviders(<MroExecutionWizardDialog open schedule={schedule} onClose={onClose} onSuccess={onSuccess} />);
    await waitFor(() => expect(screen.getByText('Объект технического обслуживания')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Чек-лист проверки/i }));
    fireEvent.click(screen.getByRole('button', { name: /Списание запчастей/i }));
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      'Не все обязательные пункты чек-листа выполнены (1 ост.)',
      { variant: 'warning' },
    );
  });
});
