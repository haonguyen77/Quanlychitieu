import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface ContextMenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  type?: 'divider';
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl py-1 min-w-[160px] animate-in"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <div key={i} className="border-t border-[var(--color-border)] my-1" />;
        }
        return (
          <button
            key={i}
            onClick={item.onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
              item.danger
                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-[var(--color-text)] hover:bg-[var(--color-surface)]'
            }`}
          >
            {item.icon && <Icon name={item.icon} size={14} className={item.danger ? 'text-red-500' : 'text-[var(--color-text-secondary)]'} />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
