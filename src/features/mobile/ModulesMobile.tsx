import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ModuleViewMobile } from './ModuleViewMobile';
import { Wallet, ShoppingCart, Gem, Home, CreditCard, Wine, Package, ChevronRight } from 'lucide-react';
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
    push({ id: `module-${mod.id}`, component: <ModuleViewMobile module={mod} /> });
  };

  const getIcon = (mod: ModuleDefinition) => {
    switch (mod.id) {
      case 'mod_chitieu': return <Wallet size={22} className="text-red-500" />;
      case 'mod_shopee': return <ShoppingCart size={22} className="text-orange-500" />;
      case 'mod_vang': return <Gem size={22} className="text-amber-500" />;
      case 'mod_nhatro': return <Home size={22} className="text-green-500" />;
      case 'mod_creditcard': return <CreditCard size={22} className="text-indigo-600" />;
      case 'mod_ruou': return <Wine size={22} className="text-purple-600" />;
      default: return <Package size={22} className="text-gray-500" />;
    }
  };

  const getColor = (mod: ModuleDefinition) => {
    switch (mod.id) {
      case 'mod_chitieu': return { bg: '#FFEBEE', border: '#FFCDD2' };
      case 'mod_shopee': return { bg: '#FFF3E0', border: '#FFE0B2' };
      case 'mod_vang': return { bg: '#FFF8E1', border: '#FFECB3' };
      case 'mod_nhatro': return { bg: '#E8F5E9', border: '#C8E6C9' };
      case 'mod_creditcard': return { bg: '#E8EAF6', border: '#C5CAE9' };
      case 'mod_ruou': return { bg: '#F3E5F5', border: '#E1BEE7' };
      default: return { bg: '#F5F5F5', border: '#E0E0E0' };
    }
  };

  // Count records per module
  const getRecordCount = (modId: string) => {
    if (!data) return 0;
    return data.records.filter(r => !r.isDeleted && (r.moduleId === modId || r.linkedModuleId === modId)).length;
  };

  return (
    <div className="h-full overflow-auto bg-white">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
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
            <Package size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Không có module nào hoạt động</p>
          </div>
        )}
      </div>
    </div>
  );
}
