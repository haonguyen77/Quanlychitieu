import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/notification_service.dart';
import 'recurring_reminder_screen.dart';

/// Material 3 minimal notification settings screen.
class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _bg = Color(0xFFF8F9FA);
  static const _border = Color(0xFFEEEEEE);

  bool _dailyEnabled = false;
  TimeOfDay _dailyTime = const TimeOfDay(hour: 20, minute: 0);
  bool _daily2Enabled = false;
  TimeOfDay _daily2Time = const TimeOfDay(hour: 12, minute: 0);
  bool _creditCardEnabled = false;
  bool _recurringEnabled = false;
  bool _budgetEnabled = false;
  double _budgetLimit = 10000000;
  int _budgetWarnPercent = 90;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final service = NotificationService.instance;
    final dailyEnabled = await service.isDailyReminderEnabled();
    final dailyTime = await service.getDailyReminderTime();
    final daily2Enabled = await service.isDailyReminder2Enabled();
    final daily2Time = await service.getDailyReminder2Time();
    final creditCard = await service.isCreditCardReminderEnabled();
    final recurring = await service.isRecurringReminderEnabled();
    final budget = await service.isBudgetAlertEnabled();
    final prefs = await SharedPreferences.getInstance();
    final budgetLimit = prefs.getDouble('budget_monthly_limit') ?? 10000000;
    final budgetWarnPercent = prefs.getInt('budget_warn_percent') ?? 90;

    if (mounted) {
      setState(() {
        _dailyEnabled = dailyEnabled;
        _dailyTime = dailyTime;
        _daily2Enabled = daily2Enabled;
        _daily2Time = daily2Time;
        _creditCardEnabled = creditCard;
        _recurringEnabled = recurring;
        _budgetEnabled = budget;
        _budgetLimit = budgetLimit;
        _budgetWarnPercent = budgetWarnPercent;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: () => Navigator.pop(context)),
        title: const Text('Nhắc nhập chi tiêu', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 17)),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _purple))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Daily Reminders ─────────────────────────────
                  _sectionLabel('Nhắc nhở hàng ngày'),
                  const SizedBox(height: 10),
                  _card(child: Column(children: [
                    _switchRow(
                      icon: Icons.notifications_active_outlined,
                      title: 'Nhắc nhở lần 1',
                      subtitle: _dailyEnabled
                          ? 'Hàng ngày lúc ${_fmtTime(_dailyTime)}'
                          : 'Tắt',
                      value: _dailyEnabled,
                      onChanged: (v) async {
                        setState(() => _dailyEnabled = v);
                        await NotificationService.instance.setDailyReminderEnabled(v);
                      },
                    ),
                    if (_dailyEnabled) ...[
                      _divider(),
                      _timeRow('Giờ nhắc', _dailyTime, _pickDailyTime),
                    ],
                    _divider(),
                    _switchRow(
                      icon: Icons.alarm_outlined,
                      title: 'Nhắc nhở lần 2',
                      subtitle: _daily2Enabled
                          ? 'Hàng ngày lúc ${_fmtTime(_daily2Time)}'
                          : 'Tắt',
                      value: _daily2Enabled,
                      onChanged: (v) async {
                        setState(() => _daily2Enabled = v);
                        await NotificationService.instance.setDailyReminder2Enabled(v);
                      },
                    ),
                    if (_daily2Enabled) ...[
                      _divider(),
                      _timeRow('Giờ nhắc lần 2', _daily2Time, _pickDaily2Time),
                    ],
                  ])),

                  const SizedBox(height: 24),

                  // ─── Alerts ──────────────────────────────────────
                  _sectionLabel('Cảnh báo & nhắc nhở'),
                  const SizedBox(height: 10),
                  _card(child: Column(children: [
                    _switchRow(
                      icon: Icons.credit_card_outlined,
                      title: 'Nhắc thanh toán thẻ',
                      subtitle: 'Nhắc trước ngày đến hạn',
                      value: _creditCardEnabled,
                      onChanged: (v) async {
                        setState(() => _creditCardEnabled = v);
                        await NotificationService.instance.setCreditCardReminderEnabled(v);
                      },
                    ),
                    _divider(),
                    _switchRow(
                      icon: Icons.repeat,
                      title: 'Nhắc giao dịch định kỳ',
                      subtitle: 'Nhắc vào ngày đến hạn',
                      value: _recurringEnabled,
                      onChanged: (v) async {
                        setState(() => _recurringEnabled = v);
                        await NotificationService.instance.setRecurringReminderEnabled(v);
                      },
                    ),
                    _divider(),
                    _switchRow(
                      icon: Icons.warning_amber_outlined,
                      title: 'Cảnh báo vượt ngân sách',
                      subtitle: 'Thông báo khi chi tiêu vượt giới hạn',
                      value: _budgetEnabled,
                      onChanged: (v) async {
                        setState(() => _budgetEnabled = v);
                        await NotificationService.instance.setBudgetAlertEnabled(v);
                      },
                    ),
                    if (_budgetEnabled) ...[
                      _divider(),
                      _tapRow(
                        icon: Icons.account_balance_wallet_outlined,
                        title: 'Giới hạn tháng',
                        subtitle: '${(_budgetLimit / 1000000).toStringAsFixed(1)}M₫',
                        onTap: _editBudgetLimit,
                      ),
                      _divider(),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        child: Row(children: [
                          Container(
                            width: 36, height: 36,
                            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(10)),
                            child: const Icon(Icons.percent, size: 16, color: _purple),
                          ),
                          const SizedBox(width: 14),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Text('Cảnh báo khi đạt', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy)),
                            Text('${((_budgetLimit * _budgetWarnPercent / 100) / 1000000).toStringAsFixed(1)}M₫',
                                style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                          ])),
                          DropdownButton<int>(
                            value: _budgetWarnPercent,
                            underline: const SizedBox(),
                            style: const TextStyle(fontSize: 13, color: _purple, fontWeight: FontWeight.w500),
                            items: const [
                              DropdownMenuItem(value: 70, child: Text('70%')),
                              DropdownMenuItem(value: 80, child: Text('80%')),
                              DropdownMenuItem(value: 90, child: Text('90%')),
                              DropdownMenuItem(value: 95, child: Text('95%')),
                              DropdownMenuItem(value: 100, child: Text('100%')),
                            ],
                            onChanged: (v) async {
                              if (v != null) {
                                final prefs = await SharedPreferences.getInstance();
                                await prefs.setInt('budget_warn_percent', v);
                                setState(() => _budgetWarnPercent = v);
                              }
                            },
                          ),
                        ]),
                      ),
                    ],
                  ])),

                  const SizedBox(height: 24),

                  // ─── Recurring ───────────────────────────────────
                  _sectionLabel('Định kỳ'),
                  const SizedBox(height: 10),
                  _card(child: _tapRow(
                    icon: Icons.event_repeat,
                    title: 'Nhắc nhở định kỳ',
                    subtitle: 'Tiền nước, điện, quỹ...',
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RecurringReminderScreen())),
                    showChevron: true,
                  )),

                  const SizedBox(height: 24),

                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  // ─── Shared Widgets ─────────────────────────────────────────────────────

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: child,
    );
  }

  Widget _sectionLabel(String text) {
    return Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey[500], letterSpacing: 0.5));
  }

  Widget _switchRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: _purple),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy)),
            const SizedBox(height: 2),
            Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
          ])),
          Switch(value: value, onChanged: onChanged, activeColor: _purple),
        ],
      ),
    );
  }

  Widget _timeRow(String label, TimeOfDay time, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(children: [
          const SizedBox(width: 50),
          Icon(Icons.access_time, size: 16, color: Colors.grey[400]),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(8)),
            child: Text(_fmtTime(time), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _purple)),
          ),
        ]),
      ),
    );
  }

  Widget _tapRow({required IconData icon, required String title, String? subtitle, required VoidCallback onTap, bool showChevron = false}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, size: 18, color: _purple),
          ),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy)),
            if (subtitle != null) ...[const SizedBox(height: 2), Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey[500]))],
          ])),
          if (showChevron) Icon(Icons.chevron_right, size: 20, color: Colors.grey[400]),
        ]),
      ),
    );
  }

  Widget _divider() => Divider(height: 1, color: Colors.grey[100]);

  String _fmtTime(TimeOfDay t) => '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  // ─── Actions ────────────────────────────────────────────────────────────

  Future<void> _pickDailyTime() async {
    final picked = await showTimePicker(context: context, initialTime: _dailyTime, helpText: 'Chọn giờ nhắc nhở');
    if (picked != null) {
      setState(() => _dailyTime = picked);
      await NotificationService.instance.scheduleDailyReminder(picked);
    }
  }

  Future<void> _pickDaily2Time() async {
    final picked = await showTimePicker(context: context, initialTime: _daily2Time, helpText: 'Chọn giờ nhắc nhở lần 2');
    if (picked != null) {
      setState(() => _daily2Time = picked);
      await NotificationService.instance.scheduleDailyReminder2(picked);
    }
  }

  Future<void> _editBudgetLimit() async {
    final ctrl = TextEditingController(text: (_budgetLimit / 1000000).toStringAsFixed(1));
    final result = await showDialog<double>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Giới hạn chi tiêu/tháng', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: _navy)),
            const SizedBox(height: 20),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.number,
              autofocus: true,
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: _purple),
              textAlign: TextAlign.center,
              decoration: InputDecoration(
                suffixText: 'M₫',
                hintText: '10',
                filled: true,
                fillColor: _purpleLight.withOpacity(0.5),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
              ),
            ),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(child: OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), side: BorderSide(color: Colors.grey[300]!)),
                child: Text('Hủy', style: TextStyle(color: Colors.grey[600])),
              )),
              const SizedBox(width: 12),
              Expanded(child: FilledButton(
                onPressed: () {
                  final val = double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0;
                  Navigator.pop(ctx, val * 1000000);
                },
                style: FilledButton.styleFrom(backgroundColor: _purple, padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)),
              )),
            ]),
          ]),
        ),
      ),
    );
    if (result != null && result > 0) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble('budget_monthly_limit', result);
      setState(() => _budgetLimit = result);
    }
  }
}
