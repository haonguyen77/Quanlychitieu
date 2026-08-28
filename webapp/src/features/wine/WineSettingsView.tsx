import { useState, useMemo } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { indexedDBService } from '@/services/indexeddb/indexedDBService';
import { syncService } from '@/services/sync/syncService';
import { getWineColorPalette, setWineColorPalette } from './wineColors';
import * as XLSX from 'xlsx';

interface Props { onClearFilters?: () => void; }

export function WineSettingsView({ onClearFilters: _onClearFilters }: Props) {
  const { data, setData, setSyncing } = useAppStore();
  const [status, setStatus] = useState('');
  const [activeSection, setActiveSection] = useState<'backup' | 'columns' | 'manage'>('backup');
  const [lowStockThreshold, setLowStockThreshold] = useState(data?.settings?.wineSettings?.lowStockThreshold ?? 4);

  const showStatus = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 4000); };

  // ─── BACKUP: Export/Import ───
  const exportJSON = () => {
    if (!data) return;
    const wineData = { orders: data.records.filter((r) => r.moduleId === 'mod_ruou' && !r.isDeleted), products: data.records.filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted), customers: data.records.filter((r) => r.moduleId === 'mod_ruou_customers' && !r.isDeleted), inventory: data.records.filter((r) => r.moduleId === 'mod_ruou_inventory' && !r.isDeleted), exportedAt: new Date().toISOString() };
    download(JSON.stringify(wineData, null, 2), `wine-data-${today()}.json`, 'application/json');
  };

  const importJSON = () => {
    pickFile('.json', async (text) => {
      if (!data) return;
      const imported = JSON.parse(text);
      const now = new Date().toISOString();
      let newRecords = [...data.records];
      let count = 0;
      for (const key of ['orders', 'products', 'customers', 'inventory']) {
        if (imported[key]?.length) {
          for (const rec of imported[key]) { if (!newRecords.find((r) => r.id === rec.id)) { newRecords.push({ ...rec, updatedAt: now }); count++; } }
        }
      }
      const updatedData = { ...data, records: newRecords, lastModified: now, metadata: { ...data.metadata, totalRecords: newRecords.filter((r) => !r.isDeleted).length } };
      setData(updatedData); await indexedDBService.saveData(updatedData);
      showStatus(`Import thành công: ${count} bản ghi mới`);
    });
  };

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    // Define columns explicitly for each module (not dependent on module.fields)
    const sheetDefs = [
      { name: 'Đơn hàng', moduleId: 'mod_ruou', columns: [
        { key: 'mod_ruou_order_date', label: 'Ngày đặt' },
        { key: 'mod_ruou_customer_name', label: 'Khách hàng' },
        { key: 'mod_ruou_customer_phone', label: 'SĐT' },
        { key: 'mod_ruou_customer_address', label: 'Địa chỉ' },
        { key: 'mod_ruou_customer_district', label: 'Quận' },
        { key: 'mod_ruou_customer_city', label: 'TP' },
        { key: 'mod_ruou_product_name', label: 'Sản phẩm' },
        { key: 'mod_ruou_product_sku', label: 'SKU' },
        { key: 'mod_ruou_color', label: 'Màu' },
        { key: 'mod_ruou_quantity', label: 'SL', type: 'n' },
        { key: 'mod_ruou_price', label: 'Đơn giá', type: 'n' },
        { key: 'mod_ruou_glasses', label: 'Ly', type: 'n' },
        { key: 'mod_ruou_boxes', label: 'Hộp', type: 'n' },
        { key: 'mod_ruou_ship_fee', label: 'Ship', type: 'n' },
        { key: 'mod_ruou_total_amount', label: 'Tổng tiền', type: 'n' },
        { key: 'mod_ruou_note1', label: 'Ghi chú 1' },
        { key: 'mod_ruou_note2', label: 'Ghi chú 2' },
      ]},
      { name: 'Khách hàng', moduleId: 'mod_ruou_customers', columns: [
        { key: 'mod_ruou_customers_full_name', label: 'Họ tên' },
        { key: 'mod_ruou_customers_phone', label: 'SĐT' },
        { key: 'mod_ruou_customers_address', label: 'Địa chỉ' },
        { key: 'mod_ruou_customers_district', label: 'Quận/Huyện' },
        { key: 'mod_ruou_customers_city', label: 'Tỉnh/TP' },
        { key: 'mod_ruou_customers_total_orders', label: 'Tổng đơn', type: 'n' },
        { key: 'mod_ruou_customers_last_order_date', label: 'Đơn cuối' },
        { key: 'mod_ruou_customers_note', label: 'Ghi chú' },
      ]},
      { name: 'Sản phẩm', moduleId: 'mod_ruou_products', columns: [
        { key: 'mod_ruou_products_sku', label: 'SKU' },
        { key: 'mod_ruou_products_product_name', label: 'Tên đầy đủ' },
        { key: 'mod_ruou_products_short_name', label: 'Tên ngắn' },
        { key: 'mod_ruou_products_volume_ml', label: 'Dung tích (ml)', type: 'n' },
        { key: 'mod_ruou_products_wine_type', label: 'Loại rượu' },
        { key: 'mod_ruou_products_bottle_type', label: 'Loại chai' },
      ]},
      { name: 'Kho', moduleId: 'mod_ruou_inventory', columns: [
        { key: 'mod_ruou_inventory_sku', label: 'SKU' },
        { key: 'mod_ruou_inventory_product_name', label: 'Sản phẩm' },
        { key: 'mod_ruou_inventory_color', label: 'Màu' },
        { key: 'mod_ruou_inventory_wine_type', label: 'Loại rượu' },
        { key: 'mod_ruou_inventory_bottle_type', label: 'Loại chai' },
        { key: 'mod_ruou_inventory_stock', label: 'Tồn kho', type: 'n' },
      ]},
    ];

    for (const sheet of sheetDefs) {
      const records = data.records.filter((r) => r.moduleId === sheet.moduleId && !r.isDeleted);
      const headers = sheet.columns.map((c) => c.label);
      
      let rows: (string | number)[][];
      
      if (sheet.moduleId === 'mod_ruou') {
        // Special handling: expand multi-product orders into multiple rows
        rows = [];
        for (const r of records) {
          const productLinesStr = r.values['mod_ruou_product_lines'];
          let productLines: Array<Record<string, string>> | null = null;
          
          if (productLinesStr && typeof productLinesStr === 'string') {
            try { productLines = JSON.parse(productLinesStr); } catch { /* ignore */ }
          }
          
          if (productLines && Array.isArray(productLines) && productLines.length > 1) {
            // Multiple products: create one row per product with shared order info
            for (const line of productLines) {
              const rowData = sheet.columns.map((c) => {
                // Product-specific fields from the line
                if (c.key === 'mod_ruou_product_name') return line.productName || '';
                if (c.key === 'mod_ruou_product_sku') return line.productSku || '';
                if (c.key === 'mod_ruou_color') return line.color || '';
                if (c.key === 'mod_ruou_quantity') return Number(line.quantity) || 0;
                if (c.key === 'mod_ruou_price') return Number(line.price) || 0;
                if (c.key === 'mod_ruou_glasses') return Number(line.glasses) || 0;
                if (c.key === 'mod_ruou_boxes') return Number(line.boxes) || 0;
                // Order-level fields from record
                const v = r.values[c.key];
                if (v == null) return '';
                if (c.type === 'n') return Number(v) || 0;
                return String(v);
              });
              rows.push(rowData);
            }
          } else {
            // Single product or no product_lines: one row
            rows.push(sheet.columns.map((c) => {
              const v = r.values[c.key];
              if (v == null) return '';
              if (c.type === 'n') return Number(v) || 0;
              return String(v);
            }));
          }
        }
      } else {
        // Standard: one row per record
        rows = records.map((r) => sheet.columns.map((c) => {
          const v = r.values[c.key];
          if (v == null) return '';
          if (c.type === 'n') return Number(v) || 0;
          return String(v);
        }));
      }
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      // Freeze first row + auto-filter
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
      // Auto column width
      ws['!cols'] = headers.map((h, i) => {
        let maxLen = h.length;
        for (const row of rows) { const cell = String(row[i] ?? ''); if (cell.length > maxLen) maxLen = cell.length; }
        return { wch: Math.min(Math.max(maxLen + 2, 8), 40) };
      });
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `wine-data-${today()}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    showStatus('Đã xuất file Excel (4 sheets)');
  };

  const importExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !data) return;
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) { showStatus('❌ File Excel trống'); return; }
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        if (rows.length === 0) { showStatus('❌ Không có dữ liệu'); return; }

        const keys = Object.keys(rows[0]);
        const { addRecord, updateRecord } = useRecordStore.getState();

        // Detect mode based on columns
        const hasStock = keys.some((k) => /^(stock|tồn|ton|sl|số lượng)$/i.test(k.trim()));
        const hasSku = keys.some((k) => /sku|mã sp|ma sp/i.test(k));
        const hasOrder = keys.some((k) => /khách hàng|khach hang|customer|kh/i.test(k)) && keys.some((k) => /sản phẩm|san pham|sp|product/i.test(k));

        // Priority: Orders > Inventory > Products
        if (hasOrder) {
          // ─── IMPORT ORDERS ───
          // Helper: convert Excel serial date to YYYY-MM-DD
          const excelDateToString = (val: unknown): string => {
            if (!val) return '';
            const s = String(val).trim();
            // If already a date string (contains - or /)
            if (s.includes('-') || s.includes('/')) return s;
            // Excel serial number (days since 1900-01-01, with 1900 bug)
            const num = Number(s);
            if (!isNaN(num) && num > 30000 && num < 60000) {
              const date = new Date((num - 25569) * 86400000);
              if (!isNaN(date.getTime())) {
                return date.toISOString().slice(0, 10);
              }
            }
            return s;
          };

          // Track added customer phones to prevent duplicates within same import
          const addedPhones = new Set<string>();
          // Pre-load existing phones
          for (const r of data.records) {
            if (r.moduleId === 'mod_ruou_customers' && !r.isDeleted) {
              const p = String(r.values['mod_ruou_customers_phone'] ?? '').trim();
              if (p) addedPhones.add(p);
            }
          }

          // Group rows by date + customer + phone → 1 order with multiple product lines
          const orderGroups = new Map<string, Array<Record<string, unknown>>>();
          
          for (const row of rows) {
            const dateRaw = row['Ngày'] ?? row['ngay'] ?? row['Date'] ?? row['date'] ?? row['Ngày đặt'] ?? '';
            const date = excelDateToString(dateRaw);
            const customer = String(row['Khách hàng'] ?? row['Khach hang'] ?? row['KH'] ?? row['Customer'] ?? row['Tên KH'] ?? '').trim();
            const phone = String(row['SĐT'] ?? row['SDT'] ?? row['sdt'] ?? row['Phone'] ?? row['Số điện thoại'] ?? '').trim();
            const groupKey = `${date}|||${customer}|||${phone}`;
            if (!orderGroups.has(groupKey)) orderGroups.set(groupKey, []);
            orderGroups.get(groupKey)!.push(row);
          }

          let imported = 0;
          let failCount = 0;
          // Track which original rows belong to which group for result mapping
          let rowIdx = 0;
          const rowResults = new Array(rows.length).fill(null);

          for (const [groupKey, groupRows] of orderGroups) {
            const [date, customer, phone] = groupKey.split('|||');
            const errors: string[] = [];
            
            if (!date && !customer) { 
              for (let g = 0; g < groupRows.length; g++) { rowResults[rowIdx + g] = { status: '❌ Thất bại', error: 'Thiếu Ngày và Khách hàng' }; failCount++; }
              rowIdx += groupRows.length;
              continue;
            }

            // Build product lines
            const productLines: Array<Record<string, string>> = [];
            let totalAmount = 0;
            let shipFee = 0;

            for (const row of groupRows) {
              const productName = String(row['Sản phẩm'] ?? row['San pham'] ?? row['SP'] ?? row['Product'] ?? row['Tên SP'] ?? '').trim();
              const sku = String(row['SKU'] ?? row['sku'] ?? row['Mã'] ?? row['ma'] ?? '').trim();
              const color = String(row['Màu'] ?? row['mau'] ?? row['Color'] ?? '').trim();
              const qty = String(Number(row['SL'] ?? row['sl'] ?? row['Số lượng'] ?? row['Quantity'] ?? row['qty'] ?? 1) || 1);
              const price = String(Number(row['Giá'] ?? row['gia'] ?? row['Đơn giá'] ?? row['Price'] ?? row['price'] ?? 0) || 0);
              const glasses = String(Number(row['Ly'] ?? row['ly'] ?? row['Glasses'] ?? 0) || 0);
              const boxes = String(Number(row['Hộp'] ?? row['hop'] ?? row['Boxes'] ?? 0) || 0);
              
              if (!productName && !sku) {
                errors.push(`Dòng thiếu tên SP/SKU`);
                continue;
              }

              productLines.push({ productName: productName || sku, productSku: sku, color, quantity: qty, price, glasses, boxes });
              totalAmount += Number(qty) * Number(price);

              // Ship fee from first row only
              if (productLines.length === 1) {
                shipFee = Number(row['Ship'] ?? row['ship'] ?? row['Phí ship'] ?? row['phi ship'] ?? 0) || 0;
              }
            }

            if (productLines.length === 0) {
              for (let g = 0; g < groupRows.length; g++) { rowResults[rowIdx + g] = { status: '❌ Thất bại', error: errors.join('; ') || 'Không có sản phẩm hợp lệ' }; failCount++; }
              rowIdx += groupRows.length;
              continue;
            }

            // Get address
            const firstRow = groupRows[0];
            const address = String(firstRow['Địa chỉ'] ?? firstRow['Dia chi'] ?? firstRow['Address'] ?? '').trim();
            const district = String(firstRow['Phường'] ?? firstRow['Quận'] ?? firstRow['District'] ?? '').trim();
            const city = String(firstRow['Thành phố'] ?? firstRow['TP'] ?? firstRow['City'] ?? '').trim();
            const note1 = String(firstRow['Ghi chú'] ?? firstRow['Ghi chu'] ?? firstRow['Note'] ?? '').trim();
            const note2 = String(firstRow['Ghi chú 2'] ?? firstRow['Note 2'] ?? '').trim();

            try {
              // Validate date
              const orderDate = date || new Date().toISOString().slice(0, 10);
              if (orderDate.includes('undefined') || orderDate.includes('NaN')) {
                for (let g = 0; g < groupRows.length; g++) { rowResults[rowIdx + g] = { status: '❌ Thất bại', error: `Ngày không hợp lệ: "${groupRows[0]['Ngày'] ?? groupRows[0]['Date'] ?? ''}"` }; failCount++; }
                rowIdx += groupRows.length;
                continue;
              }

              const values: Record<string, string | number | boolean | string[] | null> = {
                mod_ruou_order_date: orderDate,
                mod_ruou_customer_name: customer,
                mod_ruou_customer_phone: phone,
                mod_ruou_customer_address: address,
                mod_ruou_customer_district: district,
                mod_ruou_customer_city: city,
                mod_ruou_ship_fee: shipFee,
                mod_ruou_total_amount: totalAmount + shipFee,
                mod_ruou_note1: note1,
                mod_ruou_note2: note2,
                // First product flat fields
                mod_ruou_product_name: productLines[0].productName,
                mod_ruou_product_sku: productLines[0].productSku,
                mod_ruou_color: productLines[0].color,
                mod_ruou_quantity: Number(productLines[0].quantity),
                mod_ruou_price: Number(productLines[0].price),
                mod_ruou_glasses: Number(productLines[0].glasses),
                mod_ruou_boxes: Number(productLines[0].boxes),
              };
              // Multi-product: add product_lines JSON
              if (productLines.length > 1) {
                values['mod_ruou_product_lines'] = JSON.stringify(productLines);
              }

              addRecord('mod_ruou', values);

              // Also add customer if not exists (check local tracking set)
              if (phone && customer) {
                if (!addedPhones.has(phone)) {
                  addRecord('mod_ruou_customers', { mod_ruou_customers_full_name: customer, mod_ruou_customers_phone: phone, mod_ruou_customers_address: [address, district, city].filter(Boolean).join(', '), mod_ruou_customers_note: '', mod_ruou_customers_total_orders: 0 });
                  addedPhones.add(phone);
                }
              }

              for (let g = 0; g < groupRows.length; g++) { rowResults[rowIdx + g] = { status: '✅ Thành công', error: '' }; }
              imported++;
            } catch (err) {
              for (let g = 0; g < groupRows.length; g++) { rowResults[rowIdx + g] = { status: '❌ Thất bại', error: `Lỗi lưu: ${err instanceof Error ? err.message : String(err)}` }; failCount++; }
            }
            rowIdx += groupRows.length;
          }

          showStatus(failCount === 0 ? `✅ Import ${imported} đơn hàng thành công` : `⚠️ ${imported} đơn thành công, ${failCount} dòng lỗi`);

          if (failCount > 0) {
            const resultRows = rows.map((row, i) => ({ ...row, 'Import Status': rowResults[i]?.status || '', 'Import Error': rowResults[i]?.error || '' }));
            const resultSheet = XLSX.utils.json_to_sheet(resultRows);
            const resultWb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(resultWb, resultSheet, 'Import Result');
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const wbout = XLSX.write(resultWb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `Import_Result_${ts}.xlsx`; a.click(); URL.revokeObjectURL(url);
            alert(`Import: ${imported} đơn | Lỗi: ${failCount} dòng\nFile kết quả đã tải xuống.`);
          } else {
            alert(`✅ Import thành công ${imported} đơn hàng (${rows.length} dòng, gộp theo Ngày+KH)`);
          }
          return;
        }

        if (!hasSku) {
          showStatus(`❌ Thiếu cột SKU/Mã. Cột hiện có: ${keys.join(', ')}`);
          return;
        }

        // Process each row
        let successCount = 0;
        let failCount = 0;
        const results: Array<{ status: string; error: string }> = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const errors: string[] = [];

          // Extract SKU
          const sku = String(row['SKU'] ?? row['sku'] ?? row['Mã'] ?? row['ma'] ?? row['Mã SP'] ?? row['Ma SP'] ?? '').trim();
          if (!sku) {
            errors.push('Thiếu trường bắt buộc: SKU/Mã');
          }

          // Extract fields
          const name = String(row['Tên'] ?? row['ten'] ?? row['Name'] ?? row['name'] ?? row['Tên sản phẩm'] ?? row['Tên SP'] ?? '').trim() || sku;
          const color = String(row['Màu'] ?? row['mau'] ?? row['Color'] ?? row['color'] ?? row['Màu sắc'] ?? '').trim();
          const stockRaw = row['Tồn'] ?? row['ton'] ?? row['Stock'] ?? row['stock'] ?? row['SL'] ?? row['sl'] ?? row['Số lượng'] ?? '';
          const stock = Number(stockRaw);
          if (hasStock && stockRaw !== '' && isNaN(stock)) {
            errors.push(`Số lượng không hợp lệ: "${stockRaw}"`);
          }
          const wineType = String(row['Loại'] ?? row['loai'] ?? row['Type'] ?? row['Loại rượu'] ?? '').trim();
          const bottleType = String(row['Chai'] ?? row['chai'] ?? row['Bottle'] ?? row['Loại chai'] ?? '').trim();

          if (errors.length > 0) {
            results.push({ status: '❌ Thất bại', error: errors.join('; ') });
            failCount++;
            continue;
          }

          // Import
          try {
            if (hasStock) {
              const fullSku = color ? `${sku}-${color}` : sku;
              const existing = data.records.find((r) => r.moduleId === 'mod_ruou_inventory' && !r.isDeleted && String(r.values['mod_ruou_inventory_sku'] ?? '') === fullSku);
              if (existing) {
                updateRecord(existing.id, { mod_ruou_inventory_stock: stock || 0 });
              } else {
                addRecord('mod_ruou_inventory', { mod_ruou_inventory_sku: fullSku, mod_ruou_inventory_product_name: name, mod_ruou_inventory_color: color, mod_ruou_inventory_wine_type: wineType, mod_ruou_inventory_bottle_type: bottleType, mod_ruou_inventory_stock: stock || 0, mod_ruou_inventory_note: '' });
              }
            } else {
              const existing = data.records.find((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted && String(r.values['mod_ruou_products_sku'] ?? '') === sku);
              if (existing) {
                // Update existing product
                updateRecord(existing.id, { mod_ruou_products_product_name: name, mod_ruou_products_wine_type: wineType, mod_ruou_products_bottle_type: bottleType });
              } else {
                addRecord('mod_ruou_products', { mod_ruou_products_sku: sku, mod_ruou_products_product_name: name, mod_ruou_products_wine_type: wineType, mod_ruou_products_bottle_type: bottleType, mod_ruou_products_volume_ml: 0, mod_ruou_products_note: '' });
              }
            }

            // Auto-add customer if phone column exists (use tracking set)
            const phone = String(row['SĐT'] ?? row['SDT'] ?? row['sdt'] ?? row['Phone'] ?? row['phone'] ?? row['Số điện thoại'] ?? row['Điện thoại'] ?? '').trim();
            const customerName = String(row['Khách hàng'] ?? row['Khach hang'] ?? row['KH'] ?? row['Customer'] ?? row['Tên KH'] ?? row['Ten KH'] ?? '').trim();
            if (phone && customerName) {
              // Check tracking set (includes pre-loaded existing + newly added)
              const existingPhones = new Set<string>();
              for (const r of data.records) {
                if (r.moduleId === 'mod_ruou_customers' && !r.isDeleted) {
                  const p = String(r.values['mod_ruou_customers_phone'] ?? '').trim();
                  if (p) existingPhones.add(p);
                }
              }
              if (!existingPhones.has(phone)) {
                const address = String(row['Địa chỉ'] ?? row['Dia chi'] ?? row['Address'] ?? '').trim();
                addRecord('mod_ruou_customers', {
                  mod_ruou_customers_full_name: customerName,
                  mod_ruou_customers_phone: phone,
                  mod_ruou_customers_address: address,
                  mod_ruou_customers_note: '',
                  mod_ruou_customers_total_orders: 0,
                });
              }
            }

            results.push({ status: '✅ Thành công', error: '' });
            successCount++;
          } catch (err) {
            results.push({ status: '❌ Thất bại', error: `Lỗi lưu: ${err instanceof Error ? err.message : String(err)}` });
            failCount++;
          }
        }

        // Show summary
        const summary = `Import hoàn tất\nTổng: ${rows.length} | Thành công: ${successCount} | Thất bại: ${failCount}`;
        showStatus(failCount === 0 ? `✅ Import thành công 100% (${successCount}/${rows.length} dòng)` : `⚠️ ${successCount}/${rows.length} thành công, ${failCount} lỗi`);

        // If there are errors, generate result Excel and auto-download
        if (failCount > 0) {
          // Add result columns to original data
          const resultRows = rows.map((row, i) => ({
            ...row,
            'Import Status': results[i].status,
            'Import Error': results[i].error,
          }));

          const resultSheet = XLSX.utils.json_to_sheet(resultRows);
          const resultWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(resultWb, resultSheet, 'Import Result');
          const now = new Date();
          const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
          const wbout = XLSX.write(resultWb, { bookType: 'xlsx', type: 'array' });
          const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Import_Result_${timestamp}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);

          alert(`${summary}\n\nFile kết quả đã được tải xuống.\nVui lòng kiểm tra cột "Import Error" để sửa các dòng lỗi.`);
        } else {
          alert(summary);
        }
      } catch (err) {
        const msg = '❌ Lỗi đọc file: ' + (err instanceof Error ? err.message : String(err));
        showStatus(msg);
        alert(msg);
      }
    };
    input.click();
  };

  const syncGoogleDrive = async () => {
    setSyncing(true);
    try {
      await syncService.push();
      showStatus('Đã đồng bộ lên Google Drive');
    } catch (e) { showStatus('Lỗi đồng bộ: ' + (e instanceof Error ? e.message : 'Unknown')); }
    finally { setSyncing(false); }
  };

  const exportToGoogleSheets = async () => {
    if (!data) return;
    showStatus('Đang xuất lên Google Sheets...');
    try {
      // Use Web OAuth to get token
      const { driveService } = await import('@/services/drive/driveService');
      let token = driveService.token;
      if (!token) {
        token = await driveService.login();
        if (!token) throw new Error('Auth failed: ' + driveService.getLastError());
      }
      // Create spreadsheet
      const createResp = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Wine Data ${today()}`, mimeType: 'application/vnd.google-apps.spreadsheet' }),
      });
      const file = await createResp.json();
      if (file.id) {
        window.open(`https://docs.google.com/spreadsheets/d/${file.id}`, '_blank');
        showStatus('Đã tạo Google Sheet. Vui lòng paste dữ liệu từ CSV.');
      }
    } catch (e) { showStatus('Lỗi: ' + (e instanceof Error ? e.message : 'Không thể kết nối Google')); }
  };

  const openGoogleSheets = () => {
    // Open the last synced spreadsheet or create new
    window.open('https://docs.google.com/spreadsheets', '_blank');
  };

  // ─── COLUMN CONFIG ───
  const [configModule, setConfigModule] = useState('mod_ruou');

  // Default field definitions for each module (ensures all columns appear even if not in data.modules)
  const defaultFieldDefs: Record<string, { id: string; fieldName: string; fieldLabel: string }[]> = {
    mod_ruou: [
      { id: 'f_order_date', fieldName: 'order_date', fieldLabel: 'Ngày đặt' },
      { id: 'f_customer_name', fieldName: 'customer_name', fieldLabel: 'Khách hàng' },
      { id: 'f_customer_phone', fieldName: 'customer_phone', fieldLabel: 'SĐT' },
      { id: 'f_customer_address', fieldName: 'customer_address', fieldLabel: 'Địa chỉ' },
      { id: 'f_customer_district', fieldName: 'customer_district', fieldLabel: 'Phường' },
      { id: 'f_customer_city', fieldName: 'customer_city', fieldLabel: 'TP' },
      { id: 'f_product_name', fieldName: 'product_name', fieldLabel: 'Sản phẩm' },
      { id: 'f_product_sku', fieldName: 'product_sku', fieldLabel: 'SKU' },
      { id: 'f_color', fieldName: 'color', fieldLabel: 'Màu' },
      { id: 'f_quantity', fieldName: 'quantity', fieldLabel: 'SL' },
      { id: 'f_price', fieldName: 'price', fieldLabel: 'Đơn giá' },
      { id: 'f_glasses', fieldName: 'glasses', fieldLabel: 'Ly' },
      { id: 'f_boxes', fieldName: 'boxes', fieldLabel: 'Hộp' },
      { id: 'f_ship_fee', fieldName: 'ship_fee', fieldLabel: 'Ship' },
      { id: 'f_total_amount', fieldName: 'total_amount', fieldLabel: 'Tổng tiền' },
      { id: 'f_note1', fieldName: 'note1', fieldLabel: 'Ghi chú 1' },
      { id: 'f_note2', fieldName: 'note2', fieldLabel: 'Ghi chú 2' },
    ],
    mod_ruou_customers: [
      { id: 'f_cust_full_name', fieldName: 'full_name', fieldLabel: 'Họ tên' },
      { id: 'f_cust_phone', fieldName: 'phone', fieldLabel: 'SĐT' },
      { id: 'f_cust_address', fieldName: 'address', fieldLabel: 'Địa chỉ' },
      { id: 'f_cust_district', fieldName: 'district', fieldLabel: 'Phường' },
      { id: 'f_cust_city', fieldName: 'city', fieldLabel: 'TP' },
      { id: 'f_cust_total_orders', fieldName: 'total_orders', fieldLabel: 'Tổng đơn' },
      { id: 'f_cust_last_order_date', fieldName: 'last_order_date', fieldLabel: 'Đơn cuối' },
      { id: 'f_cust_note', fieldName: 'note', fieldLabel: 'Ghi chú' },
    ],
    mod_ruou_products: [
      { id: 'f_prod_sku', fieldName: 'sku', fieldLabel: 'SKU' },
      { id: 'f_prod_product_name', fieldName: 'product_name', fieldLabel: 'Tên đầy đủ' },
      { id: 'f_prod_short_name', fieldName: 'short_name', fieldLabel: 'Tên ngắn' },
      { id: 'f_prod_volume_ml', fieldName: 'volume_ml', fieldLabel: 'Dung tích (ml)' },
      { id: 'f_prod_wine_type', fieldName: 'wine_type', fieldLabel: 'Loại rượu' },
      { id: 'f_prod_bottle_type', fieldName: 'bottle_type', fieldLabel: 'Loại chai' },
      { id: 'f_prod_note', fieldName: 'note', fieldLabel: 'Ghi chú' },
    ],
    mod_ruou_inventory: [
      { id: 'f_inv_sku', fieldName: 'sku', fieldLabel: 'SKU' },
      { id: 'f_inv_product_name', fieldName: 'product_name', fieldLabel: 'Sản phẩm' },
      { id: 'f_inv_color', fieldName: 'color', fieldLabel: 'Màu' },
      { id: 'f_inv_wine_type', fieldName: 'wine_type', fieldLabel: 'Loại rượu' },
      { id: 'f_inv_bottle_type', fieldName: 'bottle_type', fieldLabel: 'Loại chai' },
      { id: 'f_inv_stock', fieldName: 'stock', fieldLabel: 'Tồn kho' },
      { id: 'f_inv_note', fieldName: 'note', fieldLabel: 'Ghi chú' },
    ],
  };

  const moduleFields = useMemo(() => {
    if (!data) return [];
    const mod = data.modules.find((m) => m.id === configModule);
    const existingFields = mod?.fields?.sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
    // Merge defaults: if existing fields cover everything, use them; otherwise inject missing ones
    const defaults = defaultFieldDefs[configModule] || [];
    if (existingFields.length > 0) {
      // Ensure all defaults exist
      const existingNames = new Set(existingFields.map((f) => f.fieldName));
      const missing = defaults.filter((d) => !existingNames.has(d.fieldName));
      if (missing.length === 0) return existingFields;
      return [...existingFields, ...missing.map((d, i) => ({ ...d, sortOrder: existingFields.length + i, isTableVisible: true, fieldType: 'text' as const, createdAt: '', updatedAt: '' }))];
    }
    // No fields at all — return defaults as visible
    return defaults.map((d, i) => ({ ...d, sortOrder: i, isTableVisible: true, fieldType: 'text' as const, createdAt: '', updatedAt: '' }));
  }, [data, configModule]);

  const toggleFieldVisible = (fieldId: string) => {
    if (!data) return;
    const mod = data.modules.find((m) => m.id === configModule);
    if (!mod) return;
    const fields = mod.fields.map((f) => f.id === fieldId ? { ...f, isTableVisible: !f.isTableVisible } : f);
    const updatedMod = { ...mod, fields };
    const modules = data.modules.map((m) => m.id === configModule ? updatedMod : m);
    const updatedData = { ...data, modules, lastModified: new Date().toISOString() };
    setData(updatedData); indexedDBService.saveData(updatedData);
  };

  const renameField = (fieldId: string, newLabel: string) => {
    if (!data || !newLabel.trim()) return;
    const mod = data.modules.find((m) => m.id === configModule);
    if (!mod) return;
    const fields = mod.fields.map((f) => f.id === fieldId ? { ...f, fieldLabel: newLabel.trim(), updatedAt: new Date().toISOString() } : f);
    const updatedMod = { ...mod, fields };
    const modules = data.modules.map((m) => m.id === configModule ? updatedMod : m);
    const updatedData = { ...data, modules, lastModified: new Date().toISOString() };
    setData(updatedData); indexedDBService.saveData(updatedData);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    if (!data) return;
    const mod = data.modules.find((m) => m.id === configModule);
    if (!mod) return;
    const fields = [...mod.fields].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = fields.findIndex((f) => f.id === fieldId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= fields.length) return;
    // Swap sortOrder values
    const tmpOrder = fields[idx].sortOrder;
    fields[idx] = { ...fields[idx], sortOrder: fields[swapIdx].sortOrder };
    fields[swapIdx] = { ...fields[swapIdx], sortOrder: tmpOrder };
    const updatedMod = { ...mod, fields };
    const modules = data.modules.map((m) => m.id === configModule ? updatedMod : m);
    const updatedData = { ...data, modules, lastModified: new Date().toISOString() };
    setData(updatedData); indexedDBService.saveData(updatedData);
  };

  // ─── MANAGE: Colors, Wine Types, Bottle Types ───
  const [manageType, setManageType] = useState<'colors' | 'wineType' | 'bottleType'>('colors');
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [editingItemLabel, setEditingItemLabel] = useState('');
  const [editingItemValue, setEditingItemValue] = useState('');

  const wineTypeField = data?.modules.find((m) => m.id === 'mod_ruou_products')?.fields.find((f) => f.fieldName === 'wine_type');
  const bottleTypeField = data?.modules.find((m) => m.id === 'mod_ruou_products')?.fields.find((f) => f.fieldName === 'bottle_type');
  // Fallback options if field.options is empty/undefined
  const wineTypeOptions = wineTypeField?.options?.length ? wineTypeField.options : [
    { id: 'wpt_gao', label: 'Gạo', value: 'gao', color: '#FF9800', sortOrder: 0, isActive: true },
    { id: 'wpt_gao2', label: 'Gạo loại 2', value: 'gao loai 2', color: '#FB8C00', sortOrder: 1, isActive: true },
    { id: 'wpt_nep', label: 'Nếp', value: 'nep', color: '#8BC34A', sortOrder: 2, isActive: true },
    { id: 'wpt_dauxanh', label: 'Đậu xanh', value: 'dauxanh', color: '#4CAF50', sortOrder: 3, isActive: true },
    { id: 'wpt_vangnep', label: 'Vang nếp', value: 'vangnep', color: '#9C27B0', sortOrder: 4, isActive: true },
    { id: 'wpt_dtht', label: 'ĐTHT', value: 'dtht', color: '#F44336', sortOrder: 5, isActive: true },
  ];
  const bottleTypeOptions = bottleTypeField?.options?.length ? bottleTypeField.options : [
    { id: 'wbt_pet', label: 'PET', value: 'pet', color: '#4CAF50', sortOrder: 0, isActive: true },
    { id: 'wbt_su', label: 'Sứ', value: 'su', color: '#795548', sortOrder: 1, isActive: true },
    { id: 'wbt_thuytinh', label: 'Thuỷ tinh', value: 'thuytinh', color: '#03A9F4', sortOrder: 2, isActive: true },
  ];
  // Palette source of truth is data.wineColorPalette (synced). Legacy
  // localStorage is only a migration fallback (handled inside getWineColorPalette).
  const colorList = getWineColorPalette(data);

  const persistPalette = (updated: { code: string; label: string }[]) => {
    if (!data) return;
    const updatedData = setWineColorPalette(data, updated);
    setData(updatedData); indexedDBService.saveData(updatedData);
  };

  const addColor = () => {
    if (!newItemValue.trim() || !newItemLabel.trim()) return;
    const updated = [...colorList, { code: newItemValue.trim().toUpperCase(), label: newItemLabel.trim() }];
    persistPalette(updated);
    setNewItemLabel(''); setNewItemValue('');
    showStatus('Đã thêm màu');
  };

  const removeColor = (code: string) => {
    const updated = colorList.filter((c) => c.code !== code);
    persistPalette(updated);
    showStatus('Đã xóa màu');
  };

  const saveEditColor = (oldCode: string) => {
    if (!editingItemLabel.trim() || !editingItemValue.trim()) { setEditingItemKey(null); return; }
    if (!data) { setEditingItemKey(null); return; }
    const newCode = editingItemValue.trim().toUpperCase();
    const updatedPalette = colorList.map((c) => c.code === oldCode ? { ...c, code: newCode, label: editingItemLabel.trim() } : c);
    // Persist palette, and propagate code change to records if code changed.
    let updatedData = setWineColorPalette(data, updatedPalette);
    if (newCode !== oldCode) {
      const updatedRecords = updatedData.records.map((r) => {
        if (r.values['mod_ruou_color'] === oldCode) {
          return { ...r, values: { ...r.values, mod_ruou_color: newCode }, updatedAt: new Date().toISOString() };
        }
        return r;
      });
      updatedData = { ...updatedData, records: updatedRecords, lastModified: new Date().toISOString() };
    }
    setData(updatedData); indexedDBService.saveData(updatedData);
    setEditingItemKey(null);
    showStatus('Đã sửa màu');
  };

  const saveEditOption = (fieldName: 'wine_type' | 'bottle_type', oldValue: string) => {
    if (!data || !editingItemLabel.trim() || !editingItemValue.trim()) { setEditingItemKey(null); return; }
    const mod = data.modules.find((m) => m.id === 'mod_ruou_products');
    if (!mod) { setEditingItemKey(null); return; }
    const field = mod.fields.find((f) => f.fieldName === fieldName);
    if (!field || !field.options) { setEditingItemKey(null); return; }
    const newValue = editingItemValue.trim().toLowerCase();
    const updatedOptions = field.options.map((o) => o.value === oldValue ? { ...o, value: newValue, label: editingItemLabel.trim() } : o);
    const updatedField = { ...field, options: updatedOptions };
    const updatedMod = { ...mod, fields: mod.fields.map((f) => f.fieldName === fieldName ? updatedField : f) };
    let updatedData = { ...data, modules: data.modules.map((m) => m.id === 'mod_ruou_products' ? updatedMod : m), lastModified: new Date().toISOString() };
    // Propagate value change to product records if value changed
    if (newValue !== oldValue) {
      const fieldKey = fieldName === 'wine_type' ? 'mod_ruou_products_wine_type' : 'mod_ruou_products_bottle_type';
      const updatedRecords = updatedData.records.map((r) => {
        if (r.values[fieldKey] === oldValue) {
          return { ...r, values: { ...r.values, [fieldKey]: newValue }, updatedAt: new Date().toISOString() };
        }
        return r;
      });
      updatedData = { ...updatedData, records: updatedRecords };
    }
    setData(updatedData); indexedDBService.saveData(updatedData);
    setEditingItemKey(null);
    showStatus('Đã sửa');
  };

  const addOption = (fieldName: 'wine_type' | 'bottle_type') => {
    if (!data || !newItemValue.trim() || !newItemLabel.trim()) return;
    const mod = data.modules.find((m) => m.id === 'mod_ruou_products');
    if (!mod) return;
    const field = mod.fields.find((f) => f.fieldName === fieldName);
    if (!field) return;
    const newOpt = { id: `opt_${Date.now()}`, label: newItemLabel.trim(), value: newItemValue.trim().toLowerCase(), color: '#607D8B', sortOrder: (field.options?.length ?? 0), isActive: true };
    const options = [...(field.options || []), newOpt];
    const fields = mod.fields.map((f) => f.fieldName === fieldName ? { ...f, options } : f);
    const modules = data.modules.map((m) => m.id === 'mod_ruou_products' ? { ...m, fields } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
    indexedDBService.saveData({ ...data, modules, lastModified: new Date().toISOString() });
    setNewItemLabel(''); setNewItemValue('');
    showStatus('Đã thêm');
  };

  const removeOption = (fieldName: 'wine_type' | 'bottle_type', value: string) => {
    if (!data) return;
    const mod = data.modules.find((m) => m.id === 'mod_ruou_products');
    if (!mod) return;
    const field = mod.fields.find((f) => f.fieldName === fieldName);
    if (!field) return;
    const options = (field.options || []).filter((o) => o.value !== value);
    const fields = mod.fields.map((f) => f.fieldName === fieldName ? { ...f, options } : f);
    const modules = data.modules.map((m) => m.id === 'mod_ruou_products' ? { ...m, fields } : m);
    setData({ ...data, modules, lastModified: new Date().toISOString() });
    indexedDBService.saveData({ ...data, modules, lastModified: new Date().toISOString() });
    showStatus('Đã xóa');
  };

  const saveThreshold = () => {
    if (!data) return;
    const updatedData = { ...data, settings: { ...data.settings, wineSettings: { ...data.settings.wineSettings, lowStockThreshold } }, lastModified: new Date().toISOString() };
    setData(updatedData); indexedDBService.saveData(updatedData);
    showStatus('Đã lưu ngưỡng cảnh báo');
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Cài đặt</h1>

      {/* Section tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)] pb-2">
        {[{ id: 'backup', label: 'Sao lưu & Đồng bộ' }, { id: 'columns', label: 'Cấu hình hiển thị' }, { id: 'manage', label: 'Quản lý danh mục' }].map((s) => (
          <button key={s.id} onClick={() => setActiveSection(s.id as typeof activeSection)} className={`px-3 py-1.5 text-xs rounded-md ${activeSection === s.id ? 'bg-purple-600 text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'}`}>{s.label}</button>
        ))}
      </div>

      {/* Status */}
      {status && <div className="px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">{status}</div>}

      {/* BACKUP & SYNC */}
      {activeSection === 'backup' && (
        <div className="space-y-4">
          {/* Threshold */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-[var(--color-text)] mb-2">Ngưỡng cảnh báo kho</h3>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(Number(e.target.value) || 1)} className="input-field py-1 px-2 text-xs w-16" />
              <span className="text-xs text-[var(--color-text-secondary)]">chai</span>
              <button onClick={saveThreshold} className="btn-primary text-xs px-3 py-1">Lưu</button>
            </div>
          </div>

          {/* Export/Import buttons */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text)] mb-2">Sao lưu dữ liệu</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={exportJSON} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="download" size={14} /> Export JSON</button>
              <button onClick={importJSON} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="upload" size={14} /> Import JSON</button>
              <button onClick={exportExcel} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="file-text" size={14} /> Export Excel (.xlsx)</button>
              <button onClick={importExcel} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="upload" size={14} /> Import Excel (.xlsx)</button>
              <button onClick={exportToGoogleSheets} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="upload" size={14} /> Export Google Sheets</button>
              <button onClick={openGoogleSheets} className="flex items-center gap-2 px-3 py-2 text-xs border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text)]"><Icon name="external-link" size={14} /> Mở Google Sheets</button>
            </div>
          </div>

          {/* Google Drive - SAME as Chi tiêu (shared service) */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text)]">Google Drive</h3>
            {useAppStore.getState().userEmail && useAppStore.getState().userEmail !== 'offline@local' && (
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-text)]">{useAppStore.getState().userEmail}</div>
                  <div className="text-[10px] text-green-600">Đã kết nối</div>
                </div>
                <button onClick={async () => { const { driveService } = await import('@/services/drive/driveService'); await driveService.revokeToken(); useAppStore.getState().clearAuth(); }} className="text-xs text-[var(--color-text-secondary)] hover:text-red-500">Ngắt kết nối</button>
              </div>
            )}
            <button onClick={async () => {
              const appSt = useAppStore.getState();
              appSt.setSyncing(true);
              showStatus('Đang đồng bộ...');
              try {
                const { driveService } = await import('@/services/drive/driveService');
                let token = driveService.token;
                if (!token) { token = await driveService.login(); if (!token) { showStatus('Lỗi: ' + (driveService.getLastError() || 'Unknown')); useAppStore.getState().setSyncing(false); return; } const profile = await driveService.getUserProfile(); if (profile) useAppStore.getState().setAuth(profile.email, profile.avatar || undefined); }
                const result = await syncService.fullSync();
                if (result.data) { useAppStore.getState().setData({ ...result.data, metadata: { ...result.data.metadata, lastSyncAt: new Date().toISOString() } }); }
                showStatus(`✓ ${result.message}${result.data ? ` (${result.data.records?.length ?? 0} records)` : ''}`);
              } catch (e) { showStatus('Lỗi: ' + (e instanceof Error ? e.message : 'Unknown')); }
              finally { useAppStore.getState().setSyncing(false); }
            }} disabled={useAppStore.getState().isSyncing} className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 w-fit disabled:opacity-50">
              <Icon name="refresh" size={14} /> {useAppStore.getState().isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            </button>
            <p className="text-[10px] text-[var(--color-text-secondary)]">
              {data?.metadata?.lastSyncAt ? `Lần cuối: ${new Date(data.metadata.lastSyncAt).toLocaleString('vi-VN')}` : 'Chưa đồng bộ'} · Auto sync khi có thay đổi
            </p>
          </div>
        </div>
      )}

      {/* COLUMN CONFIG */}
      {activeSection === 'columns' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xs font-semibold text-[var(--color-text)]">Cấu hình cột hiển thị</h3>
            <select className="input-field py-1 px-2 text-xs" value={configModule} onChange={(e) => setConfigModule(e.target.value)}>
              <option value="mod_ruou">Đơn hàng</option>
              <option value="mod_ruou_customers">Khách hàng</option>
              <option value="mod_ruou_products">Sản phẩm</option>
              <option value="mod_ruou_inventory">Kho</option>
            </select>
          </div>
          <p className="text-[10px] text-[var(--color-text-secondary)]">Bật/tắt hiển thị cột. Click vào tên để đổi tên.</p>
          <div className="space-y-1">
            {moduleFields.length === 0 && <p className="text-xs text-[var(--color-text-secondary)] py-2">Không tìm thấy cấu hình module này</p>}
            {moduleFields.map((f, idx) => (
              <div key={f.id} className="flex items-center gap-2 py-1 border-b border-[var(--color-border)]">
                <input type="checkbox" checked={f.isTableVisible} onChange={() => toggleFieldVisible(f.id)} className="rounded" />
                <input type="text" className="input-field py-0.5 px-2 text-xs flex-1" value={f.fieldLabel}
                  onChange={(e) => renameField(f.id, e.target.value)} />
                <span className="text-[9px] text-[var(--color-text-secondary)] font-mono">{f.fieldName}</span>
                <div className="flex flex-col gap-0">
                  <button onClick={() => moveField(f.id, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-[var(--color-surface)] rounded disabled:opacity-20" title="Di chuyển lên"><Icon name="chevron-up" size={10} /></button>
                  <button onClick={() => moveField(f.id, 'down')} disabled={idx === moduleFields.length - 1} className="p-0.5 hover:bg-[var(--color-surface)] rounded disabled:opacity-20" title="Di chuyển xuống"><Icon name="chevron-down" size={10} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES */}
      {activeSection === 'manage' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[{ id: 'colors', label: 'Màu sắc' }, { id: 'wineType', label: 'Loại rượu' }, { id: 'bottleType', label: 'Loại chai' }].map((t) => (
              <button key={t.id} onClick={() => setManageType(t.id as typeof manageType)} className={`px-3 py-1 text-xs rounded ${manageType === t.id ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'}`}>{t.label}</button>
            ))}
          </div>

          {/* Colors */}
          {manageType === 'colors' && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text)]">Màu sắc chai sứ</h3>
              <div className="space-y-1">
                {colorList.map((c) => (
                  <div key={c.code} className="flex items-center gap-2 py-1 border-b border-[var(--color-border)]">
                    {editingItemKey === `color_${c.code}` ? (
                      <input type="text" value={editingItemValue} onChange={(e) => setEditingItemValue(e.target.value)}
                        className="input-field py-0.5 px-2 text-xs font-mono w-16" />
                    ) : (
                      <span className="text-xs font-mono text-[var(--color-text)] w-12">{c.code}</span>
                    )}
                    {editingItemKey === `color_${c.code}` ? (
                      <input type="text" value={editingItemLabel} onChange={(e) => setEditingItemLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditColor(c.code); if (e.key === 'Escape') setEditingItemKey(null); }}
                        className="input-field py-0.5 px-2 text-xs flex-1" autoFocus />
                    ) : (
                      <span className="text-xs text-[var(--color-text)] flex-1">{c.label}</span>
                    )}
                    {editingItemKey === `color_${c.code}` ? (
                      <button onClick={() => saveEditColor(c.code)} className="text-green-500 hover:text-green-700"><Icon name="check" size={12} /></button>
                    ) : (
                      <button onClick={() => { setEditingItemKey(`color_${c.code}`); setEditingItemLabel(c.label); setEditingItemValue(c.code); }} className="text-blue-500 hover:text-blue-700"><Icon name="edit" size={12} /></button>
                    )}
                    <button onClick={() => removeColor(c.code)} className="text-red-500 hover:text-red-700"><Icon name="x" size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input type="text" className="input-field py-1 px-2 text-xs w-16" placeholder="Mã" value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} />
                <input type="text" className="input-field py-1 px-2 text-xs flex-1" placeholder="Tên màu" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
                <button onClick={addColor} className="btn-primary text-xs px-3 py-1">Thêm</button>
              </div>
            </div>
          )}

          {/* Wine Types */}
          {manageType === 'wineType' && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text)]">Loại rượu</h3>
              <div className="space-y-1">
                {(wineTypeOptions).map((o) => (
                  <div key={o.id} className="flex items-center gap-2 py-1 border-b border-[var(--color-border)]">
                    {editingItemKey === `wt_${o.value}` ? (
                      <input type="text" value={editingItemValue} onChange={(e) => setEditingItemValue(e.target.value)}
                        className="input-field py-0.5 px-2 text-xs font-mono w-20" />
                    ) : (
                      <span className="text-xs font-mono text-[var(--color-text)] w-16">{o.value}</span>
                    )}
                    {editingItemKey === `wt_${o.value}` ? (
                      <input type="text" value={editingItemLabel} onChange={(e) => setEditingItemLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditOption('wine_type', o.value); if (e.key === 'Escape') setEditingItemKey(null); }}
                        className="input-field py-0.5 px-2 text-xs flex-1" autoFocus />
                    ) : (
                      <span className="text-xs text-[var(--color-text)] flex-1">{o.label}</span>
                    )}
                    {editingItemKey === `wt_${o.value}` ? (
                      <button onClick={() => saveEditOption('wine_type', o.value)} className="text-green-500 hover:text-green-700"><Icon name="check" size={12} /></button>
                    ) : (
                      <button onClick={() => { setEditingItemKey(`wt_${o.value}`); setEditingItemLabel(o.label); setEditingItemValue(o.value); }} className="text-blue-500 hover:text-blue-700"><Icon name="edit" size={12} /></button>
                    )}
                    <button onClick={() => removeOption('wine_type', o.value)} className="text-red-500 hover:text-red-700"><Icon name="x" size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input type="text" className="input-field py-1 px-2 text-xs w-20" placeholder="Mã (value)" value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} />
                <input type="text" className="input-field py-1 px-2 text-xs flex-1" placeholder="Tên hiển thị" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
                <button onClick={() => addOption('wine_type')} className="btn-primary text-xs px-3 py-1">Thêm</button>
              </div>
            </div>
          )}

          {/* Bottle Types */}
          {manageType === 'bottleType' && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text)]">Loại chai</h3>
              <div className="space-y-1">
                {(bottleTypeOptions).map((o) => (
                  <div key={o.id} className="flex items-center gap-2 py-1 border-b border-[var(--color-border)]">
                    {editingItemKey === `bt_${o.value}` ? (
                      <input type="text" value={editingItemValue} onChange={(e) => setEditingItemValue(e.target.value)}
                        className="input-field py-0.5 px-2 text-xs font-mono w-20" />
                    ) : (
                      <span className="text-xs font-mono text-[var(--color-text)] w-16">{o.value}</span>
                    )}
                    {editingItemKey === `bt_${o.value}` ? (
                      <input type="text" value={editingItemLabel} onChange={(e) => setEditingItemLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEditOption('bottle_type', o.value); if (e.key === 'Escape') setEditingItemKey(null); }}
                        className="input-field py-0.5 px-2 text-xs flex-1" autoFocus />
                    ) : (
                      <span className="text-xs text-[var(--color-text)] flex-1">{o.label}</span>
                    )}
                    {editingItemKey === `bt_${o.value}` ? (
                      <button onClick={() => saveEditOption('bottle_type', o.value)} className="text-green-500 hover:text-green-700"><Icon name="check" size={12} /></button>
                    ) : (
                      <button onClick={() => { setEditingItemKey(`bt_${o.value}`); setEditingItemLabel(o.label); setEditingItemValue(o.value); }} className="text-blue-500 hover:text-blue-700"><Icon name="edit" size={12} /></button>
                    )}
                    <button onClick={() => removeOption('bottle_type', o.value)} className="text-red-500 hover:text-red-700"><Icon name="x" size={12} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input type="text" className="input-field py-1 px-2 text-xs w-20" placeholder="Mã (value)" value={newItemValue} onChange={(e) => setNewItemValue(e.target.value)} />
                <input type="text" className="input-field py-1 px-2 text-xs flex-1" placeholder="Tên hiển thị" value={newItemLabel} onChange={(e) => setNewItemLabel(e.target.value)} />
                <button onClick={() => addOption('bottle_type')} className="btn-primary text-xs px-3 py-1">Thêm</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───
function today() { return new Date().toISOString().slice(0, 10); }
function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function pickFile(accept: string, onLoad: (text: string) => void) {
  const input = document.createElement('input'); input.type = 'file'; input.accept = accept;
  input.onchange = async (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) onLoad(await file.text()); };
  input.click();
}
