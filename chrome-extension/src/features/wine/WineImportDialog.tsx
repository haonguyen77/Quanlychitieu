import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/components/ui/Icon';
import type { FinanceData, RecordValues, DataRecord } from '@/types';

const COLOR_CODES = [
  { code: 'DL', label: 'Da lươn' }, { code: 'DEN', label: 'Đen' }, { code: 'HONG', label: 'Hồng' },
  { code: 'TRANG', label: 'Trắng' }, { code: 'XN', label: 'Xanh ngọc' }, { code: 'XR', label: 'Xanh rêu' }, { code: 'XBB', label: 'Xanh bút bi' },
];

interface Line { query: string; sku: string; name: string; shortName: string; qty: string; color: string; note: string; wineType: string; bottleType: string; }
function emptyLine(): Line { return { query:'',sku:'',name:'',shortName:'',qty:'',color:'',note:'',wineType:'',bottleType:'' }; }

interface Props {
  data: FinanceData | null;
  addRecord: (moduleId: string, values: RecordValues) => DataRecord;
  updateRecord: (id: string, values: RecordValues) => void;
  onClose: () => void;
}

export function WineImportDialog({ data, addRecord, updateRecord, onClose }: Props) {
  const [importDate, setImportDate] = useState(new Date().toISOString().slice(0,10));
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const products = useMemo(() => data ? data.records.filter((r) => r.moduleId==='mod_ruou_products'&&!r.isDeleted).map((r) => ({ id:r.id, name:String(r.values['mod_ruou_products_product_name']??''), sku:String(r.values['mod_ruou_products_sku']??''), shortName:String(r.values['mod_ruou_products_short_name']??''), wineType:String(r.values['mod_ruou_products_wine_type']??''), bottleType:String(r.values['mod_ruou_products_bottle_type']??'') })) : [], [data]);

  const getFiltered = (q: string) => { if(!q) return []; const lq=q.toLowerCase(); return products.filter((p)=>p.sku.toLowerCase().includes(lq)||p.name.toLowerCase().includes(lq)||p.shortName.toLowerCase().includes(lq)).sort((a,b)=>{const ap=a.sku.toLowerCase().startsWith(lq)?0:1;const bp=b.sku.toLowerCase().startsWith(lq)?0:1;return ap-bp||a.name.localeCompare(b.name,'vi');}); };
  const filtered = activeIdx>=0 ? getFiltered(lines[activeIdx]?.query||'') : [];

  // Update dropdown position when activeIdx changes
  useEffect(() => {
    if (activeIdx >= 0 && inputRefs.current[activeIdx]) {
      const rect = inputRefs.current[activeIdx]!.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow > 220) {
        setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
      } else {
        setDropdownPos({ top: rect.top - 220, left: rect.left, width: rect.width });
      }
    }
  }, [activeIdx, lines]);

  const selectProduct = (idx: number, p: typeof products[0]) => {
    setLines((prev)=>{const u=[...prev];u[idx]={...u[idx],query:p.sku,sku:p.sku,name:p.name,shortName:p.shortName,wineType:p.wineType,bottleType:p.bottleType};while(u.length<2||u[u.length-1].sku)u.push(emptyLine());return u;});
    setActiveIdx(-1);setSuggestIdx(0);
    setTimeout(()=>{const el=gridRef.current?.querySelector(`[data-r="${idx}"][data-c="qty"]`) as HTMLElement;el?.focus();},30);
  };

  const updateLine = (idx: number, field: keyof Line, value: string) => {
    setLines((prev)=>{const u=[...prev];u[idx]={...u[idx],[field]:value};while(u.length<2||u[u.length-1].sku)u.push(emptyLine());return u;});
  };
  const removeLine = (idx: number) => { setLines((prev)=>{const u=prev.filter((_,i)=>i!==idx);while(u.length<2)u.push(emptyLine());return u;}); };
  const clearAll = () => setLines([emptyLine(),emptyLine()]);
  const totalQty = lines.reduce((s,l)=>s+(Number(l.qty)||0),0);
  const prevDay=()=>{const d=new Date(importDate);d.setDate(d.getDate()-1);setImportDate(d.toISOString().slice(0,10));};
  const nextDay=()=>{const d=new Date(importDate);d.setDate(d.getDate()+1);setImportDate(d.toISOString().slice(0,10));};

  const handleKey = (e: React.KeyboardEvent, idx: number, col: string) => {
    if (col==='product'&&activeIdx===idx&&filtered.length>0) {
      if (e.key==='Tab'){e.preventDefault();setSuggestIdx((p)=>(p+1)%filtered.length);return;}
      if (e.key==='Enter'){e.preventDefault();selectProduct(idx,filtered[suggestIdx]);return;}
      if (e.key==='ArrowDown'){e.preventDefault();setSuggestIdx((p)=>Math.min(p+1,filtered.length-1));return;}
      if (e.key==='ArrowUp'){e.preventDefault();setSuggestIdx((p)=>Math.max(p-1,0));return;}
      if (e.key==='Escape'){setActiveIdx(-1);return;}
    }
    if (e.key==='Enter') {
      e.preventDefault();
      const next=col==='product'?'qty':col==='qty'?'color':col==='color'?'note':'nextrow';
      if (next==='nextrow'){setLines((p)=>{const u=[...p];while(u.length<=idx+1)u.push(emptyLine());return u;});setTimeout(()=>{const el=gridRef.current?.querySelector(`[data-r="${idx+1}"][data-c="product"]`) as HTMLElement;el?.focus();},30);}
      else{const el=gridRef.current?.querySelector(`[data-r="${idx}"][data-c="${next}"]`) as HTMLElement;el?.focus();}
    }
  };

  const handleSave = () => {
    if (!data) return;
    const logEntries: { date: string; name: string; qty: number; color: string; note: string }[] = [];
    for (const line of lines) {
      const qty=Number(line.qty)||0; if(!line.sku||qty<=0) continue;
      const fullSku=line.color?`${line.sku}-${line.color}`:line.sku;
      const colorLabel=line.color?(COLOR_CODES.find((c)=>c.code===line.color)?.label??line.color):'';
      const existing=data.records.find((r)=>r.moduleId==='mod_ruou_inventory'&&!r.isDeleted&&String(r.values['mod_ruou_inventory_sku']??'')===fullSku);
      if(existing) updateRecord(existing.id,{mod_ruou_inventory_stock:Number(existing.values['mod_ruou_inventory_stock']??0)+qty,mod_ruou_inventory_note:line.note.trim()||String(existing.values['mod_ruou_inventory_note']??'')});
      else addRecord('mod_ruou_inventory',{mod_ruou_inventory_sku:fullSku,mod_ruou_inventory_product_name:line.name,mod_ruou_inventory_color:colorLabel,mod_ruou_inventory_wine_type:line.wineType,mod_ruou_inventory_bottle_type:line.bottleType,mod_ruou_inventory_stock:qty,mod_ruou_inventory_note:line.note.trim()});
      logEntries.push({ date: importDate, name: line.name || line.sku, qty, color: colorLabel, note: line.note });
    }
    // Save import log to localStorage
    if (logEntries.length > 0) {
      try {
        const existing = JSON.parse(localStorage.getItem('wine_import_log') || '[]');
        const updated = [...logEntries, ...existing].slice(0, 200);
        localStorage.setItem('wine_import_log', JSON.stringify(updated));
      } catch { /* ignore */ }
    }
    onClose();
  };

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.altKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleSaveRef.current(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0];if(!file||!data)return;
    try{const text=await file.text();const rows=text.split('\n').filter((l)=>l.trim());const si=rows[0]?.toLowerCase().includes('sku')?1:0;for(let i=si;i<rows.length;i++){const cols=rows[i].split(',').map((c)=>c.trim());const sku=cols[0];const qty=Number(cols[1])||0;const color=cols[2]||'';if(!sku||qty<=0)continue;const fullSku=color?`${sku}-${color}`:sku;const colorLabel=color?(COLOR_CODES.find((c)=>c.code===color)?.label??color):'';const existing=data.records.find((r)=>r.moduleId==='mod_ruou_inventory'&&!r.isDeleted&&String(r.values['mod_ruou_inventory_sku']??'')===fullSku);if(existing)updateRecord(existing.id,{mod_ruou_inventory_stock:Number(existing.values['mod_ruou_inventory_stock']??0)+qty});else{const p=data.records.find((r)=>r.moduleId==='mod_ruou_products'&&!r.isDeleted&&String(r.values['mod_ruou_products_sku']??'')===sku);addRecord('mod_ruou_inventory',{mod_ruou_inventory_sku:fullSku,mod_ruou_inventory_product_name:p?String(p.values['mod_ruou_products_product_name']??''):sku,mod_ruou_inventory_color:colorLabel,mod_ruou_inventory_wine_type:p?String(p.values['mod_ruou_products_wine_type']??''):'',mod_ruou_inventory_bottle_type:p?String(p.values['mod_ruou_products_bottle_type']??''):'',mod_ruou_inventory_stock:qty});}}onClose();}catch{alert('Lỗi file. Định dạng: SKU,SL,Màu');}if(fileRef.current)fileRef.current.value='';
  };
  const downloadTemplate=()=>{const csv='\uFEFF'+'SKU,Số lượng,Màu\nG-1L,10,\nHL350,5,DL\nRN350,3,HONG\n';const b=new Blob([csv],{type:'text/csv;charset=utf-8;'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='nhap_kho_template.csv';a.click();URL.revokeObjectURL(u);};

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" onClick={(e)=>e.stopPropagation()} style={{width:980,maxWidth:'96vw',maxHeight:'88vh'}}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Nhập kho</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><Icon name="x" size={20}/></button>
        </div>
        <div className="px-6 py-3 flex-shrink-0">
          <label className="text-[11px] font-medium text-red-500 block mb-1">Ngày nhập *</label>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-[220px] h-[34px]">
            <button onClick={prevDay} className="px-2 h-full hover:bg-gray-50 border-r border-gray-300"><Icon name="chevron-left" size={13}/></button>
            <input type="date" className="flex-1 px-2 text-[13px] bg-transparent outline-none text-center text-gray-900" value={importDate} onChange={(e)=>setImportDate(e.target.value)}/>
            <button onClick={nextDay} className="px-2 h-full hover:bg-gray-50 border-l border-gray-300"><Icon name="chevron-right" size={13}/></button>
          </div>
        </div>
        <div ref={gridRef} className="flex-1 overflow-y-auto px-6 min-h-0">
          <table className="w-full text-[13px]" style={{tableLayout:'fixed'}}>
            <colgroup><col style={{width:'36px'}}/><col/><col style={{width:'80px'}}/><col style={{width:'130px'}}/><col style={{width:'150px'}}/><col style={{width:'36px'}}/></colgroup>
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr className="text-[11px] font-medium text-gray-500">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">SKU / Tên sản phẩm <span className="font-normal text-gray-400">(Gõ để tìm kiếm)</span></th>
                <th className="px-2 py-2 text-center">Số lượng</th>
                <th className="px-2 py-2 text-left">Màu sắc</th>
                <th className="px-2 py-2 text-left">Ghi chú</th>
                <th className="px-2 py-2">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line,idx)=>(
                <tr key={idx} className="border-b border-gray-100 h-[52px]">
                  <td className="px-2 text-gray-400 text-[12px]">{line.sku?idx+1:''}</td>
                  <td className="px-1 relative">
                    <input ref={(el)=>{inputRefs.current[idx]=el;}} data-r={idx} data-c="product" type="text" className="w-full px-3 py-1.5 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900" placeholder="Tìm SP / SKU..."
                      value={line.query} onChange={(e)=>{setLines((p)=>p.map((l,i)=>i===idx?{...l,query:e.target.value,sku:'',name:'',shortName:''}:l));setActiveIdx(idx);setSuggestIdx(0);}}
                      onFocus={()=>{setActiveIdx(idx);setSuggestIdx(0);}} onBlur={()=>setTimeout(()=>{if(activeIdx===idx)setActiveIdx(-1);},200)}
                      onKeyDown={(e)=>handleKey(e,idx,'product')}/>
                    {line.shortName&&line.sku&&<div className="text-[10px] text-gray-400 px-3 mt-0.5">{line.shortName}{line.color?` - ${COLOR_CODES.find((c)=>c.code===line.color)?.label||line.color}`:''}</div>}
                  </td>
                  <td className="px-1"><input data-r={idx} data-c="qty" type="number" min={0} className="w-full px-2 py-1.5 text-[13px] text-center border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900" value={line.qty} onChange={(e)=>updateLine(idx,'qty',e.target.value.replace(/[^0-9]/g,''))} onKeyDown={(e)=>handleKey(e,idx,'qty')}/></td>
                  <td className="px-1"><select data-r={idx} data-c="color" className="w-full px-2 py-1.5 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900" value={line.color} onChange={(e)=>updateLine(idx,'color',e.target.value)} onKeyDown={(e)=>handleKey(e,idx,'color')}><option value="">Chọn màu</option>{COLOR_CODES.map((c)=>(<option key={c.code} value={c.code}>{c.label}</option>))}</select></td>
                  <td className="px-1"><input data-r={idx} data-c="note" type="text" className="w-full px-2 py-1.5 text-[13px] border border-gray-300 rounded-lg outline-none focus:border-purple-500 text-gray-900" placeholder="Nhập thêm" value={line.note} onChange={(e)=>updateLine(idx,'note',e.target.value)} onKeyDown={(e)=>handleKey(e,idx,'note')}/></td>
                  <td className="text-center">{line.sku&&<button onClick={()=>removeLine(idx)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600"><Icon name="trash" size={14}/></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-2 flex justify-end flex-shrink-0 border-t border-gray-100">
          <span className="text-[13px] text-gray-600">Tổng số lượng <span className="text-purple-600 font-bold text-base ml-2">{totalQty}</span></span>
        </div>
        <div className="px-6 py-3 border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <button onClick={downloadTemplate} tabIndex={-1} className="px-3 py-2 text-[13px] border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"><Icon name="download" size={13}/> Tải template</button>
          <label tabIndex={-1} className="px-3 py-2 text-[13px] border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-1.5"><Icon name="upload" size={13}/> Import Excel / CSV<input ref={fileRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={handleFileImport}/></label>
          <button onClick={clearAll} tabIndex={-1} className="text-[13px] text-red-500 hover:text-red-700 flex items-center gap-1"><Icon name="trash" size={13}/> Xóa tất cả</button>
          <div className="flex-1"/>
          <button onClick={onClose} tabIndex={-1} className="px-5 py-2 text-[13px] text-gray-600 hover:bg-gray-100 rounded-lg">Hủy</button>
          <button onClick={handleSave} className="px-6 py-2 text-[13px] font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700">Nhập kho</button>
        </div>
        <div className="px-6 py-2 text-[11px] text-gray-400 border-t border-gray-100 flex-shrink-0">• Mẹo: Tab để di chuyển, Enter để xuống dòng mới</div>
      </div>
      {/* Portal dropdown for product suggestions */}
      {activeIdx>=0&&filtered.length>0&&createPortal(
        <div style={{position:'fixed',zIndex:99999,top:dropdownPos.top,left:dropdownPos.left,width:Math.max(dropdownPos.width,300),maxHeight:220,overflowY:'auto'}} className="bg-white border border-gray-200 rounded-lg shadow-2xl">
          {filtered.map((p,j)=>(<button key={p.id} onMouseDown={()=>selectProduct(activeIdx,p)} className={`w-full text-left px-3 py-1.5 text-[13px] flex justify-between border-b border-gray-50 ${j===suggestIdx?'bg-purple-100':'hover:bg-purple-50'}`}><span className="truncate">{p.shortName||p.name}</span><span className="text-[11px] text-gray-400 font-mono ml-2">{p.sku}</span></button>))}
        </div>,
        document.body
      )}
    </div>
  );
}
