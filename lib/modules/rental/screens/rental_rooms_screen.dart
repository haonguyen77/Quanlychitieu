import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/rental_provider.dart';
import '../models/rental_models.dart';
import '../../../utils/formatters.dart';

class RentalRoomsScreen extends StatefulWidget {
  const RentalRoomsScreen({super.key});

  @override
  State<RentalRoomsScreen> createState() => _RentalRoomsScreenState();
}

class _RentalRoomsScreenState extends State<RentalRoomsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RentalProvider>().loadRooms();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Danh sách phòng')),
      body: Consumer<RentalProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) return const Center(child: CircularProgressIndicator());
          if (provider.rooms.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.apartment, size: 48, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  Text('Chưa có phòng nào', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.outline)),
                ],
              ),
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.rooms.length,
            itemBuilder: (context, index) => _buildRoomCard(context, provider.rooms[index]),
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showRoomForm(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildRoomCard(BuildContext context, RentalRoom room) {
    final isOccupied = room.isOccupied;
    final statusColor = isOccupied ? Colors.green : Colors.orange;
    final statusText = isOccupied ? 'Đang thuê' : 'Trống';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showRoomForm(context, room: room),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: statusColor.withValues(alpha: 0.1),
                child: Icon(Icons.apartment, color: statusColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(room.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(
                      'Tiền thuê: ${Formatters.currency(room.rentAmount)}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (room.currentTenantName != null)
                      Text(
                        'Khách: ${room.currentTenantName}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.green),
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w500)),
              ),
              const SizedBox(width: 8),
              PopupMenuButton<String>(
                onSelected: (value) {
                  if (value == 'delete') _confirmDelete(context, room);
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

  void _showRoomForm(BuildContext context, {RentalRoom? room}) {
    final nameCtrl = TextEditingController(text: room?.name ?? '');
    final rentCtrl = TextEditingController(text: room != null ? room.rentAmount.toStringAsFixed(0) : '');
    final noteCtrl = TextEditingController(text: room?.note ?? '');
    final isEditing = room != null;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 16, right: 16, top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(isEditing ? 'Sửa phòng' : 'Thêm phòng', style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 16),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(labelText: 'Tên phòng *', border: OutlineInputBorder()),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: rentCtrl,
                decoration: const InputDecoration(labelText: 'Tiền thuê mặc định', border: OutlineInputBorder(), suffixText: '₫'),
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
                    final provider = context.read<RentalProvider>();
                    final newRoom = RentalRoom(
                      id: room?.id ?? '',
                      name: nameCtrl.text.trim(),
                      rentAmount: double.tryParse(rentCtrl.text) ?? 0,
                      note: noteCtrl.text.trim().isEmpty ? null : noteCtrl.text.trim(),
                      createdAt: room?.createdAt ?? DateTime.now(),
                      updatedAt: DateTime.now(),
                    );
                    if (isEditing) {
                      provider.updateRoom(newRoom);
                    } else {
                      provider.addRoom(newRoom);
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
    );
  }

  void _confirmDelete(BuildContext context, RentalRoom room) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa phòng'),
        content: Text('Bạn có chắc muốn xóa "${room.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          FilledButton(
            onPressed: () {
              context.read<RentalProvider>().deleteRoom(room.id);
              Navigator.pop(ctx);
            },
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
