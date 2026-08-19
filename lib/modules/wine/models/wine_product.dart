class WineProduct {
  final String id;
  final String sku;
  final String name;
  final String? shortName;
  final int? volumeMl;
  final String? wineType;
  final String? bottleType;
  final String? images; // comma-separated paths
  final String? note;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Joined/calculated
  final List<WineProductVariant>? variants;
  final Map<String, String>? customFields;

  WineProduct({
    required this.id,
    required this.sku,
    required this.name,
    this.shortName,
    this.volumeMl,
    this.wineType,
    this.bottleType,
    this.images,
    this.note,
    this.isActive = true,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.variants,
    this.customFields,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  List<String> get imageList {
    if (images == null || images!.isEmpty) return [];
    return images!.split(',').map((e) => e.trim()).toList();
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sku': sku,
      'name': name,
      'short_name': shortName,
      'volume_ml': volumeMl,
      'wine_type': wineType,
      'bottle_type': bottleType,
      'images': images,
      'note': note,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory WineProduct.fromMap(Map<String, dynamic> map) {
    return WineProduct(
      id: map['id'] as String,
      sku: map['sku'] as String? ?? '',
      name: map['name'] as String? ?? '',
      shortName: map['short_name'] as String?,
      volumeMl: map['volume_ml'] as int?,
      wineType: map['wine_type'] as String?,
      bottleType: map['bottle_type'] as String?,
      images: map['images'] as String?,
      note: map['note'] as String?,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.tryParse(map['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(map['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  WineProduct copyWith({
    String? id,
    String? sku,
    String? name,
    String? shortName,
    int? volumeMl,
    String? wineType,
    String? bottleType,
    String? images,
    String? note,
    bool? isActive,
    DateTime? createdAt,
    DateTime? updatedAt,
    List<WineProductVariant>? variants,
    Map<String, String>? customFields,
  }) {
    return WineProduct(
      id: id ?? this.id,
      sku: sku ?? this.sku,
      name: name ?? this.name,
      shortName: shortName ?? this.shortName,
      volumeMl: volumeMl ?? this.volumeMl,
      wineType: wineType ?? this.wineType,
      bottleType: bottleType ?? this.bottleType,
      images: images ?? this.images,
      note: note ?? this.note,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      variants: variants ?? this.variants,
      customFields: customFields ?? this.customFields,
    );
  }
}

class WineProductField {
  final String id;
  final String fieldName;
  final String fieldLabel;
  final String fieldType;
  final int sortOrder;
  final bool isRequired;
  final String? options;
  final DateTime createdAt;

  WineProductField({
    required this.id,
    required this.fieldName,
    required this.fieldLabel,
    this.fieldType = 'text',
    this.sortOrder = 0,
    this.isRequired = false,
    this.options,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'field_name': fieldName,
      'field_label': fieldLabel,
      'field_type': fieldType,
      'sort_order': sortOrder,
      'is_required': isRequired ? 1 : 0,
      'options': options,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WineProductField.fromMap(Map<String, dynamic> map) {
    return WineProductField(
      id: map['id'] as String,
      fieldName: map['field_name'] as String,
      fieldLabel: map['field_label'] as String,
      fieldType: map['field_type'] as String? ?? 'text',
      sortOrder: map['sort_order'] as int? ?? 0,
      isRequired: (map['is_required'] as int? ?? 0) == 1,
      options: map['options'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  WineProductField copyWith({
    String? id,
    String? fieldName,
    String? fieldLabel,
    String? fieldType,
    int? sortOrder,
    bool? isRequired,
    String? options,
  }) {
    return WineProductField(
      id: id ?? this.id,
      fieldName: fieldName ?? this.fieldName,
      fieldLabel: fieldLabel ?? this.fieldLabel,
      fieldType: fieldType ?? this.fieldType,
      sortOrder: sortOrder ?? this.sortOrder,
      isRequired: isRequired ?? this.isRequired,
      options: options ?? this.options,
    );
  }
}

class WineProductVariant {
  final String id;
  final String productId;
  final String variantOptionId;
  final int minStock;
  final bool isActive;
  final DateTime createdAt;

  // Joined fields
  final String? variantName; // e.g. "Đỏ"
  final String? variantTypeName; // e.g. "Màu sắc"
  final String? productName;
  final int? currentStock; // calculated

  WineProductVariant({
    required this.id,
    required this.productId,
    required this.variantOptionId,
    this.minStock = 0,
    this.isActive = true,
    DateTime? createdAt,
    this.variantName,
    this.variantTypeName,
    this.productName,
    this.currentStock,
  }) : createdAt = createdAt ?? DateTime.now();

  bool get isLowStock =>
      currentStock != null && minStock > 0 && currentStock! <= minStock;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'product_id': productId,
      'variant_option_id': variantOptionId,
      'min_stock': minStock,
      'is_active': isActive ? 1 : 0,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WineProductVariant.fromMap(Map<String, dynamic> map) {
    return WineProductVariant(
      id: map['id'] as String,
      productId: map['product_id'] as String,
      variantOptionId: map['variant_option_id'] as String,
      minStock: map['min_stock'] as int? ?? 0,
      isActive: (map['is_active'] as int? ?? 1) == 1,
      createdAt: DateTime.parse(map['created_at'] as String),
      variantName: map['variant_name'] as String?,
      variantTypeName: map['variant_type_name'] as String?,
      productName: map['product_name'] as String?,
      currentStock: map['current_stock'] as int?,
    );
  }

  WineProductVariant copyWith({
    String? id,
    String? productId,
    String? variantOptionId,
    int? minStock,
    bool? isActive,
    DateTime? createdAt,
    String? variantName,
    String? variantTypeName,
    String? productName,
    int? currentStock,
  }) {
    return WineProductVariant(
      id: id ?? this.id,
      productId: productId ?? this.productId,
      variantOptionId: variantOptionId ?? this.variantOptionId,
      minStock: minStock ?? this.minStock,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      variantName: variantName ?? this.variantName,
      variantTypeName: variantTypeName ?? this.variantTypeName,
      productName: productName ?? this.productName,
      currentStock: currentStock ?? this.currentStock,
    );
  }
}
