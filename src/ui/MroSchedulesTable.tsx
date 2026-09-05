'use client';

import React from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Box,
  Paper,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import { StatusBadge, EmptyState } from '@/components/ui';
import { formatDate } from '@ems/shared';

export interface MaintenanceScheduleRow {
  id: string;
  equipmentId: string;
  planId: string | null;
  scheduledDate: string;
  actualDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  equipment: {
    id: string;
    name: string;
    inventoryNumber: string | null;
    serialNumber: string | null;
    location: string | null;
    status: string;
  };
  plan?: {
    id: string;
    name: string;
    frequency: string;
    checklist?: {
      id: string;
      title: string;
      items: Array<{ id: string; text: string; isRequired: boolean }>;
    } | null;
  } | null;
  completedBy?: {
    id: string;
    displayName: string;
    ldapLogin: string;
  } | null;
  purchaseRequests?: Array<{
    id: string;
    requestNumber: string;
    status: string;
  }>;
}

interface MroSchedulesTableProps {
  schedules: MaintenanceScheduleRow[];
  visibleColumns: string[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  canExecute: boolean;
  canCreatePrm?: boolean;
  selectedScheduleId?: string;
  onRequestSort: (field: string) => void;
  onExecute: (sch: MaintenanceScheduleRow) => void;
}

export function MroSchedulesTable({
  schedules,
  visibleColumns,
  sortField,
  sortDirection,
  canExecute,
  canCreatePrm = false,
  selectedScheduleId,
  onRequestSort,
  onExecute,
}: MroSchedulesTableProps) {
  const now = new Date();

  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: 'background.default' }}>
          {visibleColumns.includes('scheduledDate') && (
            <TableCell sx={{ minWidth: 160 }}>
              <TableSortLabel
                active={sortField === 'scheduledDate'}
                direction={sortField === 'scheduledDate' ? sortDirection : 'asc'}
                onClick={() => onRequestSort('scheduledDate')}
              >
                Плановый срок
              </TableSortLabel>
            </TableCell>
          )}

          {visibleColumns.includes('equipment') && (
            <TableCell sx={{ minWidth: 200 }}>
              <TableSortLabel
                active={sortField === 'equipment'}
                direction={sortField === 'equipment' ? sortDirection : 'asc'}
                onClick={() => onRequestSort('equipment')}
              >
                Оборудование
              </TableSortLabel>
            </TableCell>
          )}

          {visibleColumns.includes('plan') && (
            <TableCell sx={{ minWidth: 180 }}>
              <TableSortLabel
                active={sortField === 'plan'}
                direction={sortField === 'plan' ? sortDirection : 'asc'}
                onClick={() => onRequestSort('plan')}
              >
                Регламент ТО
              </TableSortLabel>
            </TableCell>
          )}

          {visibleColumns.includes('periodicity') && (
            <TableCell sx={{ minWidth: 130 }}>Периодичность</TableCell>
          )}

          {visibleColumns.includes('status') && (
            <TableCell sx={{ minWidth: 130 }}>
              <TableSortLabel
                active={sortField === 'status'}
                direction={sortField === 'status' ? sortDirection : 'asc'}
                onClick={() => onRequestSort('status')}
              >
                Статус
              </TableSortLabel>
            </TableCell>
          )}

          {visibleColumns.includes('location') && (
            <TableCell sx={{ minWidth: 140 }}>Локация</TableCell>
          )}

          {visibleColumns.includes('completedBy') && (
            <TableCell sx={{ minWidth: 150 }}>Исполнитель</TableCell>
          )}

          {visibleColumns.includes('actions') && (
            <TableCell align="right" sx={{ minWidth: 110 }}>
              Действия
            </TableCell>
          )}
        </TableRow>
      </TableHead>
      <TableBody>
        {schedules.length === 0 ? (
          <TableRow>
            <TableCell colSpan={visibleColumns.length} sx={{ py: 6 }}>
              <EmptyState
                title="Нарядов на ТО не найдено"
                description="По выбранным фильтрам записей регламентного обслуживания не обнаружено."
              />
            </TableCell>
          </TableRow>
        ) : (
          schedules.map((sch) => {
            const isMissed = sch.status === 'MISSED' || (sch.status === 'PLANNED' && new Date(sch.scheduledDate) < now);
            const isCompleted = sch.status === 'COMPLETED';
            const isSelected = selectedScheduleId === sch.id;

            return (
              <TableRow
                key={sch.id}
                hover
                selected={isSelected}
                sx={isSelected ? { bgcolor: 'action.selected' } : undefined}
              >
                {visibleColumns.includes('scheduledDate') && (
                  <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isMissed ? 700 : 500,
                        color: isMissed ? 'error.main' : 'text.primary',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {formatDate(sch.scheduledDate)}
                    </Typography>
                    {isMissed && !isCompleted && (
                      <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.7rem', display: 'block' }}>
                        Просрочено
                      </Typography>
                    )}
                  </TableCell>
                )}

                {visibleColumns.includes('equipment') && (
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.8125rem', color: 'text.primary' }}>
                      {sch.equipment?.name}
                    </Typography>
                    {sch.equipment?.inventoryNumber && (
                      <Paper
                        variant="outlined"
                        sx={{
                          display: 'inline-block',
                          px: 0.6,
                          py: 0.1,
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          color: 'text.secondary',
                          bgcolor: 'background.default',
                          mt: 0.25,
                        }}
                      >
                        Инв. № {sch.equipment.inventoryNumber}
                      </Paper>
                    )}
                    {sch.purchaseRequests && sch.purchaseRequests.length > 0 && (
                      <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          PRM:
                        </Typography>
                        {sch.purchaseRequests.map((pr) => (
                          <Button
                            key={pr.id}
                            component={Link}
                            href={`/prm?requestId=${encodeURIComponent(pr.id)}`}
                            size="small"
                            sx={{
                              p: 0,
                              minWidth: 0,
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              textTransform: 'none',
                              fontWeight: 700,
                            }}
                          >
                            {pr.requestNumber}
                          </Button>
                        ))}
                      </Box>
                    )}
                  </TableCell>
                )}

                {visibleColumns.includes('plan') && (
                  <TableCell sx={{ fontSize: '0.8125rem' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                      {sch.plan?.name || 'Регламентное обслуживание'}
                    </Typography>
                    {sch.plan?.checklist && (
                      <Typography variant="caption" color="text.secondary">
                        Чек-лист: {sch.plan.checklist.title} ({sch.plan.checklist.items.length} пунктов)
                      </Typography>
                    )}
                  </TableCell>
                )}

                {visibleColumns.includes('periodicity') && (
                  <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                    {sch.plan?.frequency || '—'}
                  </TableCell>
                )}

                {visibleColumns.includes('status') && (
                  <TableCell>
                    <StatusBadge status={isMissed && !isCompleted ? 'MISSED' : sch.status} />
                  </TableCell>
                )}

                {visibleColumns.includes('location') && (
                  <TableCell sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                    {sch.equipment?.location || '—'}
                  </TableCell>
                )}

                {visibleColumns.includes('completedBy') && (
                  <TableCell sx={{ fontSize: '0.8125rem' }}>
                    {sch.completedBy ? (
                      <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
                        {sch.completedBy.displayName}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    )}
                  </TableCell>
                )}

                {visibleColumns.includes('actions') && (
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      {canCreatePrm && (
                        <Tooltip title="Создать заявку на закупку для данного ТО">
                          <IconButton
                            component={Link}
                            href={`/prm?create=true&equipmentId=${encodeURIComponent(sch.equipmentId)}&maintenanceScheduleId=${encodeURIComponent(sch.id)}`}
                            size="small"
                            sx={{ color: 'text.secondary' }}
                          >
                            <AddShoppingCartIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!isCompleted && canExecute ? (
                        <Button
                          size="small"
                          variant="contained"
                          color={isMissed ? 'error' : 'primary'}
                          startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
                          onClick={() => onExecute(sch)}
                          sx={{ fontSize: '0.75rem', px: 1.5, py: 0.3, textTransform: 'none', fontWeight: 700, borderRadius: '6px' }}
                        >
                          Исполнить ТО
                        </Button>
                      ) : isCompleted ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                          <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                          <Typography variant="caption" fontWeight={700}>
                            Выполнено
                          </Typography>
                        </Box>
                      ) : null}
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

export default MroSchedulesTable;
