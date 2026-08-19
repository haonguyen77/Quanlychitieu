import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/app_module.dart';
import '../../providers/module_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import 'add_module_screen.dart';
import 'module_fields_screen.dart';

class ModulesScreen extends StatefulWidget {
  const ModulesScreen({super.key});

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ModuleProvider>().loadModules();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Module'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => _showInfoDialog(context),
          ),
        ],
      ),
      body: Consumer<ModuleProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.modules.isEmpty) {
            return _buildEmptyState(context);
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.modules.length,
            itemBuilder: (context, index) {
              final module = provider.modules[index];
              return _ModuleCard(module: module);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const AddModuleScreen(),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.widgets_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'Chưa có module nào',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ],
      ),
    );
  }

  void _showInfoDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Module là gì?'),
        content: const Text(
          'Module cho phép bạn phân loại giao dịch theo nhóm riêng biệt.\n\n'
          'Ví dụ: Chi tiêu, Shopee, Vàng, Nhà trọ...\n\n'
          'Mỗi module có thể có các trường dữ liệu riêng (cột tùy chỉnh). '
          'Bạn có thể tự tạo, sửa, xóa module mà không cần cập nhật ứng dụng.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đã hiểu'),
          ),
        ],
      ),
    );
  }
}

class _ModuleCard extends StatelessWidget {
  final AppModule module;

  const _ModuleCard({required this.module});

  @override
  Widget build(BuildContext context) {
    final color = ColorHelper.getColor(module.color);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => ModuleFieldsScreen(module: module),
            ),
          );
        },
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: color.withValues(alpha: 0.15),
                child: Icon(
                  IconHelper.getIcon(module.icon),
                  color: color,
                  size: 24,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          module.name,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (module.isDefault) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Mặc định',
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Nhấn để quản lý trường dữ liệu',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.outline,
                          ),
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                onSelected: (value) => _handleMenu(context, value),
                itemBuilder: (context) => [
                  const PopupMenuItem(
                    value: 'edit',
                    child: ListTile(
                      leading: Icon(Icons.edit_outlined),
                      title: Text('Sửa'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'fields',
                    child: ListTile(
                      leading: Icon(Icons.view_column_outlined),
                      title: Text('Trường dữ liệu'),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                  if (!module.isDefault)
                    const PopupMenuItem(
                      value: 'delete',
                      child: ListTile(
                        leading: Icon(Icons.delete_outline, color: Colors.red),
                        title:
                            Text('Xóa', style: TextStyle(color: Colors.red)),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _handleMenu(BuildContext context, String action) {
    switch (action) {
      case 'edit':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AddModuleScreen(editModule: module),
          ),
        );
        break;
      case 'fields':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => ModuleFieldsScreen(module: module),
          ),
        );
        break;
      case 'delete':
        _confirmDelete(context);
        break;
    }
  }

  void _confirmDelete(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa module'),
        content: Text(
          'Bạn có chắc muốn xóa "${module.name}"?\n\n'
          'Các giao dịch thuộc module này sẽ không bị xóa.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              context.read<ModuleProvider>().deleteModule(module.id);
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Đã xóa "${module.name}"'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );
  }
}
