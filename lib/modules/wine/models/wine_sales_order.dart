class WineSalesOrder {
  final String id;
  final DateTime date;
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final String? customerAddress;
  final String? customerDistrict;
  final String? customerCity;
  final double shippingFee;
  final double totalAmount;
  final String? note1;
  final String? note2;
  final String? images;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<WineSalesOrderItem>? items;

  WineSalesOrder({
    required this.id,
    required this.date,
    this.customerId,
    this.customerName,
    this.customerPhone,
    this.customerAddress,
    this.customerDistrict,
    this.customerCity,
    this.shippingFee = 0,
    this.totalAmount = 0,
    this.note1,
    this.note2,
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

  double get itemsTotal =>
      items?.fold(0.0, (sum, item) => sum! + item.lineTotal) ?? 0;

  double get calculatedTotal => itemsTotal + shippingFee;

  int get totalItems =>
      items?.fold(0, (sum, item) => sum! + item.quantity) ?? 0;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'date': date.toIso8601String(),
      'customer_id': customerId,
      'customer_name': customerName,
      'customer_phone': customerPhone,
      'customer_address': customerAddress,
      'customer_district': customerDistrict,
      'customer_city': customerCity,
      'shipping_fee': shippingFee,
      'total_amount': totalAmount,
      'note1': note1,
      'note2': note2,
      'images': images,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  factory WineSalesOrder.fromMap(Map<String, dynamic> map) {
    return WineSalesOrder(
      id: map['id'] as String,
      date: DateTime.tryParse(map['date'] as String? ?? '') ?? DateTime.now(),
      customerId: map['customer_id'] as String?,
      customerName: map['customer_name'] as String?,
      customerPhone: map['customer_phone'] as String?,
      customerAddress: map['customer_address'] as String?,
      customerDistrict: map['customer_district'] as String?,
      customerCity: map['customer_city'] as String?,
      shippingFee: (map['shipping_fee'] as num?)?.toDouble() ?? 0,
      totalAmount: (map['total_amount'] as num?)?.toDouble() ?? 0,
      note1: map['note1'] as String?,
      note2: map['note2'] as String?,
      images: map['images'] as String?,
      createdAt: DateTime.tryParse(map['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(map['updated_at'] as String? ?? '') ?? DateTime.now(),
    );
  }

  WineSalesOrder copyWith({
    String? id,
    DateTime? date,
    String? customerId,
    String? customerName,
    String? customerPhone,
    String? customerAddress,
    String? customerDistrict,
    String? customerCity,
    double? shippingFee,
    double? totalAmount,
    String? note1,
    String? note2,
    String? images,
    List<WineSalesOrderItem>? items,
  }) {
    return WineSalesOrder(
      id: id ?? this.id,
      date: date ?? this.date,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      customerAddress: customerAddress ?? this.customerAddress,
      customerDistrict: customerDistrict ?? this.customerDistrict,
      customerCity: customerCity ?? this.customerCity,
      shippingFee: shippingFee ?? this.shippingFee,
      totalAmount: totalAmount ?? this.totalAmount,
      note1: note1 ?? this.note1,
      note2: note2 ?? this.note2,
      images: images ?? this.images,
      items: items ?? this.items,
    );
  }
}

class WineSalesOrderItem {
  final String id;
  final String salesOrderId;
  final String productVariantId;
  final int quantity;
  final double price;
  final int hasGlass; // 1 = có ly, 0 = không
  final int hasBox;   // 1 = có hộp, 0 = không
  final String? note;

  // Joined
  final String? productName;
  final String? variantName;

  WineSalesOrderItem({
    required this.id,
    required this.salesOrderId,
    required this.productVariantId,
    required this.quantity,
    required this.price,
    this.hasGlass = 0,
    this.hasBox = 0,
    this.note,
    this.productName,
    this.variantName,
  });

  double get lineTotal => quantity * price;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'sales_order_id': salesOrderId,
      'product_variant_id': productVariantId,
      'quantity': quantity,
      'price': price,
      'has_glass': hasGlass,
      'has_box': hasBox,
      'note': note,
    };
  }

  factory WineSalesOrderItem.fromMap(Map<String, dynamic> map) {
    // Support both old TEXT columns and new INTEGER columns (migration compat)
    int parseGlass(Map<String, dynamic> m) {
      // New installs or migrated: has_glass is INTEGER
      if (m['has_glass'] is int) return m['has_glass'] as int;
      // Migrated DB uses has_glass_int
      if (m['has_glass_int'] is int) return m['has_glass_int'] as int;
      // Old TEXT column: treat non-empty/non-zero as 1
      final v = m['has_glass'] as String?;
      if (v == null || v.isEmpty || v == '0') return 0;
      return 1;
    }
    int parseBox(Map<String, dynamic> m) {
      if (m['has_box'] is int) return m['has_box'] as int;
      if (m['has_box_int'] is int) return m['has_box_int'] as int;
      final v = m['has_box'] as String?;
      if (v == null || v.isEmpty || v == '0') return 0;
      return 1;
    }

    return WineSalesOrderItem(
      id: map['id'] as String,
      salesOrderId: map['sales_order_id'] as String,
      productVariantId: map['product_variant_id'] as String,
      quantity: map['quantity'] as int? ?? 0,
      price: (map['price'] as num?)?.toDouble() ?? 0,
      hasGlass: parseGlass(map),
      hasBox: parseBox(map),
      note: map['note'] as String?,
      productName: map['product_name'] as String?,
      variantName: map['variant_name'] as String?,
    );
  }

  WineSalesOrderItem copyWith({
    String? id,
    String? salesOrderId,
    String? productVariantId,
    int? quantity,
    double? price,
    int? hasGlass,
    int? hasBox,
    String? note,
    String? productName,
    String? variantName,
  }) {
    return WineSalesOrderItem(
      id: id ?? this.id,
      salesOrderId: salesOrderId ?? this.salesOrderId,
      productVariantId: productVariantId ?? this.productVariantId,
      quantity: quantity ?? this.quantity,
      price: price ?? this.price,
      hasGlass: hasGlass ?? this.hasGlass,
      hasBox: hasBox ?? this.hasBox,
      note: note ?? this.note,
      productName: productName ?? this.productName,
      variantName: variantName ?? this.variantName,
    );
  }
}
