import 'package:flutter/material.dart' hide Category;
import 'package:provider/provider.dart';
import '../../models/category.dart';
import '../../providers/category_provider.dart';
import '../../utils/icon_helper.dart';
import '../../utils/color_helper.dart';
import '../../app/constants.dart';
import 'add_category_screen.dart';

class CategoriesScreen extends StatefulWidget {
  const CategoriesScreen({super.key});

  @override
  State<CategoriesScreen> createState() => _CategoriesScreenState();
}

class _CategoriesScreenState extends State<CategoriesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CategoryProvider>().loadCategories();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Danh mục'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Chi tiêu'),
            Tab(text: 'Thu nhập'),
          ],
        ),
      ),
      body: Consumer<CategoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          return TabBarView(
            controller: _tabController,
            children: [
              _CategoryList(
                categories: provider.expenseCategories,
                type: AppConstants.typeExpense,
              ),
              _CategoryList(
                categories: provider.incomeCategories,
                type: AppConstants.typeIncome,
              ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final type = _tabController.index == 0
              ? AppConstants.typeExpense
              : AppConstants.typeIncome;
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => AddCategoryScreen(type: type),
            ),
          );
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _CategoryList extends StatelessWidget {
  final List<Category> categories;
  final int type;

  const _CategoryList({
    required this.categories,
    required this.type,
  });

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.category_outlined,
              size: 64,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              'Chưa có danh mục',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: categories.length,
      itemBuilder: (context, index) {
        final category = categories[index];
        return _CategoryTile(category: category, type: type);
      },
    );
  }
}

class _CategoryTile extends StatelessWidget {
  final Category category;
  final int type;

  const _CategoryTile({required this.category, required this.type});

  @override
  Widget build(BuildContext context) {
    final hasChildren = category.children != null && category.children!.isNotEmpty;

    return Column(
      children: [
        ListTile(
          leading: CircleAvatar(
            backgroundColor: ColorHelper.getColor(category.color).withValues(alpha: 0.15),
            child: Icon(
              IconHelper.getIcon(category.icon),
              color: ColorHelper.getColor(category.color),
              size: 20,
            ),
          ),
          title: Text(
            category.name,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
          ),
          subtitle: hasChildren
              ? Text(
                  '${category.children!.length} danh mục con',
                  style: Theme.of(context).textTheme.bodySmall,
                )
              : null,
          trailing: PopupMenuButton<String>(
            onSelected: (value) => _handleMenuAction(context, value),
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
                value: 'add_child',
                child: ListTile(
                  leading: Icon(Icons.add),
                  title: Text('Thêm danh mục con'),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              const PopupMenuItem(
                value: 'delete',
                child: ListTile(
                  leading: Icon(Icons.delete_outline, color: Colors.red),
                  title: Text('Xóa', style: TextStyle(color: Colors.red)),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
            ],
          ),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => AddCategoryScreen(
                  type: type,
                  editCategory: category,
                ),
              ),
            );
          },
        ),
        // Children
        if (hasChildren)
          for (final child in category.children!) Padding(
                padding: const EdgeInsets.only(left: 32),
                child: ListTile(
                  dense: true,
                  leading: CircleAvatar(
                    radius: 16,
                    backgroundColor:
                        ColorHelper.getColor(child.color).withValues(alpha: 0.1),
                    child: Icon(
                      IconHelper.getIcon(child.icon),
                      color: ColorHelper.getColor(child.color),
                      size: 16,
                    ),
                  ),
                  title: Text(child.name),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.edit_outlined, size: 18),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => AddCategoryScreen(
                                type: type,
                                editCategory: child,
                                parentId: category.id,
                              ),
                            ),
                          );
                        },
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline,
                            size: 18, color: Colors.red),
                        onPressed: () => _confirmDelete(context, child),
                      ),
                    ],
                  ),
                ),
              ),
        if (hasChildren) const Divider(indent: 32),
      ],
    );
  }

  void _handleMenuAction(BuildContext context, String action) {
    switch (action) {
      case 'edit':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AddCategoryScreen(
              type: type,
              editCategory: category,
            ),
          ),
        );
        break;
      case 'add_child':
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AddCategoryScreen(
              type: type,
              parentId: category.id,
            ),
          ),
        );
        break;
      case 'delete':
        _confirmDelete(context, category);
        break;
    }
  }

  void _confirmDelete(BuildContext context, Category cat) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xóa danh mục'),
        content: Text('Bạn có chắc muốn xóa "${cat.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () {
              context.read<CategoryProvider>().deleteCategory(cat.id);
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Đã xóa "${cat.name}"'),
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
