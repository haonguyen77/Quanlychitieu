import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../providers/account_provider.dart';
import '../models/credit_card.dart';
import '../providers/credit_card_provider.dart';

class CreditCardPaymentScreen extends StatefulWidget {
  const CreditCardPaymentScreen({super.key});

  @override
  State<CreditCardPaymentScreen> createState() => _CreditCardPaymentScreenState();
}

class _CreditCardPaymentScreenState extends State<CreditCardPaymentScreen> {
  static const _primaryPurple = Color(0xFF6C2BD9);
  static const _border = Color(0xFFE5E7EB);
  static const _red = Color(0xFFEF4444);

  final _amountCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  DateTime _paymentDate = DateTime.now();
  String? _selectedCardId;
  String? _selectedSourceAccountId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ccProvider = context.read<CreditCardProvider>();
      final accProvider = context.read<AccountProvider>();
      accProvider.loadAccounts();
      if (ccProvider.cards.isNotEmpty) {
        setState(() => _selectedCardId = ccProvider.selectedCard?.id ?? ccProvider.cards.first.id);
        _updateNote();
      }
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose(); _noteCtrl.dispose();
    super.dispose();
  }

  void _updateNote() {
    final mf = DateFormat('MM/yyyy');
    _noteCtrl.text = 'Thanh toán thẻ ${mf.format(_paymentDate)}';
  }

  CreditCard? get _selectedCard {
    final provider = context.read<CreditCardProvider>();
    if (_selectedCardId == null) return null;
    return provider.cards.where((c) => c.id == _selectedCardId).firstOrNull;
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _paymentDate, firstDate: DateTime(2020), lastDate: DateTime(2099));
    if (picked != null) { setState(() => _paymentDate = picked); _updateNote(); }
  }

  void _fillMaxAmount() {
    final card = _selectedCard;
    if (card != null && card.currentDebt != null) {
      final nf = NumberFormat('#,###', 'vi_VN');
      _amountCtrl.text = nf.format(card.currentDebt!.toInt());
      setState(() {});
    }
  }

  Future<void> _save() async {
    if (_selectedCardId == null) return;
    final amountText = _amountCtrl.text.replaceAll('.', '').replaceAll(',', '');
    final amount = double.tryParse(amountText) ?? 0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Vui lòng nhập số tiền')));
      return;
    }

    final provider = context.read<CreditCardProvider>();
    await provider.addPayment(
      cardId: _selectedCardId!,
      amount: amount,
      sourceAccountId: _selectedSourceAccountId ?? '',
      date: _paymentDate,
      note: _noteCtrl.text.trim().isEmpty ? null : _noteCtrl.text.trim(),
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Đã lưu thanh toán'), behavior: SnackBarBehavior.floating));
      Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final nf = NumberFormat('#,###', 'vi_VN');
    final df = DateFormat('dd/MM/yyyy');

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.black87), onPressed: () => Navigator.pop(context)),
        title: const Text('Thanh toán thẻ tín dụng', style: TextStyle(color: Colors.black87, fontSize: 16, fontWeight: FontWeight.bold)),
        centerTitle: true,
        actions: [
          TextButton.icon(onPressed: _save, icon: const Icon(Icons.save_outlined, size: 16, color: _primaryPurple), label: const Text('Lưu', style: TextStyle(color: _primaryPurple))),
        ],
      ),
      body: Consumer2<CreditCardProvider, AccountProvider>(
        builder: (context, ccProvider, accProvider, child) {
          final card = _selectedCard;
          final debt = card?.currentDebt ?? 0;
          // Source accounts: exclude credit card accounts
          final sourceAccounts = accProvider.accounts.where((a) => a.isActive && !a.id.startsWith('acc_cc_')).toList();

          return Column(children: [
            Expanded(child: SingleChildScrollView(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Select card
              Text('Chọn thẻ cần thanh toán', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _primaryPurple)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  // Card info
                  if (card != null) ...[
                    Container(width: 40, height: 40, decoration: BoxDecoration(color: _primaryPurple.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                      child: Center(child: Text(card.name.length > 2 ? card.name.substring(0, 2).toUpperCase() : card.name.toUpperCase(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: _primaryPurple)))),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(card.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      if (card.last4 != null) Text('**** ${card.last4}', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                    ])),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('Đã sử dụng (dư nợ)', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                      Text('-${nf.format(debt.toInt())} VND', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _red)),
                    ]),
                  ],
                  // Dropdown
                  PopupMenuButton<String>(
                    icon: Icon(Icons.keyboard_arrow_down, color: Colors.grey[600]),
                    onSelected: (id) => setState(() { _selectedCardId = id; }),
                    itemBuilder: (_) => ccProvider.cards.map((c) => PopupMenuItem(value: c.id, child: Text(c.name))).toList(),
                  ),
                ]),
              ),
              const SizedBox(height: 20),
              // Amount
              Text('Số tiền thanh toán', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _primaryPurple)),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: TextField(
                  controller: _amountCtrl, keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  decoration: InputDecoration(
                    prefixIcon: Container(
                      width: 32, margin: const EdgeInsets.only(left: 12, right: 8),
                      alignment: Alignment.center,
                      child: const Text('đ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _primaryPurple)),
                    ), prefixIconConstraints: const BoxConstraints(minWidth: 40),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _primaryPurple)),
                  ),
                )),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _fillMaxAmount,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(border: Border.all(color: _primaryPurple.withOpacity(0.5)), borderRadius: BorderRadius.circular(10)),
                    child: const Text('Thanh toán tối đa', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: _primaryPurple)),
                  ),
                ),
              ]),
              const SizedBox(height: 20),
              // Source account
              Text('Nguồn tiền thanh toán', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _primaryPurple)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
                child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                  value: _selectedSourceAccountId,
                  hint: const Text('Chọn tài khoản'),
                  isExpanded: true,
                  items: sourceAccounts.map((a) => DropdownMenuItem(value: a.id, child: Text(a.name))).toList(),
                  onChanged: (v) => setState(() => _selectedSourceAccountId = v),
                )),
              ),
              const SizedBox(height: 20),
              // Date
              Text('Ngày thanh toán', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _primaryPurple)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(border: Border.all(color: _border), borderRadius: BorderRadius.circular(10)),
                  child: Row(children: [Icon(Icons.calendar_today, size: 16, color: Colors.grey[600]), const SizedBox(width: 10), Text(df.format(_paymentDate), style: const TextStyle(fontSize: 14)), const Spacer(), Icon(Icons.keyboard_arrow_down, color: Colors.grey[600])]),
                ),
              ),
              const SizedBox(height: 20),
              // Note
              Text('Ghi chú (không bắt buộc)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: _primaryPurple)),
              const SizedBox(height: 8),
              TextField(
                controller: _noteCtrl,
                decoration: InputDecoration(
                  prefixIcon: Icon(Icons.note_outlined, size: 18, color: Colors.grey[500]),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                ),
              ),
            ]))),
            // Save button
            Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              SizedBox(width: double.infinity, height: 48, child: ElevatedButton.icon(
                onPressed: _save,
                icon: const Icon(Icons.save_outlined),
                label: const Text('Lưu', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                style: ElevatedButton.styleFrom(backgroundColor: _primaryPurple, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              )),
              const SizedBox(height: 8),
              Text('Sau khi lưu, dư nợ thẻ sẽ được giảm tương ứng và số dư tài khoản nguồn tiền sẽ được trừ.', style: TextStyle(fontSize: 10, color: Colors.grey[500]), textAlign: TextAlign.center),
            ])),
          ]);
        },
      ),
    );
  }
}
