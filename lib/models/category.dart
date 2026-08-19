class Category {
  final String id;
  final String name;
  final String icon;
  final String color;
  final String? parentId;
  final int type; // 0 = expense, 1 = income
  final int sortOrder;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<Category>? children;

  Category({
    required this.id,
    required this.name,
    this.icon = 'other',
    this.color = '#2196F3',
    this.parentId,
    this.type = 0,
    this.sortOrder = 0,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.children,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  bool get isParent => parentId == null;
  bool get isChild => parentId != null;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      'color': color,
      'parent_id': parentId,
      'type': type,
      'sort_order': sortOrder,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory Category.fromMap(Map<String, dynamic> map) {
    return Category(
      id: map['id'] as String,
      name: map['name'] as String,
      icon: map['icon'] as String? ?? 'other',
      color: map['color'] as String? ?? '#2196F3',
      parentId: map['parent_id'] as String?,
      type: map['type'] as int? ?? 0,
      sortOrder: map['sort_order'] as int? ?? 0,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Category copyWith({
    String? id,
    String? name,
    String? icon,
    String? color,
    String? parentId,
    int? type,
    int? sortOrder,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<Category>? children,
  }) {
    return Category(
      id: id ?? this.id,
      name: name ?? this.name,
      icon: icon ?? this.icon,
      color: color ?? this.color,
      parentId: parentId ?? this.parentId,
      type: type ?? this.type,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      children: children ?? this.children,
    );
  }
}
