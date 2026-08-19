import { useAppStore } from '@/core/store/appStore';
import { useMobileNav } from './MobileNavigation';
import { GoogleDriveMobile } from './GoogleDriveMobile';
import { Cloud, Bell, Shield, Palette, Database, Trash2, ChevronRight } from 'lucide-react';

/**
 * Mobile Settings — Clean list with icons.
 * Design reference: Android App "Cài đặt" screen.
 * Google Drive button navigates to GoogleDriveMobile.
 */
export function SettingsMobile() {
  const { theme, setTheme } = useAppStore();
  const { push } = useMobileNav();

  const openGoogleDrive = () => {
    push({ id: 'google-drive', component: <GoogleDriveMobile /> });
  };

  return (
    <div className="h-full overflow-auto bg-white">
      <div className="px-5 pt-3 pb-4">
        <h1 className="text-xl font-bold" style={{ color: '#0F1F4D' }}>Cài đặt</h1>
      </div>

      <div className="px-4 pb-24 space-y-4">
        {/* Sync */}
        <SettingsSection title="Đồng bộ">
          <SettingsItem icon={<Cloud size={18} />} iconBg="bg-blue-50" iconColor="text-blue-500" label="Google Drive" subtitle="Đồng bộ dữ liệu" onPress={openGoogleDrive} />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Thông báo">
          <SettingsItem icon={<Bell size={18} />} iconBg="bg-orange-50" iconColor="text-orange-500" label="Nhắc nhập chi tiêu" subtitle="Web notification chưa được cấu hình" />
        </SettingsSection>

        {/* Security */}
        <SettingsSection title="Bảo mật">
          <SettingsItem icon={<Shield size={18} />} iconBg="bg-purple-50" iconColor="text-purple-500" label="Bảo mật" subtitle="Chưa hỗ trợ trên Web" />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Giao diện">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500">
              <Palette size={18} />
            </div>
            <span className="flex-1 text-sm text-gray-900">Giao diện</span>
            <select
              value={theme}
              onChange={e => setTheme(e.target.value as 'light' | 'dark')}
              className="text-xs bg-gray-100 rounded-lg px-2 py-1 border-0"
            >
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </div>
        </SettingsSection>

        {/* Data */}
        <SettingsSection title="Dữ liệu">
          <SettingsItem icon={<Database size={18} />} iconBg="bg-green-50" iconColor="text-green-500" label="Import / Export" subtitle="Chưa hỗ trợ trên Web" />
          <div className="border-t border-gray-50" />
          <SettingsItem icon={<Trash2 size={18} />} iconBg="bg-red-50" iconColor="text-red-500" label="Thùng rác" subtitle="Giao dịch đã xóa" />
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-gray-400 tracking-wide px-1 mb-2">{title}</p>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SettingsItem({ icon, iconBg, iconColor, label, subtitle, onPress }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; subtitle: string; onPress?: () => void;
}) {
  return (
    <button onClick={onPress} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 transition-colors text-left">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center ${iconColor}`}>{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-[10px] text-gray-400">{subtitle}</p>
      </div>
      <ChevronRight size={16} className="text-gray-300" />
    </button>
  );
}
