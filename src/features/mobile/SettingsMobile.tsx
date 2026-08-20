import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { GoogleDriveMobile } from './GoogleDriveMobile';
import { CategoriesMobile } from './CategoriesMobile';
import { AccountsMobile } from './AccountsMobile';
import { BeneficiariesMobile } from './BeneficiariesMobile';
import { TrashMobile } from './TrashMobile';
import { ReportsMobile } from './ReportsMobile';
import { BudgetMobile } from './BudgetMobile';
import { BackupRestoreMobile } from './BackupRestoreMobile';
import { ModuleManagementMobile } from './ModuleManagementMobile';
import { RecurringMobile } from './RecurringMobile';
import { SecurityMobile } from './SecurityMobile';
import { MobileIcon } from './MobileIcon';
import { getModuleIconInfo, getModuleColor } from './mobileIconMap';
import { Cloud, Bell, Shield, Tag, Wallet, User, Trash2, Database, Lock, ChevronRight, Palette, BarChart3, PieChart, Repeat, Layers } from 'lucide-react';

/**
 * SettingsMobile — Full reproduction of Android settings_screen.dart.
 * 6 sections: Dữ liệu, Quản lý Module, Đồng bộ, Thông báo, Import/Export, Bảo mật.
 */
export function SettingsMobile() {
  const { data, theme, setTheme } = useAppStore();
  const { push } = useMobileNav();

  const modules = data?.modules || [];

  return (
    <div className="h-full overflow-auto bg-[#F8F9FA]">
      {/* Header */}
      <div className="bg-white px-4 pb-4" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <h1 className="text-xl font-bold text-center" style={{ color: '#1A1A1A' }}>Cài đặt</h1>
      </div>

      <div className="px-4 pb-24 pt-4 space-y-5">
        {/* 1. DỮ LIỆU */}
        <SettingsSection title="1. DỮ LIỆU">
          <SettingsNav icon={<Tag size={18} />} iconBg="#E8F5E9" iconColor="#2E7D32" label="Danh mục" subtitle="Quản lý danh mục chi tiêu" onTap={() => push({ id: 'categories', component: <CategoriesMobile /> })} />
          <Divider />
          <SettingsNav icon={<Wallet size={18} />} iconBg="#E3F2FD" iconColor="#1565C0" label="Phương thức thanh toán" subtitle="Quản lý tài khoản, ví, thẻ..." onTap={() => push({ id: 'accounts', component: <AccountsMobile /> })} />
          <Divider />
          <SettingsNav icon={<User size={18} />} iconBg="#F3E5F5" iconColor="#6A1B9A" label="Người nhận" subtitle="Quản lý danh sách người nhận" onTap={() => push({ id: 'beneficiaries', component: <BeneficiariesMobile /> })} />
          <Divider />
          <SettingsNav icon={<BarChart3 size={18} />} iconBg="#E8F5E9" iconColor="#1B5E20" label="Báo cáo" subtitle="Thống kê thu chi theo thời gian" onTap={() => push({ id: 'reports', component: <ReportsMobile /> })} />
          <Divider />
          <SettingsNav icon={<PieChart size={18} />} iconBg="#FFF3E0" iconColor="#E65100" label="Ngân sách" subtitle="Quản lý hạn mức chi tiêu" onTap={() => push({ id: 'budget', component: <BudgetMobile /> })} />
          <Divider />
          <SettingsNav icon={<Repeat size={18} />} iconBg="#E8EAF6" iconColor="#3F51B5" label="Giao dịch định kỳ" subtitle="Tự động tạo giao dịch" onTap={() => push({ id: 'recurring', component: <RecurringMobile /> })} />
          <Divider />
          <SettingsNav icon={<Trash2 size={18} />} iconBg="#FFEBEE" iconColor="#D32F2F" label="Thùng rác" subtitle="Xem và khôi phục giao dịch đã xóa" onTap={() => push({ id: 'trash', component: <TrashMobile /> })} />
        </SettingsSection>

        {/* 2. QUẢN LÝ MODULE */}
        <SettingsSection title="2. QUẢN LÝ MODULE">
          <SettingsNav icon={<Layers size={18} />} iconBg="#E3F2FD" iconColor="#1565C0" label="Quản lý Module" subtitle="Thêm, sửa, xóa module" onTap={() => push({ id: 'module-mgmt', component: <ModuleManagementMobile /> })} />
          <Divider />
          {modules.filter(m => m.isVisible !== false).map(mod => {
            const iconInfo = getModuleIconInfo(mod.icon);
            const color = getModuleColor(mod.id);
            return <ModuleToggle key={mod.id} name={mod.name} iconName={iconInfo.icon} iconColor={color} isActive={mod.isActive} onToggle={() => {
              const updated = { ...data!, modules: data!.modules.map(m => m.id === mod.id ? { ...m, isActive: !m.isActive } : m), lastModified: new Date().toISOString() };
              useAppStore.getState().setData(updated);
            }} />;
          })}
        </SettingsSection>

        {/* 3. ĐỒNG BỘ */}
        <SettingsSection title="3. ĐỒNG BỘ">
          <SettingsNav icon={<Cloud size={18} />} iconBg="#E3F2FD" iconColor="#1565C0" label="Google Drive" subtitle="Đồng bộ dữ liệu lên đám mây" onTap={() => push({ id: 'google-drive', component: <GoogleDriveMobile /> })} />
        </SettingsSection>

        {/* 4. THÔNG BÁO */}
        <SettingsSection title="4. THÔNG BÁO">
          <SettingsNav icon={<Bell size={18} />} iconBg="#FFF3E0" iconColor="#E65100" label="Nhắc nhập chi tiêu" subtitle="Web notification chưa được cấu hình" onTap={() => {}} />
        </SettingsSection>

        {/* 5. IMPORT / EXPORT & BACKUP */}
        <SettingsSection title="5. IMPORT / EXPORT & BACKUP">
          <SettingsNav icon={<Database size={18} />} iconBg="#E0F2F1" iconColor="#00695C" label="Sao lưu & Khôi phục" subtitle="Export / Import finance.json" onTap={() => push({ id: 'backup', component: <BackupRestoreMobile /> })} />
        </SettingsSection>

        {/* 6. BẢO MẬT */}
        <SettingsSection title="6. BẢO MẬT">
          <SettingsNav icon={<Lock size={18} />} iconBg="#ECEFF1" iconColor="#37474F" label="Bảo mật" subtitle="Mã PIN, mã hóa dữ liệu trên thiết bị" onTap={() => push({ id: 'security', component: <SecurityMobile /> })} />
        </SettingsSection>

        {/* GIAO DIỆN */}
        <SettingsSection title="7. GIAO DIỆN">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F3E5F5' }}>
              <Palette size={18} style={{ color: '#6A1B9A' }} />
            </div>
            <span className="flex-1 text-sm text-gray-900">Giao diện</span>
            <select value={theme} onChange={e => setTheme(e.target.value as 'light' | 'dark')} className="text-xs bg-gray-100 rounded-lg px-3 py-1.5 border-0 outline-none">
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-green-700 mb-2 px-1">{title}</p>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">{children}</div>
    </div>
  );
}

function SettingsNav({ icon, iconBg, iconColor, label, subtitle, onTap }: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; subtitle: string; onTap: () => void }) {
  return (
    <button onClick={onTap} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 text-left">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300" />
    </button>
  );
}

function ModuleToggle({ name, iconName, iconColor, isActive, onToggle }: { name: string; iconName: string; iconColor: string; isActive: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
      <MobileIcon name={iconName} size={16} color={iconColor} />
      <span className="flex-1 text-sm text-gray-900">{name}</span>
      <button onClick={onToggle} className={`w-11 h-6 rounded-full transition-colors relative ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function Divider() { return <div className="h-px bg-gray-50 mx-4" />; }
