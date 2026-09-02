import { useState, useEffect, useCallback } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { WineOrdersTab } from './WineOrdersTab';
import { WineProductsTab } from './WineProductsTab';
import { WineCustomersTab } from './WineCustomersTab';
import { WineInventoryTab } from './WineInventoryTab';
import { WineReportsTab } from './WineReportsTab';

type WineTab = 'orders' | 'products' | 'customers' | 'inventory' | 'reports';

const TAB_COLORS: Record<WineTab, string> = {
  orders:    '#f05423',
  customers: '#0ea5e9',
  products:  '#a855f7',
  inventory: '#22c55e',
  reports:   '#6366f1',
};

const tabs: { id: WineTab; label: string; icon: string }[] = [
  { id: 'orders', label: 'Đơn hàng', icon: 'file-text' },
  { id: 'products', label: 'Sản phẩm', icon: 'wine' },
  { id: 'customers', label: 'Khách hàng', icon: 'users' },
  { id: 'inventory', label: 'Kho', icon: 'building' },
  { id: 'reports', label: 'Báo cáo', icon: 'trending-up' },
];

export function WineModuleView() {
  const [activeTab, setActiveTab] = useState<WineTab>('orders');
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const [newOrderTrigger, setNewOrderTrigger] = useState(0);

  const triggerNewOrder = useCallback(() => {
    setNewOrderTrigger((n) => n + 1);
  }, []);

  // Global Alt+N shortcut to create new order (only fires when on orders tab)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        // Only handle at module level if on orders tab; other tabs handle Alt+N themselves
        if (activeTab === 'orders') {
          e.preventDefault();
          triggerNewOrder();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [triggerNewOrder, activeTab]);

  const handleCustomerClick = (customerName: string) => {
    setCustomerFilter(customerName);
    setActiveTab('orders');
  };

  const handleProductClick = (productName: string) => {
    setProductFilter(productName);
    setActiveTab('orders');
  };

  const clearFilters = () => {
    setCustomerFilter(null);
    setProductFilter(null);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#9C27B015' }}>
            <Icon name="wine" size={20} color="#9C27B0" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text)]">Quản lý Rượu</h1>
            <p className="text-xs text-[var(--color-text-secondary)]">Đơn hàng, sản phẩm, khách hàng & kho</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 py-2 border-b border-[var(--color-border)] flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); clearFilters(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'text-white shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
            }`}
            style={activeTab === tab.id ? { backgroundColor: TAB_COLORS[tab.id] } : undefined}
          >
            <Icon name={tab.icon} size={13} color={activeTab === tab.id ? '#ffffff' : TAB_COLORS[tab.id]} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active filter indicator */}
      {(customerFilter || productFilter) && (
        <div className="px-6 py-1.5 bg-purple-50 dark:bg-purple-900/10 border-b border-[var(--color-border)] flex items-center gap-2">
          <span className="text-xs text-purple-700 dark:text-purple-300">
            Lọc: {customerFilter && `KH "${customerFilter}"`}{productFilter && `SP "${productFilter}"`}
          </span>
          <button onClick={clearFilters} className="text-xs text-purple-600 underline hover:no-underline">Xóa lọc</button>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'orders' && <WineOrdersTab customerFilter={customerFilter} productFilter={productFilter} newOrderTrigger={newOrderTrigger} />}
        {activeTab === 'products' && <WineProductsTab />}
        {activeTab === 'customers' && <WineCustomersTab onCustomerClick={handleCustomerClick} />}
        {activeTab === 'inventory' && <WineInventoryTab />}
        {activeTab === 'reports' && <WineReportsTab onCustomerClick={handleCustomerClick} onProductClick={handleProductClick} />}
      </div>
    </div>
  );
}
