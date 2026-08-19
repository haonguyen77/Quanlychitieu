import { useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { TrendingDown, TrendingUp, Wallet, FileText } from 'lucide-react';

/**
 * Mobile Dashboard — Summary cards + recent transactions.
 * Design reference: Android App dashboard with Material 3 cards.
 */
export function DashboardMobile() {
  const { data } = useAppStore();
  const { records } = useRecordStore();

  const stats = useMemo(() => {
    if (!data) return { expense: 0, income: 0, records: 0 };
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let expense = 0, income = 0, count = 0;
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
      const date = dateKey ? String(r.values[dateKey] ?? '') : '';
      if (!date.startsWith(monthPrefix)) continue;

      const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
      const amount = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
      const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
      const type = typeKey ? String(r.values[typeKey] ?? '0') : '0';

      if (type === '1') income += amount;
      else if (type !== '2') expense += amount;
      count++;
    }
    return { expense, income, records: count };
  }, [data]);

  const recentTransactions = useMemo(() => {
    if (!data) return [];
    return data.records
      .filter(r => !r.isDeleted && r.moduleId === 'mod_chitieu')
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
      .slice(0, 5);
  }, [data]);

  const fmtMoney = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M₫`;
    if (n >= 1000) return `${Math.round(n / 1000)}K₫`;
    return `${n.toLocaleString('vi-VN')}₫`;
  };

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-xs text-gray-500 mt-1">Tháng {new Date().getMonth() + 1}/{new Date().getFullYear()}</p>
      </div>

      <div className="px-4 pb-24 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<TrendingDown size={18} />} iconBg="bg-red-50" iconColor="text-red-500" label="Tổng chi" value={fmtMoney(stats.expense)} valueColor="text-red-600" />
          <StatCard icon={<TrendingUp size={18} />} iconBg="bg-green-50" iconColor="text-green-500" label="Tổng thu" value={fmtMoney(stats.income)} valueColor="text-green-600" />
          <StatCard icon={<Wallet size={18} />} iconBg="bg-blue-50" iconColor="text-blue-500" label="Số dư" value={fmtMoney(stats.income - stats.expense)} valueColor="text-blue-600" />
          <StatCard icon={<FileText size={18} />} iconBg="bg-orange-50" iconColor="text-orange-500" label="Bản ghi" value={String(stats.records)} valueColor="text-orange-600" />
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Giao dịch gần đây</h3>
          {recentTransactions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Chưa có giao dịch</p>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map(r => {
                const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
                const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
                const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
                const title = titleKey ? String(r.values[titleKey] ?? '') : '—';
                const amount = amtKey ? Number(r.values[amtKey] ?? 0) : 0;
                const isIncome = typeKey ? String(r.values[typeKey]) === '1' : false;

                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isIncome ? 'bg-green-50' : 'bg-red-50'}`}>
                      {isIncome ? <TrendingUp size={16} className="text-green-500" /> : <TrendingDown size={16} className="text-red-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{title || '—'}</p>
                      <p className="text-[10px] text-gray-400">{r.updatedAt?.slice(0, 10) || ''}</p>
                    </div>
                    <span className={`text-sm font-semibold ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                      {isIncome ? '+' : '-'}{fmtMoney(Math.abs(amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconBg, iconColor, label, value, valueColor }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string; valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}
