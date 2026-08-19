import { useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { useMobileNav } from './MobileNavigation';
import { ArrowLeft, RotateCcw, Trash2, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * TrashMobile — Deleted records with restore/permanent delete.
 * Based on Android trash_screen.dart.
 */
export function TrashMobile() {
  const { pop } = useMobileNav();
  const { data, setData } = useAppStore();

  const deleted = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => r.isDeleted)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map(r => {
        const get = (s: string) => { const k = Object.keys(r.values).find(k => k.endsWith(`_${s}`)); return k ? String(r.values[k] ?? '') : ''; };
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
        return { record: r, title: get('title') || get('order_name') || '—', amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0, type: get('type'), date: get('date') || r.updatedAt?.slice(0, 10) || '' };
      });
  }, [data]);

  const restore = (id: string) => {
    if (!data) return;
    const updated = { ...data, records: data.records.map(r => r.id === id ? { ...r, isDeleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() } : r), lastModified: new Date().toISOString() };
    setData(updated);
  };

  const permanentDelete = (id: string) => {
    if (!data || !confirm('Xóa vĩnh viễn? Không thể khôi phục.')) return;
    const updated = { ...data, records: data.records.filter(r => r.id !== id), lastModified: new Date().toISOString() };
    setData(updated);
  };

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA]">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button onClick={pop} className="w-10 h-10 rounded-xl flex items-center justify-center active:bg-gray-100"><ArrowLeft size={22} className="text-gray-700" /></button>
        <h2 className="flex-1 text-base font-semibold" style={{ color: '#101B4D' }}>Thùng rác</h2>
        <span className="text-xs text-gray-400">{deleted.length} mục</span>
      </header>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-2">
        {deleted.length === 0 && (
          <div className="text-center py-12">
            <Trash2 size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Thùng rác trống</p>
          </div>
        )}
        {deleted.map(t => (
          <div key={t.record.id} className="bg-white rounded-xl border border-gray-100 flex items-center gap-3 px-4 py-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${t.type === '1' ? 'bg-green-50' : 'bg-red-50'}`}>
              {t.type === '1' ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
              <p className="text-[10px] text-gray-400">{t.date} · {fmtMoney(t.amount)}₫</p>
            </div>
            <button onClick={() => restore(t.record.id)} className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center" title="Khôi phục"><RotateCcw size={14} className="text-green-600" /></button>
            <button onClick={() => permanentDelete(t.record.id)} className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center" title="Xóa vĩnh viễn"><Trash2 size={14} className="text-red-500" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
