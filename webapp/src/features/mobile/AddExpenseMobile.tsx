import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { X, ChevronLeft, ChevronRight, Calendar, ArrowDown, ArrowUp, Minus, Plus, Camera, ChevronDown, ChevronUp as CUp } from 'lucide-react';
import type { RecordValues } from '@/types';
import { GridChip, ModulePill, MobileIcon } from './MobileIcon';
import { getAccountIconInfo, getModuleIconInfo, getModuleColor } from './mobileIconMap';
import { getCategories, getActiveAccounts, getActiveModules, getBeneficiaryOptions, formatDate, resolveCategoryVisual } from './mobileDataMapper';

interface Props {
  onClose: () => void;
  editRecord?: { id: string; values: RecordValues; categoryId?: string; linkedModuleId?: string; moduleId?: string };
}

/**
 * AddExpenseMobile — Exact reproduction of Android add_transaction_screen.dart.
 * Layout order (from Android build() method):
 * 1. Header: Back + "Thêm chi tiêu" + Lưu button (#004DEB)
 * 2. Date + Type row (pink bg, < date >, Chi/Thu pills)
 * 3. Title (with suggestions)
 * 4. Amount + Quantity (3:2 flex)
 * 5. Amount suggestions
 * 6. Payment method (grid chips with icons)
 * 7. Category (grid chips with icons, wrap)
 * 8. Module (horizontal pills with icons)
 * 9. Beneficiary (DROPDOWN — Android uses DropdownButtonFormField)
 * 10. Attachment section
 * 11. Note
 * 12. Expand toggle
 * 13. Expanded: Event + Store + Warranty (months + end date)
 * 14. Save button
 */
