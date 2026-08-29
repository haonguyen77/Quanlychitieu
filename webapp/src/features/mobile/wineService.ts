/**
 * Wine Inventory Service — Reproduces Android wine_data_provider.dart logic.
 * 
 * BUSINESS RULES (from Android source):
 * - Create order → deduct inventory by SKU
 * - Edit order → return old inventory, deduct new inventory
 * - Delete order → return inventory
 * - _adjustInventory(sku, delta): finds record by SKU, adjusts stock, clamps 0-999999
 * - _getProductLines: tries product_lines JSON, falls back to single product fields
 * 
 * IMPORTANT: This modifies data.records in-place via useAppStore.getState().setData()
 * to avoid double-counting on sync.
 */

import { useAppStore } from '@/core/store/appStore';
import type { RecordValues } from '@/types';

interface ProductLine {
  sku: string;
  qty: number;
}

/**
 * Extract product lines from order record values (matches Android _getProductLines).
 */
function getProductLines(values: RecordValues): ProductLine[] {
  const result: ProductLine[] = [];

  // Try product_lines JSON (multi-product)
  const plRaw = values['mod_ruou_product_lines'];
  if (plRaw && typeof plRaw === 'string' && plRaw.length > 0) {
    try {
      const lines = JSON.parse(plRaw) as Array<Record<string, string>>;
      for (const l of lines) {
        const sku = l.productSku || '';
        const qty = parseInt(l.quantity || '0') || 0;
        if (sku && qty > 0) result.push({ sku, qty });
      }
      if (result.length > 0) return result;
    } catch { /* fallback */ }
  }

  // Fallback: single product
  const sku = String(values['mod_ruou_product_sku'] || '');
  const qty = Number(values['mod_ruou_quantity']) || 0;
  if (sku && qty > 0) result.push({ sku, qty });

  return result;
}

/**
 * Adjust inventory stock for a SKU by delta.
 * Mutates data and calls setData.
 * Matches Android _adjustInventory(sku, delta).
 */
function adjustInventory(sku: string, delta: number): void {
  const { data } = useAppStore.getState();
  if (!data || !sku) return;

  const now = new Date().toISOString();
  const updatedRecords = data.records.map(r => {
    if (r.isDeleted || r.moduleId !== 'mod_ruou_inventory') return r;
    const invSku = String(r.values['mod_ruou_inventory_sku'] || '');
    if (invSku !== sku && invSku !== `${sku}-`) return r;

    const currentStock = Number(r.values['mod_ruou_inventory_stock']) || 0;
    // Allow negative stock (e.g. sell 10 when 0 in stock → -10) per requirement.
    const newStock = Math.min(999999, currentStock + delta);
    return {
      ...r,
      values: { ...r.values, mod_ruou_inventory_stock: newStock },
      updatedAt: now,
    };
  });

  useAppStore.getState().setData({ ...data, records: updatedRecords, lastModified: now });
}

/**
 * Deduct inventory for order creation (matches Android _deductInventoryForOrder).
 */
export function deductInventoryForOrder(values: RecordValues): void {
  // "Không trừ kho": skip deduction entirely when the order opts out.
  if (isSkipInventory(values)) return;
  const lines = getProductLines(values);
  for (const { sku, qty } of lines) {
    adjustInventory(sku, -qty);
  }
}

/** Whether an order is flagged to NOT deduct inventory. */
export function isSkipInventory(values: RecordValues): boolean {
  const v = values['mod_ruou_skip_inventory'];
  return v === true || v === 1 || v === '1';
}

/**
 * Return inventory on order delete (matches Android _returnInventoryForOrder).
 */
export function returnInventoryForOrder(values: RecordValues): void {
  // If the order didn't deduct stock, don't return stock either.
  if (isSkipInventory(values)) return;
  const lines = getProductLines(values);
  for (const { sku, qty } of lines) {
    adjustInventory(sku, qty);
  }
}

/**
 * Handle inventory adjustment for order edit (Android: return old, deduct new).
 */
export function adjustInventoryForEdit(oldValues: RecordValues, newValues: RecordValues): void {
  returnInventoryForOrder(oldValues);
  deductInventoryForOrder(newValues);
}

/**
 * Ensure customer record exists (matches Android _ensureCustomer).
 * Does NOT create duplicate if already exists by phone or name.
 * NOTE: Caller should handle adding the customer record if this returns false.
 */
export function shouldCreateCustomer(orderValues: RecordValues): boolean {
  const { data } = useAppStore.getState();
  if (!data) return false;

  const name = String(orderValues['mod_ruou_customer_name'] || '');
  const phone = String(orderValues['mod_ruou_customer_phone'] || '');
  if (!name) return false;

  // Check if customer already exists
  const exists = data.records.some(r => {
    if (r.isDeleted || r.moduleId !== 'mod_ruou_customers') return false;
    const existingPhone = String(r.values['mod_ruou_customers_phone'] || '');
    const existingName = String(r.values['mod_ruou_customers_full_name'] || '');
    return (phone && existingPhone === phone) || existingName === name;
  });

  return !exists;
}

/**
 * Get customer values to create from order values.
 */
export function getCustomerValues(orderValues: RecordValues): RecordValues {
  return {
    mod_ruou_customers_full_name: String(orderValues['mod_ruou_customer_name'] || ''),
    mod_ruou_customers_phone: String(orderValues['mod_ruou_customer_phone'] || ''),
    mod_ruou_customers_address: String(orderValues['mod_ruou_customer_address'] || ''),
    mod_ruou_customers_district: String(orderValues['mod_ruou_customer_district'] || ''),
    mod_ruou_customers_city: String(orderValues['mod_ruou_customer_city'] || ''),
    mod_ruou_customers_total_orders: 0,
    mod_ruou_customers_note: '',
  };
}
