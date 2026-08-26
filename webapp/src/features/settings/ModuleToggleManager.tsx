import { useState } from 'react';
import { useAppStore } from '@/core/store/appStore';
import { Icon } from '@/shared/components/ui/Icon';
import { v4 as uuidv4 } from 'uuid';
import type { ModuleDefinition, MenuItem } from '@/types';

/** System modules that cannot be deleted (mirror of mobile app + ModuleManager). */
const SYSTEM_MODULES = new Set([
  'mod_chitieu', 'mod_shopee', 'mod_vang', 'mod_nhatro', 'mod_creditcard',
  'mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory',
]);

/** Wine sub-modules live in their own workspace — hide from this sidebar list. */
const WINE_MODULE_IDS = new Set([
  'mod_ruou', 'mod_ruou_products', 'mod_ruou_customers', 'mod_ruou_inventory',
]);

/** Icons offered in the picker (all exist in the extension's Icon set). */
const ICON_OPTIONS = [
  'wallet', 'shopping-cart', 'shopping-bag', 'credit-card', 'gem', 'home',
  'utensils', 'car', 'heart', 'star', 'building', 'smartphone', 'film', 'book',
  'calendar', 'file-text', 'trending-up', 'trending-down', 'database', 'users',
];

/** Colors offered in the picker. */
const COLOR_OPTIONS = [
  '#2196F3', '#f05423', '#8b5cf6', '#f59e0b', '#22c55e', '#e91e63',
  '#009688', '#6366f1', '#ef4444', '#0ea5e9', '#a855f7', '#607D8B',
];

