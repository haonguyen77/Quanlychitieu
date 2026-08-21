import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/crypto_service.dart';

/// PinOnboardingGate — wraps the home screen and, on first launch, offers
/// (optionally) to create a security PIN. Skippable. The same PIN encrypts
/// Drive data and locks the app on open.
class PinOnboardingGate extends StatefulWidget {
  final Widget child;
  const PinOnboardingGate({super.key, required this.child});

  @override
  State<PinOnboardingGate> createState() => _PinOnboardingGateState();
}

class _PinOnboardingGateState extends State<PinOnboardingGate> {
  static const _flag = 'pdp_pin_prompted';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybePrompt());
  }

  Future<void> _maybePrompt() async {
    final prefs = await SharedPreferences.getInstance();
    if (prefs.getBool(_flag) == true) return;
    if (await CryptoService.instance.isEnabled()) { await prefs.setBool(_flag, true); return; }
    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    await _showCreateDialog();
    await prefs.setBool(_flag, true);
  }

  Future<void> _showCreateDialog() async {
    final controller = TextEditingController();
    final confirmC = TextEditingController();
    String err = '';
    await showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Bảo mật bằng mã PIN?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Tạo mã PIN (4-6 số) để mã hóa dữ liệu đồng bộ Google Drive và khóa ứng dụng khi mở. Có thể bỏ qua và bật sau ở Cài đặt.', style: TextStyle(fontSize: 13)),
              const SizedBox(height: 12),
              TextField(controller: controller, obscureText: true, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(hintText: 'Mã PIN', counterText: '')),
              TextField(controller: confirmC, obscureText: true, keyboardType: TextInputType.number, maxLength: 6, decoration: const InputDecoration(hintText: 'Nhập lại PIN', counterText: '')),
              if (err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(err, style: const TextStyle(color: Colors.red, fontSize: 12))),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Bỏ qua')),
            FilledButton(
              onPressed: () async {
                final pin = controller.text.trim();
                if (!RegExp(r'^\d{4,6}$').hasMatch(pin)) { setLocal(() => err = 'Mã PIN gồm 4-6 chữ số'); return; }
                if (pin != confirmC.text.trim()) { setLocal(() => err = 'Nhập lại PIN không khớp'); return; }
                await CryptoService.instance.setupPin(pin);
                if (ctx.mounted) Navigator.pop(ctx);
              },
              child: const Text('Tạo mã PIN'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
