import type { RecordValue } from '@/types';

interface NoteInputProps {
  value: RecordValue;
  onChange: (v: RecordValue) => void;
  maxLength?: number;
}

export function NoteInput({ value, onChange, maxLength = 500 }: NoteInputProps) {
  const text = String(value ?? '');
  const charCount = text.length;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-gray-700">Ghi chu</label>
      <div className="relative">
        <textarea
          className="w-full h-[80px] px-3 py-2 rounded-lg border border-[#E5E7EB] bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/30 focus:border-[#22C55E] transition-all duration-200 resize-none"
          value={text}
          onChange={(e) => {
            if (e.target.value.length <= maxLength) {
              onChange(e.target.value);
            }
          }}
          placeholder="Nhap ghi chu chi tiet (neu co)..."
          maxLength={maxLength}
        />
        <span className="absolute bottom-3 right-4 text-xs text-gray-400">
          {charCount}/{maxLength}
        </span>
      </div>
    </div>
  );
}
