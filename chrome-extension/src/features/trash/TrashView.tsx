import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';

export function TrashView({ moduleFilter }: { moduleFilter?: string[] }) {
  const { data } = useAppStore();
  const { restoreRecord, deleteRecord } = useRecordStore();
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const CHITIEU_MODULES = ['mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro', 'mod_creditcard'];
  const WINE_MODULES = ['mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory'];

  const deletedRecords = useMemo(() => {
    if (!data) return [];
    let records = data.records.filter((r) => r.isDeleted);
    // Filter by workspace if specified
    if (moduleFilter) {
      records = records.filter((r) => moduleFilter.includes(r.moduleId));
    }
    return records.sort((a, b) => (b.deletedAt || b.updatedAt).localeCompare(a.deletedAt || a.updatedAt));
  }, [data, moduleFilter]);

  const getModuleName = (moduleId: string) => {
    if (!data) return moduleId;
    return data.modules.find((m) => m.id === moduleId)?.name || moduleId;
  };

  const getCategoryName = (categoryId?: string) => {
    if (!data || !categoryId || categoryId.startsWith('mod_')) return '—';
    for (const mod of data.modules) {
      const cat = mod.categories?.find((c) => c.id === categoryId);
      if (cat) return cat.name;
    }
    return '—';
  };

  const getRecordTitle = (record: typeof deletedRecords[0]) => {
    const titleKey = Object.keys(record.values).find(
      (k) => k.endsWith('_title') || k.endsWith('_order_name') || k.endsWith('_card_name') || k.endsWith('_customer_name') || k.endsWith('_room_name')
    );
    return titleKey ? String(record.values[titleKey] || '—') : '—';
  };

  const getRecordAmount = (record: typeof deletedRecords[0]) => {
    const amtKey = Object.keys(record.values).find(
      (k) => k.endsWith('_amount') || k.endsWith('_total_amount') || k.endsWith('_total')
    );
    if (!amtKey || !record.values[amtKey]) return '—';
    return Number(record.values[amtKey]).toLocaleString('vi-VN') + ' ₫';
  };

  const handleDeleteAllPermanent = () => {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }
    for (const record of deletedRecords) {
      deleteRecord(record.id, true);
    }
    setConfirmDeleteAll(false);
  };

  if (!data) return null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">Thùng rác</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">{deletedRecords.length} bản ghi đã xóa</p>
        </div>
        {deletedRecords.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmDeleteAll && (
              <button
                onClick={() => setConfirmDeleteAll(false)}
                className="px-3 py-1.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]"
              >
                Hủy
              </button>
            )}
            <button
              onClick={handleDeleteAllPermanent}
              className={`px-3 py-1.5 text-xs rounded font-medium ${
                confirmDeleteAll
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30'
              }`}
            >
              {confirmDeleteAll ? 'Xác nhận xóa tất cả?' : 'Xóa tất cả vĩnh viễn'}
            </button>
          </div>
        )}
      </div>

      {deletedRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--color-text-secondary)]">
          <Icon name="trash-2" size={48} className="opacity-30 mb-4" />
          <p className="text-sm">Thùng rác trống</p>
        </div>
      ) : (
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-text-secondary)]">
                <th className="py-2 px-3 font-medium">Ngày xóa</th>
                <th className="py-2 px-3 font-medium">Tên</th>
                <th className="py-2 px-3 font-medium">Số tiền</th>
                <th className="py-2 px-3 font-medium">Module</th>
                <th className="py-2 px-3 font-medium">Danh mục</th>
                <th className="py-2 px-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {deletedRecords.map((record) => (
                <tr key={record.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-colors">
                  <td className="py-2 px-3 text-xs text-[var(--color-text-secondary)]">
                    {record.deletedAt ? new Date(record.deletedAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td className="py-2 px-3 text-[var(--color-text)]">{getRecordTitle(record)}</td>
                  <td className="py-2 px-3 text-[var(--color-text)] tabular-nums">{getRecordAmount(record)}</td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)]">{getModuleName(record.moduleId)}</td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)]">{getCategoryName(record.categoryId)}</td>
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => restoreRecord(record.id)}
                        className="px-2 py-1 text-xs rounded bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30"
                        title="Khôi phục"
                      >
                        Khôi phục
                      </button>
                      <button
                        onClick={() => deleteRecord(record.id, true)}
                        className="px-2 py-1 text-xs rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30"
                        title="Xóa vĩnh viễn"
                      >
                        Xóa vĩnh viễn
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
