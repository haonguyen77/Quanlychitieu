import { useMemo, useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { TimeFilter } from '@/shared/components/ui/TimeFilter';
import type { DatePreset } from '@/core/store/recordStore';

type DashboardPreset = 'week' | 'month' | 'year' | 'all' | 'custom';

function getWeekStart(): string { const now = new Date(); const day = now.getDay(); const diff = now.getDate() - day + (day === 0 ? -6 : 1); const m = new Date(now); m.setDate(diff); return m.toISOString().slice(0, 10); }
function getMonthStart(): string { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`; }
function getYearStart(): string { return `${new Date().getFullYear()}-01-01`; }
function getToday(): string { return new Date().toISOString().slice(0, 10); }
function fmtMoney(n: number) { return n.toLocaleString('vi-VN') + 'd'; }
function fmtShort(n: number) { if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M'; if (Math.abs(n) >= 1000) return (n / 1000).toFixed(0) + 'K'; return n.toLocaleString('vi-VN'); }

export function DashboardView() {
  const { data, setActiveModule } = useAppStore();
  const [dashPreset, setDashPreset] = useState<DashboardPreset>('month');
  const [customFrom, setCustomFrom] = useState(getMonthStart());
  const [customTo, setCustomTo] = useState(getToday());
  const [compareMonth1, setCompareMonth1] = useState(() => { const n = new Date(); const p = new Date(n.getFullYear(), n.getMonth() - 1); return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`; });
  const [compareMonth2, setCompareMonth2] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });
  const [dailyMonth, setDailyMonth] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; });
  const [yearlyYear, setYearlyYear] = useState(() => new Date().getFullYear());
  const [yearlyChartType, setYearlyChartType] = useState<'bar' | 'pie'>('bar');
  const [alertsExpanded, _setAlertsExpanded] = useState(false);
  const [hiddenCategoryIds, setHiddenCategoryIds] = useState<Set<string>>(new Set());

  const toggleCategory = (id: string) => {
    setHiddenCategoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { dateFrom, dateTo } = useMemo(() => {
    if (dashPreset === 'custom') return { dateFrom: customFrom, dateTo: customTo };
    if (dashPreset === 'all') return { dateFrom: '', dateTo: '' };
    const to = getToday();
    const from = dashPreset === 'week' ? getWeekStart() : dashPreset === 'month' ? getMonthStart() : getYearStart();
    return { dateFrom: from, dateTo: to };
  }, [dashPreset, customFrom, customTo]);

  const handlePresetChange = (preset: DatePreset) => {
    setDashPreset(preset);
    if (preset === 'week') { setCustomFrom(getWeekStart()); setCustomTo(getToday()); }
    else if (preset === 'month') { setCustomFrom(getMonthStart()); setCustomTo(getToday()); }
    else if (preset === 'year') { setCustomFrom(getYearStart()); setCustomTo(getToday()); }
  };
  const handleDateRangeChange = (from: string, to: string) => { setCustomFrom(from); setCustomTo(to); setDashPreset('custom'); };
  const navigateToCategory = (catId: string, monthKey?: string) => {
    const from = monthKey ? `${monthKey}-01` : dateFrom;
    const to = monthKey ? (() => { const [y, m] = monthKey.split('-').map(Number); const last = new Date(y, m, 0).getDate(); return `${monthKey}-${String(last).padStart(2, '0')}`; })() : dateTo;
    useRecordStore.setState({ dateFrom: from, dateTo: to, datePreset: 'custom', filterCategory: catId, filterModule: null, filterAccount: null, _skipApplyDefault: true, currentPage: 1 });
    setActiveModule('mod_chitieu');
  };
  const navigateToChiTieu = (from?: string, to?: string) => {
    useRecordStore.setState({ dateFrom: from || '', dateTo: to || '', datePreset: from ? 'custom' : 'month', filterCategory: null, filterModule: null, filterAccount: null, _skipApplyDefault: true, currentPage: 1 });
    setActiveModule('mod_chitieu');
  };
  const navigateToAccount = (accValue: string) => {
    useRecordStore.setState({ dateFrom: dateFrom, dateTo: dateTo, datePreset: 'custom', filterCategory: null, filterModule: null, filterAccount: accValue, _skipApplyDefault: true, currentPage: 1 });
    setActiveModule('mod_chitieu');
  };

  // ─── Main Stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return { totalExpense: 0, totalIncome: 0, totalRecords: 0, prevExpense: 0, prevIncome: 0, prevRecords: 0 };
    const chiRecs = data.records.filter((r) => r.moduleId === 'mod_chitieu' && !r.isDeleted);
    const inRange = (d: string) => { if (!dateFrom && !dateTo) return true; if (dateFrom && d < dateFrom) return false; if (dateTo && d > dateTo) return false; return true; };
    const getDate = (r: typeof chiRecs[0]) => { const k = Object.keys(r.values).find((x) => x.endsWith('_date')); return k ? String(r.values[k] ?? '') : ''; };
    const getAmt = (r: typeof chiRecs[0]) => { const k = Object.keys(r.values).find((x) => x.endsWith('_amount')); return k ? Number(r.values[k] ?? 0) : 0; };
    const getType = (r: typeof chiRecs[0]) => { const k = Object.keys(r.values).find((x) => x.endsWith('_type')); return k ? r.values[k] : '0'; };

    let totalExpense = 0, totalIncome = 0, totalRecords = 0;
    for (const r of chiRecs) { const d = getDate(r); if (!inRange(d)) continue; const a = getAmt(r); const t = getType(r); if (t === '1') totalIncome += a; else if (t !== '2') totalExpense += a; totalRecords++; }

    // Previous period for comparison %
    let prevFrom = '', prevTo = '';
    if (dashPreset === 'month') { const n = new Date(); const p = new Date(n.getFullYear(), n.getMonth() - 1, 1); prevFrom = p.toISOString().slice(0, 10); prevTo = new Date(n.getFullYear(), n.getMonth(), 0).toISOString().slice(0, 10); }
    else if (dashPreset === 'year') { prevFrom = `${new Date().getFullYear() - 1}-01-01`; prevTo = `${new Date().getFullYear() - 1}-12-31`; }
    let prevExpense = 0, prevIncome = 0, prevRecords = 0;
    if (prevFrom) { for (const r of chiRecs) { const d = getDate(r); if (d < prevFrom || d > prevTo) continue; const a = getAmt(r); const t = getType(r); if (t === '1') prevIncome += a; else if (t !== '2') prevExpense += a; prevRecords++; } }
    return { totalExpense, totalIncome, totalRecords, prevExpense, prevIncome, prevRecords };
  }, [data, dateFrom, dateTo, dashPreset]);

  // ─── Category Breakdown (pie) ─────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    if (!data) return [];
    const chiTieu = data.modules.find((m) => m.id === 'mod_chitieu');
    const catMap = new Map<string, number>();
    for (const r of data.records) {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); const d = dk ? String(r.values[dk] ?? '') : '';
      if (dateFrom && d < dateFrom) continue; if (dateTo && d > dateTo) continue;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type')); if (tk && (r.values[tk] === '1' || r.values[tk] === '2')) continue;
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const amt = ak ? Number(r.values[ak] ?? 0) : 0;
      const catId = (r.categoryId && !r.categoryId.startsWith('mod_')) ? r.categoryId : '__other';
      catMap.set(catId, (catMap.get(catId) ?? 0) + amt);
    }
    const total = Array.from(catMap.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(catMap.entries()).map(([id, amt]) => {
      const cat = chiTieu?.categories?.find((c) => c.id === id);
      return { id, name: cat?.name || 'Khac', color: cat?.color || '#607D8B', icon: cat?.icon, amount: amt, percent: (amt / total) * 100 };
    }).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [data, dateFrom, dateTo]);

  // ─── Payment Method Breakdown (pie) ───────────────────────────────────────
  const paymentBreakdown = useMemo(() => {
    if (!data) return [];
    const chiTieu = data.modules.find((m) => m.id === 'mod_chitieu');
    const accField = chiTieu?.fields.find((f) => f.fieldName === 'account');
    const accMap = new Map<string, number>();
    for (const r of data.records) {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); const d = dk ? String(r.values[dk] ?? '') : '';
      if (dateFrom && d < dateFrom) continue; if (dateTo && d > dateTo) continue;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type')); if (tk && (r.values[tk] === '1' || r.values[tk] === '2')) continue;
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const amt = ak ? Number(r.values[ak] ?? 0) : 0;
      const accK = Object.keys(r.values).find((x) => x.endsWith('_account')); const acc = accK ? String(r.values[accK] ?? 'cash') : 'cash';
      accMap.set(acc, (accMap.get(acc) ?? 0) + amt);
    }
    const total = Array.from(accMap.values()).reduce((s, v) => s + v, 0) || 1;
    return Array.from(accMap.entries()).map(([value, amt]) => {
      let name = value, color = '#607D8B';
      if (value.startsWith('credit_card_')) {
        const cid = value.replace('credit_card_', '');
        const cr = data.records.find((r2) => r2.id === cid && r2.moduleId === 'mod_creditcard');
        if (cr) {
          // Tìm đúng field card_name thay vì dùng Object.values chung chung (dễ lấy nhầm UUID)
          const cardNameKey = Object.keys(cr.values).find((k) => k.endsWith('_card_name'));
          name = cardNameKey ? String(cr.values[cardNameKey] ?? 'Thẻ TD') : 'Thẻ TD';
        } else {
          name = 'Thẻ tín dụng';
        }
        color = '#1A237E';
      } else {
        const opt = accField?.options?.find((o) => o.value === value);
        if (opt) { name = opt.label; color = opt.color || '#607D8B'; }
      }
      return { value, name, color, amount: amt, percent: (amt / total) * 100 };
    }).sort((a, b) => b.amount - a.amount).slice(0, 6);
  }, [data, dateFrom, dateTo]);

  // ─── Alerts ───────────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    if (!data) return [];
    const items: { id: string; type: 'warranty' | 'creditcard' | 'rent'; label: string; detail: string; date?: string; urgent: boolean }[] = [];
    const now = new Date(); const alertDays = data.settings?.warrantyAlertDays ?? 10;

    // 1. Credit card payment due
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_creditcard') continue;
      const dk = Object.keys(r.values).find((k) => k.endsWith('_payment_due_day'));
      if (!dk) continue;
      const dueDay = Number(r.values[dk]);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) continue;
      let diff = dueDay - now.getDate();
      if (diff < -15) diff += 30;
      if (diff >= 0 && diff <= alertDays) {
        const nk = Object.keys(r.values).find((k) => k.endsWith('_card_name'));
        items.push({ id: r.id, type: 'creditcard', label: diff === 0 ? 'Hom nay' : `Con ${diff} ngay`, detail: `Thanh toan the ${nk ? r.values[nk] : ''}`, date: `Ngay ${dueDay}`, urgent: diff <= 2 });
      }
    }

    // 2. Rent due (from rentalSettings in AppSettings)
    const rentalSettings = data.settings?.rentalSettings;
    if (rentalSettings?.rentDueDate) {
      const dueDate = new Date(rentalSettings.rentDueDate + 'T00:00:00');
      if (!isNaN(dueDate.getTime())) {
        const rentAlertDays = rentalSettings.rentAlertDays || 5;
        const diff = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        if (diff >= 0 && diff <= rentAlertDays) {
          items.push({ id: 'rent_reminder', type: 'rent', label: diff === 0 ? 'Hom nay' : `Con ${diff} ngay`, detail: 'Dong tien nha tro', date: dueDate.toLocaleDateString('vi-VN'), urgent: diff <= 1 });
        }
      }
    }

    // 3. Warranty expiry (ONLY records with valid warranty_date, skip null/empty/undefined)
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const wk = Object.keys(r.values).find((k) => k === 'mod_chitieu_warranty_date');
      if (!wk) continue;
      const wdVal = r.values[wk];
      // Skip if empty, null, undefined, or not a valid date string
      if (!wdVal || wdVal === null || wdVal === '' || wdVal === 'null' || wdVal === 'undefined') continue;
      const wdStr = String(wdVal).trim();
      if (wdStr.length < 8) continue; // Must be at least YYYY-MM-DD format
      const wd = new Date(wdStr);
      if (isNaN(wd.getTime())) continue;
      // Must be a future-ish date or recently expired (not purchase date)
      const dl = Math.ceil((wd.getTime() - now.getTime()) / 86400000);
      if (dl <= alertDays && dl >= -30) {
        const tk = Object.keys(r.values).find((k) => k.endsWith('_title'));
        items.push({ id: r.id, type: 'warranty', label: dl < 0 ? 'Het han' : `Con ${dl} ngay`, detail: String(tk ? r.values[tk] : 'San pham'), date: wd.toLocaleDateString('vi-VN'), urgent: dl < 0 });
      }
    }

    return items.sort((a, b) => (a.urgent ? 0 : 1) - (b.urgent ? 0 : 1));
  }, [data]);

  // ─── Daily chart data ─────────────────────────────────────────────────────
  const dailyData = useMemo(() => {
    if (!data) return [];
    const [y, m] = dailyMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, expense: 0, income: 0 }));
    for (const r of data.records) {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); if (!dk || !r.values[dk]) continue;
      const d = String(r.values[dk]); if (!d.startsWith(dailyMonth)) continue;
      const dayNum = parseInt(d.substring(8, 10), 10); if (dayNum < 1 || dayNum > daysInMonth) continue;
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const amt = ak ? Number(r.values[ak] ?? 0) : 0;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type'));
      if (tk && r.values[tk] === '1') days[dayNum - 1].income += amt; else days[dayNum - 1].expense += amt;
    }
    return days;
  }, [data, dailyMonth]);

  // ─── Yearly chart data ────────────────────────────────────────────────────
  const yearlyData = useMemo(() => {
    if (!data) return [];
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, label: `T${i + 1}`, expense: 0, income: 0 }));
    for (const r of data.records) {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); if (!dk || !r.values[dk]) continue;
      const d = String(r.values[dk]); if (!d.startsWith(String(yearlyYear))) continue;
      const mi = parseInt(d.substring(5, 7), 10) - 1; if (mi < 0 || mi > 11) continue;
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const amt = ak ? Number(r.values[ak] ?? 0) : 0;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type'));
      if (tk && r.values[tk] === '1') months[mi].income += amt; else months[mi].expense += amt;
    }
    return months;
  }, [data, yearlyYear]);

  // ─── Top 5 largest expenses ───────────────────────────────────────────────
  const top5Expenses = useMemo(() => {
    if (!data) return [];
    return data.records.filter((r) => {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) return false;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); const d = dk ? String(r.values[dk] ?? '') : '';
      if (dateFrom && d < dateFrom) return false; if (dateTo && d > dateTo) return false;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type')); return !(tk && r.values[tk] === '1');
    }).map((r) => {
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const tk = Object.keys(r.values).find((x) => x.endsWith('_title')); const dk = Object.keys(r.values).find((x) => x.endsWith('_date'));
      return { id: r.id, title: String(tk ? r.values[tk] : '—'), amount: ak ? Number(r.values[ak] ?? 0) : 0, date: dk ? String(r.values[dk] ?? '') : '' };
    }).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [data, dateFrom, dateTo]);

  // ─── Top 5 categories ─────────────────────────────────────────────────────
  const top5Categories = useMemo(() => categoryBreakdown.slice(0, 5), [categoryBreakdown]);

  // ─── Module Breakdown (per linkedModuleId) ────────────────────────────────
  const moduleBreakdown = useMemo(() => {
    if (!data) return [];
    const modMap = new Map<string, number>();
    for (const r of data.records) {
      if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue;
      const dk = Object.keys(r.values).find((x) => x.endsWith('_date'));
      const d = dk ? String(r.values[dk] ?? '') : '';
      if (dateFrom && d < dateFrom) continue;
      if (dateTo && d > dateTo) continue;
      const tk = Object.keys(r.values).find((x) => x.endsWith('_type'));
      if (tk && r.values[tk] === '1') continue;
      const ak = Object.keys(r.values).find((x) => x.endsWith('_amount'));
      const amt = ak ? Math.abs(Number(r.values[ak] ?? 0)) : 0;
      const modId = r.linkedModuleId || '_none';
      modMap.set(modId, (modMap.get(modId) ?? 0) + amt);
    }
    const total = Array.from(modMap.values()).reduce((s, v) => s + v, 0);
    return Array.from(modMap.entries())
      .map(([id, amt]) => {
        const mod = id === '_none' ? null : data.modules.find(m => m.id === id);
        return { id, name: mod?.name || 'Chi tiêu chung', color: mod?.color || '#607D8B', amount: amt, percent: total > 0 ? (amt / total) * 100 : 0 };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data, dateFrom, dateTo]);

  // ─── Comparison ───────────────────────────────────────────────────────────
  const comparison = useMemo(() => {
    if (!data) return { total1: 0, total2: 0, diff: 0, diffPct: 0, cats: [] as { id: string; name: string; color: string; amt1: number; amt2: number }[] };
    const chiTieu = data.modules.find((m) => m.id === 'mod_chitieu');
    const getData = (mk: string) => { let t = 0; const cm = new Map<string, number>(); for (const r of data.records) { if (r.moduleId !== 'mod_chitieu' || r.isDeleted) continue; const dk = Object.keys(r.values).find((x) => x.endsWith('_date')); if (!dk || !r.values[dk]) continue; if (!String(r.values[dk]).startsWith(mk)) continue; const tk = Object.keys(r.values).find((x) => x.endsWith('_type')); if (tk && (r.values[tk] === '1' || r.values[tk] === '2')) continue; const ak = Object.keys(r.values).find((x) => x.endsWith('_amount')); const a = ak ? Number(r.values[ak] ?? 0) : 0; t += a; const cid = (r.categoryId && !r.categoryId.startsWith('mod_')) ? r.categoryId : '__other'; cm.set(cid, (cm.get(cid) ?? 0) + a); } return { t, cm }; };
    const d1 = getData(compareMonth1); const d2 = getData(compareMonth2);
    const allCats = new Set([...d1.cm.keys(), ...d2.cm.keys()]);
    const cats = Array.from(allCats).map((id) => { const c = chiTieu?.categories?.find((x) => x.id === id); return { id, name: c?.name || 'Khac', color: c?.color || '#607D8B', amt1: d1.cm.get(id) ?? 0, amt2: d2.cm.get(id) ?? 0 }; }).sort((a, b) => Math.max(b.amt1, b.amt2) - Math.max(a.amt1, a.amt2)).slice(0, 5);
    const diff = d2.t - d1.t; const diffPct = d1.t > 0 ? (diff / d1.t) * 100 : 0;
    return { total1: d1.t, total2: d2.t, diff, diffPct, cats };
  }, [data, compareMonth1, compareMonth2]);

  if (!data) return null;
  const balance = stats.totalIncome - stats.totalExpense;
  const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : '0';
  const expPct = pctChange(stats.totalExpense, stats.prevExpense);
  const incPct = pctChange(stats.totalIncome, stats.prevIncome);
  const recDiff = stats.totalRecords - stats.prevRecords;
  // Previous month label
  const prevMonthLabel = (() => {
    const now = new Date();
    const pm = dashPreset === 'year' ? now.getFullYear() - 1 : (now.getMonth() === 0 ? 12 : now.getMonth());
    return dashPreset === 'year' ? `${now.getFullYear() - 1}` : `T${pm}`;
  })();
  const maxDaily = Math.max(...dailyData.map((d) => d.expense + d.income), 1);
  const maxYearly = Math.max(...yearlyData.map((m) => Math.max(m.expense, m.income)), 1);

  // ─── PIE CHART SVG HELPER ─────────────────────────────────────────────────
  const PIE_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6'];
  const renderPie = (
    items: { name: string; color: string; amount: number; percent: number; id?: string }[],
    totalLabel: string,
    onClickItem?: (id: string) => void,
    hiddenIds?: Set<string>,
    onToggleHide?: (id: string) => void,
  ) => {
    const visibleItems = hiddenIds ? items.filter(i => !hiddenIds.has(i.id ?? i.name)) : items;
    const total = visibleItems.reduce((s, c) => s + c.amount, 0);
    const grandTotal = items.reduce((s, c) => s + c.amount, 0);    let cum = 0;
    const slices = visibleItems.map((item, idx) => {
      const angle = (item.amount / (total || 1)) * 360;
      const start = cum; cum += angle; const end = cum;
      const large = angle > 180 ? 1 : 0;
      const r = 70, cx = 80, cy = 80;
      const x1 = cx + r * Math.cos((start - 90) * Math.PI / 180);
      const y1 = cy + r * Math.sin((start - 90) * Math.PI / 180);
      const x2 = cx + r * Math.cos((end - 90) * Math.PI / 180);
      const y2 = cy + r * Math.sin((end - 90) * Math.PI / 180);
      const color = item.color && item.color !== '#607D8B' ? item.color : PIE_COLORS[idx % PIE_COLORS.length];
      const path = angle >= 359.9
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { ...item, color, path, idx };
    });
    return (
      <div className="flex items-center gap-3">
        <svg width="160" height="160" viewBox="0 0 160 160" className="flex-shrink-0">
          {slices.map((s) => (
            <path key={s.idx} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5"
              className="hover:opacity-70 cursor-pointer transition-opacity"
              onClick={() => onClickItem?.(visibleItems[s.idx]?.id || visibleItems[s.idx]?.name || '')}>
              <title>{s.name}: {fmtShort(s.amount)} ({s.percent.toFixed(1)}%)</title>
            </path>
          ))}
          <circle cx="80" cy="80" r="35" fill="var(--color-bg, white)" />
          <text x="80" y="76" textAnchor="middle" className="text-[9px]" fill="var(--color-text-secondary, #666)">{totalLabel}</text>
          <text x="80" y="92" textAnchor="middle" className="text-xs font-bold" fill="var(--color-text, #333)">{fmtShort(grandTotal)}</text>
        </svg>
        <div className="flex-1 space-y-1">
          {items.map((item) => {
            const isHidden = hiddenIds?.has(item.id ?? item.name);
            const originalIdx = items.indexOf(item);
            const color = item.color && item.color !== '#607D8B' ? item.color : PIE_COLORS[originalIdx % PIE_COLORS.length];
            return (
              <div key={item.name} className={`flex items-center gap-2 text-xs rounded px-1 -mx-1 py-0.5 transition-opacity ${isHidden ? 'opacity-40' : ''}`}>
                <button
                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer hover:bg-[var(--color-surface)] rounded"
                  onClick={() => onClickItem?.(item.id || item.name || '')}
                  title="Xem giao dịch"
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: isHidden ? '#ccc' : color }} />
                  <span className="flex-1 truncate text-[var(--color-text)]">{item.name}</span>
                  <span className="text-[var(--color-text-secondary)] tabular-nums">{fmtShort(item.amount)}</span>
                  <span className="text-[var(--color-text-secondary)] w-12 text-right">({grandTotal > 0 ? ((item.amount / grandTotal) * 100).toFixed(1) : '0.0'}%)</span>
                </button>
                {onToggleHide && (
                  <button
                    onClick={() => onToggleHide(item.id ?? item.name)}
                    className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-border)] transition-colors"
                    title={isHidden ? 'Hiện danh mục này' : 'Ẩn danh mục này khỏi chart'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isHidden ? 'text-gray-400' : 'text-gray-500'}>
                      {isHidden
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      }
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-white dark:bg-[var(--color-bg)]">
        <div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Dashboard</h1>
          <p className="text-xs text-[var(--color-text-secondary)]">Tong quan tai chinh ca nhan</p>
        </div>
        <TimeFilter datePreset={dashPreset} dateFrom={customFrom} dateTo={customTo} onPresetChange={handlePresetChange} onDateRangeChange={handleDateRangeChange} presets={['week', 'month', 'year', 'all']} />
      </div>

      <div className="p-5 space-y-4 bg-[var(--color-surface)]">
        {/* Row 1: 4 Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard icon="trending-down" iconColor="#6366F1" bg="bg-indigo-50 dark:bg-indigo-900/20" label="Tong chi" value={fmtMoney(stats.totalExpense)} change={`${Number(expPct) >= 0 ? '↑' : '↓'} ${Math.abs(Number(expPct))}% so với ${prevMonthLabel}`} changeUp={Number(expPct) > 0} />
          <StatCard icon="trending-up" iconColor="#10B981" bg="bg-emerald-50 dark:bg-emerald-900/20" label="Tong thu" value={fmtMoney(stats.totalIncome)} change={`${Number(incPct) >= 0 ? '↑' : '↓'} ${Math.abs(Number(incPct))}% so với ${prevMonthLabel}`} changeUp={Number(incPct) > 0} />
          <StatCard icon="wallet" iconColor="#3B82F6" bg="bg-blue-50 dark:bg-blue-900/20" label="So du" value={`${balance >= 0 ? '' : '-'}${fmtMoney(Math.abs(balance))}`} change={`${Number(expPct) > 0 ? '↓' : '↑'} ${Math.abs(Number(expPct))}% so với ${prevMonthLabel}`} changeUp={Number(expPct) <= 0} />
          <StatCard icon="file-text" iconColor="#F97316" bg="bg-orange-50 dark:bg-orange-900/20" label="Ban ghi" value={String(stats.totalRecords)} change={`${recDiff >= 0 ? '+' : ''}${recDiff} so với ${prevMonthLabel}`} changeUp={recDiff >= 0} />
        </div>

        {/* Row 2: Alerts | Category Pie | Payment Pie */}
        <div className="grid grid-cols-3 gap-3">
          {/* Alerts */}
          <div className="card p-4 border-l-4 border-l-orange-400">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[var(--color-text)] flex items-center gap-1.5"><Icon name="alert-triangle" size={14} className="text-orange-500" />Canh bao <span className="text-xs text-orange-500 font-bold">({alerts.length})</span></h3>
              <button onClick={() => {
                useRecordStore.setState({ dateFrom: '', dateTo: '', datePreset: 'all', filterCategory: null, filterModule: null, filterAccount: null, filterWarrantyAlert: true, _skipApplyDefault: true, currentPage: 1 });
                setActiveModule('mod_chitieu');
              }} className="text-[10px] text-blue-500 hover:underline">Xem tat ca</button>
            </div>
            <div className={`space-y-1 ${alertsExpanded ? 'max-h-[400px]' : 'max-h-[180px]'} overflow-y-auto`}>
              {(alertsExpanded ? alerts : alerts.slice(0, 7)).map((a) => (
                <div key={a.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${a.urgent ? 'bg-red-50 dark:bg-red-900/10' : 'bg-orange-50 dark:bg-orange-900/10'}`}>
                  <span className={`font-medium whitespace-nowrap ${a.urgent ? 'text-red-600' : 'text-orange-600'}`}>{a.label}</span>
                  <span className="flex-1 truncate text-[var(--color-text)]">{a.detail}</span>
                  {a.date && <span className="text-[var(--color-text-secondary)] whitespace-nowrap">{a.date}</span>}
                </div>
              ))}
              {alerts.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] text-center py-4">Khong co canh bao</p>}
            </div>
          </div>
          {/* Category Pie */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">Chi tieu theo danh muc</h3>
            {categoryBreakdown.length > 0 ? renderPie(categoryBreakdown, 'Tong chi', (id) => navigateToCategory(id), hiddenCategoryIds, toggleCategory) : <p className="text-xs text-center py-8 text-[var(--color-text-secondary)]">Chua co du lieu</p>}
          </div>
          {/* Payment Pie */}
          <div className="card p-4">
            <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">Chi tieu theo phuong thuc</h3>
            {paymentBreakdown.length > 0 ? renderPie(paymentBreakdown.map((p) => ({ ...p, id: p.value })), 'Tong chi', (id) => navigateToAccount(id)) : <p className="text-xs text-center py-8 text-[var(--color-text-secondary)]">Chua co du lieu</p>}
          </div>
        </div>

        {/* Row 3: Comparison | Daily Chart */}
        <div className="grid grid-cols-[1.2fr_1fr] gap-3">
          {/* Comparison - horizontal bars */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">So sanh chi tieu</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => { const [y, m] = compareMonth1.split('-').map(Number); const p = new Date(y, m - 2, 1); setCompareMonth1(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-left" size={12} /></button>
                <span className="text-[10px] text-[var(--color-text)]">Thang {compareMonth1.split('-')[1]}/{compareMonth1.split('-')[0]}</span>
                <button onClick={() => { const [y, m] = compareMonth1.split('-').map(Number); const n2 = new Date(y, m, 1); setCompareMonth1(`${n2.getFullYear()}-${String(n2.getMonth() + 1).padStart(2, '0')}`); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-right" size={12} /></button>
                <span className="mx-1 text-[var(--color-text-secondary)]">•</span>
                <button onClick={() => { const [y, m] = compareMonth2.split('-').map(Number); const p = new Date(y, m - 2, 1); setCompareMonth2(`${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-left" size={12} /></button>
                <span className="text-[10px] text-[var(--color-text)]">Thang {compareMonth2.split('-')[1]}/{compareMonth2.split('-')[0]}</span>
                <button onClick={() => { const [y, m] = compareMonth2.split('-').map(Number); const n2 = new Date(y, m, 1); setCompareMonth2(`${n2.getFullYear()}-${String(n2.getMonth() + 1).padStart(2, '0')}`); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-right" size={12} /></button>
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-3 mb-2 text-[9px] text-[var(--color-text-secondary)]"><span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-green-500 rounded-sm" />It hon</span><span className="flex items-center gap-1"><span className="w-2.5 h-1.5 bg-red-500 rounded-sm" />Nhieu hon</span></div>
            {/* Header */}
            <div className="grid grid-cols-[60px_1fr_1fr_70px] gap-1 text-[8px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
              <span>Danh muc</span><span className="text-center">Thang {compareMonth1.split('-')[1]}</span><span className="text-center">Thang {compareMonth2.split('-')[1]}</span><span className="text-right"></span>
            </div>
            {/* Rows */}
            <div className="space-y-2">
              {(() => { const globalMax = Math.max(...comparison.cats.map((x) => Math.max(x.amt1, x.amt2)), 1); return comparison.cats.map((c) => {
                const diff = c.amt2 - c.amt1;
                const pct = c.amt1 > 0 ? ((diff / c.amt1) * 100) : (c.amt2 > 0 ? 100 : 0);
                return (
                  <div key={c.name} className="grid grid-cols-[70px_1fr_1fr_70px] gap-2 items-center rounded px-1 py-1">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} /><span className="text-xs truncate text-[var(--color-text)]">{c.name}</span></div>
                    <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-70" onClick={() => navigateToCategory(c.id, compareMonth1)}>
                      <span className="text-xs tabular-nums text-[var(--color-text)] w-16 text-right">{fmtShort(c.amt1)}d</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex justify-end"><div className={`h-full rounded-full ${c.amt1 >= c.amt2 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${(c.amt1 / globalMax) * 100}%` }} /></div>
                    </div>
                    <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-70" onClick={() => navigateToCategory(c.id, compareMonth2)}>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${c.amt2 >= c.amt1 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${(c.amt2 / globalMax) * 100}%` }} /></div>
                      <span className="text-xs tabular-nums text-[var(--color-text)] w-16">{fmtShort(c.amt2)}d</span>
                    </div>
                    <div className={`text-xs text-right font-medium ${diff > 0 ? 'text-red-500' : diff < 0 ? 'text-green-500' : 'text-gray-400'}`}>{diff > 0 ? '+' : ''}{pct.toFixed(1)}% {diff > 0 ? '↑' : diff < 0 ? '↓' : ''}</div>
                  </div>
                );
              }); })()}
            </div>
          </div>

          {/* Daily Chart - thin bars with Y-axis */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--color-text)]">Chi tieu theo ngay</h3>
              <div className="flex items-center gap-2">
                <input type="month" className="input-field py-0.5 px-1.5 text-[10px] w-[100px]" value={dailyMonth} onChange={(e) => setDailyMonth(e.target.value)} />
                <div className="flex items-center gap-2 text-[9px] text-[var(--color-text-secondary)]"><span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm" />Chi</span><span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-sm" />Thu</span></div>
              </div>
            </div>
            <div className="flex gap-1">
              {/* Y-axis */}
              <div className="flex flex-col justify-between h-28 text-[7px] text-[var(--color-text-secondary)] text-right w-6 py-0.5">
                <span>{fmtShort(maxDaily)}</span><span>{fmtShort(maxDaily * 0.5)}</span><span>0</span>
              </div>
              {/* Bars */}
              <div className="flex-1 flex items-end gap-[1px] h-28 border-l border-b border-gray-200 dark:border-gray-700">
                {dailyData.map((d) => (
                  <div key={d.day} className="flex-1 flex justify-center items-end h-full group/day relative cursor-pointer"
                    onClick={() => { const ds = `${dailyMonth}-${String(d.day).padStart(2, '0')}`; navigateToChiTieu(ds, ds); }}>
                    <div className="flex gap-[1px] items-end h-full">
                      {d.expense > 0 && <div className="w-[3px] bg-red-400 hover:bg-red-500 rounded-t-[1px]" style={{ height: `${(d.expense / maxDaily) * 100}%`, minHeight: '1px' }} />}
                      {d.income > 0 && <div className="w-[3px] bg-green-400 hover:bg-green-500 rounded-t-[1px]" style={{ height: `${(d.income / maxDaily) * 100}%`, minHeight: '1px' }} />}
                    </div>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/day:block bg-gray-800 text-white text-[8px] px-1.5 py-0.5 rounded whitespace-nowrap z-20 pointer-events-none">Ngay {d.day}: {d.expense.toLocaleString('vi-VN')}d</div>
                  </div>
                ))}
              </div>
            </div>
            {/* X-axis */}
            <div className="flex pl-7 gap-[1px]">{dailyData.map((d) => (<div key={d.day} className="flex-1 text-center"><span className="text-[6px] text-[var(--color-text-secondary)]">{d.day % 2 === 1 ? String(d.day).padStart(2, '0') : ''}</span></div>))}</div>
          </div>
        </div>

        {/* Row 4: Top 5 Expenses | Top 5 Categories | Yearly Chart */}
        <div className="grid grid-cols-3 gap-3">
          {/* Top 5 Expenses */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--color-text)]">Top 5 chi tieu lon nhat</h3>
              <button onClick={() => navigateToChiTieu(dateFrom, dateTo)} className="text-[10px] text-blue-500 hover:underline">Xem tat ca</button>
            </div>
            <div className="space-y-2">
              {top5Expenses.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-yellow-500' : 'bg-gray-400'}`}>{i + 1}</span>
                  <span className="flex-1 text-xs truncate text-[var(--color-text)]">{item.title}</span>
                  <span className="text-xs font-medium tabular-nums text-[var(--color-text)]">{fmtShort(item.amount)}</span>
                  <span className="text-[10px] text-[var(--color-text-secondary)]">{item.date ? new Date(item.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : ''}</span>
                </div>
              ))}
              {top5Expenses.length === 0 && <p className="text-xs text-center py-4 text-[var(--color-text-secondary)]">Chua co du lieu</p>}
            </div>
          </div>

          {/* Top 5 Categories */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--color-text)]">Top 5 danh muc chi nhieu nhat</h3>
              <button className="text-[10px] text-blue-500 hover:underline">Xem tat ca</button>
            </div>
            <div className="space-y-2">
              {top5Categories.map((cat, i) => {
                const maxAmt = top5Categories[0]?.amount || 1;
                return (
                  <div key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-surface)] rounded px-1 -mx-1 py-0.5" onClick={() => navigateToCategory(cat.id)}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white`} style={{ backgroundColor: cat.color }}>{i + 1}</span>
                    <span className="text-xs text-[var(--color-text)] w-16 truncate">{cat.name}</span>
                    <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(cat.amount / maxAmt) * 100}%`, backgroundColor: cat.color }} /></div>
                    <span className="text-xs tabular-nums text-[var(--color-text)]">{fmtShort(cat.amount)}</span>
                    <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{cat.percent.toFixed(1)}%</span>
                  </div>
                );
              })}
              {top5Categories.length === 0 && <p className="text-xs text-center py-4 text-[var(--color-text-secondary)]">Chua co du lieu</p>}
            </div>
          </div>

          {/* Module Breakdown */}
          {moduleBreakdown.length > 1 && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-[var(--color-text)] mb-3">Chi tiêu theo module</h3>
              <div className="space-y-2">
                {moduleBreakdown.map((mod, i) => {
                  const maxAmt = moduleBreakdown[0]?.amount || 1;
                  return (
                    <div key={mod.id} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: mod.color }}>{i + 1}</span>
                      <span className="text-xs text-[var(--color-text)] w-20 truncate">{mod.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(mod.amount / maxAmt) * 100}%`, backgroundColor: mod.color }} /></div>
                      <span className="text-xs tabular-nums text-[var(--color-text)]">{fmtShort(mod.amount)}</span>
                      <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{mod.percent.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yearly Chart */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-[var(--color-text)]">Chi tieu theo nam</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setYearlyYear(yearlyYear - 1)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-left" size={14} /></button>
                <span className="text-xs font-medium text-[var(--color-text)]">{yearlyYear}</span>
                <button onClick={() => setYearlyYear(yearlyYear + 1)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"><Icon name="chevron-right" size={14} /></button>
                <div className="flex rounded border border-[var(--color-border)] overflow-hidden ml-2">
                  <button onClick={() => setYearlyChartType('bar')} className={`px-1.5 py-0.5 text-[9px] ${yearlyChartType === 'bar' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>Bar</button>
                  <button onClick={() => setYearlyChartType('pie')} className={`px-1.5 py-0.5 text-[9px] ${yearlyChartType === 'pie' ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)]'}`}>Pie</button>
                </div>
              </div>
            </div>
            {yearlyChartType === 'bar' ? (
              <div className="flex items-end gap-1 h-28">
                {yearlyData.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center group/m relative cursor-pointer"
                    onClick={() => { const mk = `${yearlyYear}-${String(m.month).padStart(2, '0')}`; const from = `${mk}-01`; const last = new Date(yearlyYear, m.month, 0).getDate(); navigateToChiTieu(from, `${mk}-${String(last).padStart(2, '0')}`); }}>
                    <div className="w-full flex gap-px justify-center items-end h-20">
                      <div className="w-2 bg-red-400 rounded-t hover:bg-red-500" style={{ height: `${(m.expense / maxYearly) * 100}%`, minHeight: m.expense > 0 ? '2px' : '0' }} />
                      <div className="w-2 bg-green-400 rounded-t hover:bg-green-500" style={{ height: `${(m.income / maxYearly) * 100}%`, minHeight: m.income > 0 ? '2px' : '0' }} />
                    </div>
                    <span className="text-[8px] text-[var(--color-text-secondary)] mt-0.5">{m.label}</span>
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/m:block bg-gray-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-20">{m.label}: Chi {fmtShort(m.expense)} | Thu {fmtShort(m.income)}</div>
                  </div>
                ))}
              </div>
            ) : (
              renderPie(yearlyData.filter((m) => m.expense > 0).map((m, i) => ({ name: m.label, color: `hsl(${i * 30}, 60%, 55%)`, amount: m.expense, percent: 0 })).map((item) => { const t = yearlyData.reduce((s, m2) => s + m2.expense, 0) || 1; return { ...item, percent: (item.amount / t) * 100 }; }), `Nam ${yearlyYear}`)
            )}
            <div className="flex items-center gap-3 mt-2 justify-center">
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]"><span className="w-2 h-2 bg-red-400 rounded-sm" />Chi</span>
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]"><span className="w-2 h-2 bg-green-400 rounded-sm" />Thu</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── StatCard Component ─────────────────────────────────────────────────────
function StatCard({ icon, iconColor, bg, label, value, change, changeUp }: { icon: string; iconColor: string; bg: string; label: string; value: string; change: string; changeUp: boolean }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon name={icon} size={18} color={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
        <p className="text-lg font-bold text-[var(--color-text)] truncate">{value}</p>
        <p className={`text-[10px] ${changeUp ? 'text-red-500' : 'text-green-500'}`}>{change}</p>
      </div>
    </div>
  );
}
