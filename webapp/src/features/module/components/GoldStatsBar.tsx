import { useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';

interface GoldStatsBarProps {
  records?: unknown[];
}

export function GoldStatsBar(_props: GoldStatsBarProps) {
  const { data } = useAppStore();

  // Compute gold stats from ALL gold records (not just filtered)
  const allGoldRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter((r) =>
      !r.isDeleted && (
        r.moduleId === 'mod_vang' ||
        r.linkedModuleId === 'mod_vang' ||
        (r.categoryId && r.categoryId === 'mod_vang')
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, data?.records.length, data?.lastModified]);

  const stats = useMemo(() => {
    let totalBought = 0;
    let totalSold = 0;

    for (const record of allGoldRecords) {
      // For direct gold records (moduleId === 'mod_vang')
      if (record.moduleId === 'mod_vang') {
        const type = String(record.values['mod_vang_type'] ?? '').toLowerCase();
        const quantity = Number(record.values['mod_vang_quantity'] ?? 1) || 1;

        if (type === 'buy' || type === 'mua' || type === '0') {
          totalBought += quantity;
        } else if (type === 'sell' || type === 'ban' || type === 'bán' || type === '1') {
          totalSold += quantity;
        }
      }
      // For linked records (from mod_chitieu linked to mod_vang)
      else {
        // Try to find quantity in various field patterns, default to 1
        const rawQty = 
          record.values['mod_chitieu_quantity'] ??
          record.values['mod_vang_quantity'] ??
          Object.entries(record.values).find(([k]) => k.endsWith('_quantity'))?.[1] ??
          1;
        const qty = Number(rawQty) || 1;
        // Chi tiêu type: '0' = expense (buying gold), '1' = income (selling gold)
        const chitieuType = String(record.values['mod_chitieu_type'] ?? '0');
        if (chitieuType === '0' || chitieuType === 'expense') {
          totalBought += qty;
        } else {
          totalSold += qty;
        }
      }
    }

    return {
      totalBought,
      totalSold,
      current: totalBought - totalSold,
    };
  }, [allGoldRecords]);

  // Compute last purchase and average cost
  const { lastPurchase, avgCost } = useMemo(() => {
    // Helper: get field value from record (handles both mod_vang and mod_chitieu field prefixes)
    const getVal = (r: typeof allGoldRecords[0], fieldName: string): number => {
      // Try direct gold field first
      const direct = r.values[`mod_vang_${fieldName}`];
      if (direct !== null && direct !== undefined && direct !== '') return Number(direct);
      // Try chitieu field
      const chitieu = r.values[`mod_chitieu_${fieldName}`];
      if (chitieu !== null && chitieu !== undefined && chitieu !== '') return Number(chitieu);
      // Try any field ending with _fieldName
      const entry = Object.entries(r.values).find(([k]) => k.endsWith('_' + fieldName));
      return entry ? Number(entry[1] ?? 0) : 0;
    };

    const getDate = (r: typeof allGoldRecords[0]): string => {
      return String(
        r.values['mod_vang_date'] ??
        r.values['mod_chitieu_date'] ??
        Object.entries(r.values).find(([k]) => k.endsWith('_date'))?.[1] ??
        r.createdAt ?? ''
      );
    };

    const isBuyRecord = (r: typeof allGoldRecords[0]): boolean => {
      if (r.moduleId === 'mod_vang') {
        const type = String(r.values['mod_vang_type'] ?? '').toLowerCase();
        return type === 'buy' || type === 'mua' || type === '0';
      }
      // Linked chitieu: type '0' = Chi (expense = buying gold)
      const chitieuType = String(r.values['mod_chitieu_type'] ?? '0');
      return chitieuType === '0' || chitieuType === 'expense';
    };

    // Get all BUY records sorted by date desc
    const buyRecords = allGoldRecords
      .filter(isBuyRecord)
      .sort((a, b) => getDate(b).localeCompare(getDate(a)));

    // Last purchase
    let lastPurchaseData = { quantity: 0, price: 0 };
    if (buyRecords.length > 0) {
      const latest = buyRecords[0];
      const qty = getVal(latest, 'quantity') || 1;
      const totalAmount = getVal(latest, 'total_amount') || getVal(latest, 'amount');
      const pricePerUnit = getVal(latest, 'price_per_unit');
      lastPurchaseData = {
        quantity: qty,
        price: pricePerUnit || (totalAmount && qty ? Math.round(totalAmount / qty) : totalAmount),
      };
    }

    // Average cost per chỉ (total spent / total chỉ bought)
    let totalSpent = 0;
    let totalQty = 0;
    for (const r of buyRecords) {
      const qty = getVal(r, 'quantity') || 1;
      const total = getVal(r, 'total_amount') || getVal(r, 'amount');
      const pricePerUnit = getVal(r, 'price_per_unit');
      totalQty += qty;
      totalSpent += total > 0 ? total : pricePerUnit * qty;
    }
    const avgCostVal = totalQty > 0 ? Math.round(totalSpent / totalQty) : 0;

    return { lastPurchase: lastPurchaseData, avgCost: avgCostVal };
  }, [allGoldRecords]);

  const formatMoney = (amount: number) => {
    if (!amount) return '---';
    return amount.toLocaleString('vi-VN') + ' d';
  };

  return (
    <div className="px-6 py-3 border-b border-[var(--color-border)]">
      <div className="grid grid-cols-5 gap-3">
        {/* Total Bought */}
        <StatCard
          icon="trending-up"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="#3B82F6"
          label="TONG SO (CHI)"
          value={`${stats.totalBought} chi`}
          sublabel="Tong da mua tru ban"
        />

        {/* Total Sold */}
        <StatCard
          icon="trending-down"
          iconBg="bg-red-50 dark:bg-red-900/20"
          iconColor="#EF4444"
          label="DA BAN"
          value={`${stats.totalSold} chi`}
          sublabel="Tong da ban"
        />

        {/* Current Holdings */}
        <StatCard
          icon="gem"
          iconBg="bg-green-50 dark:bg-green-900/20"
          iconColor="#22C55E"
          label="HIEN TAI"
          value={`${stats.current} chi`}
          sublabel="So luong con lai"
          highlight
        />

        {/* Last Purchase */}
        <StatCard
          icon="shopping-cart"
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconColor="#7C3AED"
          label="DA MUA GAN NHAT"
          value={lastPurchase.quantity ? `${lastPurchase.quantity} chi` : '---'}
          sublabel={lastPurchase.price ? formatMoney(lastPurchase.price) + '/chi' : 'Chua co giao dich'}
        />

        {/* Average Cost */}
        <StatCard
          icon="star"
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="#F59E0B"
          label="GIA VON TRUNG BINH"
          value={avgCost ? formatMoney(avgCost) : '---'}
          sublabel="Trung binh gia mua/chi"
        />
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon, iconBg, iconColor, label, value, sublabel, highlight }: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  sublabel: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl transition-all duration-200 hover:shadow-sm ${highlight ? 'ring-1 ring-green-200 dark:ring-green-800' : ''}`}>
      <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon name={icon} size={16} color={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</p>
        <p className={`text-lg font-bold leading-tight ${highlight ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text)]'}`}>{value}</p>
        <p className="text-[10px] text-[var(--color-text-secondary)]">{sublabel}</p>
      </div>
    </div>
  );
}
