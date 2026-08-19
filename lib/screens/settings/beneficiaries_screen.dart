import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/beneficiary.dart';
import '../../providers/beneficiary_provider.dart';

class BeneficiariesScreen extends StatefulWidget {
  const BeneficiariesScreen({super.key});

  @override
  State<BeneficiariesScreen> createState() => _BeneficiariesScreenState();
}

class _BeneficiariesScreenState extends State<BeneficiariesScreen> {
  static const _green = Color(0xFF2E7D32);
  static const _darkText = Color(0xFF1A1A1A);

  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<BeneficiaryProvider>().loadBeneficiaries();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Beneficiary> get _filteredList {
    final provider = context.read<BeneficiaryProvider>();
    if (_searchQuery.isEmpty) return provider.beneficiaries;
    final q = _searchQuery.toLowerCase();
    return provider.beneficiaries.where((b) => b.name.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _darkText),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Người nhận', style: TextStyle(color: _darkText, fontSize: 18, fontWeight: FontWeight.w600)),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: _green),
            onPressed: () => _showAddEditDialog(null),
          ),
        ],
      ),
      body: Consumer<BeneficiaryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return Column(
            children: [
              // Search bar
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _searchQuery = value),
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm người nhận...',
                    hintStyle: TextStyle(fontSize: 14, color: Colors.grey[400]),
                    prefixIcon: Icon(Icons.search, size: 20, color: Colors.grey[400]),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[300]!)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey[200]!)),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _green)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    filled: true,
                    fillColor: const Color(0xFFF5F5F5),
                  ),
                ),
              ),
              // List
              Expanded(
                child: _filteredList.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.person_outline, size: 48, color: Colors.grey[300]),
                            const SizedBox(height: 12),
                            Text(
                              _searchQuery.isNotEmpty ? 'Không tìm thấy' : 'Chưa có người nhận',
                              style: TextStyle(fontSize: 14, color: Colors.grey[500]),
                            ),
                            if (_searchQuery.isEmpty) ...[
                              const SizedBox(height: 8),
                              TextButton.icon(
                                onPressed: () => _showAddEditDialog(null),
                                icon: const Icon(Icons.add, size: 16, color: _green),
                                label: const Text('Thêm người nhận', style: TextStyle(color: _green)),
                              ),
                            ],
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        itemCount: _filteredList.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final item = _filteredList[index];
                          return _buildBeneficiaryCard(item);
                        },
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildBeneficiaryCard(Beneficiary item) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: CircleAvatar(
          backgroundColor: item.isActive ? _green.withOpacity(0.1) : Colors.grey[100],
          child: Icon(Icons.person, size: 20, color: item.isActive ? _green : Colors.grey[400]),
        ),
        title: Text(
          item.name,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: item.isActive ? _darkText : Colors.grey[500],
            decoration: item.isActive ? null : TextDecoration.lineThrough,
          ),
        ),
        subtitle: Text(
          item.isActive ? 'Đang sử dụng' : 'Đã ẩn',
          style: TextStyle(fontSize: 12, color: item.isActive ? _green : Colors.grey[400]),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Switch(
              value: item.isActive,
              onChanged: (value) {
                context.read<BeneficiaryProvider>().toggleActive(item.id, value);
              },
              activeColor: _green,
            ),
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, size: 20, color: Colors.grey[500]),
              onSelected: (action) {
                if (action == 'edit') {
                  _showAddEditDialog(item);
                } else if (action == 'delete') {
                  _confirmDelete(item);
                }
              },
              itemBuilder: (_) => [
                const PopupMenuItem(value: 'edit', child: Row(children: [Icon(Icons.edit, size: 16), SizedBox(width: 8), Text('Sửa')])),
                const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete, size: 16, color: Colors.red), SizedBox(width: 8), Text('Xóa', style: TextStyle(color: Colors.red))])),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showAddEditDialog(Beneficiary? existing) {
    final controller = TextEditingController(text: existing?.name ?? '');
    final isEditing = existing != null;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(isEditing ? 'Sửa người nhận' : 'Thêm người nhận', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.words,
          decoration: InputDecoration(
            hintText: 'Nhập tên người nhận',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          ),
          onSubmitted: (_) => _save(ctx, controller, existing),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Hủy', style: TextStyle(color: Colors.grey[600])),
          ),
          FilledButton(
            onPressed: () => _save(ctx, controller, existing),
            style: FilledButton.styleFrom(backgroundColor: _green),
            child: Text(isEditing ? 'Lưu' : 'Thêm'),
          ),
        ],
      ),
    );
  }

  void _save(BuildContext ctx, TextEditingController controller, Beneficiary? existing) {
    final name = controller.text.trim();
    if (name.isEmpty) return;

    final provider = context.read<BeneficiaryProvider>();
    if (existing != null) {
      provider.updateBeneficiary(existing.copyWith(name: name, updatedAt: DateTime.now()));
    } else {
      final id = 'ben_${const Uuid().v4().substring(0, 8)}';
      provider.addBeneficiary(Beneficiary(id: id, name: name));
    }
    Navigator.pop(ctx);
  }

  void _confirmDelete(Beneficiary item) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Xóa người nhận', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        content: Text('Bạn có chắc muốn xóa "${item.name}"?\n\nCác giao dịch cũ vẫn giữ nguyên tên người nhận.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Hủy', style: TextStyle(color: Colors.grey[600])),
          ),
          FilledButton(
            onPressed: () {
              context.read<BeneficiaryProvider>().deleteBeneficiary(item.id);
              Navigator.pop(ctx);
            },
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
