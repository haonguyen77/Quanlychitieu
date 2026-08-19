import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { AddExpenseMobile } from './AddExpenseMobile';
import { ArrowLeft, Edit, Trash2, Calendar, Wallet, Tag, Layers, FileText, User, MapPin, ShoppingBag, Shield, TrendingUp, TrendingDown } from 'lucide-react';
import type { DataRecord } from '@/types';

interface Props { record: DataRecord; }

/**
 * TransactionDetailMobile — Reproduction of Android transaction_detail_screen.dart.
 * Gradient hero card + info rows card + note + actions.
 */
export function TransactionDetailMobile({ record }: Props) {
  const { pop, push } = useMobileNav();
  const { deleteRecord } = useRecordStore();
  const { data } = useAppStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const getVal = (suffix: string): string => { const k = Object.keys(record.values).find(k => k.endsWith(`_${suffix}`)); return k ? String(record.values[k] ?? '') : ''; };

  const title = getVal('title') || '—';
  const amount = Math.abs(Number(getVal('amount')) || 0);
  const type = getVal('type');
  const date = getVal('date');
  const time = getVal('time');
  const account = getVal('account');
  const note = getVal('note');
  const beneficiary = getVal('beneficiary');
  const event = getVal('event');
  const store = getVal('store');
  const warrantyMonths = getVal('warranty_months');
  const isIncome = type === '1';

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + '₫';
  const fmtDate = (d: string) => { if (!d) return '—'; const parts = d.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d; };

  const getCatName = () => { if (!record.categoryId || !data) return ''; for (const mod of data.modules) { const cat = mod.categories?.find(c => c.id === record.categoryId); if (cat) return cat.name; } return ''; };
  const getAccLabel = () => { const mod = data?.modules.find(m => m.id === 'mod_chitieu'); const f = mod?.fields.find(f => f.fieldName === 'account'); return f?.options?.find(o => o.value === account)?.label || account || '—'; };
  const getModName = () => { const mod = data?.modules.find(m => m.id === (record.linkedModuleId || record.moduleId)); return mod?.name || record.moduleId || '—'; };

  const handleEdit = () => {
    push({ id: `edit-${record.id}`, component: <AddExpenseMobile editRecord={{ id: record.id, values: record.values, categoryId: record.categoryId || undefined, linkedModuleId: record.linkedModuleId || undefined, moduleId: record.moduleId }} onClose={() => { pop(); pop(); }} /> });
  };

  const handleDelete = () => {
    deleteRecord(record.id);
    pop();
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold text-center" style={{ color: '#101B4D' }}>Chi tiết giao dịch</h2>
        <button onClick={handleEdit} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-purple-50"><Edit size={18} style={{ color: '#6C2BD9' }} /></button>
        <button onClick={() => setShowDeleteConfirm(true)} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-red-50"><Trash2 size={18} className="text-red-400" /></button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {/* Hero Card — gradient */}
        <div className="rounded-2xl p-6 text-center" style={{ background: isIncome ? 'linear-gradient(135deg, #2ED573, #17C0EB)' : 'linear-gradient(135deg, #FF6B6B, #EE5A24)', boxShadow: `0 8px 20px ${isIncome ? 'rgba(46,213,115,0.2)' : 'rgba(255,107,107,0.2)'}` }}>
          <div className="w-11 h-11 mx-auto rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
            {isIncome ? <TrendingUp size={22} color="white" /> : <TrendingDown size={22} color="white" />}
          </div>
          <p className="text-white text-3xl font-bold">{isIncome ? '+' : '-'}{fmtMoney(amount)}</p>
          <p className="text-white/90 text-sm mt-2">{title}</p>
          <p className="text-white/70 text-xs mt-1">{fmtDate(date)}</p>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <InfoRow icon={<Calendar size={15} />} label="Ngày" value={fmtDate(date)} />
          {time && <><Divider /><InfoRow icon={<Calendar size={15} />} label="Giờ" value={time} /></>}
          <Divider /><InfoRow icon={<Tag size={15} />} label="Danh mục" value={getCatName() || 'Không phân loại'} />
          <Divider /><InfoRow icon={<Wallet size={15} />} label="Thanh toán" value={getAccLabel()} />
          <Divider /><InfoRow icon={<Layers size={15} />} label="Module" value={getModName()} />
          {beneficiary && <><Divider /><InfoRow icon={<User size={15} />} label="Người nhận" value={beneficiary} /></>}
          {event && <><Divider /><InfoRow icon={<Calendar size={15} />} label="Sự kiện" value={event} /></>}
          {store && <><Divider /><InfoRow icon={<ShoppingBag size={15} />} label="Cửa hàng" value={store} /></>}
          {warrantyMonths && <><Divider /><InfoRow icon={<Shield size={15} />} label="Bảo hành" value={`${warrantyMonths} tháng`} /></>}
        </div>

        {/* Note */}
        {note && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <FileText size={16} className="text-gray-400 mt-0.5" />
              <div><p className="text-[11px] text-gray-400">Ghi chú</p><p className="text-sm text-gray-900 mt-1">{note}</p></div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={handleEdit} className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white active:scale-[0.98]" style={{ backgroundColor: '#6C2BD9' }}>
            <Edit size={16} /> Sửa
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="flex-1 py-3 rounded-xl border border-red-200 flex items-center justify-center gap-2 text-sm font-semibold text-red-500 active:bg-red-50">
            <Trash2 size={16} /> Xóa
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl p-6 mx-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">Xóa giao dịch</h3>
            <p className="text-sm text-gray-600 mb-5">Bạn có chắc muốn xóa "{title}"?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-sm font-medium text-gray-600">Hủy</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-sm font-semibold text-white active:scale-95">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F3EAFF' }}>
        <div style={{ color: '#6C2BD9' }}>{icon}</div>
      </div>
      <span className="text-xs text-gray-400 w-20">{label}</span>
      <span className="flex-1 text-sm font-medium text-right" style={{ color: '#101B4D' }}>{value}</span>
    </div>
  );
}

function Divider() { return <div className="h-px bg-gray-50 mx-4" />; }
