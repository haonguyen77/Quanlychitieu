interface HintBarProps {
  mode: 'basic' | 'advanced';
}

export function HintBar({ mode }: HintBarProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-green-50/60 border border-green-100 rounded-xl mx-6 mt-4">
      <div className="flex items-center gap-2">
        <span className="text-base">💡</span>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-700">
            Che do {mode === 'basic' ? 'Co ban' : 'Nang cao'}:
          </span>{' '}
          {mode === 'basic'
            ? 'Nhap nhanh cac thong tin quan trong. Chuyen sang Nang cao de them day du chi tiet.'
            : 'Nhap day du thong tin chi tiet cho giao dich.'}
        </p>
      </div>
      <div className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 font-mono whitespace-nowrap">
        Ctrl + Shift + N
      </div>
    </div>
  );
}
