import { useState } from 'react';
import { BarChart3, Receipt, LayoutGrid, Settings, Plus } from 'lucide-react';
import { useMobileNav } from './MobileNavigation';
import { AddExpenseMobile } from './AddExpenseMobile';

interface Props {
  /** Accent color of the current module — colors the center "+" FAB. */
  accentColor: string;
  /** Module id to preselect when adding a transaction from this screen. */
  moduleId: string;
  /** Which tab looks active (usually 'modules' since we came from Danh mục). */
  activeTab?: 'dashboard' | 'expense' | 'modules' | 'settings';
}

/**
 * ModuleBottomNav — reproduces the Flutter per-module bottom navigation bar
 * (Dashboard / Chi tiêu / + / Danh mục / Cài đặt) with the center FAB colored
 * by the module accent. Rendered inside each module overlay (Shopee, Gold,
 * Rental, Credit Card) since the shell's own nav is covered by the overlay.
 * Tapping a non-add tab pops back to the shell.
 */
export function ModuleBottomNav({ accentColor, moduleId, activeTab = 'modules' }: Props) {
  const { pop } = useMobileNav();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <nav className="flex-shrink-0 bg-white" style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 px-1">
          <NavItem icon={<BarChart3 size={22} />} label="Dashboard" active={activeTab === 'dashboard'} accent={accentColor} onTap={pop} />
          <NavItem icon={<Receipt size={22} />} label="Chi tiêu" active={activeTab === 'expense'} accent={accentColor} onTap={pop} />
          {/* Center FAB — module accent */}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center active:scale-90 transition-transform"
            style={{ width: '52px', height: '52px', minWidth: '52px', minHeight: '52px', borderRadius: '50%', backgroundColor: accentColor, boxShadow: `0 4px 8px ${accentColor}4D`, marginTop: '-12px' }}
          >
            <Plus size={26} color="white" strokeWidth={2.5} />
          </button>
          <NavItem icon={<LayoutGrid size={22} />} label="Danh mục" active={activeTab === 'modules'} accent={accentColor} onTap={pop} />
          <NavItem icon={<Settings size={22} />} label="Cài đặt" active={activeTab === 'settings'} accent={accentColor} onTap={pop} />
        </div>
      </nav>
      {showAdd && <AddExpenseMobile onClose={() => setShowAdd(false)} presetModuleId={moduleId} />}
    </>
  );
}

function NavItem({ icon, label, active, accent, onTap }: { icon: React.ReactNode; label: string; active: boolean; accent: string; onTap: () => void }) {
  return (
    <button onClick={onTap} className="flex flex-col items-center justify-center gap-0.5 w-[60px]" style={{ color: active ? accent : '#9CA3AF' }}>
      {icon}
      <span className="text-[10px]" style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  );
}