interface EditState {
  id?: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * Mobile-style module manager for the sidebar: list the modules shown in the
 * left menu, toggle each on/off, add new ones, edit name/icon/color, delete.
 * Keeps data.modules and data.menu in sync exactly like ModuleManager.saveModule.
 */
export function ModuleToggleManager() {
  const { data, setData } = useAppStore();
  const [editing, setEditing] = useState<EditState | null>(null);

  if (!data) return null;

  // Modules to show: exclude wine sub-modules (they have their own workspace).
  const modules = data.modules
    .filter((m) => !WINE_MODULE_IDS.has(m.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // A module is "on" when its sidebar menu item is visible.
  const isOn = (moduleId: string): boolean => {
    const item = data.menu.find((m) => m.type === 'module' && m.targetId === moduleId);
    // If no menu item yet, fall back to the module's own flags.
    if (!item) return data.modules.find((m) => m.id === moduleId)?.isActive !== false;
    return item.isVisible;
  };

  const toggle = (moduleId: string) => {
    const now = new Date().toISOString();
    const on = isOn(moduleId);
    // Flip the menu item's visibility (what actually shows/hides it in sidebar).
    let menu = data.menu.map((m) =>
      m.type === 'module' && m.targetId === moduleId ? { ...m, isVisible: !on } : m
    );
    // If there's no menu item yet, create one when turning on.
    const hasItem = data.menu.some((m) => m.type === 'module' && m.targetId === moduleId);
    if (!hasItem && !on) {
      const mod = data.modules.find((m) => m.id === moduleId);
      if (mod) menu = [...menu, buildMenuItem(mod, data.menu)];
    }
    // Keep module.isActive/isVisible in sync (mobile writes isVisible = isActive).
    const mods = data.modules.map((m) =>
      m.id === moduleId ? { ...m, isActive: !on, isVisible: !on, updatedAt: now } : m
    );
    setData({ ...data, modules: mods, menu, lastModified: now });
  };

  const save = () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    const now = new Date().toISOString();

    if (editing.id) {
      // Edit existing: update module + sync its menu item label/icon.
      const mods = data.modules.map((m) =>
        m.id === editing.id ? { ...m, name, icon: editing.icon, color: editing.color, updatedAt: now } : m
      );
      const menu = data.menu.map((m) =>
        m.type === 'module' && m.targetId === editing.id ? { ...m, label: name, icon: editing.icon } : m
      );
      setData({ ...data, modules: mods, menu, lastModified: now });
    } else {
      // Create new module (a filter view of Chi tiêu) + its menu item.
      const newModule: ModuleDefinition = {
        id: `mod_${uuidv4().slice(0, 8)}`,
        name,
        icon: editing.icon,
        color: editing.color,
        description: '',
        sortOrder: data.modules.length,
        isDefault: false,
        isActive: true,
        isVisible: true,
        fields: [],
        categories: [],
        createdAt: now,
        updatedAt: now,
      };
      const menu = [...data.menu, buildMenuItem(newModule, data.menu)];
      setData({ ...data, modules: [...data.modules, newModule], menu, lastModified: now });
    }
    setEditing(null);
  };

  const remove = (moduleId: string) => {
    if (SYSTEM_MODULES.has(moduleId)) {
      alert('Không thể xóa module hệ thống.');
      return;
    }
    if (!confirm('Xóa module này? Giao dịch Chi tiêu đã gắn module này sẽ vẫn còn.')) return;
    const now = new Date().toISOString();
    const mods = data.modules.filter((m) => m.id !== moduleId);
    const menu = data.menu.filter((m) => m.targetId !== moduleId);
    setData({ ...data, modules: mods, menu, lastModified: now });
  };

  return (
    <div className="space-y-3 pt-3">
      {/* Workspace ON/OFF (unchanged) */}
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Nhóm workspace</p>
        {[
          { key: 'pdp_ws_chitieu', label: 'Quản lý chi tiêu', desc: 'Chi tiêu, Shopee, Vàng, Nhà trọ, Thẻ tín dụng' },
          { key: 'pdp_ws_ruou', label: 'Quản lý rượu', desc: 'Đơn hàng, Khách hàng, Kho, Sản phẩm' },
        ].map((ws) => {
          const enabled = localStorage.getItem(ws.key) !== '0';
          return (
            <div key={ws.key} className="flex items-center justify-between py-1.5">
              <div>
                <span className="text-sm font-medium text-[var(--color-text)]">{ws.label}</span>
                <p className="text-[10px] text-[var(--color-text-secondary)]">{ws.desc}</p>
              </div>
              <button
                onClick={() => { localStorage.setItem(ws.key, enabled ? '0' : '1'); window.location.reload(); }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              >
                {enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Sidebar module list — add/edit/delete/toggle like the mobile app */}
      <div className="pt-2 border-t border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">Module bên trái ({modules.length})</p>
          <button
            onClick={() => setEditing({ name: '', icon: ICON_OPTIONS[0], color: COLOR_OPTIONS[0] })}
            className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1"
          >
            <Icon name="plus" size={13} />Thêm
          </button>
        </div>

        <div className="space-y-1.5">
          {modules.map((mod) => {
            const on = isOn(mod.id);
            const system = SYSTEM_MODULES.has(mod.id);
            return (
              <div key={mod.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (on ? mod.color : '#9ca3af') + '1a' }}>
                  <Icon name={mod.icon} size={16} color={on ? mod.color : '#9ca3af'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${on ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>{mod.name}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)]">{system ? 'Module hệ thống' : 'Filter view — Chi tiêu'}</div>
                </div>
                {/* Toggle switch (mobile-style) */}
                <button
                  onClick={() => toggle(mod.id)}
                  role="switch"
                  aria-checked={on}
                  aria-label={`Bật/tắt ${mod.name}`}
                  className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
                <button onClick={() => setEditing({ id: mod.id, name: mod.name, icon: mod.icon, color: mod.color })}
                  className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-secondary)] flex-shrink-0">
                  <Icon name="edit" size={14} />
                </button>
                {!system && (
                  <button onClick={() => remove(mod.id)}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-secondary)] hover:text-red-500 flex-shrink-0">
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-[var(--color-text-secondary)] mt-2">Tắt = ẩn module khỏi menu, dữ liệu vẫn giữ nguyên.</p>
      </div>

      {/* Add/Edit dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-[var(--color-surface)] rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{editing.id ? 'Sửa module' : 'Thêm module'}</h3>

            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1">Tên module</label>
              <input
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                placeholder="VD: Xe máy, Du lịch, Tiết kiệm..."
                className="input-field text-sm w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1.5">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map((name) => {
                  const sel = name === editing.icon;
                  return (
                    <button key={name} onClick={() => setEditing({ ...editing, icon: name })}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                      style={sel ? { backgroundColor: editing.color + '1a', border: `2px solid ${editing.color}` } : { backgroundColor: 'var(--color-border)' }}>
                      <Icon name={name} size={16} color={sel ? editing.color : 'var(--color-text-secondary)'} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--color-text-secondary)] block mb-1.5">Màu sắc</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => {
                  const sel = c === editing.color;
                  return (
                    <button key={c} onClick={() => setEditing({ ...editing, color: c })}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform"
                      style={{ backgroundColor: c, transform: sel ? 'scale(1.1)' : undefined, boxShadow: sel ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c}` : undefined }}>
                      {sel && <Icon name="check" size={14} color="#ffffff" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1 text-sm">Hủy</button>
              <button onClick={save} disabled={!editing.name.trim()} className="btn-primary flex-1 text-sm disabled:opacity-50">
                {editing.id ? 'Lưu' : 'Tạo module'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Build a sidebar menu item for a module, inserted logically above settings/trash. */
function buildMenuItem(mod: ModuleDefinition, existing: MenuItem[]): MenuItem {
  const maxSort = existing.length > 0 ? Math.max(...existing.map((m) => m.sortOrder)) : 0;
  return {
    id: `menu_${mod.id}`,
    label: mod.name,
    icon: mod.icon,
    type: 'module',
    targetId: mod.id,
    sortOrder: maxSort + 1,
    isVisible: true,
  };
}
