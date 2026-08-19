import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

interface FormFooterProps {
  isEditing: boolean;
  onCancel: () => void;
  onSave: () => void;
  onSaveAndNew?: () => void;
  onSaveAndCopy?: () => void;
  onSaveAndClose?: () => void;
}

export function FormFooter({
  isEditing,
  onCancel,
  onSave,
  onSaveAndNew,
  onSaveAndCopy,
  onSaveAndClose,
}: FormFooterProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  return (
    <div className="flex items-center justify-end px-4 py-3 bg-white border-t border-[#E8EDF5] rounded-b-2xl gap-3">
      <span className="text-[10px] text-gray-400 mr-auto">Ctrl+Enter de luu</span>

      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-[#E5E7EB] transition-all duration-200"
      >
        Huy
      </button>

      {/* Save button with dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-[#22C55E] hover:bg-[#16A34A] rounded-l-lg shadow-sm transition-all duration-200"
          >
            <Icon name="save" size={14} color="white" />
            {isEditing ? 'Cap nhat' : `Luu chi tieu`}
          </button>
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center justify-center h-9 w-8 text-white bg-[#22C55E] hover:bg-[#16A34A] border-l border-green-400/40 rounded-r-lg transition-all duration-200"
          >
            <Icon name="chevron-down" size={12} color="white" />
          </button>
        </div>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute right-0 bottom-full mb-2 w-52 bg-white border border-[#E8EDF5] rounded-xl shadow-lg py-1.5 z-30 animate-in">
            <DropdownItem onClick={() => { onSave(); setShowDropdown(false); }}>
              <Icon name="save" size={14} className="text-gray-500" />
              Luu
            </DropdownItem>
            {onSaveAndNew && (
              <DropdownItem onClick={() => { onSaveAndNew(); setShowDropdown(false); }}>
                <Icon name="plus" size={14} className="text-gray-500" />
                Luu va them moi
              </DropdownItem>
            )}
            {onSaveAndCopy && (
              <DropdownItem onClick={() => { onSaveAndCopy(); setShowDropdown(false); }}>
                <Icon name="copy" size={14} className="text-gray-500" />
                Luu va sao chep
              </DropdownItem>
            )}
            {onSaveAndClose && (
              <DropdownItem onClick={() => { onSaveAndClose(); setShowDropdown(false); }}>
                <Icon name="x" size={14} className="text-gray-500" />
                Luu & dong
              </DropdownItem>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dropdown Item ──────────────────────────────────────────────────────────
function DropdownItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 text-left"
    >
      {children}
    </button>
  );
}

// ─── Tips Bar (bottom) ──────────────────────────────────────────────────────
export function TipsBar() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-purple-50/60 border border-purple-100 rounded-lg mx-4 mb-3">
      <span className="text-base">⭐</span>
      <p className="text-xs text-gray-600 flex-1">
        <span className="font-medium text-purple-700">Meo:</span>{' '}
        Nhan Tab de chuyen nhanh giua cac o nhap. Nhan Ctrl+Enter de luu nhanh.
      </p>
    </div>
  );
}
