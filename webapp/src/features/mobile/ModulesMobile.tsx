import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { ModuleViewMobile } from './ModuleViewMobile';
import { Wallet, ShoppingCart, Gem, Home, CreditCard, Wine } from 'lucide-react';
import type { ModuleDefinition } from '@/types';

/**
 * Mobile Modules Grid — shows active modules as cards.
 * Tap → navigates to module's transaction list.
 */
export function ModulesMobile() {
  const { data } = useAppStore();
  const { push } = useMobileNav();

  const modules = data?.modules.filter(m => m.isActive && m.isVisible !== false) || [];

  const handleModuleTap = (mod: ModuleDefinition) => {
    push({ id: `module-${mod.id}`, component: <ModuleViewMobile module={mod} /> });
  };

  const getIcon = (id: string) => {
    switch (id) {
      case 'mod_chitieu': return <Wallet size={22} className="text-red-500" />;
      case 'mod_shopee': return <ShoppingCart size={22} className="text-orange-500" />;
      case 'mod_vang': return <Gem size={22} className="text-amber-500" />;
      case 'mod_nhatro': return <Home size={22} className="text-green-500" />;
      case 'mod_creditcard': return <CreditCard size={22} className="text-indigo-500" />;
      case 'mod_ruou': return <Wine size={22} className="text-purple-500" />;
      default: return <Wallet size={22} className="text-gray-500" />;
    }
  };

  const getColor = (id: string) => {
    switch (id) {
      case 'mod_chitieu': return 'bg-red-50 border-red-100';
      case 'mod_shopee': return 'bg-orange-50 border-orange-100';
      case 'mod_vang': return 'bg-amber-50 border-amber-100';
      case 'mod_nhatro': return 'bg-green-50 border-green-100';
      case 'mod_creditcard': return 'bg-indigo-50 border-indigo-100';
      case 'mod_ruou': return 'bg-purple-50 border-purple-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="bg-white px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Danh mục</h1>
      </div>

      <div className="px-4 pb-24">
        <div className="grid grid-cols-2 gap-3">
          {modules.map(m => (
            <button
              key={m.id}
              onClick={() => handleModuleTap(m)}
              className={`${getColor(m.id)} border rounded-2xl p-4 text-left active:scale-95 transition-transform`}
            >
              <div className="mb-3">{getIcon(m.id)}</div>
              <p className="text-sm font-semibold text-gray-900">{m.name}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{m.description || ''}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
