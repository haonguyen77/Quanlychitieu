import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { MobileIcon } from './MobileIcon';
import { resolveCategoryVisual } from './mobileDataMapper';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Bell, User } from 'lucide-react';
import { NotificationBellMobile } from './NotificationMobile';

type FilterPeriod = 'week' | 'month' | 'year' | 'all';

/**
 * DashboardMobile — Full reproduction of Android dashboard_screen.dart.
 * Sections: Header, Period Filter, Summary Cards, Category Donut, Alerts, Comparison, Top 5, Beneficiaries, Recent.
 */
export function DashboardMobile() {
  const { data } = useAppStore();
  const [period, setPeriod] = useState<FilterPeriod>('month');
  const [showFilter, setShowFilter] = useState(false);
  const [refDate, setRefDate] = useState(new Date());
  const [showAllComparison, setShowAllComparison] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    const ref = refDate;
    let start: Date, end: Date;
    switch (period) {
      case 'week': { const d = ref.getDay(); const diff = d === 0 ? -6 : 1 - d; start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diff); end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59); break; }
      case 'month': start = new Date(ref.getFullYear(), ref.getMonth(), 1); end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59); break;
      case 'year': start = new Date(ref.getFullYear(), 0, 1); end = new Date(ref.getFullYear(), 11, 31, 23, 59, 59); break;
      default: start = new Date(2020, 0, 1); end = new Date(2099, 11, 31);
    }
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }, [period, refDate]);

  // All records for calculations
  const periodRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') return false;
      const dk = Object.keys(r.values).find(k => k.endsWith('_date'));
      const d = dk ? String(r.values[dk] ?? '') : '';
      return d >= startDate && d <= endDate;
    });
  }, [data, startDate, endDate]);

  const stats = useMemo(() => {
    let income = 0, expense = 0;
    const cats = new Map<string, number>();
    const beneficiaries = new Map<string, { total: number; count: number }>();

    for (const r of periodRecords) {
      const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
      const amount = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
      const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
      const type = typeKey ? String(r.values[typeKey] ?? '0') : '0';

      if (type === '1') income += amount;
      else if (type !== '2') {
        expense += amount;
        const catId = r.categoryId || '__other';
        cats.set(catId, (cats.get(catId) ?? 0) + amount);
        // Beneficiary
        const benKey = Object.keys(r.values).find(k => k.endsWith('_beneficiary'));
        const ben = benKey ? String(r.values[benKey] ?? '') : '';
        if (ben) { const prev = beneficiaries.get(ben) || { total: 0, count: 0 }; beneficiaries.set(ben, { total: prev.total + amount, count: prev.count + 1 }); }
      }
    }
    return { income, expense, categories: cats, beneficiaries };
  }, [periodRecords]);

  // Comparison: current month vs previous month
  const comparison = useMemo(() => {
    if (!data) return { month1: new Map<string, number>(), month2: new Map<string, number>(), m1Label: '', m2Label: '' };
    const now = new Date();
    const m2 = new Date(now.getFullYear(), now.getMonth(), 1);
    const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const m2End = new Date(m2.getFullYear(), m2.getMonth() + 1, 0).toISOString().slice(0, 10);
    const m1End = new Date(m1.getFullYear(), m1.getMonth() + 1, 0).toISOString().slice(0, 10);
    const m2Start = m2.toISOString().slice(0, 10);
    const m1Start = m1.toISOString().slice(0, 10);

    const month1 = new Map<string, number>();
    const month2 = new Map<string, number>();
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const dk = Object.keys(r.values).find(k => k.endsWith('_date'));
      const d = dk ? String(r.values[dk] ?? '') : '';
      const tk = Object.keys(r.values).find(k => k.endsWith('_type'));
      const type = tk ? String(r.values[tk] ?? '0') : '0';
      if (type !== '0') continue;
      const ak = Object.keys(r.values).find(k => k.endsWith('_amount'));
      const amt = ak ? Math.abs(Number(r.values[ak] ?? 0)) : 0;
      const catId = r.categoryId || '__other';

      if (d >= m1Start && d <= m1End) month1.set(catId, (month1.get(catId) ?? 0) + amt);
      if (d >= m2Start && d <= m2End) month2.set(catId, (month2.get(catId) ?? 0) + amt);
    }
    return { month1, month2, m1Label: `${String(m1.getMonth() + 1).padStart(2, '0')}/${m1.getFullYear()}`, m2Label: `${String(m2.getMonth() + 1).padStart(2, '0')}/${m2.getFullYear()}` };
  }, [data]);

  // Top 5 expenses
  const top5 = useMemo(() => {
    return periodRecords
      .filter(r => { const tk = Object.keys(r.values).find(k => k.endsWith('_type')); return tk ? String(r.values[tk]) === '0' : true; })
      .map(r => {
        const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
        const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
        return { title: titleKey ? String(r.values[titleKey] ?? '') : '—', amount: amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0 };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [periodRecords]);

  // Category donut — use the category's real icon + color (same as Add/Chi tiêu screens)
  const categoryData = useMemo(() => {
    const entries = Array.from(stats.categories.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    const fallback = ['#FF5722', '#FF9800', '#4CAF50', '#7B1FA2', '#1565C0', '#9E9E9E'];
    const mod = data?.modules.find(m => m.id === 'mod_chitieu');
    return entries.map(([id, amount], i) => {
      const cat = mod?.categories?.find(c => c.id === id);
      const v = resolveCategoryVisual(cat?.icon, cat?.color);
      return { name: cat?.name || 'Khác', amount, percent: (amount / total) * 100, color: cat?.color || v.color || fallback[i] || '#607D8B', icon: v.icon };
    });
  }, [stats.categories, data]);

  // Beneficiaries top 4
  const topBeneficiaries = useMemo(() => {
    return Array.from(stats.beneficiaries.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 4)
      .map(([name, { total, count }]) => ({ name, total, count }));
  }, [stats.beneficiaries]);

  const balance = stats.income - stats.expense;
  const daysInPeriod = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const avgPerDay = stats.expense / daysInPeriod;

  const fmtShort = (n: number) => { const abs = Math.abs(n); const p = n < 0 ? '-' : ''; if (abs >= 1000000) { const m = Math.floor(abs / 1000000); const h = Math.floor((abs - m * 1000000) / 100000); return h > 0 ? `${p}${m}M${h}` : `${p}${m}M`; } if (abs >= 1000) return `${p}${Math.round(abs / 1000).toLocaleString('vi-VN')}K`; return `${p}${abs}`; };
  const fmtNum = (n: number) => n.toLocaleString('vi-VN');

  const navigate = (dir: number) => { const d = new Date(refDate); if (period === 'week') d.setDate(d.getDate() + 7 * dir); else if (period === 'month') d.setMonth(d.getMonth() + dir); else if (period === 'year') d.setFullYear(d.getFullYear() + dir); setRefDate(d); };

  const colors = { navy: '#0F1F4D', purple: '#7B1FA2', darkPurple: '#4A148C', red: '#EF3030', green: '#20A84A', blue: '#1565C0', orange: '#FF8F00' };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="px-4 pb-0 flex items-center gap-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: colors.navy }}>Dashboard</h1>
          <p className="text-xs text-gray-500">Tổng quan tài chính cá nhân</p>
        </div>
        <NotificationBellMobile />
        <button className="w-9 h-9 flex items-center justify-center"><Search size={20} color={colors.navy} /></button>
        <button onClick={() => setShowFilter(!showFilter)} className="w-9 h-9 flex items-center justify-center">
          <SlidersHorizontal size={20} color={showFilter ? colors.purple : colors.navy} />
        </button>
      </div>

      {/* Period Filter */}
      {showFilter && (
        <div className="px-4 pt-2 flex items-center gap-1.5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronLeft size={18} color={colors.navy} /></button>
          {(['week', 'month', 'year', 'all'] as FilterPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} className="flex-1 py-2.5 rounded-full text-xs font-semibold text-center" style={{ backgroundColor: period === p ? colors.darkPurple : '#fff', color: period === p ? '#fff' : colors.navy, border: period === p ? 'none' : '1px solid #E5E7EB' }}>
              {{ week: 'Tuần', month: 'Tháng', year: 'Năm', all: 'Tất cả' }[p]}
            </button>
          ))}
          <button onClick={() => navigate(1)} className="w-9 h-9 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0"><ChevronRight size={18} color={colors.navy} /></button>
        </div>
      )}

      <div className="px-4 pb-20 pt-4 space-y-4">
        {/* Summary Cards Row 1 */}
        <div className="grid grid-cols-3 gap-2">
          <SummaryBox iconName="trending-up" color={colors.green} label="Tổng thu" value={fmtShort(stats.income)} />
          <SummaryBox iconName="arrow-down" color={colors.red} label="Tổng chi" value={fmtShort(stats.expense)} />
          <SummaryBox iconName="wallet" color={colors.blue} label="Số dư" value={fmtShort(balance)} />
        </div>
        {/* Summary Cards Row 2 */}
        <div className="grid grid-cols-2 gap-2">
          <SummaryBox iconName="credit-card" color={colors.purple} label="Tổng nợ" value="0" />
          <SummaryBox iconName="bar-chart-3" color={colors.orange} label="TB/ngày" value={fmtShort(avgPerDay)} />
        </div>

        {/* Category Donut */}
        {categoryData.length > 0 && (
          <Section title="Chi tiêu theo danh mục">
            <div className="flex items-center gap-4">
              <div className="relative w-[120px] h-[120px] flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {categoryData.reduce((acc, cat, i) => { const offset = acc.offset; const len = (cat.percent / 100) * 283; acc.elements.push(<circle key={i} cx="50" cy="50" r="45" fill="none" stroke={cat.color} strokeWidth="10" strokeDasharray={`${len} ${283 - len}`} strokeDashoffset={-offset} />); acc.offset += len; return acc; }, { offset: 0, elements: [] as React.ReactNode[] }).elements}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] text-gray-400">Tổng chi</span>
                  <span className="text-[11px] font-bold" style={{ color: colors.navy }}>{fmtShort(stats.expense)}</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {categoryData.map((cat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat.color}20` }}>
                      <MobileIcon name={cat.icon} size={13} color={cat.color} />
                    </div>
                    <span className="text-[11px] text-gray-700 flex-1 truncate">{cat.name}</span>
                    <span className="text-[11px] text-gray-500">{cat.percent.toFixed(0)}%</span>
                    <span className="text-[11px] font-medium text-right" style={{ color: cat.color }}>{fmtShort(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* Alerts */}
        <Section title="Cảnh báo" icon={<Bell size={16} color={colors.orange} />}>
          <p className="text-xs text-gray-400 text-center py-3">Không có cảnh báo</p>
        </Section>

        {/* Comparison */}
        <Section title="So sánh chi tiêu">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded">{comparison.m1Label}</span>
            <span className="text-[10px] text-gray-400">vs</span>
            <span className="text-[10px] text-white px-2 py-1 rounded" style={{ backgroundColor: colors.darkPurple }}>{comparison.m2Label}</span>
          </div>
          {(() => {
            const allCats = [...new Set([...comparison.month1.keys(), ...comparison.month2.keys()])];
            const display = showAllComparison ? allCats : allCats.slice(0, 5);
            if (allCats.length === 0) return <p className="text-xs text-gray-400 text-center py-2">Chưa có dữ liệu</p>;
            return (
              <>
                <div className="space-y-1.5">
                  {display.map(catId => {
                    const mod = data?.modules.find(m => m.id === 'mod_chitieu');
                    const cat = mod?.categories?.find(c => c.id === catId);
                    const v1 = comparison.month1.get(catId) || 0;
                    const v2 = comparison.month2.get(catId) || 0;
                    const diff = v2 - v1;
                    const pct = v1 > 0 ? ((diff / v1) * 100).toFixed(0) : v2 > 0 ? '100' : '0';
                    const diffColor = diff >= 0 ? colors.red : colors.green;
                    return (
                      <div key={catId} className="flex items-center gap-1 text-[10px]">
                        <span className="w-16 truncate text-gray-700">{cat?.name || 'Khác'}</span>
                        <span className="w-14 text-center" style={{ color: colors.navy }}>{fmtShort(v1)}</span>
                        <span className="w-14 text-center" style={{ color: colors.navy }}>{fmtShort(v2)}</span>
                        <span className="w-14 text-center" style={{ color: diffColor }}>{diff >= 0 ? '+' : ''}{fmtShort(diff)}</span>
                        <span className="w-10 text-right" style={{ color: diffColor }}>{diff >= 0 ? '+' : ''}{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                {allCats.length > 5 && (
                  <button onClick={() => setShowAllComparison(!showAllComparison)} className="mt-2 text-xs font-medium" style={{ color: colors.purple }}>
                    {showAllComparison ? 'Thu gọn' : 'Mở rộng'}
                  </button>
                )}
              </>
            );
          })()}
        </Section>

        {/* Top 5 */}
        {top5.length > 0 && (
          <Section title="Top 5 chi tiêu">
            <div className="space-y-2.5">
              {top5.map((t, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${colors.purple}18` }}>
                    <span className="text-[10px] font-bold" style={{ color: colors.purple }}>{i + 1}</span>
                  </div>
                  <span className="flex-1 text-xs text-gray-900 truncate">{t.title}</span>
                  <span className="text-xs font-medium" style={{ color: colors.navy }}>{fmtNum(t.amount)}đ</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Beneficiaries */}
        {topBeneficiaries.length > 0 && (
          <Section title="Người nhận" icon={<User size={14} color="#9CA3AF" />}>
            <div className="flex justify-around">
              {topBeneficiaries.map((b, i) => {
                const bColors = [colors.red, colors.orange, colors.purple, colors.blue];
                const c = bColors[i % bColors.length];
                return (
                  <div key={b.name} className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${c}18` }}>
                      <User size={18} color={c} />
                    </div>
                    <span className="text-[11px] font-medium mt-1.5 text-gray-900 max-w-[60px] truncate text-center">{b.name}</span>
                    <span className="text-[10px] text-gray-500">{fmtShort(b.total)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Recent Transactions */}
        <Section title="Giao dịch gần đây">
          {periodRecords.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">Chưa có giao dịch</p>
          ) : (
            <div className="space-y-2.5">
              {periodRecords.slice(0, 5).map(r => {
                const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
                const amtKey = Object.keys(r.values).find(k => k.endsWith('_amount'));
                const typeKey = Object.keys(r.values).find(k => k.endsWith('_type'));
                const dateKey = Object.keys(r.values).find(k => k.endsWith('_date'));
                const title = titleKey ? String(r.values[titleKey] ?? '') : '—';
                const amount = amtKey ? Math.abs(Number(r.values[amtKey] ?? 0)) : 0;
                const type = typeKey ? String(r.values[typeKey] ?? '0') : '0';
                const date = dateKey ? String(r.values[dateKey] ?? '') : '';
                const isIncome = type === '1';
                const catId = r.categoryId || '';
                const mod = data?.modules.find(m => m.id === 'mod_chitieu');
                const cat = mod?.categories?.find(c => c.id === catId);
                const catIcon = resolveCategoryVisual(cat?.icon, cat?.color);
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: catId && cat ? catIcon.bgColor : (isIncome ? '#E8F5E9' : '#FFEBEE') }}>
                      {catId && cat ? (
                        <MobileIcon name={catIcon.icon} size={14} color={catIcon.color} />
                      ) : (
                        <MobileIcon name={isIncome ? 'trending-up' : 'arrow-down'} size={14} color={isIncome ? '#20A84A' : '#EF3030'} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{title}</p>
                      <p className="text-[10px] text-gray-400">{date}</p>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: isIncome ? '#20A84A' : '#EF3030' }}>{isIncome ? '+' : '-'}{fmtShort(amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function SummaryBox({ iconName, color, label, value }: { iconName: string; color: string; label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <MobileIcon name={iconName} size={14} color={color} />
        </div>
        <span className="text-[9px] text-gray-500 leading-tight">{label}</span>
      </div>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-2xl p-4" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm font-semibold" style={{ color: '#0F1F4D' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
