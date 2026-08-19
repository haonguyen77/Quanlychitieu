import { Icon } from '@/shared/components/ui/Icon';
import { FormField } from './BasicForm';
import type { RecordValue, ModuleDefinition } from '@/types';

// ─── Module Link Buttons ────────────────────────────────────────────────────
interface ModuleLinkButtonsProps {
  linkedModules: ModuleDefinition[];
  selectedModuleLink: string | null;
  onSelect: (moduleId: string | null) => void;
  formModuleId: string;
}

export function ModuleLinkButtons({ linkedModules, selectedModuleLink, onSelect, formModuleId }: ModuleLinkButtonsProps) {
  const allOptions = [
    { id: formModuleId, name: 'Chi tieu', icon: 'file-text', color: '#3b82f6' },
    ...linkedModules.map((m) => ({ id: m.id, name: m.name, icon: m.icon, color: m.color })),
    { id: '__other', name: 'Khac', icon: 'more-horizontal', color: '#64748b' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {allOptions.map((mod) => {
        const isSelected = mod.id === '__other'
          ? false
          : mod.id === formModuleId
            ? selectedModuleLink === null
            : selectedModuleLink === mod.id;

        return (
          <button
            key={mod.id}
            type="button"
            onClick={() => {
              if (mod.id === '__other') return;
              onSelect(mod.id === formModuleId ? null : mod.id);
            }}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border-2 text-xs font-medium transition-all duration-200 ${
              isSelected
                ? 'border-[#7C3AED] bg-purple-50 text-purple-700 shadow-sm'
                : 'border-[#E5E7EB] bg-white text-gray-600 hover:border-gray-300 hover:shadow-sm'
            }`}
          >
            <Icon name={mod.icon} size={14} color={isSelected ? '#7C3AED' : mod.color} />
            <span>{mod.name}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Module Fields (dynamic based on selected module) ───────────────────────
interface ModuleFieldsProps {
  // Event/Tags
  tagsValue: RecordValue;
  onTagsChange: (v: RecordValue) => void;
  eventSuggestions: string[];
  // Beneficiary
  beneficiaryValue: RecordValue;
  onBeneficiaryChange: (v: RecordValue) => void;
  beneficiaryOptions: Array<{ id: string; label: string; value: string }>;
  // Quantity
  quantityValue: RecordValue;
  onQuantityChange: (v: RecordValue) => void;
  // Warranty
  warrantyMonthsValue: RecordValue;
  onWarrantyMonthsChange: (v: RecordValue) => void;
  warrantyDateValue: RecordValue;
  onWarrantyDateChange: (v: RecordValue) => void;
}

export function ModuleFields({
  tagsValue, onTagsChange, eventSuggestions,
  beneficiaryValue, onBeneficiaryChange, beneficiaryOptions,
  quantityValue, onQuantityChange,
  warrantyMonthsValue, onWarrantyMonthsChange,
  warrantyDateValue, onWarrantyDateChange,
}: ModuleFieldsProps) {
  return (
    <div className="space-y-3 mt-3">
      {/* Row 1: Event + Beneficiary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField label="Su kien (Event)">
          <input
            type="text"
            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all duration-200"
            value={String(tagsValue ?? '')}
            onChange={(e) => onTagsChange(e.target.value)}
            placeholder="Nhap su kien (neu co)..."
            list="event-suggestions-list"
            autoComplete="off"
          />
          {eventSuggestions.length > 0 && (
            <datalist id="event-suggestions-list">
              {eventSuggestions.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          )}
        </FormField>

        <FormField label="Nguoi nhan">
          <div className="relative">
            <select
              className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all duration-200"
              value={String(beneficiaryValue ?? '')}
              onChange={(e) => onBeneficiaryChange(e.target.value)}
            >
              <option value="">-- Chon --</option>
              {beneficiaryOptions.map((opt) => (
                <option key={opt.id} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Icon name="chevron-down" size={14} />
            </div>
          </div>
        </FormField>
      </div>

      {/* Row 2: Quantity + Warranty months + Warranty date */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField label="So luong">
          <input
            type="number"
            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all duration-200"
            value={String(quantityValue ?? '1')}
            onChange={(e) => onQuantityChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="1"
            min="0"
            step="0.1"
          />
        </FormField>

        <FormField label="Thang bao hanh">
          <input
            type="number"
            className="w-full h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all duration-200"
            value={String(warrantyMonthsValue ?? '')}
            onChange={(e) => onWarrantyMonthsChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="So thang (neu co)"
            min="0"
            step="1"
          />
        </FormField>

        <FormField label="Ngay bao hanh">
          <div className="relative">
            <input
              type="date"
              className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED] transition-all duration-200"
              value={String(warrantyDateValue ?? '')}
              onChange={(e) => onWarrantyDateChange(e.target.value)}
            />
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Icon name="calendar" size={14} />
            </div>
          </div>
        </FormField>
      </div>
    </div>
  );
}

// ─── Main ModuleSection ─────────────────────────────────────────────────────
interface ModuleSectionProps {
  linkedModules: ModuleDefinition[];
  selectedModuleLink: string | null;
  onModuleLinkSelect: (moduleId: string | null) => void;
  formModuleId: string;
  // Module fields
  tagsValue: RecordValue;
  onTagsChange: (v: RecordValue) => void;
  eventSuggestions: string[];
  beneficiaryValue: RecordValue;
  onBeneficiaryChange: (v: RecordValue) => void;
  beneficiaryOptions: Array<{ id: string; label: string; value: string }>;
  quantityValue: RecordValue;
  onQuantityChange: (v: RecordValue) => void;
  warrantyMonthsValue: RecordValue;
  onWarrantyMonthsChange: (v: RecordValue) => void;
  warrantyDateValue: RecordValue;
  onWarrantyDateChange: (v: RecordValue) => void;
}

export function ModuleSection({
  linkedModules, selectedModuleLink, onModuleLinkSelect, formModuleId,
  tagsValue, onTagsChange, eventSuggestions,
  beneficiaryValue, onBeneficiaryChange, beneficiaryOptions,
  quantityValue, onQuantityChange,
  warrantyMonthsValue, onWarrantyMonthsChange,
  warrantyDateValue, onWarrantyDateChange,
}: ModuleSectionProps) {
  return (
    <div className="bg-white border border-[#E8EDF5] rounded-xl p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <h3 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <Icon name="star" size={12} className="text-[#7C3AED]" />
        Lien ket Module
      </h3>

      <ModuleLinkButtons
        linkedModules={linkedModules}
        selectedModuleLink={selectedModuleLink}
        onSelect={onModuleLinkSelect}
        formModuleId={formModuleId}
      />

      {/* Dynamic fields for selected module */}
      <ModuleFields
        tagsValue={tagsValue}
        onTagsChange={onTagsChange}
        eventSuggestions={eventSuggestions}
        beneficiaryValue={beneficiaryValue}
        onBeneficiaryChange={onBeneficiaryChange}
        beneficiaryOptions={beneficiaryOptions}
        quantityValue={quantityValue}
        onQuantityChange={onQuantityChange}
        warrantyMonthsValue={warrantyMonthsValue}
        onWarrantyMonthsChange={onWarrantyMonthsChange}
        warrantyDateValue={warrantyDateValue}
        onWarrantyDateChange={onWarrantyDateChange}
      />
    </div>
  );
}
