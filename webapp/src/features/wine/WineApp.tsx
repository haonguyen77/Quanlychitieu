import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { WineOrdersTab } from './WineOrdersTab';
import { WineProductsTab } from './WineProductsTab';
import { WineCustomersTab } from './WineCustomersTab';
import { TrashView } from '@/features/trash/TrashView';
import { WineInventoryTab } from './WineInventoryTab';
import { WineReportsTab } from './WineReportsTab';
import { WineSettingsView } from './WineSettingsView';

export function WineApp() {
  const { activeWineView, setActiveWineView } = useAppStore();
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<string | null>(null);

  const handleCustomerClick = (customerName: string) => {
    setCustomerFilter(customerName);
    setProductFilter(null);
    setActiveWineView('orders');
  };

  const handleProductClick = (productName: string) => {
    setProductFilter(productName);
    setCustomerFilter(null);
    setActiveWineView('orders');
  };

  // Clear filters when navigating away from orders
  const clearFilters = () => {
    setCustomerFilter(null);
    setProductFilter(null);
  };

  return (
    <main className="flex-1 overflow-hidden flex flex-col">
      {activeWineView === 'dashboard' && (
        <WineReportsTab onCustomerClick={handleCustomerClick} onProductClick={handleProductClick} />
      )}
      {activeWineView === 'orders' && (
        <WineOrdersTab customerFilter={customerFilter} productFilter={productFilter} />
      )}
      {activeWineView === 'customers' && <WineCustomersTab onCustomerClick={handleCustomerClick} />}
      {activeWineView === 'products' && <WineProductsTab />}
      {activeWineView === 'inventory' && <WineInventoryTab />}
      {activeWineView === 'settings' && <WineSettingsView onClearFilters={clearFilters} />}
      {activeWineView === 'trash' && <TrashView moduleFilter={['mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory']} />}
    </main>
  );
}
