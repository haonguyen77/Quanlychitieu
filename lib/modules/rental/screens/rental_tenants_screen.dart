import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/rental_provider.dart';
import '../models/rental_models.dart';
import '../../../utils/formatters.dart';

class RentalTenantsScreen extends StatefulWidget {
  const RentalTenantsScreen({super.key});

  @override
  State<RentalTenantsScreen> createState() => _RentalTenantsScreenState();
}

class _RentalTenantsScreenState extends State<RentalTenantsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<RentalProvider>();
      provider.loadTenants();
      provider.loadRooms();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Khách thuê')),
      body: Consumer<RentalProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) return const Center(child: CircularProgressIndicator());
          if (provider.tenants.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.people_outline, size: 48, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  Text('Chưa có khách thuê', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.tenants.length,
            itemBuilder: (context, index) => _buildTenantCard(context, provider.tenants[index], provider),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showTenantForm(context),
        child: const Icon(Icons.person_add),
      ),
    );
  }

  Widget _buildTenantCard(BuildContext context, RentalTenant tenant, RentalProvider provider) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showTenantForm(context, tenant: tenant),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: Colors.green.withValues(alpha: 0.1),
                child: const Icon(Icons.person, color: Colors.green, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tenant.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    if (tenant.phone != null && tenant.phone!.isNotEmpty)
                      Text('SĐT: ${tenant.phone}', style: Theme.of(context).textTheme.bodySmall),
                    if (tenant.roomName != null)
                      Text('Phòng: ${tenant.roomName}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.blue)),
                    if (tenant.moveInDate != null)
                      Text('Vào: ${Formatters.date(tenant.moveInDate!)}', style: Theme.of(context).textTheme.bodySmall),
                    if (tenant.deposit > 0)
                      Text('Cọc: ${Formatters.currency(tenant.deposit)}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.green)),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'delete') _confirmDelete(context, tenant);
                },
                itemBuilder: (context) => [
                  const PopupMenuItem(value: 'delete', child: Text('Xóa')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTenantForm(BuildContext context, {RentalTenant? tenant}) {
    final provider = context.read<RentalProvider>();
    final nameCtrl = TextEditingController(text: tenant?.name ?? '');
    final phoneCtrl = TextEditingController(text: tenant?.phone ?? '');
    final idNumberCtrl = TextEditingController(text: tenant?.idNumber ?? '');
    final depositCtrl = TextEditingController(text: tenant != null && tenant.deposit > 0 ? tenant.deposit.toStringAsFixed(0) : '');
    final noteCtrl = TextEditingController(text: tenant?.note ?? '');
    final isEditing = tenant != null;

    String? selectedRoomId = tenant?.roomId;
    DateTime? moveInDate = tenant?.moveInDate;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16, right: 16, top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(isEditing ? 'Sửa khách thuê' : 'Thêm khách thuê', style: Theme.of(ctx).textTheme.titleLarge),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Tên khách *', border: OutlineInputBorder()),
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phoneCtrl,
                  decoration: const InputDecoration(labelText: 'Số điện thoại', border: OutlineInputBorder()),
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: idNumberCtrl,
                  decoration: const InputDecoration(labelText: 'CMND/CCCD', border: OutlineInputBorder()),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedRoomId,
                  decoration: const InputDecoration(labelText: 'Phòng', border: OutlineInputBorder()),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('-- Chưa chọn --')),
                    ...provider.activeRooms.map((r) => DropdownMenuItem(value: r.id, child: Text(r.name))),
                  ],
                  onChanged: (value) => setModalState(() => selectedRoomId = value),
                ),
                const SizedBox(height: 12),
                InkWell(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: moveInDate ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) setModalState(() => moveInDate = picked);
                  },
                  child: InputDecorator(
                    decoration: const InputDecoration(labelText: 'Ngày vào ở', border: OutlineInputBorder()),
                    child: Text(moveInDate != null ? Formatters.date(moveInDate!) : 'Chọn ngày'),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: depositCtrl,
                  decoration: const InputDecoration(labelText: 'Tiền cọc', border: OutlineInputBorder(), suffixText: '₫'),
                  keyboardType: TextInputType.number,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: noteCtrl,
                  decoration: const InputDecoration(labelText: 'Ghi chú', border: OutlineInputBorder()),
                  maxLines: 2,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () {
                      if (nameCtrl.text.trim().isEmpty) return;
                      final newTenant = RentalTenant(
                        id: tenant?.id ?? '',
                        roomId: selectedRoomId,
                        name: nameCtrl.text.trim(),
                        phone: phoneCtrl.text.trim().isEmpty ? null : phoneCtrl.text.trim(),
                        idNumber: idNumberCtrl.text.trim().isEmpty ? null : idNumberCtrl.text.trim(),
                        moveInDate: moveInDate,
                        deposit: double.tryParse(depositCtrl.text) ?? 0,
                        note: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
                        createdAt: tenant?.createdAt ?? DateTime.now(),
                        updatedAt: DateTime.now(),
                      );
                      if (isEditing) {
                        provider.updateTenant(newTenant);
                      } else {
                        provider.addTenant(newTenant);
                      }
                      Navigator.pop(ctx);
                    },
                    child: Text(isEditing ? 'Cập nhật' : 'Thêm'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmDelete(BuildContext context, RentalTenant tenant) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa khách thuê'),
        content: Text('Bạn có chắc muốn xóa "${tenant.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              context.read<RentalProvider>().deleteTenant(tenant.id);
              Navigator.pop(ctx);
            },
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
