'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  TextField,
  MenuItem,
  Stack,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Chip,
  Divider,
  Alert,
  Autocomplete,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import { useSnackbar } from 'notistack';
import { FormDialog, StatusBadge } from '@/components/ui';
import { buildMroExecutionSubmitPayload } from './mro-execution-submit';

interface NomenclatureOption {
  id: string;
  name: string;
  article?: string | null;
  unit: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface UsedPartItem {
  nomenclatureId: string;
  nomenclatureName: string;
  nomenclatureArticle?: string;
  unit: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
}

interface ChecklistItem {
  id: string;
  description: string;
  itemType: 'BOOLEAN' | 'NUMERIC' | 'TEXT';
  isRequired: boolean;
  sortOrder: number;
}

export interface MroExecutionWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule: {
    id: string;
    title: string;
    scheduledDate: string;
    notes?: string | null;
    equipment: {
      id: string;
      name: string;
      inventoryNumber?: string | null;
      location?: string | null;
    };
    plan?: {
      id: string;
      name: string;
      checklist?: {
        id: string;
        name: string;
        items: ChecklistItem[];
      } | null;
    } | null;
  } | null;
}

export default function MroExecutionWizardDialog({
  open,
  onClose,
  onSuccess,
  schedule,
}: MroExecutionWizardDialogProps) {
  const { enqueueSnackbar } = useSnackbar();

  // Wizard Steps (0: Параметры и исполнитель, 1: Чек-лист проверки, 2: Списание ТМЦ, 3: Протокол и завершение)
  const [activeStep, setActiveStep] = useState(0);

  // Step 0: General
  const [notes, setNotes] = useState('');
  const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 1: Checklist answers
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, { value: any; note?: string }>>({});

  // Step 2: Used Parts
  const [usedParts, setUsedParts] = useState<UsedPartItem[]>([]);
  const [selectedNomenclature, setSelectedNomenclature] = useState<NomenclatureOption | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [partQty, setPartQty] = useState('1');

  // Dictionaries
  const [nomenclatures, setNomenclatures] = useState<NomenclatureOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && schedule) {
      setActiveStep(0);
      setNotes(schedule.notes || '');
      setExecutionDate(new Date().toISOString().split('T')[0]);
      setUsedParts([]);

      // Initialize checklist answers
      const initialAnswers: Record<string, { value: any; note?: string }> = {};
      schedule.plan?.checklist?.items?.forEach((item) => {
        initialAnswers[item.id] = { value: false, note: '' };
      });
      setChecklistAnswers(initialAnswers);

      // Load dictionaries for parts & warehouses
      Promise.all([
        fetch('/api/wms/nomenclature?limit=500').then((r) => r.json()),
        fetch('/api/wms/warehouses').then((r) => r.json()),
      ])
        .then(([nomRes, whRes]) => {
          if (nomRes.success) {
            setNomenclatures(nomRes.data.items || nomRes.data || []);
          }
          if (whRes.success) {
            const whList = whRes.data || [];
            setWarehouses(whList);
            if (whList.length > 0) {
              setSelectedWarehouseId(whList[0].id);
            }
          }
        })
        .catch(() => {
          enqueueSnackbar('Не удалось загрузить справочники для выполнения ТО', { variant: 'error' });
        });
    }
  }, [open, schedule, enqueueSnackbar]);

  const checklistItems = schedule?.plan?.checklist?.items || [];

  const handleAddPart = () => {
    if (!selectedNomenclature) {
      enqueueSnackbar('Выберите номенклатурную позицию', { variant: 'warning' });
      return;
    }
    if (!selectedWarehouseId) {
      enqueueSnackbar('Выберите склад списания', { variant: 'warning' });
      return;
    }
    const qty = parseFloat(partQty);
    if (isNaN(qty) || qty <= 0) {
      enqueueSnackbar('Укажите корректное количество (> 0)', { variant: 'warning' });
      return;
    }

    const wh = warehouses.find((w) => w.id === selectedWarehouseId);

    setUsedParts((prev) => [
      ...prev,
      {
        nomenclatureId: selectedNomenclature.id,
        nomenclatureName: selectedNomenclature.name,
        nomenclatureArticle: selectedNomenclature.article || undefined,
        unit: selectedNomenclature.unit,
        warehouseId: selectedWarehouseId,
        warehouseName: wh?.name || selectedWarehouseId,
        quantity: qty,
      },
    ]);

    setSelectedNomenclature(null);
    setPartQty('1');
  };

  const handleRemovePart = (index: number) => {
    setUsedParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNextStep = () => {
    if (activeStep === 1) {
      // Validate required checklist items
      const uncompletedRequired = checklistItems.filter(
        (item) => item.isRequired && !checklistAnswers[item.id]?.value
      );
      if (uncompletedRequired.length > 0) {
        enqueueSnackbar(`Не все обязательные пункты чек-листа выполнены (${uncompletedRequired.length} ост.)`, {
          variant: 'warning',
        });
        return;
      }
    }
    setActiveStep((prev) => Math.min(prev + 1, 3));
  };

  const handleSubmit = async () => {
    if (!schedule) return;

    setIsSubmitting(true);
    try {
      const payload = buildMroExecutionSubmitPayload({
        notes,
        checklistAnswers,
        checklistItems,
        usedParts: usedParts.map((part) => ({
          nomenclatureId: part.nomenclatureId,
          warehouseId: part.warehouseId,
          quantity: part.quantity,
        })),
      });

      const res = await fetch(`/api/mro/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        enqueueSnackbar('Наряд ТО успешно выполнен и закрыт', { variant: 'success' });
        onSuccess();
        onClose();
      } else {
        enqueueSnackbar(json.error || 'Ошибка при сохранении наряда ТО', { variant: 'error' });
      }
    } catch {
      enqueueSnackbar('Ошибка сети при сохранении наряда ТО', { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!schedule) return null;

  return (
    <FormDialog
      open={open}
      onClose={() => !isSubmitting && onClose()}
      title="Мастер проведения регламентного ТО"
      subtitle={`Наряд #${schedule.id.slice(0, 8)} • ${schedule.title}`}
      icon={<AssignmentIcon />}
      maxWidth="md"
      steps={[
        '1. Сведения о ТО',
        '2. Электронный чек-лист',
        '3. Списание запчастей',
        '4. Протокол и закрытие',
      ]}
      activeStep={activeStep}
      onStepChange={(step) => setActiveStep(step)}
      hideActions
    >
      <Box sx={{ mt: 1.5 }}>
        {/* STEP 0: Сведения о ТО */}
        {activeStep === 0 && (
          <Stack spacing={3}>
            {/* Equipment Card */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <PrecisionManufacturingIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  Объект технического обслуживания
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Оборудование:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    {schedule.equipment.name}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Инвентарный номер:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    {schedule.equipment.inventoryNumber || '—'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="caption" color="text.secondary">
                    Локация:
                  </Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary">
                    {schedule.equipment.location || '—'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Фактическая дата проведения ТО"
                  InputLabelProps={{ shrink: true }}
                  value={executionDate}
                  onChange={(e) => setExecutionDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  disabled
                  label="Регламентный план"
                  value={schedule.plan?.name || 'Внеплановое обслуживание'}
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Заключение инженера / Примечания к выполненным работам"
              placeholder="Опишите состояние оборудования, выявленные замечания или выполненные регулировки..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
              <Button
                variant="contained"
                onClick={handleNextStep}
                sx={{ borderRadius: '8px', px: 3, fontWeight: 600 }}
              >
                Далее: Чек-лист проверки →
              </Button>
            </Box>
          </Stack>
        )}

        {/* STEP 1: Электронный чек-лист */}
        {activeStep === 1 && (
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                Пункты регламентной проверки ({checklistItems.length}):
              </Typography>
              <Chip
                size="small"
                label={schedule.plan?.checklist?.name || 'Чек-лист регламента'}
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            </Box>

            {checklistItems.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: '8px' }}>
                Для данного плана регламентный чек-лист не задан. Вы можете сразу перейти к списанию запчастей.
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {checklistItems.map((item, idx) => {
                  const isChecked = !!checklistAnswers[item.id]?.value;
                  return (
                    <Paper
                      key={item.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isChecked ? 'success.light' : 'divider',
                        bgcolor: isChecked ? 'rgba(240, 253, 244, 0.5)' : 'background.paper',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={isChecked}
                              onChange={(e) =>
                                setChecklistAnswers((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], value: e.target.checked },
                                }))
                              }
                              color="success"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="body2" fontWeight={600} color="text.primary">
                                {idx + 1}. {item.description}
                                {item.isRequired && (
                                  <Typography component="span" color="error.main" sx={{ ml: 0.5 }}>
                                    *
                                  </Typography>
                                )}
                              </Typography>
                            </Box>
                          }
                        />
                        {isChecked && (
                          <StatusBadge status="COMPLETED" label="Выполнено" size="small" />
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Stack>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
              <Button onClick={() => setActiveStep(0)} sx={{ fontWeight: 600 }}>
                ← Назад
              </Button>
              <Button
                variant="contained"
                onClick={handleNextStep}
                sx={{ borderRadius: '8px', px: 3, fontWeight: 600 }}
              >
                Далее: Списание запчастей →
              </Button>
            </Box>
          </Stack>
        )}

        {/* STEP 2: Списание запчастей */}
        {activeStep === 2 && (
          <Stack spacing={2.5}>
            {/* Add Part Form */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: '10px', bgcolor: 'background.default', border: '1px solid divider' }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
                Подобрать и списать деталь со склада WMS:
              </Typography>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} sm={5}>
                  <Autocomplete
                    size="small"
                    options={nomenclatures}
                    getOptionLabel={(option) => `${option.name} (${option.article || option.unit})`}
                    value={selectedNomenclature}
                    onChange={(_, val) => setSelectedNomenclature(val)}
                    renderInput={(params) => <TextField {...params} label="Номенклатура / Запчасть" placeholder="Поиск детали..." />}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Склад списания</InputLabel>
                    <Select
                      value={selectedWarehouseId}
                      label="Склад списания"
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    >
                      {warehouses.map((wh) => (
                        <MenuItem key={wh.id} value={wh.id}>
                          {wh.name} ({wh.code})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} sm={1.5}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Кол-во"
                    value={partQty}
                    onChange={(e) => setPartQty(e.target.value)}
                    inputProps={{ min: 0.01, step: 'any' }}
                  />
                </Grid>
                <Grid item xs={6} sm={1.5}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddPart}
                    sx={{ height: 40, borderRadius: '8px', fontWeight: 600 }}
                  >
                    В наряд
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            {/* List of Used Parts */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ mb: 1 }}>
                Запчасти и материалы к списанию ({usedParts.length}):
              </Typography>
              {usedParts.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: '8px' }}>
                  Запчасти не использовались (ТО проведено без списания расходных материалов).
                </Alert>
              ) : (
                <Paper elevation={0} sx={{ border: '1px solid divider', borderRadius: '8px', overflow: 'hidden' }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'background.default' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Запчасть / Материал</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Артикул</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Склад</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Количество</TableCell>
                        <TableCell align="center" sx={{ width: 40 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usedParts.map((item, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ py: 1, fontWeight: 600, fontSize: '0.8125rem' }}>
                            {item.nomenclatureName}
                          </TableCell>
                          <TableCell sx={{ py: 1, color: 'text.disabled', fontSize: '0.75rem' }}>
                            {item.nomenclatureArticle || '—'}
                          </TableCell>
                          <TableCell sx={{ py: 1, fontSize: '0.75rem' }}>{item.warehouseName}</TableCell>
                          <TableCell align="right" sx={{ py: 1, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 0.5 }}>
                            <IconButton size="small" color="error" onClick={() => handleRemovePart(idx)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
              <Button onClick={() => setActiveStep(1)} sx={{ fontWeight: 600 }}>
                ← Назад к чек-листу
              </Button>
              <Button
                variant="contained"
                onClick={handleNextStep}
                sx={{ borderRadius: '8px', px: 3, fontWeight: 600 }}
              >
                Далее: Итоговый протокол →
              </Button>
            </Box>
          </Stack>
        )}

        {/* STEP 3: Протокол и закрытие */}
        {activeStep === 3 && (
          <Stack spacing={2.5}>
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Все этапы регламента пройдены. Проверьте сводный протокол перед подписанием и списанием ТМЦ.
            </Alert>

            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', border: '1px solid divider', bgcolor: 'background.default' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Название регламента:
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                    {schedule.title}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">
                    Оборудование:
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                    {schedule.equipment.name} ({schedule.equipment.inventoryNumber || 'б/н'})
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Пунктов чек-листа:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">
                    {Object.values(checklistAnswers).filter((a) => a.value).length} из {checklistItems.length} выполнено
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Списываемых запчастей:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    {usedParts.length} позиций
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">
                    Дата закрытия:
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="text.primary">
                    {executionDate}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
              <Button onClick={() => setActiveStep(2)} sx={{ fontWeight: 600 }}>
                ← Назад к запчастям
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleSubmit}
                disabled={isSubmitting}
                sx={{ borderRadius: '8px', px: 4, fontWeight: 700 }}
              >
                {isSubmitting ? 'Закрытие наряда...' : 'Подписать и закрыть наряд ТО'}
              </Button>
            </Box>
          </Stack>
        )}
      </Box>
    </FormDialog>
  );
}
