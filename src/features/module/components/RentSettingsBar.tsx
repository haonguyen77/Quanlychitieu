import { useAppStore } from '@/core/store/appStore';

export function RentSettingsBar() {
  const { data, updateSettings } = useAppStore();
  const settings = data?.settings?.rentalSettings || {};

  const handleDueDateChange = (value: string) => {
    updateSettings({ rentalSettings: { ...settings, rentDueDate: value } });
  };

  const handleAlertDaysChange = (value: string) => {
    updateSettings({ rentalSettings: { ...settings, rentAlertDays: value ? Number(value) : undefined } });
  };

  return (
    <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center gap-6">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--color-text)]">Ngay dong tien</label>
        <input
          type="date"
          className="input-field py-1.5 px-3 text-sm w-[150px]"
          value={settings.rentDueDate || ''}
          onChange={(e) => handleDueDateChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--color-text)]">Canh bao (nhac nho)</label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-secondary)]">Truoc</span>
          <input
            type="number"
            className="input-field py-1.5 px-2 text-sm w-[60px] text-center"
            value={settings.rentAlertDays ?? ''}
            onChange={(e) => handleAlertDaysChange(e.target.value)}
            placeholder="5"
            min="1"
            max="30"
          />
          <span className="text-xs text-[var(--color-text-secondary)]">ngay</span>
        </div>
      </div>
    </div>
  );
}
