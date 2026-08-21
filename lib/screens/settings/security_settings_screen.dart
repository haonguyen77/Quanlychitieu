import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/security_provider.dart';
import '../../services/security_service.dart';

/// Material 3 minimal security settings screen.
class SecuritySettingsScreen extends StatefulWidget {
  const SecuritySettingsScreen({super.key});

  @override
  State<SecuritySettingsScreen> createState() => _SecuritySettingsScreenState();
}

class _SecuritySettingsScreenState extends State<SecuritySettingsScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _purpleLight = Color(0xFFF3EAFF);
  static const _navy = Color(0xFF101B4D);
  static const _bg = Color(0xFFF8F9FA);
  static const _border = Color(0xFFEEEEEE);

  bool _pinEnabled = false;
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  bool _privacyMode = false;
  int _autoLockMinutes = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final service = SecurityService.instance;
    final pinEnabled = await service.isPinEnabled();
    final biometricEnabled = await service.isBiometricEnabled();
    final biometricAvailable = await service.isBiometricAvailable();
    final privacyMode = await service.isPrivacyMode();
    var autoLock = await service.getAutoLockMinutes();
    if (autoLock > 0 && autoLock < 30) {
      autoLock = autoLock * 60;
      await service.setAutoLockMinutes(autoLock);
    }
    if (mounted) {
      setState(() {
        _pinEnabled = pinEnabled;
        _biometricEnabled = biometricEnabled;
        _biometricAvailable = biometricAvailable;
        _privacyMode = privacyMode;
        _autoLockMinutes = autoLock;
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
        title: const Text('Bảo mật', style: TextStyle(color: _navy, fontWeight: FontWeight.w600, fontSize: 17)),
        centerTitle: true,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _purple))
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ─── Lock Section ───────────────────────────────
                  _sectionLabel('Khóa ứng dụng'),
                  const SizedBox(height: 10),
                  _card(child: Column(children: [
                    _switchRow(
                      icon: Icons.lock_outline,
                      title: 'Passcode',
                      subtitle: _pinEnabled ? 'Đã bật — nhập 4-6 số để mở khóa app' : 'Tắt',
                      value: _pinEnabled,
                      onChanged: (v) async {
                        if (v) {
                          final pin = await _showSetPinDialog();
                          if (pin != null) {
                            await SecurityService.instance.setPin(pin);
                            await SecurityService.instance.setPinEnabled(true);
                            setState(() => _pinEnabled = true);
                          }
                        } else {
                          await SecurityService.instance.setPinEnabled(false);
                          setState(() => _pinEnabled = false);
                        }
                      },
                    ),
                    _divider(),
                    _switchRow(
                      icon: Icons.fingerprint,
                      title: 'Vân tay / Face ID',
                      subtitle: _biometricAvailable
                          ? (_biometricEnabled ? 'Đã bật' : 'Tắt')
                          : 'Thiết bị không hỗ trợ',
                      value: _biometricEnabled,
                      enabled: _biometricAvailable && _pinEnabled,
                      onChanged: (v) async {
                        await SecurityService.instance.setBiometricEnabled(v);
                        setState(() => _biometricEnabled = v);
                      },
                    ),
                    _divider(),
                    _dropdownRow(
                      icon: Icons.timer_outlined,
                      title: 'Tự động khóa',
                      subtitle: _autoLockLabel(_autoLockMinutes),
                      enabled: _pinEnabled,
                      value: _autoLockMinutes,
                      items: const [
                        DropdownMenuItem(value: 0, child: Text('Ngay lập tức')),
                        DropdownMenuItem(value: 30, child: Text('30 giây')),
                        DropdownMenuItem(value: 60, child: Text('1 phút')),
                        DropdownMenuItem(value: 300, child: Text('5 phút')),
                        DropdownMenuItem(value: 900, child: Text('15 phút')),
                        DropdownMenuItem(value: -1, child: Text('Không')),
                      ],
                      onChanged: (v) async {
                        if (v != null) {
                          await SecurityService.instance.setAutoLockMinutes(v);
                          setState(() => _autoLockMinutes = v);
                        }
                      },
                    ),
                    if (_pinEnabled) ...[
                      _divider(),
                      _tapRow(
                        icon: Icons.password,
                        title: 'Đổi Passcode',
                        onTap: () async {
                          final pin = await _showSetPinDialog(isChange: true);
                          if (pin != null) {
                            await SecurityService.instance.setPin(pin);
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Đã đổi Passcode'), behavior: SnackBarBehavior.floating),
                              );
                            }
                          }
                        },
                      ),
                    ],
                  ])),

                  const SizedBox(height: 24),

                  // ─── Privacy Section ────────────────────────────
                  _sectionLabel('Riêng tư'),
                  const SizedBox(height: 10),
                  _card(child: _switchRow(
                    icon: Icons.visibility_off_outlined,
                    title: 'Chế độ riêng tư',
                    subtitle: 'Ẩn số tiền trên màn hình',
                    value: _privacyMode,
                    onChanged: (v) async {
                      await SecurityService.instance.setPrivacyMode(v);
                      if (context.mounted) {
                        context.read<SecurityProvider>().setPrivacyMode(v);
                      }
                      setState(() => _privacyMode = v);
                    },
                  )),

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
    bool enabled = true,
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
          Switch(
            value: value,
            onChanged: enabled ? onChanged : null,
            activeColor: _purple,
          ),
        ],
      ),
    );
  }

  Widget _dropdownRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool enabled,
    required int value,
    required List<DropdownMenuItem<int>> items,
    required ValueChanged<int?> onChanged,
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
          DropdownButton<int>(
            value: value,
            underline: const SizedBox(),
            style: const TextStyle(fontSize: 12, color: _purple),
            items: items,
            onChanged: enabled ? onChanged : null,
          ),
        ],
      ),
    );
  }

  Widget _tapRow({required IconData icon, required String title, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(10)),
              child: Icon(icon, size: 18, color: _purple),
            ),
            const SizedBox(width: 14),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: _navy))),
            Icon(Icons.chevron_right, size: 20, color: Colors.grey[400]),
          ],
        ),
      ),
    );
  }

  Widget _divider() => Divider(height: 1, color: Colors.grey[100]);

  String _autoLockLabel(int seconds) {
    switch (seconds) {
      case 0: return 'Ngay lập tức';
      case 30: return '30 giây';
      case 60: return '1 phút';
      case 300: return '5 phút';
      case 900: return '15 phút';
      case -1: return 'Không tự động khóa';
      default: return seconds < 60 ? '$seconds giây' : '${seconds ~/ 60} phút';
    }
  }

  Future<String?> _showSetPinDialog({bool isChange = false}) async {
    final pinController = TextEditingController();
    final confirmController = TextEditingController();

    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(color: _purpleLight, borderRadius: BorderRadius.circular(16)),
                child: const Icon(Icons.lock_outline, color: _purple, size: 28),
              ),
              const SizedBox(height: 16),
              Text(isChange ? 'Đổi Passcode' : 'Đặt Passcode',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: _navy)),
              const SizedBox(height: 20),
              TextField(
                controller: pinController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: InputDecoration(
                  hintText: '••••',
                  counterText: '',
                  filled: true,
                  fillColor: _purpleLight.withOpacity(0.5),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: _purple, width: 1.5)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: confirmController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                obscureText: true,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, letterSpacing: 8),
                decoration: InputDecoration(
                  hintText: 'Xác nhận',
                  counterText: '',
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
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: BorderSide(color: Colors.grey[300]!),
                  ),
                  child: Text('Hủy', style: TextStyle(color: Colors.grey[600])),
                )),
                const SizedBox(width: 12),
                Expanded(child: FilledButton(
                  onPressed: () {
                    final pin = pinController.text;
                    final confirm = confirmController.text;
                    if (pin.length != 4) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mật khẩu phải đủ 4 số'), behavior: SnackBarBehavior.floating));
                      return;
                    }
                    if (pin != confirm) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mật khẩu xác nhận không khớp'), behavior: SnackBarBehavior.floating));
                      return;
                    }
                    Navigator.pop(ctx, pin);
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: _purple,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Xác nhận', style: TextStyle(fontWeight: FontWeight.w600)),
                )),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