export function AddExpenseMobile({ onClose, editRecord }: Props) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();
  const isEditing = !!editRecord;

  const getVal = (suffix: string): string => {
    if (!editRecord) return '';
    const key = Object.keys(editRecord.values).find(k => k.endsWith(`_${suffix}`));
    return key ? String(editRecord.values[key] ?? '') : '';
  };

  // State
  const [type, setType] = useState<0 | 1>(getVal('type') === '1' ? 1 : 0);
  const [title, setTitle] = useState(getVal('title'));
  const [amount, setAmount] = useState(getVal('amount') ? String(Math.abs(Number(getVal('amount')))) : '');
  const [quantity, setQuantity] = useState(Number(getVal('quantity')) || 1);
  const [categoryId, setCategoryId] = useState(editRecord?.categoryId || '');
  const [accountId, setAccountId] = useState(getVal('account') || 'acc_cash');
  const [moduleId, setModuleId] = useState(editRecord?.linkedModuleId || editRecord?.moduleId || 'mod_chitieu');
  const [date, setDate] = useState(getVal('date') || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(getVal('note'));
  const [beneficiary, setBeneficiary] = useState(getVal('beneficiary'));
  const [event, setEvent] = useState(getVal('event'));
  const [store, setStore] = useState(getVal('store'));
  const [warrantyMonths, setWarrantyMonths] = useState(getVal('warranty_months'));
  const [warrantyEndDate, setWarrantyEndDate] = useState(getVal('warranty_end_date'));
  const [showExpanded, setShowExpanded] = useState(!!(getVal('event') || getVal('store') || getVal('warranty_months') || getVal('warranty_end_date')));
  const [showCatSheet, setShowCatSheet] = useState(false);
  const [showAccSheet, setShowAccSheet] = useState(false);
  const [showBenSheet, setShowBenSheet] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [titleSuggestions, setTitleSuggestions] = useState<Array<{ title: string; categoryId: string; cnt: number }>>([]);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);

  // Data
  const categories = getCategories(data, type);
  const accounts = getActiveAccounts(data);
  // Hide Rượu + Thẻ tín dụng from the module picker (UI-only; data untouched).
  const modules = getActiveModules(data).filter(m => m.id !== 'mod_ruou' && m.id !== 'mod_creditcard');
  const beneficiaryOptions = getBeneficiaryOptions(data);

  // Amount suggestions (from Android _buildAmountSuggestions)
  const amountSuggestions = useMemo(() => {
    const base = Number(amount.replace(/\D/g, '')) || 0;
    if (base <= 0) return [];
    const sugs = new Set<number>();
    for (const m of [1000, 10000, 100000, 1000000]) {
      const v = base * m;
      if (v > base && v >= 1000 && v <= 1000000000) sugs.add(v);
    }
    if (base >= 1000) {
      for (const m of [10, 100, 1000]) {
        const v = base * m;
        if (v > base && v >= 1000 && v <= 1000000000) sugs.add(v);
      }
    }
    const arr = Array.from(sugs).filter(s => s > base).sort((a, b) => a - b);
    return arr.slice(0, 4);
  }, [amount]);

  const fmtMoney = (n: number) => n.toLocaleString('vi-VN');

  // Title suggestions (Android: getTitleSuggestions — search existing transactions)
  const handleTitleChange = (value: string) => {
    // Auto-capitalize first letter (Android behavior)
    if (value.length === 1 && value[0] !== value[0].toUpperCase()) {
      value = value[0].toUpperCase() + value.substring(1);
    }
    setTitle(value);
    if (!value.trim() || !data) {
      setTitleSuggestions([]);
      setShowTitleSuggestions(false);
      return;
    }
    const q = value.toLowerCase();
    const titleMap = new Map<string, { categoryId: string; cnt: number }>();
    for (const r of data.records) {
      if (r.isDeleted || r.moduleId !== 'mod_chitieu') continue;
      const tk = Object.keys(r.values).find(k => k.endsWith('_type'));
      if (tk && String(r.values[tk]) !== '0') continue; // only expenses
      const titleKey = Object.keys(r.values).find(k => k.endsWith('_title'));
      const t = titleKey ? String(r.values[titleKey] ?? '') : '';
      if (!t.toLowerCase().includes(q)) continue;
      const existing = titleMap.get(t);
      if (existing) { existing.cnt++; }
      else { titleMap.set(t, { categoryId: r.categoryId || '', cnt: 1 }); }
    }
    const results = Array.from(titleMap.entries())
      .map(([title, { categoryId, cnt }]) => ({ title, categoryId, cnt }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 10);
    setTitleSuggestions(results);
    setShowTitleSuggestions(results.length > 0);
  };

  const selectTitleSuggestion = (suggestion: { title: string; categoryId: string }) => {
    setTitle(suggestion.title);
    if (suggestion.categoryId) setCategoryId(suggestion.categoryId);
    setShowTitleSuggestions(false);
  };

  // Date navigation (Android: _previousDay, _nextDay)
  const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); };
  const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().slice(0, 10)); };

  // Warranty auto-calc (Android behavior: when months entered, calc end date)
  const handleWarrantyMonthsChange = (val: string) => {
    setWarrantyMonths(val.replace(/\D/g, ''));
    const months = parseInt(val);
    if (months > 0 && !warrantyEndDate) {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      setWarrantyEndDate(d.toISOString().slice(0, 10));
    }
  };

  // Save (Android behavior: amount empty/0 = valid)
  const handleSave = () => {
    const amt = Number(amount.replace(/\D/g, '')) || 0;
    const values: RecordValues = {
      mod_chitieu_title: title.trim() || 'Giao dịch',
      mod_chitieu_amount: amt,
      mod_chitieu_type: String(type),
      mod_chitieu_date: date,
      mod_chitieu_account: accountId,
      mod_chitieu_note: note.trim() || null,
      mod_chitieu_beneficiary: beneficiary || null,
      mod_chitieu_event: event.trim() || null,
      mod_chitieu_store: store.trim() || null,
      mod_chitieu_warranty_months: warrantyMonths || null,
      mod_chitieu_warranty_end_date: warrantyEndDate || null,
      mod_chitieu_quantity: quantity > 1 ? quantity : null,
    };
    if (isEditing && editRecord) { updateRecord(editRecord.id, values); }
    else { addRecord('mod_chitieu', values, categoryId || undefined, moduleId !== 'mod_chitieu' ? moduleId : undefined); }
    onClose();
  };

  // Visible items (Android: max 7 cats + "Thêm", max 3 accounts + "Thêm")
  const visibleCats = categories.length > 8 ? categories.slice(0, 7) : categories;
  const hasMoreCats = categories.length > 8;
  const visibleAccs = accounts.length > 4 ? accounts.slice(0, 3) : accounts;
  const hasMoreAccs = accounts.length > 4;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* ═══ HEADER — Android: AppBar with back + title + Lưu button ═══ */}
      <header className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg active:bg-gray-100">
          <MobileIcon name="arrow-left" size={22} color="#374151" />
        </button>
        <h2 className="flex-1 text-[16px] font-bold" style={{ color: '#1F2937' }}>{isEditing ? 'Sửa chi tiêu' : 'Thêm chi tiêu'}</h2>
        <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold active:scale-95" style={{ backgroundColor: '#004DEB' }}>
          <MobileIcon name="save" size={16} color="white" />
          <span>Lưu</span>
        </button>
      </header>

      {/* ═══ FORM — scrollable ═══ */}
      <div className="flex-1 overflow-auto px-4 pb-8">

        {/* ─── 1. Date + Type Row (Android: pink[50] bg, chevrons, calendar) ─── */}
        <div className="flex items-center gap-1 py-3 px-3 mt-3 rounded-xl" style={{ backgroundColor: 'rgba(252,228,236,0.3)' }}>
          <button onClick={prevDay} className="w-8 h-8 flex items-center justify-center active:bg-black/5 rounded-lg">
            <ChevronLeft size={20} color="#616161" />
          </button>
          <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-1.5 flex-1 justify-center">
            <Calendar size={14} color="#757575" />
            <span className="text-[13px] font-medium text-gray-800">{formatDate(date)}</span>
          </button>
          <button onClick={nextDay} className="w-8 h-8 flex items-center justify-center active:bg-black/5 rounded-lg">
            <ChevronRight size={20} color="#616161" />
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1" />
          {/* Type pills — Android: Icons.arrow_downward (Chi) + Icons.arrow_upward (Thu) */}
          <button onClick={() => { setType(0); setCategoryId(''); }}
            className="flex items-center gap-1 px-3 py-2 rounded-[10px]"
            style={{ backgroundColor: type === 0 ? 'rgba(244,67,54,0.15)' : 'transparent', border: `${type === 0 ? 2 : 1}px solid ${type === 0 ? '#F44336' : '#E0E0E0'}` }}>
            <ArrowDown size={14} color={type === 0 ? '#F44336' : '#BDBDBD'} />
            <span style={{ fontSize: 12, fontWeight: type === 0 ? 700 : 400, color: type === 0 ? '#F44336' : '#9E9E9E' }}>Chi</span>
          </button>
          <button onClick={() => { setType(1); setCategoryId(''); }}
            className="flex items-center gap-1 px-3 py-2 rounded-[10px] ml-1"
            style={{ backgroundColor: type === 1 ? 'rgba(76,175,80,0.15)' : 'transparent', border: `${type === 1 ? 2 : 1}px solid ${type === 1 ? '#4CAF50' : '#E0E0E0'}` }}>
            <ArrowUp size={14} color={type === 1 ? '#4CAF50' : '#BDBDBD'} />
            <span style={{ fontSize: 12, fontWeight: type === 1 ? 700 : 400, color: type === 1 ? '#4CAF50' : '#9E9E9E' }}>Thu</span>
          </button>
        </div>
        {showDatePicker && <input type="date" value={date} onChange={e => { setDate(e.target.value); setShowDatePicker(false); }} className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" autoFocus />}

        {/* ─── 2. Title (Android: label + TextFormField + suggestions) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Tên giao dịch *</label>
          <input type="text" value={title} onChange={e => handleTitleChange(e.target.value)} placeholder="Nhập tên giao dịch" maxLength={100}
            className="w-full mt-1.5 px-3.5 py-3 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
          {/* Title suggestions dropdown (Android: _buildTitleSuggestions) */}
          {showTitleSuggestions && (
            <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-[150px] overflow-auto">
              {titleSuggestions.map((s, i) => (
                <button key={i} onClick={() => selectTitleSuggestion(s)} className="w-full px-3.5 py-2.5 text-left flex items-center justify-between border-b border-gray-50 last:border-b-0 active:bg-gray-50">
                  <span className="text-[13px] text-gray-900">{s.title}</span>
                  <span className="text-[11px] text-gray-400">{s.cnt}x</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── 3. Amount + Quantity (Android: 3:2 Expanded flex) ─── */}
        <div className="mt-4 flex gap-4">
          <div className="flex-[3]">
            <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Số tiền *</label>
            <div className="relative mt-1.5">
              <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0"
                className="w-full px-3.5 py-3 pr-8 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">đ</span>
            </div>
          </div>
          <div className="flex-[2]">
            <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Số lượng</label>
            <div className="flex mt-1.5 h-[46px]">
              <button onClick={() => quantity > 1 && setQuantity(quantity - 1)} className="w-10 border border-gray-300 rounded-l-[10px] flex items-center justify-center active:bg-gray-50">
                <Minus size={16} color="#616161" />
              </button>
              <div className="flex-1 border-y border-gray-300 flex items-center justify-center text-base font-semibold">{quantity}</div>
              <button onClick={() => setQuantity(quantity + 1)} className="w-10 border border-gray-300 rounded-r-[10px] flex items-center justify-center active:bg-gray-50">
                <Plus size={16} color="#616161" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── 4. Amount suggestions (Android: blue chips) ─── */}
        {amountSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {amountSuggestions.map(v => (
              <button key={v} onClick={() => setAmount(String(v))} className="px-3 py-1.5 rounded-full active:scale-95"
                style={{ backgroundColor: '#E3F2FD', border: '1px solid #90CAF9' }}>
                <span style={{ fontSize: 12, color: '#1565C0' }}>{fmtMoney(v)}₫</span>
              </button>
            ))}
          </div>
        )}

        {/* ─── 5. Payment Method — GRID CHIPS with icons (Android: _buildPaymentMethodSection) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Phương thức thanh toán *</label>
          {/* One row only — 4 equal columns, chips fluid to fit width */}
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {visibleAccs.map(acc => {
              const iconInfo = getAccountIconInfo(acc.icon);
              return <GridChip fluid key={acc.id} label={acc.name} icon={iconInfo.icon} iconColor={acc.color || iconInfo.color} isSelected={accountId === acc.id} onTap={() => setAccountId(acc.id)} />;
            })}
            {hasMoreAccs && <GridChip fluid label="Thêm" icon="more-horizontal" iconColor="#757575" isSelected={false} onTap={() => setShowAccSheet(true)} />}
          </div>
        </div>

        {/* ─── 6. Category — GRID CHIPS with icons (Android: _buildCategorySection, Wrap) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Danh mục *</label>
          {/* Max 2 rows — 4 columns; overflow goes into the "Thêm" sheet */}
          <div className="grid grid-cols-4 gap-2 mt-2.5">
            {visibleCats.map(cat => {
              const v = resolveCategoryVisual(cat.icon, cat.color);
              return <GridChip fluid key={cat.id} label={cat.name} icon={v.icon} iconColor={v.color} isSelected={categoryId === cat.id} onTap={() => setCategoryId(cat.id)} />;
            })}
            {hasMoreCats && <GridChip fluid label="Thêm" icon="more-horizontal" iconColor="#757575" isSelected={false} onTap={() => setShowCatSheet(true)} />}
          </div>
        </div>

        {/* ─── 7. Module — Horizontal pills (Android: _buildModuleSection, Row of pills) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Module *</label>
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
            {modules.map(m => {
              const iconInfo = getModuleIconInfo(m.icon);
              const color = getModuleColor(m.id);
              return <ModulePill key={m.id} label={m.name} icon={iconInfo.icon} color={color} isSelected={moduleId === m.id} onTap={() => setModuleId(m.id)} />;
            })}
          </div>
        </div>

        {/* ─── 8. Beneficiary — Custom bottom sheet (Android: DropdownButtonFormField) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Người nhận</label>
          <button onClick={() => setShowBenSheet(true)} className="w-full mt-1.5 px-3.5 py-3 rounded-[10px] border border-gray-300 text-sm text-left flex items-center justify-between bg-white">
            <span style={{ color: beneficiary ? '#1F2937' : '#9CA3AF' }}>{beneficiary || 'Chọn người nhận'}</span>
            <ChevronDown size={16} color="#9E9E9E" />
          </button>
        </div>

        {/* ─── 9. Attachment Section (Android: camera_alt_outlined + text) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Đính kèm</label>
          <div className="mt-1.5 py-5 border border-dashed border-gray-300 rounded-[10px] flex flex-col items-center bg-gray-50">
            <Camera size={28} color="#9E9E9E" />
            <p className="mt-1.5 text-[13px] text-gray-500">Chụp ảnh hoặc <span className="text-blue-600 font-medium">chọn ảnh</span></p>
            <p className="mt-1 text-[11px] text-gray-400">Hỗ trợ: JPG, PNG (Tối đa 5MB) — Web chưa hỗ trợ upload</p>
          </div>
        </div>

        {/* ─── 10. Note (Android: TextFormField, maxLines 5, maxLength 200) ─── */}
        <div className="mt-5">
          <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Ghi chú</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nhập ghi chú (không bắt buộc)" rows={4} maxLength={200}
            className="w-full mt-1.5 px-3.5 py-3 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500 resize-none" />
        </div>

        {/* ─── 11. Expand Toggle (Android: _buildExpandToggle) ─── */}
        <button onClick={() => setShowExpanded(!showExpanded)} className="w-full mt-4 py-2 flex items-center justify-center gap-1 border-t border-gray-200">
          <span className="text-[13px] text-gray-500">{showExpanded ? 'Thu gọn' : 'Thêm thông tin'}</span>
          {showExpanded ? <CUp size={16} color="#9E9E9E" /> : <ChevronDown size={16} color="#9E9E9E" />}
        </button>

        {/* ─── 12. Expanded Section (Android: Event + Store + Warranty) ─── */}
        {showExpanded && (
          <div className="mt-3 space-y-4">
            {/* Sự kiện */}
            <div>
              <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Sự kiện</label>
              <input type="text" value={event} onChange={e => setEvent(e.target.value)} placeholder="Chọn sự kiện"
                className="w-full mt-1.5 px-3.5 py-3 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            {/* Cửa hàng */}
            <div>
              <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Cửa hàng</label>
              <input type="text" value={store} onChange={e => setStore(e.target.value)} placeholder="Nhập tên cửa hàng / nhà cung cấp" maxLength={100}
                className="w-full mt-1.5 px-3.5 py-3 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
            </div>
            {/* Bảo hành — Android: BH (tháng) + Hết BH (2 columns) */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[13px] font-medium" style={{ color: '#424242' }}>BH (tháng)</label>
                <div className="relative mt-1.5">
                  <input type="text" inputMode="numeric" value={warrantyMonths} onChange={e => handleWarrantyMonthsChange(e.target.value)} placeholder="Số tháng"
                    className="w-full px-3 py-3 pr-14 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">tháng</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[13px] font-medium" style={{ color: '#424242' }}>Hết BH</label>
                <div className="relative mt-1.5">
                  <div className="relative">
                    <input type="date" value={warrantyEndDate} onChange={e => setWarrantyEndDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-3 rounded-[10px] border border-gray-300 text-sm outline-none focus:border-blue-500" />
                    <Calendar size={14} color="#757575" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── 13. Save Button — Full width (Android: _buildSaveButton) ─── */}
        <button onClick={handleSave} className="w-full mt-6 py-3.5 rounded-[10px] text-white text-sm font-semibold active:scale-[0.98]" style={{ backgroundColor: '#004DEB' }}>
          {isEditing ? 'Cập nhật' : 'Lưu giao dịch'}
        </button>
        <div className="h-6" />
      </div>

      {/* ═══ BOTTOM SHEETS ═══ */}
      {showCatSheet && (
        <BottomSheet title="Chọn danh mục" onClose={() => setShowCatSheet(false)}>
          {categories.map(c => {
            const v = resolveCategoryVisual(c.icon, c.color);
            return (
              <button key={c.id} onClick={() => { setCategoryId(c.id); setShowCatSheet(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 active:bg-gray-50 ${categoryId === c.id ? 'bg-blue-50' : ''}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: v.bgColor }}>
                  <MobileIcon name={v.icon} size={18} color={v.color} />
                </div>
                <span className="flex-1 text-left text-sm text-gray-900">{c.name}</span>
                {categoryId === c.id && <MobileIcon name="check" size={16} color="#004DEB" />}
              </button>
            );
          })}
        </BottomSheet>
      )}
      {showAccSheet && (
        <BottomSheet title="Phương thức thanh toán" onClose={() => setShowAccSheet(false)}>
          {accounts.map(a => {
            const iconInfo = getAccountIconInfo(a.icon);
            return (
              <button key={a.id} onClick={() => { setAccountId(a.id); setShowAccSheet(false); }}
                className={`w-full px-4 py-3 flex items-center gap-3 active:bg-gray-50 ${accountId === a.id ? 'bg-blue-50' : ''}`}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${a.color || iconInfo.color}1A` }}>
                  <MobileIcon name={iconInfo.icon} size={18} color={a.color || iconInfo.color} />
                </div>
                <span className="flex-1 text-left text-sm text-gray-900">{a.name}</span>
                {accountId === a.id && <MobileIcon name="check" size={16} color="#004DEB" />}
              </button>
            );
          })}
        </BottomSheet>
      )}
      {/* Beneficiary Bottom Sheet */}
      {showBenSheet && (
        <BottomSheet title="Chọn người nhận" onClose={() => setShowBenSheet(false)}>
          <button onClick={() => { setBeneficiary(''); setShowBenSheet(false); }}
            className={`w-full px-4 py-3.5 text-left text-sm active:bg-gray-50 border-b border-gray-50 ${!beneficiary ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-900'}`}>
            Không chọn
          </button>
          {beneficiaryOptions.map(b => (
            <button key={b} onClick={() => { setBeneficiary(b); setShowBenSheet(false); }}
              className={`w-full px-4 py-3.5 text-left text-sm active:bg-gray-50 border-b border-gray-50 flex items-center justify-between ${beneficiary === b ? 'bg-blue-50' : ''}`}>
              <span className={beneficiary === b ? 'text-blue-700 font-semibold' : 'text-gray-900'}>{b}</span>
              {beneficiary === b && <MobileIcon name="check" size={16} color="#004DEB" />}
            </button>
          ))}
        </BottomSheet>
      )}
    </div>
  );
}

// ─── Bottom Sheet Component ───────────────────────────────────────────────────

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative bg-white rounded-t-2xl max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center"><X size={20} color="#9E9E9E" /></button>
        </div>
        <div className="overflow-auto">{children}</div>
      </div>
    </div>
  );
}
