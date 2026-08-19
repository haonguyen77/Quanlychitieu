import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { SuggestInput } from './SuggestInput';
import type { DataRecord, RecordValues } from '@/types';

interface Props {
  record: DataRecord | null;
  onClose: () => void;
}

export function WineProductFormDialog({ record, onClose }: Props) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();

  const [productName, setProductName] = useState(record?.values['mod_ruou_products_product_name'] as string ?? '');
  const [sku, setSku] = useState(record?.values['mod_ruou_products_sku'] as string ?? '');
  const [shortName, setShortName] = useState(record?.values['mod_ruou_products_short_name'] as string ?? '');
  const [volumeMl, setVolumeMl] = useState(Number(record?.values['mod_ruou_products_volume_ml'] ?? 0));
  const [wineType, setWineType] = useState(record?.values['mod_ruou_products_wine_type'] as string ?? '');
  const [bottleType, setBottleType] = useState(record?.values['mod_ruou_products_bottle_type'] as string ?? '');
  const [note, setNote] = useState(record?.values['mod_ruou_products_note'] as string ?? '');

  // Unique values for autocomplete
  const existingProducts = useMemo(() => data ? data.records.filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted) : [], [data]);
  const suggNames = useMemo(() => [...new Set(existingProducts.map((r) => String(r.values['mod_ruou_products_product_name'] ?? '')).filter(Boolean))], [existingProducts]);
  const suggShortNames = useMemo(() => [...new Set(existingProducts.map((r) => String(r.values['mod_ruou_products_short_name'] ?? '')).filter(Boolean))], [existingProducts]);

  const wineTypeField = data?.modules.find((m) => m.id === 'mod_ruou_products')?.fields.find((f) => f.fieldName === 'wine_type');
  const wineTypeOptions = wineTypeField?.options?.length ? wineTypeField.options : [
    { id: 'wpt_gao', label: 'Gạo', value: 'gao' },
    { id: 'wpt_nep', label: 'Nếp', value: 'nep' },
    { id: 'wpt_dauxanh', label: 'Đậu xanh', value: 'dauxanh' },
    { id: 'wpt_vangnep', label: 'Vang nếp', value: 'vangnep' },
    { id: 'wpt_dtht', label: 'ĐTHT', value: 'dtht' },
  ];
  const bottleTypeField = data?.modules.find((m) => m.id === 'mod_ruou_products')?.fields.find((f) => f.fieldName === 'bottle_type');
  const bottleTypeOptions = bottleTypeField?.options?.length ? bottleTypeField.options : [
    { id: 'wbt_pet', label: 'PET', value: 'pet' },
    { id: 'wbt_su', label: 'Sứ', value: 'su' },
    { id: 'wbt_thuytinh', label: 'Thuỷ tinh', value: 'thuytinh' },
  ];

  const handleSave = useCallback(() => {
    if (!productName.trim()) return;
    const values: RecordValues = {
      mod_ruou_products_product_name: productName.trim(),
      mod_ruou_products_sku: sku.trim(),
      mod_ruou_products_short_name: shortName.trim(),
      mod_ruou_products_volume_ml: volumeMl || null,
      mod_ruou_products_wine_type: wineType || null,
      mod_ruou_products_bottle_type: bottleType || null,
      mod_ruou_products_note: note.trim(),
    };
    if (record) {
      updateRecord(record.id, values);
    } else {
      addRecord('mod_ruou_products', values);
    }
    onClose();
  }, [productName, sku, shortName, volumeMl, wineType, bottleType, note, record, updateRecord, addRecord, onClose]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleSaveRef.current(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--color-bg)] rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            {record ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--color-surface)] rounded"><Icon name="x" size={16} /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Tên đầy đủ *</label>
            <SuggestInput value={productName} onChange={setProductName} suggestions={suggNames} placeholder="Tên sản phẩm..." className="input-field py-1.5 px-3 text-sm w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Mã SKU</label>
              <input type="text" className="input-field py-1.5 px-3 text-sm w-full" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Tên ngắn</label>
              <SuggestInput value={shortName} onChange={setShortName} suggestions={suggShortNames} placeholder="Tên ngắn..." className="input-field py-1.5 px-3 text-sm w-full" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Dung tích (ml)</label>
              <input type="number" className="input-field py-1.5 px-3 text-sm w-full" min={0} value={volumeMl || ''} onChange={(e) => setVolumeMl(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Loại rượu</label>
              <select className="input-field py-1.5 px-3 text-sm w-full" value={wineType} onChange={(e) => setWineType(e.target.value)}>
                <option value="">--</option>
                {wineTypeOptions.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Loại chai</label>
              <select className="input-field py-1.5 px-3 text-sm w-full" value={bottleType} onChange={(e) => setBottleType(e.target.value)}>
                <option value="">--</option>
                {bottleTypeOptions.map((o) => <option key={o.id} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Ghi chú</label>
            <textarea className="input-field py-1.5 px-3 text-xs w-full h-16 resize-none" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] rounded-md">Hủy</button>
          <button onClick={handleSave} className="btn-primary px-4 py-1.5 text-xs" disabled={!productName.trim()}>
            {record ? 'Cập nhật' : 'Thêm'}
          </button>
        </div>
      </div>
    </div>
  );
}
