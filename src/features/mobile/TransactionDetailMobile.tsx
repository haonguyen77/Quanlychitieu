import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, Edit, Trash2, Calendar, Wallet, Tag, Layers, FileText } from 'lucide-react';
import type { DataRecord } from '@/types';

interface Props {
  record: DataRecord;
}

/**
 * Mobile Transaction Detail — fullscreen view with hero amount.
 * Design reference: Android App TransactionDetailScreen.
 */
export function TransactionDetailMobile({ record }: Props) {
  const { pop } = useMobileNav();
  const { deleteRecord } = useRecordStore();
  const { data } = useAppStore();

  const getValue = (suffix: string): string => {
    const key = Object.keys(record.values).find(k => k.endsWith(`_${suffix}`));
    return key ? String(record.values[key] ?? '') : '';
  };

  const title = getValue('title') || '—';
  const amount = Math.abs(Number(getValue('amount')) || 0);
  const type = getValue('type');
  const date = getValue('date');
  const account = getValue('account');
  const note = getValue('note');
  const isIncome = type === '1';

  // Find category name
  const categoryName = (() => {
    if (!record.categoryId || !data) return '';
    for (const mod of data.modules) {
      const cat = mod.categories?.find(c => c.id === record.categoryId);
      if (cat) return cat.name;
    }
    return '';
  })();

  // Find account label
  const accountLabel = (() => {
    if (!account || !data) return account;
    const mod = data.modules.find(m => m.id === 'mod_chitieu');
    const field = mod?.fields.find(f => f.fieldName === 'account');
    const opt = field?.options?.find(o => o.value === account);
    return opt?.label || account;
  })();

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + '₫';

  const handleDelete = () => {
    if (confirm('Xóa giao dịch này?')) {
      deleteRecord(record.id);
      pop();
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-base font-semibold text-gray-900 flex-1">Chi tiết giao dịch</h2>
        <button onClick={handleDelete} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-red-50">
          <Trash2 size={18} className="text-red-500" />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Amount Hero */}
        <div className={`rounded-2xl p-6 text-center ${isIncome ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
          <p className="text-white/80 text-sm mb-1">{isIncome ? 'Thu nhập' : 'Chi tiêu'}</p>
          <p className="text-white text-3xl font-bold">{isIncome ? '+' : '-'}{fmtMoney(amount)}</p>
          <p className="text-white/70 text-sm mt-2">{title}</p>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
          <InfoRow icon={<Calendar size={16} />} label="Ngày" value={date || '—'} />
          {categoryName && <InfoRow icon={<Tag size={16} />} label="Danh mục" value={categoryName} />}
          <InfoRow icon={<Wallet size={16} />} label="Tài khoản" value={accountLabel || '—'} />
          <InfoRow icon={<Layers size={16} />} label="Module" value={record.moduleId || '—'} />
          {note && <InfoRow icon={<FileText size={16} />} label="Ghi chú" value={note} />}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            className="flex-1 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold flex items-center justify-center gap-2 active:bg-red-50"
          >
            <Trash2 size={16} /> Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500">{icon}</div>
      <div className="flex-1">
        <p className="text-[10px] text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
