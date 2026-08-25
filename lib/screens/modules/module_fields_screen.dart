import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../models/app_module.dart';
import '../../providers/module_provider.dart';
import '../../utils/color_helper.dart';

class ModuleFieldsScreen extends StatefulWidget {
  final AppModule module;

  const ModuleFieldsScreen({super.key, required this.module});

  @override
  State<ModuleFieldsScreen> createState() => _ModuleFieldsScreenState();
}

class _ModuleFieldsScreenState extends State<ModuleFieldsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ModuleProvider>().selectModule(widget.module.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final color = ColorHelper.getColor(widget.module.color);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.module.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: () => _showFieldTypesInfo(context),
          ),
        ],
      ),
      body: Consumer<ModuleProvider>(
        builder: (context, provider, child) {
          final fields = provider.selectedModuleFields;

          if (fields.isEmpty) {
            return _buildEmptyState(context);
          }

          return ReorderableListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: fields.length,
            onReorder: (oldIndex, newIndex) {
              if (newIndex > oldIndex) newIndex--;
              final reordered = List<ModuleField>.from(fields);
              final item = reordered.removeAt(oldIndex);
              reordered.insert(newIndex, item);
              provider.reorderFields(reordered);
            },
            itemBuilder: (context, index) {
              final field = fields[index];
              return _FieldCard(
                key: ValueKey(field.id),
                field: field,
                color: color,
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddFieldDialog(context),
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
            Icons.view_column_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'Chưa có trường dữ liệu',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Nhấn + để thêm trường tùy chỉnh',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ],
      ),
    );
  }

  void _showFieldTypesInfo(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Kiểu dữ liệu'),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('• text: Văn bản tự do'),
            Text('• number: Số (tiền, số lượng)'),
            Text('• select: Chọn từ danh sách'),
            Text('• date: Ngày tháng'),
            Text('• boolean: Có/Không'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  void _showAddFieldDialog(BuildContext context, {ModuleField? editField}) {
    final nameController = TextEditingController(
      text: editField?.fieldLabel ?? '',
    );
    final optionsController = TextEditingController(
      text: editField?.options ?? '',
    );
    String selectedType = editField?.fieldType ?? 'text';
    bool isRequired = editField?.isRequired ?? false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  editField != null ? 'Sửa trường' : 'Thêm trường dữ liệu',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Tên trường',
                    hintText: 'Ví dụ: Tên khách, Tiền thuê...',
                  ),
                  autofocus: true,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: selectedType,
                  decoration: const InputDecoration(
                    labelText: 'Kiểu dữ liệu',
                  ),
                  items: const [
                    DropdownMenuItem(value: 'text', child: Text('Văn bản')),
                    DropdownMenuItem(value: 'number', child: Text('Số')),
                    DropdownMenuItem(value: 'select', child: Text('Danh sách')),
                    DropdownMenuItem(value: 'date', child: Text('Ngày')),
                    DropdownMenuItem(value: 'boolean', child: Text('Có/Không')),
                  ],
                  onChanged: (value) {
                    setSheetState(() => selectedType = value ?? 'text');
                  },
                ),
                if (selectedType == 'select') ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: optionsController,
                    decoration: const InputDecoration(
                      labelText: 'Tùy chọn (phân cách bằng dấu phẩy)',
                      hintText: 'Ví dụ: Đã TT, Chưa TT, Trễ hạn',
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SwitchListTile(
                  title: const Text('Bắt buộc'),
                  value: isRequired,
                  onChanged: (v) => setSheetState(() => isRequired = v),
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () async {
                      if (nameController.text.trim().isEmpty) return;
                      final provider = context.read<ModuleProvider>();
                      final fieldName = nameController.text
                          .trim()
                          .toLowerCase()
                          .replaceAll(' ', '_');

                      final field = ModuleField(
                        id: editField?.id ?? const Uuid().v4(),
                        moduleId: widget.module.id,
                        fieldName: fieldName,
                        fieldLabel: nameController.text.trim(),
                        fieldType: selectedType,
                        isRequired: isRequired,
                        options: selectedType == 'select'
                            ? optionsController.text.trim()
                            : null,
                      );

                      if (editField != null) {
                        await provider.updateField(field);
                      } else {
                        await provider.addField(field);
                      }
                      if (ctx.mounted) Navigator.pop(ctx);
                    },
                    child: Text(editField != null ? 'Cập nhật' : 'Thêm'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FieldCard extends StatelessWidget {
  final ModuleField field;
  final Color color;

  const _FieldCard({super.key, required this.field, required this.color});

  String get _typeLabel {
    switch (field.fieldType) {
      case 'text': return 'Văn bản';
      case 'number': return 'Số';
      case 'select': return 'Danh sách';
      case 'date': return 'Ngày';
      case 'boolean': return 'Có/Không';
      default: return field.fieldType;
    }
  }

  IconData get _typeIcon {
    switch (field.fieldType) {
      case 'text': return Icons.text_fields;
      case 'number': return Icons.pin;
      case 'select': return Icons.list;
      case 'date': return Icons.calendar_today;
      case 'boolean': return Icons.toggle_on_outlined;
      default: return Icons.help_outline;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(_typeIcon, color: color),
        title: Text(field.fieldLabel),
        subtitle: Row(
          children: [
            Text(_typeLabel),
            if (field.isRequired) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  'Bắt buộc',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.red,
                      ),
                ),
              ),
            ],
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 18),
              onPressed: () {
                final screenState = context
                    .findAncestorStateOfType<_ModuleFieldsScreenState>();
                screenState?._showAddFieldDialog(context, editField: field);
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Xóa trường'),
                    content: Text('Xóa "${field.fieldLabel}"?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Hủy'),
                      ),
                      FilledButton(
                        onPressed: () {
                          context
                              .read<ModuleProvider>()
                              .deleteField(field.id);
                          Navigator.pop(ctx);
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor:
                              Theme.of(context).colorScheme.error,
                        ),
                        child: const Text('Xóa'),
                      ),
                    ],
                  ),
                );
              },
            ),
            ReorderableDragStartListener(
              index: 0,
              child: const Icon(Icons.drag_handle),
            ),
          ],
        ),
      ),
    );
  }
}
