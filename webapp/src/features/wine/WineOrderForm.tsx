import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/core/store/appStore';
import { useRecordStore } from '@/core/store/recordStore';
import { Icon } from '@/shared/components/ui/Icon';
import { SuggestInput } from './SuggestInput';
import type { DataRecord, RecordValues } from '@/types';

const COLOR_CODES = [
  { code: 'DL', label: 'Da lươn' }, { code: 'DEN', label: 'Đen' }, { code: 'HONG', label: 'Hồng' },
  { code: 'TRANG', label: 'Trắng' }, { code: 'XN', label: 'Xanh ngọc' }, { code: 'XR', label: 'Xanh rêu' }, { code: 'XBB', label: 'Xanh bút bi' },
];

interface GridRow { productName: string; productSku: string; quantity: number; price: number; color: string; ly: boolean; box: boolean; }
function emptyRow(): GridRow { return { productName: '', productSku: '', quantity: 0, price: 0, color: '', ly: false, box: false }; }
function fmt(n: number): string { return n ? n.toLocaleString('vi-VN') : ''; }

function priceSugg(raw: string): number[] {
  if (!raw) return [];
  const n = parseInt(raw, 10);
  if (!n || n <= 0) return [];
  // Same logic as Chi tiêu: 1 digit × 10000, 2+ digits × 1000
  if (raw.length === 1) {
    return [n * 10000];
  } else {
    return [n * 1000];
  }
}

