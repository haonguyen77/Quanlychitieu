import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/wine_data_provider.dart';
import 'wine_customer_detail_screen.dart';

/// Wine Customers Screen — reads from records table (mod_ruou_customers).
class WineCustomersScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const WineCustomersScreen({super.key, this.onBack});

  @override
  State<WineCustomersScreen> createState() => _WineCustomersScreenState();
}

class _WineCustomersScreenState extends State<WineCustomersScreen> {
  static const _purple = Color(0xFF6C2BD9);
  static const _navy = Color(0xFF101B4D);
  static const _border = Color(0xFFE5E7EB);
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<WineDataProvider>().loadCustomers());
  }

  @override
  void dispose() { _searchCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: widget.onBack != null ? IconButton(icon: const Icon(Icons.arrow_back, color: _navy), onPressed: widget.onBack) : null,
        title: const Text('Khách hàng', style: TextStyle(color: _navy, fontWeight: FontWeight.bold)),
      ),
      body: Consumer<WineDataProvider>(
        builder: (context, provider, _) {
          final query = _searchCtrl.text.toLowerCase();
          final customers = query.isEmpty ? provider.customers : provider.customers.where((c) {
            final name = (c['full_name'] as String? ?? '').toLowerCase();
            final phone = (c['phone'] as String? ?? '').toLowerCase();
            return name.contains(query) || phone.contains(query);
          }).toList();

          return Column(children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                controller: _searchCtrl, onChanged: (_) => setState(() {}),
                decoration: InputDecoration(hintText: 'Tìm khách hàng...', prefixIcon: const Icon(Icons.search, size: 20),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: _border)),
                  isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
              ),
            ),
            Expanded(
              child: customers.isEmpty
                  ? const Center(child: Text('Chưa có khách hàng'))
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      itemCount: customers.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        final c = customers[i];
                        final address = [c['address'], c['district'], c['city']].where((s) => s != null && s.toString().isNotEmpty).join(', ');
                        return ListTile(
                          leading: CircleAvatar(backgroundColor: _purple.withOpacity(0.1), child: Icon(Icons.person, color: _purple, size: 20)),
                          title: Text(c['full_name'] as String? ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                          subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if ((c['phone'] as String? ?? '').isNotEmpty) Text('📞 ${c['phone']}', style: TextStyle(fontSize: 11, color: Colors.blue[600])),
                            if (address.isNotEmpty) Text('📍 $address', style: TextStyle(fontSize: 11, color: Colors.grey[600])),
                            Text('Đơn: ${c['total_orders'] ?? 0}', style: TextStyle(fontSize: 10, color: Colors.grey[500])),
                          ]),
                          trailing: IconButton(icon: const Icon(Icons.edit, size: 18, color: _purple), onPressed: () => _editCustomer(c)),
                          onTap: () => _openCustomerDetail(c),
                        );
                      },
                    ),
            ),
          ]);
        },
      ),
    );
  }

  void _addCustomer() async {
    final result = await _showForm(null);
    if (result != null) await context.read<WineDataProvider>().addCustomer(result);
  }

  void _openCustomerDetail(Map<String, dynamic> customer) async {
    await Navigator.push(context, MaterialPageRoute(
      builder: (_) => WineCustomerDetailScreen(customer: customer),
    ));
    // Reload after potential delete
    context.read<WineDataProvider>().loadCustomers();
  }

  void _editCustomer(Map<String, dynamic> customer) async {
    final result = await _showForm(customer);
    if (result != null) await context.read<WineDataProvider>().updateCustomer(customer['id'] as String, result);
  }

  Future<Map<String, dynamic>?> _showForm(Map<String, dynamic>? existing) {
    final nameCtrl = TextEditingController(text: existing?['full_name'] as String? ?? '');
    final phoneCtrl = TextEditingController(text: existing?['phone'] as String? ?? '');
    final addrCtrl = TextEditingController(text: existing?['address'] as String? ?? '');
    final districtCtrl = TextEditingController(text: existing?['district'] as String? ?? '');
    final cityCtrl = TextEditingController(text: existing?['city'] as String? ?? '');
    final noteCtrl = TextEditingController(text: existing?['note'] as String? ?? '');

    const purple = Color(0xFF6C2BD9);
    const purpleLight = Color(0xFFF3EAFF);
    const navy = Color(0xFF101B4D);

    Widget styledField({required TextEditingController controller, required String label, required IconData icon, TextInputType? keyboardType}) {
      return TextField(
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(fontSize: 14),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(fontSize: 13, color: Colors.grey[600]),
          prefixIcon: Container(margin: const EdgeInsets.only(left: 12, right: 8), child: Icon(icon, size: 18, color: purple)),
          prefixIconConstraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          filled: true,
          fillColor: purpleLight.withOpacity(0.3),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: purple, width: 1.5)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      );
    }

    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  existing != null ? 'Sửa khách hàng' : 'Thêm khách hàng',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: navy),
                ),
                const SizedBox(height: 20),
                styledField(controller: nameCtrl, label: 'Họ tên *', icon: Icons.person_outline),
                const SizedBox(height: 12),
                styledField(controller: phoneCtrl, label: 'SĐT', icon: Icons.phone_outlined, keyboardType: TextInputType.phone),
                const SizedBox(height: 12),
                styledField(controller: addrCtrl, label: 'Địa chỉ', icon: Icons.location_on_outlined),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: styledField(controller: districtCtrl, label: 'Phường/Xã', icon: Icons.map_outlined)),
                    const SizedBox(width: 10),
                    Expanded(child: styledField(controller: cityCtrl, label: 'Thành phố', icon: Icons.location_city_outlined)),
                  ],
                ),
                const SizedBox(height: 12),
                styledField(controller: noteCtrl, label: 'Ghi chú', icon: Icons.notes_outlined),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(ctx),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          side: BorderSide(color: Colors.grey[300]!),
                        ),
                        child: Text('Hủy', style: TextStyle(color: Colors.grey[600], fontWeight: FontWeight.w500)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          if (nameCtrl.text.trim().isEmpty) return;
                          Navigator.pop(ctx, {
                            'mod_ruou_customers_full_name': nameCtrl.text.trim(),
                            'mod_ruou_customers_phone': phoneCtrl.text.trim(),
                            'mod_ruou_customers_address': addrCtrl.text.trim(),
                            'mod_ruou_customers_district': districtCtrl.text.trim(),
                            'mod_ruou_customers_city': cityCtrl.text.trim(),
                            'mod_ruou_customers_total_orders': existing?['total_orders'] ?? 0,
                            'mod_ruou_customers_last_order_date': existing?['last_order_date'] ?? '',
                            'mod_ruou_customers_note': noteCtrl.text.trim(),
                          });
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: purple,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Lưu', style: TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
