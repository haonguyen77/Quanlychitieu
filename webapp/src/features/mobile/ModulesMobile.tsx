import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ModuleViewMobile } from './ModuleViewMobile';
import { WineMobile } from './WineMobile';
import { RentalMobile } from './RentalMobile';
import { CreditCardMobile } from './CreditCardMobile';
import { ShopeeMobile } from './ShopeeMobile';
import { GoldMobile } from './GoldMobile';
import { MobileIcon } from './MobileIcon';
import { getModuleIconInfo, getModuleColor } from './mobileIconMap';
import { ChevronRight } from 'lucide-react';
import type { ModuleDefinition } from '@/types';

/**
 * ModulesMobile — Reproduction of Android modules_tab_screen.dart.
 * Shows active modules as cards. Tap → module's transaction list.
 * Dynamic from data.modules — NOT hardcoded.
 */
export function ModulesMobile() {
  const { data } = useAppStore();
  const { push } = useMobileNav();

  const modules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];

  const handleModuleTap = (mod: ModuleDefinition) => {
    if (mod.id === 'mod_ruou') {
      push({ id: 'wine-home', component: <WineMobile /> });
    } else if (mod.id === 'mod_creditcard') {
      push({ id: 'creditcard', component: <CreditCardMobile /> });
    } else if (mod.id === 'mod_shopee') {
      push({ id: 'shopee', component: <ShopeeMobile /> });
    } else if (mod.id === 'mod_vang') {
      push({ id: 'gold', component: <GoldMobile /> });
    } else if (mod.id === 'mod_nhatro') {
      push({ id: 'rental', component: <RentalMobile /> });
    } else {
      push({ id: `module-${mod.id}`, component: <ModuleViewMobile module={mod} /> });
    }
  };

  const getIcon = (mod: ModuleDefinition) => {
    const iconInfo = getModuleIconInfo(mod.icon);
    const color = getModuleColor(mod.id);
    return <MobileIcon name={iconInfo.icon} size={22} color={color} />;
  };

  const getColor = (mod: ModuleDefinition) => {
    const iconInfo = getModuleIconInfo(mod.icon);
    const color = getModuleColor(mod.id);
    return { bg: iconInfo.bgColor, border: `${color}33` };
  };

  // Count records per module
  const getRecordCount = (modId: string) => {
    if (!data) return 0;
    return data.records.filter(r => !r.isDeleted && (r.moduleId === modId || r.linkedModuleId === modId)).length;
  };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="px-4 pb-2 flex items-center justify-between" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0F1F4D' }}>Danh mục</h1>
          <p className="text-xs text-gray-500">{modules.length} module đang hoạt động</p>
        </div>
      </div>

      {/* Module List */}
      <div className="px-4 pb-20 space-y-3 pt-2">
        {modules.map(mod => {
          const color = getColor(mod);
          const count = getRecordCount(mod.id);
          return (
            <button
              key={mod.id}
              onClick={() => handleModuleTap(mod)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border text-left active:scale-[0.98] transition-transform"
              style={{ backgroundColor: color.bg, borderColor: color.border }}
            >
              <div className="w-12 h-12 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                {getIcon(mod)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{mod.name}</p>
                {mod.description && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{mod.description}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{count} bản ghi</p>
              </div>
              <ChevronRight size={18} className="text-gray-400" />
            </button>
          );
        })}

        {modules.length === 0 && (
          <div className="text-center py-12">
            <MobileIcon name="layout-grid" size={40} color="#E0E0E0" className="mx-auto mb-3" />
            <p className="text-sm text-gray-400">Không có module nào hoạt động</p>
          </div>
        )}
      </div>
    </div>
  );
}
