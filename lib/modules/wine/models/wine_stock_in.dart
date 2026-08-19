class WineStockIn {
  final String id;
  final DateTime date;
  final String? note;
  final String? images; // comma-separated paths
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<WineStockInItem>? items;

  WineStockIn({
    required this.id,
    required this.date,
    this.note,
    this.images,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.items,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  List<String> get imageList {
    if (images == null || images!.isEmpty) return [];
    return images!.split(',').map((e) => e.trim()).toList();
  }

  int get totalQuantity =>
      items?.fold(0, (sum, item) => sum! + item.quantity) ?? 0;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'date': date.toIso8601String(),
      'note': note,
      'images': images,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory WineStockIn.fromMap(Map<String, dynamic> map) {
    return WineStockIn(
      id: map['id'] as String,
      date: DateTime.parse(map['date'] as String),
      note: map['note'] as String?,
      images: map['images'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  WineStockIn copyWith({
    String? id,
    DateTime? date,
    String? note,
    String? images,
    List<WineStockInItem>? items,
  }) {
    return WineStockIn(
      id: id ?? this.id,
      date: date ?? this.date,
      note: note ?? this.note,
      images: images ?? this.images,
      items: items ?? this.items,
    );
  }
}

class WineStockInItem {
  final String id;
  final String stockInId;
  final String productVariantId;
  final int quantity;
  final int remainingQuantity; // for FIFO
  final String? note;
  final DateTime createdAt;

  // Joined
  final String? productName;
  final String? variantName;

  WineStockInItem({
    required this.id,
    required this.stockInId,
    required this.productVariantId,
    required this.quantity,
    int? remainingQuantity,
    this.note,
    DateTime? createdAt,
    this.productName,
    this.variantName,
  })  : remainingQuantity = remainingQuantity ?? quantity,
        createdAt = createdAt ?? DateTime.now();

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'stock_in_id': stockInId,
      'product_variant_id': productVariantId,
      'quantity': quantity,
      'remaining_quantity': remainingQuantity,
      'note': note,
      'created_at': createdAt.toIso8601String(),
    };
  }

  factory WineStockInItem.fromMap(Map<String, dynamic> map) {
    return WineStockInItem(
      id: map['id'] as String,
      stockInId: map['stock_in_id'] as String,
      productVariantId: map['product_variant_id'] as String,
      quantity: map['quantity'] as int? ?? 0,
      remainingQuantity: map['remaining_quantity'] as int? ?? 0,
      note: map['note'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      productName: map['product_name'] as String?,
      variantName: map['variant_name'] as String?,
    );
  }
}
