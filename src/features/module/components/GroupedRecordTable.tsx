/**
 * GroupedRecordTable: Same as RecordTable but with date-group separator rows.
 * Uses the existing RecordTable component but injects date headers between rows.
 * 
 * This is NOT a separate table — it wraps RecordTable and adds grouping via
 * the existing table structure with separator <tr> elements.
 */
import { RecordTable } from './RecordTable';
import type { ModuleDefinition, DataRecord } from '@/types';

interface GroupedRecordTableProps {
  module: ModuleDefinition;
  records: DataRecord[];
  onEdit: (record: DataRecord) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

/**
 * This component simply passes through to RecordTable.
 * The date grouping is handled INSIDE RecordTable via the dateGroups logic
 * that was already added there (renders date header <tr> before each new date group).
 */
export function GroupedRecordTable({ module, records, onEdit, selectedIds, onSelectionChange }: GroupedRecordTableProps) {
  return (
    <RecordTable
      module={module}
      records={records}
      onEdit={onEdit}
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      showDateGroups={true}
    />
  );
}