/** Portal dropdown rendered at fixed position on document.body — always below input */
function DropdownPortal({ anchorRef, show, children }: { anchorRef: React.RefObject<HTMLElement>; show: boolean; children: React.ReactNode }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  useEffect(() => {
    if (show && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      // Always show below the input (never flip up)
      setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    }
  }, [show, anchorRef]);
  if (!show) return null;
  const style: React.CSSProperties = { position: 'fixed', zIndex: 99999, left: pos.left, top: pos.top, width: Math.max(pos.width, 300), maxHeight: 150, overflowY: 'auto' };
  return createPortal(<div style={style} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl">{children}</div>, document.body);
}

interface Props { record: DataRecord | null; onClose: () => void; }

export function WineOrderForm({ record, onClose }: Props) {
  const { data } = useAppStore();
  const { addRecord, updateRecord } = useRecordStore();

  const [orderDate, setOrderDate] = useState(record?.values['mod_ruou_order_date'] as string ?? new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState(record?.values['mod_ruou_customer_name'] as string ?? '');
  const [customerPhone, setCustomerPhone] = useState(record?.values['mod_ruou_customer_phone'] as string ?? '');
  const [customerAddress, setCustomerAddress] = useState(record?.values['mod_ruou_customer_address'] as string ?? '');
  const [customerWard, setCustomerWard] = useState(record?.values['mod_ruou_customer_district'] as string ?? '');
  const [customerDistrict, setCustomerDistrict] = useState(record?.values['mod_ruou_customer_city'] as string ?? '');
  const [shipFee, setShipFee] = useState(Number(record?.values['mod_ruou_ship_fee'] ?? 0));
  const [note1, setNote1] = useState(record?.values['mod_ruou_note1'] as string ?? '');
  const [note2, setNote2] = useState(record?.values['mod_ruou_note2'] as string ?? '');

  const [rows, setRows] = useState<GridRow[]>(() => {
    if (record) {
      const lj = record.values['mod_ruou_product_lines'] as string;
      if (lj) { try { const p = JSON.parse(lj); return [...p.map((l: any) => ({ productName: l.productName||'', productSku: l.productSku||'', quantity: Number(l.quantity)||1, price: Number(l.price)||0, color: l.color||'', ly: Number(l.glasses)>0, box: Number(l.boxes)>0 })), emptyRow()]; } catch {} }
      return [{ productName: record.values['mod_ruou_product_name'] as string??'', productSku: record.values['mod_ruou_product_sku'] as string??'', quantity: Number(record.values['mod_ruou_quantity']??1), price: Number(record.values['mod_ruou_price']??0), color: record.values['mod_ruou_color'] as string??'', ly: Number(record.values['mod_ruou_glasses']??0)>0, box: Number(record.values['mod_ruou_boxes']??0)>0 }, emptyRow()];
    }
    return [emptyRow(), emptyRow()];
  });

  const [suggestRow, setSuggestRow] = useState(-1);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [priceRow, setPriceRow] = useState(-1);
  const [priceIdx, setPriceIdx] = useState(0);
  const [showCustSugg, setShowCustSugg] = useState(false);
  const [showShipSugg, setShowShipSugg] = useState(false);
  const productInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const shipInputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const products = useMemo(() => data ? data.records.filter((r) => r.moduleId === 'mod_ruou_products' && !r.isDeleted).map((r) => ({ id: r.id, name: String(r.values['mod_ruou_products_product_name']??''), sku: String(r.values['mod_ruou_products_sku']??''), shortName: String(r.values['mod_ruou_products_short_name']??'') })) : [], [data]);
  const customers = useMemo(() => data ? data.records.filter((r) => r.moduleId === 'mod_ruou_customers' && !r.isDeleted).map((r) => ({ name: String(r.values['mod_ruou_customers_full_name']??''), phone: String(r.values['mod_ruou_customers_phone']??''), address: String(r.values['mod_ruou_customers_address']??''), ward: String(r.values['mod_ruou_customers_district']??''), district: String(r.values['mod_ruou_customers_city']??'') })) : [], [data]);

  // Unique values for autocomplete
  const suggPhones = useMemo(() => [...new Set(customers.map((c) => c.phone).filter(Boolean))], [customers]);
  const suggAddresses = useMemo(() => [...new Set(customers.map((c) => c.address).filter(Boolean))], [customers]);
  const suggWards = useMemo(() => [...new Set(customers.map((c) => c.ward).filter(Boolean))], [customers]);
  const suggCities = useMemo(() => [...new Set(customers.map((c) => c.district).filter(Boolean))], [customers]);

  const getFiltered = useCallback((q: string) => { if (!q) return []; const lq = q.toLowerCase(); return products.filter((p) => p.sku.toLowerCase().includes(lq)||p.name.toLowerCase().includes(lq)||p.shortName.toLowerCase().includes(lq)).sort((a, b) => { const ap=a.sku.toLowerCase().startsWith(lq)?0:a.shortName.toLowerCase().startsWith(lq)?1:2; const bp=b.sku.toLowerCase().startsWith(lq)?0:b.shortName.toLowerCase().startsWith(lq)?1:2; return ap-bp||a.name.localeCompare(b.name,'vi'); }); }, [products]);
  const filteredCustomers = useMemo(() => { if (!customerName) return []; const q=customerName.toLowerCase(); return customers.filter((c)=>c.name.toLowerCase().includes(q)||c.phone.includes(q)).slice(0,6); }, [customers, customerName]);
  const filteredProducts = suggestRow >= 0 ? getFiltered(rows[suggestRow]?.productName||'') : [];
  const curPriceSugg = priceRow >= 0 ? priceSugg(String(rows[priceRow]?.price||'')) : [];
  const curShipSugg = priceSugg(String(shipFee||''));

  const totalGoods = rows.reduce((s, r) => s + r.price * r.quantity, 0);
  const totalPayment = totalGoods + shipFee;

  const updateRow = (i: number, f: keyof GridRow, v: any) => { setRows((p) => { const u=[...p]; u[i]={...u[i],[f]:v}; if(f==='productName'&&v&&(!u[i].quantity||u[i].quantity<=0)) u[i].quantity=1; while(u.length<2||u[u.length-1].productName) u.push(emptyRow()); return u; }); };
  const selectProduct = (i: number, p: typeof products[0]) => { setRows((prev) => { const u=[...prev]; u[i]={...u[i], productName:p.name, productSku:p.sku, quantity:u[i].quantity||1}; while(u[u.length-1].productName) u.push(emptyRow()); return u; }); setSuggestRow(-1); setSuggestIdx(0); setTimeout(()=>focusCell(i,'qty'),30); };
  const deleteRow = (i: number) => { setRows((p)=>{const u=p.filter((_,j)=>j!==i); while(u.length<2) u.push(emptyRow()); return u;}); };

  const focusCell = (row: number, col: string) => { const el = gridRef.current?.querySelector(`[data-r="${row}"][data-c="${col}"]`) as HTMLElement; el?.focus(); };

  const handleProductKey = (e: React.KeyboardEvent, i: number) => {
    if (suggestRow===i && filteredProducts.length>0) {
      if (e.key==='Tab') { e.preventDefault(); setSuggestIdx((p)=>(p+1)%filteredProducts.length); return; }
      if (e.key==='Enter') { e.preventDefault(); selectProduct(i,filteredProducts[suggestIdx]); return; }
      if (e.key==='Escape') { setSuggestRow(-1); return; }
      if (e.key==='ArrowDown') { e.preventDefault(); setSuggestIdx((p)=>Math.min(p+1,filteredProducts.length-1)); return; }
      if (e.key==='ArrowUp') { e.preventDefault(); setSuggestIdx((p)=>Math.max(p-1,0)); return; }
    }
    if (e.key==='Enter') { e.preventDefault(); focusCell(i,'qty'); }
  };
  const handlePriceKey = (e: React.KeyboardEvent, i: number) => {
    if (priceRow===i && curPriceSugg.length>0) {
      if (e.key==='Tab') { e.preventDefault(); updateRow(i,'price',curPriceSugg[priceIdx]); setPriceRow(-1); focusCell(i,'color'); return; }
      if (e.key==='Enter') { e.preventDefault(); setPriceRow(-1); focusCell(i,'color'); return; }
      if (e.key==='Escape') { setPriceRow(-1); return; }
      if (e.key==='ArrowDown') { e.preventDefault(); setPriceIdx((p)=>Math.min(p+1,curPriceSugg.length-1)); return; }
      if (e.key==='ArrowUp') { e.preventDefault(); setPriceIdx((p)=>Math.max(p-1,0)); return; }
    }
    if (e.key==='Enter'||e.key==='Tab') { e.preventDefault(); setPriceRow(-1); focusCell(i,'color'); }
  };
  const cellKey = (e: React.KeyboardEvent, row: number, next: string) => {
    if (e.key==='Enter') { e.preventDefault(); if (next==='nextrow') { setRows((p)=>{const u=[...p];while(u.length<=row+1)u.push(emptyRow());return u;}); setTimeout(()=>focusCell(row+1,'product'),30); } else focusCell(row,next); }
  };

  const handlePaste = (e: React.ClipboardEvent) => { const t=e.clipboardData.getData('text/plain'); if(!t.includes('\t')&&!t.includes('\n'))return; e.preventDefault(); const lines=t.split('\n').filter((l)=>l.trim()); const nr:GridRow[]=[]; for(const l of lines){const c=l.split('\t');const nm=c[0]?.trim()||'';if(nm){const f=products.find((p)=>p.sku.toLowerCase()===nm.toLowerCase()||p.name.toLowerCase()===nm.toLowerCase());nr.push({productName:f?.name||nm,productSku:f?.sku||'',quantity:Number(c[1])||1,price:Number(c[2])||0,color:c[3]?.trim()||'',ly:false,box:false});}} if(nr.length)setRows((p)=>{const ex=p.filter((r)=>r.productName);return[...ex,...nr,emptyRow(),emptyRow()];}); };

  const handleSave = () => {
    if (!customerName.trim()) return;
    const valid = rows.filter((r)=>r.productName&&r.quantity>0);
    if (!valid.length) return;
    const f = valid[0];
    const values: RecordValues = { mod_ruou_order_date:orderDate, mod_ruou_customer_name:customerName.trim(), mod_ruou_customer_phone:customerPhone.trim(), mod_ruou_customer_address:customerAddress.trim(), mod_ruou_customer_district:customerWard.trim(), mod_ruou_customer_city:customerDistrict.trim(), mod_ruou_product_sku:f.productSku, mod_ruou_product_name:f.productName, mod_ruou_color:f.color, mod_ruou_quantity:f.quantity, mod_ruou_price:f.price, mod_ruou_glasses:f.ly?1:0, mod_ruou_boxes:f.box?1:0, mod_ruou_ship_fee:shipFee, mod_ruou_total_amount:totalPayment, mod_ruou_note1:note1.trim(), mod_ruou_note2:note2.trim(), mod_ruou_product_lines:valid.length>1?JSON.stringify(valid.map((r)=>({productName:r.productName,productSku:r.productSku,quantity:String(r.quantity),price:String(r.price),color:r.color,glasses:r.ly?'1':'0',boxes:r.box?'1':'0'}))):null };
    if (record) updateRecord(record.id, values);
    else { addRecord('mod_ruou', values); for(const r of valid) if(r.productSku) deductStock(r.productSku,r.color,r.quantity); ensureCustomer(); }
    onClose();
  };
  const deductStock = (sku:string,color:string,qty:number) => { if(!data||!sku||!qty)return; const fs=color?`${sku}-${color}`:sku; const inv=data.records.find((r)=>r.moduleId==='mod_ruou_inventory'&&!r.isDeleted&&(String(r.values['mod_ruou_inventory_sku']??'')===fs||String(r.values['mod_ruou_inventory_sku']??'')===sku)); if(inv)updateRecord(inv.id,{mod_ruou_inventory_stock:Math.max(0,Number(inv.values['mod_ruou_inventory_stock']??0)-qty)}); };
  const ensureCustomer = () => { if(!data||!customerName.trim())return; const phone=customerPhone.trim(); const ex=phone?data.records.find((r)=>r.moduleId==='mod_ruou_customers'&&!r.isDeleted&&String(r.values['mod_ruou_customers_phone']??'')===phone):null; if(ex){const updates:any={mod_ruou_customers_total_orders:Number(ex.values['mod_ruou_customers_total_orders']??0)+1,mod_ruou_customers_last_order_date:orderDate,mod_ruou_customers_full_name:customerName.trim()}; if(customerAddress.trim())updates.mod_ruou_customers_address=customerAddress.trim(); if(customerWard.trim())updates.mod_ruou_customers_district=customerWard.trim(); if(customerDistrict.trim())updates.mod_ruou_customers_city=customerDistrict.trim(); updateRecord(ex.id,updates);} else addRecord('mod_ruou_customers',{mod_ruou_customers_full_name:customerName.trim(),mod_ruou_customers_phone:phone,mod_ruou_customers_address:customerAddress.trim(),mod_ruou_customers_district:customerWard.trim(),mod_ruou_customers_city:customerDistrict.trim(),mod_ruou_customers_total_orders:1,mod_ruou_customers_last_order_date:orderDate,mod_ruou_customers_note:''}); };

  const prevDay=()=>{const d=new Date(orderDate);d.setDate(d.getDate()-1);setOrderDate(d.toISOString().slice(0,10));};
  const nextDay=()=>{const d=new Date(orderDate);d.setDate(d.getDate()+1);setOrderDate(d.toISOString().slice(0,10));};
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.altKey&&(e.key==='s'||e.key==='S')){e.preventDefault();handleSaveRef.current();}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col" onClick={(e)=>e.stopPropagation()} onPaste={handlePaste}
        style={{width:980,maxWidth:'96vw',maxHeight:'88vh',fontFamily:'Inter,system-ui,sans-serif'}}>

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{record?'Sửa đơn hàng':'Tạo đơn hàng mới'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><Icon name="x" size={18}/></button>
        </div>

        {/* Customer info - compact */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 space-y-2 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <div style={{width:220}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">Ngày đặt *</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-[32px]">
                <button onClick={prevDay} className="px-2 h-full hover:bg-gray-50 border-r border-gray-300"><Icon name="chevron-left" size={12}/></button>
                <input type="date" className="flex-1 px-2 text-[13px] bg-transparent outline-none text-center text-gray-900" value={orderDate} onChange={(e)=>setOrderDate(e.target.value)}/>
                <button onClick={nextDay} className="px-2 h-full hover:bg-gray-50 border-l border-gray-300"><Icon name="chevron-right" size={12}/></button>
              </div>
            </div>
            <div className="flex-1 relative" style={{maxWidth:420}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">Khách hàng *</label>
              <input type="text" className="w-full h-[32px] px-3 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900" placeholder="Tên KH..." value={customerName}
                onChange={(e)=>{setCustomerName(e.target.value);setShowCustSugg(true);}} onFocus={()=>setShowCustSugg(true)} onBlur={()=>setTimeout(()=>setShowCustSugg(false),200)}
                onKeyDown={(e)=>{if(e.key==='Tab'&&showCustSugg&&filteredCustomers.length>0){e.preventDefault();const c=filteredCustomers[0];setCustomerName(c.name);setCustomerPhone(c.phone);setCustomerAddress(c.address);setCustomerWard(c.ward);setCustomerDistrict(c.district);setShowCustSugg(false);}}}/>
              {showCustSugg&&filteredCustomers.length>0&&(<div className="absolute z-50 top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">{filteredCustomers.map((c,i)=>(<button key={i} onMouseDown={()=>{setCustomerName(c.name);setCustomerPhone(c.phone);setCustomerAddress(c.address);setCustomerWard(c.ward);setCustomerDistrict(c.district);setShowCustSugg(false);}} className="w-full text-left px-3 py-1.5 hover:bg-purple-50 text-[13px] flex justify-between"><span className="text-gray-900">{c.name}</span><span className="text-gray-400 text-xs">{c.phone}</span></button>))}</div>)}
            </div>
            <div style={{width:220}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">SĐT</label>
              <SuggestInput value={customerPhone} onChange={setCustomerPhone} suggestions={suggPhones} placeholder="0xxx..." className="w-full h-[32px] px-3 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900"/>
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1" style={{maxWidth:420}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">Địa chỉ</label>
              <SuggestInput value={customerAddress} onChange={setCustomerAddress} suggestions={suggAddresses} placeholder="Nhập địa chỉ..." className="w-full h-[32px] px-3 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900"/>
            </div>
            <div style={{width:220}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">Phường/Xã</label>
              <SuggestInput value={customerWard} onChange={setCustomerWard} suggestions={suggWards} placeholder="Phường/xã..." className="w-full h-[32px] px-3 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900"/>
            </div>
            <div style={{width:220}}>
              <label className="text-[11px] text-gray-500 block mb-[4px]">Thành Phố</label>
              <SuggestInput value={customerDistrict} onChange={setCustomerDistrict} suggestions={suggCities} placeholder="Thành phố..." className="w-full h-[32px] px-3 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900"/>
            </div>
          </div>
        </div>

        {/* Product Grid - takes ~70% height */}
        <div className="flex-1 overflow-hidden flex flex-col px-5 pt-2 min-h-0">
          <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
            <span className="text-[13px] font-semibold text-gray-900">Sản phẩm</span>
          </div>
          <div ref={gridRef} className="flex-1 overflow-y-auto border border-gray-200 rounded-lg min-h-0">
            <table className="w-full text-[13px]" style={{tableLayout:'fixed'}}>
              <colgroup>
                <col style={{width:'36px'}}/>{/* # */}
                <col/>{/* Tên SP ~ 40% */}
                <col style={{width:'55px'}}/>{/* SL */}
                <col style={{width:'110px'}}/>{/* Đơn giá */}
                <col style={{width:'100px'}}/>{/* Màu */}
                <col style={{width:'44px'}}/>{/* Ly */}
                <col style={{width:'44px'}}/>{/* Hộp */}
                <col style={{width:'110px'}}/>{/* Thành tiền */}
                <col style={{width:'36px'}}/>{/* X */}
              </colgroup>
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                <tr className="text-[11px] font-medium text-gray-500">
                  <th className="px-1.5 py-1.5 text-left">#</th>
                  <th className="px-1.5 py-1.5 text-left">Tên sản phẩm</th>
                  <th className="px-1.5 py-1.5 text-center">SL</th>
                  <th className="px-1.5 py-1.5 text-right">Đơn giá</th>
                  <th className="px-1.5 py-1.5 text-left">Màu</th>
                  <th className="px-1.5 py-1.5 text-center">Ly</th>
                  <th className="px-1.5 py-1.5 text-center">Hộp</th>
                  <th className="px-1.5 py-1.5 text-right">Thành tiền</th>
                  <th className="px-1.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-purple-50/20 h-[34px]">
                    <td className="px-1.5 text-[11px] text-gray-400">{row.productName?i+1:''}</td>
                    {/* Product with portal suggest */}
                    <td className="px-1 relative">
                      <input ref={(el)=>{productInputRefs.current[i]=el;}} data-r={i} data-c="product" type="text"
                        className="w-full px-2 py-1 text-[13px] bg-transparent outline-none border-0 focus:bg-purple-50 rounded text-gray-900 truncate" placeholder="Tìm SP / SKU..." title={row.productName}
                        value={row.productName} onChange={(e)=>{updateRow(i,'productName',e.target.value);setSuggestRow(i);setSuggestIdx(0);}}
                        onFocus={()=>{setSuggestRow(i);setSuggestIdx(0);}} onBlur={()=>setTimeout(()=>{if(suggestRow===i)setSuggestRow(-1);},200)}
                        onKeyDown={(e)=>handleProductKey(e,i)}/>
                      <DropdownPortal anchorRef={{current:productInputRefs.current[i]}} show={suggestRow===i&&filteredProducts.length>0}>
                        {filteredProducts.map((p,j)=>(<button key={p.id} onMouseDown={()=>selectProduct(i,p)} className={`w-full text-left px-3 py-1.5 text-[13px] flex justify-between border-b border-gray-50 ${j===suggestIdx?'bg-purple-100':'hover:bg-purple-50'}`}><span className="text-gray-900 truncate">{p.shortName||p.name}</span><span className="text-[11px] text-gray-400 font-mono ml-2 flex-shrink-0">{p.sku}</span></button>))}
                      </DropdownPortal>
                    </td>
                    <td className="px-1"><input data-r={i} data-c="qty" type="number" min={0} className="w-full px-1 py-1 text-[13px] text-center bg-transparent outline-none border-0 focus:bg-purple-50 rounded text-gray-900" value={row.quantity||''} onChange={(e)=>updateRow(i,'quantity',Number(e.target.value)||0)} onKeyDown={(e)=>cellKey(e,i,'price')}/></td>
                    {/* Price with portal suggest */}
                    <td className="px-1 relative">
                      <input ref={(el)=>{priceInputRefs.current[i]=el;}} data-r={i} data-c="price" type="text"
                        className="w-full px-2 py-1 text-[13px] text-right bg-transparent outline-none border-0 focus:bg-purple-50 rounded text-gray-900 tabular-nums" placeholder="0"
                        value={row.price?fmt(row.price):''} onChange={(e)=>{updateRow(i,'price',Number(e.target.value.replace(/[^0-9]/g,''))||0);setPriceRow(i);setPriceIdx(0);}}
                        onFocus={()=>{setPriceRow(i);setPriceIdx(0);}} onBlur={()=>setTimeout(()=>{if(priceRow===i)setPriceRow(-1);},200)}
                        onKeyDown={(e)=>handlePriceKey(e,i)}/>
                      <DropdownPortal anchorRef={{current:priceInputRefs.current[i]}} show={priceRow===i&&curPriceSugg.length>0}>
                        {curPriceSugg.map((s,j)=>(<button key={s} onMouseDown={()=>{updateRow(i,'price',s);setPriceRow(-1);focusCell(i,'color');}} className={`w-full text-left px-3 py-1.5 text-[13px] tabular-nums ${j===priceIdx?'bg-purple-100':'hover:bg-purple-50'}`}>{fmt(s)}</button>))}
                      </DropdownPortal>
                    </td>
                    <td className="px-1"><select data-r={i} data-c="color" className="w-full px-1 py-1 text-[13px] bg-transparent outline-none border-0 focus:bg-purple-50 rounded text-gray-900" value={row.color} onChange={(e)=>updateRow(i,'color',e.target.value)} onKeyDown={(e)=>cellKey(e,i,'ly')}><option value="">--</option>{COLOR_CODES.map((c)=>(<option key={c.code} value={c.code}>{c.label}</option>))}</select></td>
                    <td className="text-center"><input data-r={i} data-c="ly" type="checkbox" className="w-[15px] h-[15px] rounded border-gray-300 text-purple-600" checked={row.ly} onChange={(e)=>updateRow(i,'ly',e.target.checked)} onKeyDown={(e)=>cellKey(e,i,'box')}/></td>
                    <td className="text-center"><input data-r={i} data-c="box" type="checkbox" className="w-[15px] h-[15px] rounded border-gray-300 text-purple-600" checked={row.box} onChange={(e)=>updateRow(i,'box',e.target.checked)} onKeyDown={(e)=>cellKey(e,i,'nextrow')}/></td>
                    <td className="px-2 text-right text-[13px] text-gray-900 tabular-nums font-medium">{row.price&&row.quantity?fmt(row.price*row.quantity):''}</td>
                    <td className="text-center">{row.productName&&<button onClick={()=>deleteRow(i)} className="p-0.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600"><Icon name="trash" size={12}/></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom: Notes + Totals */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-4 flex-shrink-0">
          <div className="flex-1 flex gap-3">
            <div className="flex-1"><label className="text-[11px] text-gray-500 block mb-[4px]">Ghi chú 1</label><textarea tabIndex={-1} className="w-full h-[54px] px-2 py-1.5 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 resize-none text-gray-900" placeholder="Nhập ghi chú 1..." value={note1} onChange={(e)=>setNote1(e.target.value)}/></div>
            <div className="flex-1"><label className="text-[11px] text-gray-500 block mb-[4px]">Ghi chú 2</label><textarea tabIndex={-1} className="w-full h-[54px] px-2 py-1.5 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 resize-none text-gray-900" placeholder="Nhập ghi chú 2..." value={note2} onChange={(e)=>setNote2(e.target.value)}/></div>
          </div>
          {/* POS-style totals */}
          <div className="w-[260px] bg-purple-50 dark:bg-purple-900/10 rounded-lg p-3 space-y-1 flex-shrink-0 border border-purple-100">
            <div className="flex justify-between text-[13px]"><span className="text-gray-600">Tổng hàng</span><span className="font-medium text-gray-900 tabular-nums">{fmt(totalGoods)}đ</span></div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="text-gray-600">Phí ship</span>
              <div className="flex items-center gap-1">
                <input ref={shipInputRef} type="text" className="w-[80px] px-2 py-0.5 text-[13px] text-right border border-gray-300 rounded bg-white outline-none tabular-nums text-gray-900" value={shipFee?fmt(shipFee):''} placeholder="0"
                  onChange={(e)=>{setShipFee(Number(e.target.value.replace(/[^0-9]/g,''))||0);setShowShipSugg(true);}}
                  onFocus={()=>setShowShipSugg(true)} onBlur={()=>setTimeout(()=>setShowShipSugg(false),200)}
                  onKeyDown={(e)=>{if((e.key==='Tab'||e.key==='Enter')&&showShipSugg&&curShipSugg.length>0){e.preventDefault();setShipFee(curShipSugg[0]);setShowShipSugg(false);}}}/>
                <span className="text-[11px] text-gray-400">đ</span>
                <DropdownPortal anchorRef={shipInputRef} show={showShipSugg&&curShipSugg.length>0}>
                  {curShipSugg.map((s)=>(<button key={s} onMouseDown={()=>{setShipFee(s);setShowShipSugg(false);}} className="w-full text-right px-3 py-1.5 text-[13px] tabular-nums hover:bg-purple-50 text-gray-900 whitespace-nowrap">{fmt(s)}đ</button>))}
                </DropdownPortal>
              </div>
            </div>
            <div className="border-t border-purple-200 pt-1.5 flex justify-between items-baseline">
              <span className="text-[13px] font-semibold text-purple-700">Tổng thanh toán</span>
              <span className="text-[22px] font-bold text-purple-700 tabular-nums">{fmt(totalPayment)}đ</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-xl flex-shrink-0">
          <span className="text-[11px] text-gray-400">Tab: ô tiếp theo · Enter: dòng mới · Ctrl+C/V: copy dòng</span>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-5 py-2 text-[13px] text-gray-600 hover:bg-gray-200 rounded-lg">Hủy</button>
            <button onClick={handleSave} disabled={!customerName.trim()||!rows.some((r)=>r.productName&&r.quantity>0)}
              className="px-8 h-[42px] text-[13px] font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed" style={{minWidth:150}}>Lưu đơn</button>
          </div>
        </div>
      </div>
    </div>
  );
}
