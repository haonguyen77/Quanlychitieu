import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../models/credit_card.dart';
import '../providers/credit_card_provider.dart';

class AddCreditCardScreen extends StatefulWidget {
  final CreditCard? editCard;
  const AddCreditCardScreen({super.key, this.editCard});

  @override
  State<AddCreditCardScreen> createState() => _AddCreditCardScreenState();
}

class _AddCreditCardScreenState extends State<AddCreditCardScreen> {
  static const _primaryPurple = Color(0xFF6C2BD9);
  static const _green = Color(0xFF16A34A);
  static const _border = Color(0xFFE5E7EB);

  final _nameCtrl = TextEditingController();
  final _bankCtrl = TextEditingController();
  final _last4Ctrl = TextEditingController();
  final _limitCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  int _statementDay = 20;
  int _paymentDay = 10;
  int _alertDays = 3;

  bool get isEditing => widget.editCard != null;

  @override
  void initState() {
    super.initState();
    if (isEditing) {
      final c = widget.editCard!;
      _nameCtrl.text = c.name;
      _bankCtrl.text = c.bankName ?? '';
      _last4Ctrl.text = c.last4 ?? '';
      _limitCtrl.text = c.creditLimit > 0 ? c.creditLimit.toStringAsFixed(0) : '';
      _noteCtrl.text = c.note ?? '';
      _statementDay = c.statementDay;
      _paymentDay = c.paymentDueDays;
      _alertDays = c.alertDays;
    }
  }

  @override
  void dispose() {
    _nameCtrl.dispose(); _bankCtrl.dispose(); _last4Ctrl.dispose(); _limitCtrl.dispose(); _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vui lòng nhập tên thẻ')));
      return;
    }
    final limitText = _limitCtrl.text.replaceAll('.', '').replaceAll(',', '');
    final limit = double.tryParse(limitText) ?? 0;

    final card = CreditCard(
      id: isEditing ? widget.editCard!.id : const Uuid().v4(),
      name: _nameCtrl.text.trim(),
      bankName: _bankCtrl.text.trim().isEmpty ? null : _bankCtrl.text.trim(),
      last4: _last4Ctrl.text.trim().isEmpty ? null : _last4Ctrl.text.trim(),
      creditLimit: limit,
      statementDay: _statementDay,
      paymentDueDays: _paymentDay,
      alertDays: _alertDays,
      note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
    );

