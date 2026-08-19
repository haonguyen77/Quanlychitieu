class WineVariantType {
  final String id;
  final String name;
  final int sortOrder;
  final bool isActive;
  final DateTime createdAt;
  final List<WineVariantOption>? options;

  WineVariantType({
    required this.id,
    required this.name,
    this.sortOrder = 0,
    this.isActive = true,
    DateTime? createdAt,
    this.options,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'sort_order': sortOrder,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WineVariantType.fromMap(Map<String, dynamic> map) {
    return WineVariantType(
      id: map['id'] as String,
      name: map['name'] as String,
      sortOrder: map['sort_order'] as int? ?? 0,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  WineVariantType copyWith({
    String? id,
    String? name,
    int? sortOrder,
    bool? isActive,
    List<WineVariantOption>? options,
  }) {
    return WineVariantType(
      id: id ?? this.id,
      name: name ?? this.name,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
      options: options ?? this.options,
    );
  }
}

class WineVariantOption {
  final String id;
  final String variantTypeId;
  final String name;
  final int sortOrder;
  final bool isActive;
  final DateTime createdAt;

  WineVariantOption({
    required this.id,
    required this.variantTypeId,
    required this.name,
    this.sortOrder = 0,
    this.isActive = true,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'variant_type_id': variantTypeId,
      'name': name,
      'sort_order': sortOrder,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WineVariantOption.fromMap(Map<String, dynamic> map) {
    return WineVariantOption(
      id: map['id'] as String,
      variantTypeId: map['variant_type_id'] as String,
      name: map['name'] as String,
      sortOrder: map['sort_order'] as int? ?? 0,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  WineVariantOption copyWith({
    String? id,
    String? variantTypeId,
    String? name,
    int? sortOrder,
    bool? isActive,
  }) {
    return WineVariantOption(
      id: id ?? this.id,
      variantTypeId: variantTypeId ?? this.variantTypeId,
      name: name ?? this.name,
      sortOrder: sortOrder ?? this.sortOrder,
      isActive: isActive ?? this.isActive,
    );
  }
}
