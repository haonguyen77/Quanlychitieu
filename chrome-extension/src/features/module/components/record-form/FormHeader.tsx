import { Icon } from '@/shared/components/ui/Icon';

interface FormHeaderProps {
  title: string;
  onClose: () => void;
}

export function FormHeader({ title, onClose }: FormHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-t-2xl border-b border-[#E8EDF5]">
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-50">
          <Icon name="file-text" size={14} color="#EF4444" />
        </div>
        <h2 className="text-base font-semibold text-gray-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
          {title}
        </h2>
      </div>

      {/* Right: Help + Close */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
          title="Tro giup"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