    final provider = context.read<CreditCardProvider>();
    if (isEditing) {
      await provider.updateCard(card);
    } else {
      await provider.addCard(card);
    }
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.black87), onPressed: () => Navigator.pop(context)),
        title: Text(isEditing ? 'Sửa thẻ tín dụng' : 'Thêm thẻ tín dụng', style: const TextStyle(color: Colors.black87, fontSize: 18, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: Consumer<CreditCardProvider>(
        builder: (context, provider, child) {
          return Column(
            children: [
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    // Existing cards list (only in manage mode, not editing)
                    if (!isEditing && provider.cards.isNotEmpty) ...[
                      Text('Thẻ hiện có', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Colors.grey[800])),
                      const SizedBox(height: 8),
                      ...provider.cards.map((c) => _existingCardTile(c, provider)),
                      const Divider(height: 24),
                    ],
                    // Form
                    _sectionTitle(Icons.credit_card, 'Thông tin thẻ', _primaryPurple),
                    const SizedBox(height: 12),
                    _field('Tên thẻ *', _nameCtrl, 'Ví dụ: Thẻ Tín Dụng VPBank Platinum'),
                    const SizedBox(height: 12),
                    _field('Ngân hàng phát hành *', _bankCtrl, 'Nhập tên ngân hàng'),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _field('4 số cuối thẻ *', _last4Ctrl, '1234', keyboardType: TextInputType.number, maxLength: 4)),
                      const SizedBox(width: 12),
                      Expanded(child: _field('Hạn mức tín dụng *', _limitCtrl, 'Nhập hạn mức', keyboardType: TextInputType.number, suffixText: 'đ')),
                    ]),
                    const SizedBox(height: 20),
                    _sectionTitle(Icons.calendar_month, 'Thông tin thanh toán', _green),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _dropdownField('Ngày sao kê *', _statementDay, (v) => setState(() => _statementDay = v))),
                      const SizedBox(width: 12),
                      Expanded(child: _dropdownField('Ngày thanh toán *', _paymentDay, (v) => setState(() => _paymentDay = v))),
                    ]),
                    const SizedBox(height: 12),
                    _alertDropdown(),
                    const SizedBox(height: 20),
                    _sectionTitle(Icons.note_outlined, 'Ghi chú', Colors.teal),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _noteCtrl, maxLines: 3, maxLength: 200,
                      decoration: InputDecoration(
                        hintText: 'Nhập ghi chú (nếu có)',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                      ),
                    ),
                  ]),
                ),
              ),
              // Save button
              Padding(
                padding: const EdgeInsets.all(16),
                child: SizedBox(width: double.infinity, height: 48, child: ElevatedButton(
                  onPressed: _save,
                  style: ElevatedButton.styleFrom(backgroundColor: _green, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                  child: Text(isEditing ? 'Cập nhật thẻ' : 'Lưu thẻ tín dụng', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                )),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _existingCardTile(CreditCard c, CreditCardProvider provider) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Icon(Icons.credit_card, color: _primaryPurple, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(c.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          if (c.bankName != null) Text(c.bankName!, style: TextStyle(fontSize: 11, color: Colors.grey[500])),
        ])),
        if (c.last4 != null) Text('**** ${c.last4}', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => AddCreditCardScreen(editCard: c))).then((_) => provider.loadCards()),
          child: Icon(Icons.edit_outlined, size: 18, color: Colors.grey[600]),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () async {
            final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
              title: const Text('Xóa thẻ'), content: Text('Xóa "${c.name}"?'),
              actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')), FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(backgroundColor: Colors.red), child: const Text('Xóa'))],
            ));
            if (confirm == true) await provider.deleteCard(c.id);
          },
          child: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
        ),
      ]),
    );
  }

  Widget _sectionTitle(IconData icon, String text, Color color) {
    return Row(children: [Icon(icon, size: 18, color: color), const SizedBox(width: 8), Text(text, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: color))]);
  }

  Widget _field(String label, TextEditingController ctrl, String hint, {TextInputType? keyboardType, int? maxLength, String? suffixText}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey[800])),
      const SizedBox(height: 4),
      TextField(controller: ctrl, keyboardType: keyboardType, maxLength: maxLength,
        inputFormatters: keyboardType == TextInputType.number ? [FilteringTextInputFormatter.digitsOnly] : null,
        decoration: InputDecoration(
          hintText: hint, counterText: '', suffixText: suffixText,
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
        )),
    ]);
  }

  Widget _dropdownField(String label, int value, ValueChanged<int> onChanged) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey[800])),
      const SizedBox(height: 4),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
        child: DropdownButtonHideUnderline(child: DropdownButton<int>(
          value: value, isExpanded: true,
          items: List.generate(31, (i) => DropdownMenuItem(value: i + 1, child: Text('${i + 1}'))),
          onChanged: (v) { if (v != null) onChanged(v); },
        )),
      ),
    ]);
  }

  Widget _alertDropdown() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Cảnh báo thanh toán', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Colors.grey[800])),
      const SizedBox(height: 4),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
        child: DropdownButtonHideUnderline(child: DropdownButton<int>(
          value: _alertDays, isExpanded: true,
          items: [1, 2, 3, 5, 7, 10, 14].map((d) => DropdownMenuItem(value: d, child: Text('Nhắc tôi trước $d ngày'))).toList(),
          onChanged: (v) { if (v != null) setState(() => _alertDays = v); },
        )),
      ),
    ]);
  }
}
