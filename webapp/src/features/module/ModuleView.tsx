import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { ModuleHeader } from './components/ModuleHeader';
import { ModuleStats } from './components/ModuleStats';
import { ChiTieuHeader } from './components/ChiTieuHeader';
import { GroupedRecordTable } from './components/GroupedRecordTable';
import { RecordTable } from './components/RecordTable';
import { RecordFormDialog } from './components/RecordFormDialog';
import { CreditCardView } from './components/CreditCardView';
import { CardFormDialog } from './components/CardFormDialog';
import { BatchToolbar } from './components/BatchToolbar';
import { GoldStatsBar } from './components/GoldStatsBar';
import { RentSettingsBar } from './components/RentSettingsBar';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import type { DataRecord, RecordValue } from '@/types';

export function ModuleView() {
  const { data, activeModuleId } = useAppStore();
  const { searchQuery, dateFrom, dateTo, filters, sortField, sortDirection, filterCategory, filterModule, filterAccount, filterWarrantyAlert } = useRecordStore();
  const getFilteredRecords = useRecordStore((s) => s.getFilteredRecords);
  const applyModuleDefault = useRecordStore((s) => s.applyModuleDefault);
  const deleteRecord = useRecordStore((s) => s.deleteRecord);

  const module = useMemo(
    () => data?.modules.find((m) => m.id === activeModuleId),
    [data, activeModuleId]
  );

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [isGroupMode, setIsGroupMode] = useState(() => {
    return localStorage.getItem('pdp_groupMode') !== '0'; // Default: group mode ON
  });
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardRecord, setEditingCardRecord] = useState<DataRecord | null>(null);

  // Apply per-module default date preset when switching modules
  useEffect(() => {
    if (activeModuleId) {
      applyModuleDefault(activeModuleId);
      setSelectedRecordIds(new Set()); // Clear selection on module switch
    }
  }, [activeModuleId, applyModuleDefault]);

  // Compute records
  const records = useMemo(() => {
    if (!module) return [];
    return getFilteredRecords(module.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module, data, searchQuery, dateFrom, dateTo, filters, sortField, sortDirection, filterCategory, filterModule, filterAccount, filterWarrantyAlert]);

  const handleAdd = useCallback(() => {
    setEditingRecord(null);
    setShowForm(true);
  }, []);

  const [creditCardDefaultAccount, setCreditCardDefaultAccount] = useState<string | null>(null);

  const handleAddCreditCardTransaction = useCallback((cardName?: string) => {
    // If no card name passed, try to get from first credit card record
    let accValue = cardName || null;
    if (!accValue && data) {
      const ccRecords = data.records.filter((r) => r.moduleId === 'mod_creditcard' && !r.isDeleted);
      if (ccRecords.length > 0) {
        const name = Object.entries(ccRecords[0].values).find(([k]) => k.endsWith('_card_name'))?.[1];
        if (name) accValue = String(name);
      }
    }
    setCreditCardDefaultAccount(accValue ? `credit_card_${accValue}` : 'credit_card');
    setEditingRecord(null);
    setShowForm(true);
  }, [data]);

  const handleEdit = useCallback((record: DataRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowForm(false);
    setEditingRecord(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedRecordIds.size === 0) return;
    if (!confirm(`Xóa ${selectedRecordIds.size} bản ghi đã chọn?`)) return;
    for (const id of selectedRecordIds) {
      deleteRecord(id);
    }
    setSelectedRecordIds(new Set());
  }, [selectedRecordIds, deleteRecord]);

  const handleBatchEditField = useCallback((fieldId: string, value: unknown) => {
    if (selectedRecordIds.size === 0) return;
    const appStore = useAppStore.getState();
    const appData = appStore.data;
    if (!appData) return;
    const now = new Date().toISOString();
    const updatedRecords: DataRecord[] = appData.records.map((r) => {
      if (!selectedRecordIds.has(r.id)) return r;
      const newValues = { ...r.values };
      newValues[fieldId] = value as RecordValue;
      return { ...r, values: newValues, updatedAt: now };
    });
    appStore.setData({ ...appData, records: updatedRecords, lastModified: now });
    setSelectedRecordIds(new Set());
  }, [selectedRecordIds]);

  const handleBatchEditCategory = useCallback((categoryId: string | undefined) => {
    if (selectedRecordIds.size === 0) return;
    const appStore = useAppStore.getState();
    const appData = appStore.data;
    if (!appData) return;
    const now = new Date().toISOString();
    const updatedRecords: DataRecord[] = appData.records.map((r) => {
      if (!selectedRecordIds.has(r.id)) return r;
      return { ...r, categoryId, updatedAt: now };
    });
    appStore.setData({ ...appData, records: updatedRecords, lastModified: now });
    setSelectedRecordIds(new Set());
  }, [selectedRecordIds]);

  const handleBatchEditLinkedModule = useCallback((moduleId: string | null) => {
    if (selectedRecordIds.size === 0) return;
    const appStore = useAppStore.getState();
    const appData = appStore.data;
    if (!appData) return;
    const now = new Date().toISOString();
    const updatedRecords: DataRecord[] = appData.records.map((r) => {
      if (!selectedRecordIds.has(r.id)) return r;
      return { ...r, linkedModuleId: moduleId || undefined, updatedAt: now };
    });
    appStore.setData({ ...appData, records: updatedRecords, lastModified: now });
    setSelectedRecordIds(new Set());
  }, [selectedRecordIds]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewRecord: handleAdd,
    onDeleteSelected: handleDeleteSelected,
    enabled: !showForm,
  });

  if (!module) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
        <div className="text-center">
          <p className="text-lg">Chọn một module từ menu bên trái</p>
          <p className="text-sm mt-1">để bắt đầu quản lý dữ liệu</p>
        </div>
      </div>
    );
  }

  const isCreditCard = module.id === 'mod_creditcard';
  const isChiTieu = module.id === 'mod_chitieu';

  const toggleGroupMode = useCallback(() => {
    setIsGroupMode((prev) => {
      const next = !prev;
      localStorage.setItem('pdp_groupMode', next ? '1' : '0');
      return next;
    });
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {isChiTieu ? (
        <>
          <ChiTieuHeader
            module={module}
            records={records}
            onAdd={handleAdd}
            isGroupMode={isGroupMode}
            onToggleGroup={toggleGroupMode}
          />
          {selectedRecordIds.size > 0 && (
            <BatchToolbar
              selectedCount={selectedRecordIds.size}
              module={module}
              onDelete={handleDeleteSelected}
              onEditField={handleBatchEditField}
              onEditCategory={handleBatchEditCategory}
              onEditLinkedModule={handleBatchEditLinkedModule}
              onClearSelection={() => setSelectedRecordIds(new Set())}
            />
          )}
          {isGroupMode ? (
            <GroupedRecordTable module={module} records={records} onEdit={handleEdit} />
          ) : (
            <RecordTable
              module={module}
              records={records}
              onEdit={handleEdit}
              selectedIds={selectedRecordIds}
              onSelectionChange={setSelectedRecordIds}
            />
          )}
        </>
      ) : isCreditCard ? (
        <>
          <ModuleHeader module={module} onAdd={() => handleAddCreditCardTransaction()} />
          <CreditCardView
            onEditRecord={handleEdit}
            onAddRecord={(defaultAcc) => handleAddCreditCardTransaction(defaultAcc)}
            onAddCard={() => setShowCardForm(true)}
            onEditCard={(record) => { setEditingCardRecord(record); setShowCardForm(true); }}
          />
          {showCardForm && <CardFormDialog onClose={() => { setShowCardForm(false); setEditingCardRecord(null); }} editRecord={editingCardRecord ? { id: editingCardRecord.id, values: editingCardRecord.values as Record<string, unknown> } : undefined} />}
        </>
      ) : (
        <>
          <ModuleHeader module={module} onAdd={handleAdd} />
          <ModuleStats module={module} records={records} />
          {module.id === 'mod_vang' && <GoldStatsBar records={records} />}
          {module.id === 'mod_nhatro' && <RentSettingsBar />}
          {selectedRecordIds.size > 0 && (
            <BatchToolbar
              selectedCount={selectedRecordIds.size}
              module={module}
              onDelete={handleDeleteSelected}
              onEditField={handleBatchEditField}
              onEditCategory={handleBatchEditCategory}
              onEditLinkedModule={handleBatchEditLinkedModule}
              onClearSelection={() => setSelectedRecordIds(new Set())}
            />
          )}
          <RecordTable
            module={module}
            records={records}
            onEdit={handleEdit}
            selectedIds={selectedRecordIds}
            onSelectionChange={setSelectedRecordIds}
          />
        </>
      )}
      {showForm && (
        <RecordFormDialog
          module={isCreditCard ? (data?.modules.find((m) => m.id === 'mod_chitieu') || module) : module}
          record={editingRecord}
          onClose={() => { handleCloseForm(); setCreditCardDefaultAccount(null); }}
          defaultAccount={creditCardDefaultAccount || undefined}
        />
      )}
    </div>
  );
}
