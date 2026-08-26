import { useState, type ReactNode } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

interface CollapsibleCardProps {
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  /** Optional element rendered on the right of the header (e.g. an ON/OFF badge). */
  headerRight?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A settings card whose body is hidden until the user expands it (chevron).
 * Used for long sections so they don't take up vertical space by default.
 */
export function CollapsibleCard({ title, subtitle, icon, iconColor, headerRight, defaultOpen = false, children }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card p-0 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface)] transition-colors"
      >
        {icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (iconColor || 'var(--color-primary)') + '1a' }}>
            <Icon name={icon} size={16} color={iconColor || 'var(--color-primary)'} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
          {subtitle && <div className="text-[11px] text-[var(--color-text-secondary)] truncate">{subtitle}</div>}
        </div>
        {headerRight}
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} className="text-[var(--color-text-secondary)] flex-shrink-0" />
      </button>
      {open && <div className="px-5 pb-5 pt-0 border-t border-[var(--color-border)]">{children}</div>}
    </section>
  );
}
