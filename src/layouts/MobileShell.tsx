import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { MobileNavProvider } from '@/features/mobile/MobileNavigation';
import { DashboardMobile } from '@/features/mobile/DashboardMobile';
import { ExpenseMobile } from '@/features/mobile/ExpenseMobile';
import { ModulesMobile } from '@/features/mobile/ModulesMobile';
import { SettingsMobile } from '@/features/mobile/SettingsMobile';
import { AddExpenseMobile } from '@/features/mobile/AddExpenseMobile';
import { BarChart3, Receipt, PlusCircle, FolderOpen, Settings } from 'lucide-react';

type MobileTab = 'dashboard' | 'expense' | 'add' | 'modules' | 'settings';

/**
 * MobileShell — Bottom Navigation + Content.
 * Matches Android App layout: Dashboard, Chi tiêu, +, Danh mục, Cài đặt.
 * Shown when viewport < 1024px.
 */
export function MobileShell() {
  const [activeTab, setActiveTab] = useState<MobileTab>('expense');
  const [showAddForm, setShowAddForm] = useState(false);
  const { data } = useAppStore();

  // Show loading if no data
  if (!data) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center animate-pulse">
            <span className="text-white text-xl font-bold">₫</span>
          </div>
          <p className="text-sm text-gray-500">Đang tải...</p>
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
    <div className="h-screen flex flex-col bg-[var(--color-bg)] overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <DashboardMobile />}
        {activeTab === 'expense' && <ExpenseMobile />}
        {activeTab === 'modules' && <ModulesMobile />}
        {activeTab === 'settings' && <SettingsMobile />}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          <NavItem
            icon={<BarChart3 size={22} />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onPress={() => handleTabPress('dashboard')}
          />
          <NavItem
            icon={<Receipt size={22} />}
            label="Chi tiêu"
            active={activeTab === 'expense'}
            onPress={() => handleTabPress('expense')}
          />

          {/* Center FAB */}
          <button
            onClick={() => handleTabPress('add')}
            className="w-14 h-14 -mt-4 rounded-full bg-primary-500 shadow-lg shadow-primary-500/30 flex items-center justify-center active:scale-95 transition-transform"
          >
            <PlusCircle size={28} color="white" />
          </button>

          <NavItem
            icon={<FolderOpen size={22} />}
            label="Danh mục"
            active={activeTab === 'modules'}
            onPress={() => handleTabPress('modules')}
          />
          <NavItem
            icon={<Settings size={22} />}
            label="Cài đặt"
            active={activeTab === 'settings'}
            onPress={() => handleTabPress('settings')}
          />
        </div>
      </nav>

      {/* Add Expense Fullscreen */}
      {showAddForm && (
        <AddExpenseMobile onClose={() => setShowAddForm(false)} />
      )}
    </div>
    </MobileNavProvider>
  );
}

function NavItem({ icon, label, active, onPress }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      onClick={onPress}
      className={`flex flex-col items-center justify-center w-16 h-full gap-0.5 transition-colors ${
        active ? 'text-primary-500' : 'text-gray-400'
      }`}
    >
      {icon}
      <span className={`text-[10px] ${active ? 'font-semibold' : 'font-normal'}`}>{label}</span>
    </button>
  );
}
