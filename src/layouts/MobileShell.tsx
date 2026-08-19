import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { MobileNavProvider } from '@/features/mobile/MobileNavigation';
import { DashboardMobile } from '@/features/mobile/DashboardMobile';
import { ExpenseMobile } from '@/features/mobile/ExpenseMobile';
import { ModulesMobile } from '@/features/mobile/ModulesMobile';
import { SettingsMobile } from '@/features/mobile/SettingsMobile';
import { AddExpenseMobile } from '@/features/mobile/AddExpenseMobile';
import { BarChart3, Receipt, Plus, FolderOpen, Settings } from 'lucide-react';

type MobileTab = 'dashboard' | 'expense' | 'add' | 'modules' | 'settings';

/**
 * MobileShell — Exact reproduction of Android App HomeScreen.
 * Bottom nav: 64px height, FAB 56x56 circle, navy blue (#1264F5).
 * No extra top padding. No tablet layout.
 */
export function MobileShell() {
  const [activeTab, setActiveTab] = useState<MobileTab>('expense');
  const [showAddForm, setShowAddForm] = useState(false);
  const { data } = useAppStore();

  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 rounded-full bg-[#1264F5] flex items-center justify-center animate-pulse">
          <span className="text-white text-lg font-bold">₫</span>
        </div>
      </div>
    );
  }

  const handleTabPress = (tab: MobileTab) => {
    if (tab === 'add') {
      setShowAddForm(true);
      return;
    }
    setActiveTab(tab);
  };

  return (
    <MobileNavProvider>
      <div className="h-screen flex flex-col bg-white overflow-hidden">
        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {activeTab === 'dashboard' && <DashboardMobile />}
          {activeTab === 'expense' && <ExpenseMobile />}
          {activeTab === 'modules' && <ModulesMobile />}
          {activeTab === 'settings' && <SettingsMobile />}
        </main>

        {/* Bottom Navigation — matches Android: 64px, white, shadow */}
        <nav className="relative flex-shrink-0 bg-white" style={{ boxShadow: '0 -2px 10px rgba(0,0,0,0.08)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around h-16 px-1">
            <NavItem icon={<BarChart3 size={24} />} label="Dashboard" active={activeTab === 'dashboard'} onPress={() => handleTabPress('dashboard')} />
            <NavItem icon={<Receipt size={24} />} label="Chi tiêu" active={activeTab === 'expense'} onPress={() => handleTabPress('expense')} />

            {/* FAB — 56x56 circle, navy blue, centered */}
            <button
              onClick={() => handleTabPress('add')}
              className="flex items-center justify-center active:scale-90 transition-transform"
              style={{
                width: '56px',
                height: '56px',
                minWidth: '56px',
                minHeight: '56px',
                borderRadius: '50%',
                backgroundColor: '#1264F5',
                boxShadow: '0 4px 8px rgba(18,100,245,0.3)',
                marginTop: '-12px',
              }}
            >
              <Plus size={28} color="white" strokeWidth={2.5} />
            </button>

            <NavItem icon={<FolderOpen size={24} />} label="Danh mục" active={activeTab === 'modules'} onPress={() => handleTabPress('modules')} />
            <NavItem icon={<Settings size={24} />} label="Cài đặt" active={activeTab === 'settings'} onPress={() => handleTabPress('settings')} />
          </div>
        </nav>

        {/* Add Expense Fullscreen Overlay */}
        {showAddForm && <AddExpenseMobile onClose={() => setShowAddForm(false)} />}
      </div>
    </MobileNavProvider>
  );
}

function NavItem({ icon, label, active, onPress }: {
  icon: React.ReactNode; label: string; active: boolean; onPress: () => void;
}) {
  const color = active ? '#1264F5' : '#9CA3AF';
  return (
    <button onClick={onPress} className="flex flex-col items-center justify-center" style={{ width: '64px' }}>
      <div style={{ color }}>{icon}</div>
      <span style={{ fontSize: '11px', color, fontWeight: active ? 600 : 400, marginTop: '4px' }}>{label}</span>
    </button>
  );
}
