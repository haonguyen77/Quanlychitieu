import 'dart:convert';

class Transaction {
  final String id;
  final int type; // 0 = expense, 1 = income
  final double amount;
  final String title;
  final String? note;
  final String? categoryId;
  final String? accountId;
  final String? moduleId;
  final DateTime date;
  final String? tags; // comma-separated
  final String? images; // comma-separated file paths
  final bool isDeleted;
  final DateTime? deletedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  // New fields for redesigned UI
  final String? beneficiary; // Người nhận (Của)
  final int quantity; // Số lượng
  final int? warrantyMonths; // Bảo hành (tháng)
  final DateTime? warrantyDate; // Ngày hết hạn bảo hành
  final String? event; // Sự kiện
  final String? store; // Cửa hàng

  // Joined fields (not stored in DB directly)
  final String? categoryName;
  final String? accountName;
  final String? moduleName;
  final Map<String, String>? customFieldValues;

  Transaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.title,
    this.note,
    this.categoryId,
    this.accountId,
    this.moduleId,
    required this.date,
    this.tags,
    this.images,
    this.isDeleted = false,
    this.deletedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    this.beneficiary,
    this.quantity = 1,
    this.warrantyMonths,
    this.warrantyDate,
    this.event,
    this.store,
    this.categoryName,
    this.accountName,
    this.moduleName,
    this.customFieldValues,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  bool get isExpense => type == 0;
  bool get isIncome => type == 1;

  List<String> get tagList {
    if (tags == null || tags!.isEmpty) return [];
    return tags!.split(',').map((e) => e.trim()).toList();
  }

  List<String> get imageList {
    if (images == null || images!.isEmpty) return [];
    return images!.split(',').map((e) => e.trim()).toList();
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'amount': amount,
      'title': title,
      'note': note,
      'category_id': categoryId,
      'account_id': accountId,
      'module_id': moduleId,
      'date': date.toIso8601String(),
      'tags': tags,
      'images': images,
      'is_deleted': isDeleted ? 1 : 0,
      'deleted_at': deletedAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'beneficiary': beneficiary,
      'quantity': quantity,
      'warranty_months': warrantyMonths,
      'warranty_date': warrantyDate?.toIso8601String(),
      'event': event,
      'store': store,
    };
  }

  factory Transaction.fromMap(Map<String, dynamic> map) {
    return Transaction(
      id: map['id'] as String,
      type: map['type'] as int? ?? 0,
      amount: (map['amount'] as num?)?.toDouble() ?? 0,
      title: map['title'] as String,
      note: map['note'] as String?,
      categoryId: map['category_id'] as String?,
      accountId: map['account_id'] as String?,
      moduleId: map['module_id'] as String?,
      date: DateTime.parse(map['date'] as String),
      tags: map['tags'] as String?,
      images: map['images'] as String?,
      isDeleted: (map['is_deleted'] as int? ?? 0) == 1,
      deletedAt: map['deleted_at'] != null
          ? DateTime.parse(map['deleted_at'] as String)
          : null,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
      beneficiary: map['beneficiary'] as String?,
      quantity: map['quantity'] as int? ?? 1,
      warrantyMonths: map['warranty_months'] as int?,
      warrantyDate: map['warranty_date'] != null
          ? DateTime.parse(map['warranty_date'] as String)
          : null,
      event: map['event'] as String?,
      store: map['store'] as String?,
      categoryName: map['category_name'] as String?,
      accountName: map['account_name'] as String?,
      moduleName: map['module_name'] as String?,
    );
  }

  Transaction copyWith({
    String? id,
    int? type,
    double? amount,
    String? title,
    String? note,
    String? categoryId,
    String? accountId,
    String? moduleId,
    DateTime? date,
    String? tags,
    String? images,
    bool? isDeleted,
    DateTime? deletedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? beneficiary,
    int? quantity,
    int? warrantyMonths,
    DateTime? warrantyDate,
    String? event,
    String? store,
    String? categoryName,
    String? accountName,
    String? moduleName,
    Map<String, String>? customFieldValues,
  }) {
    return Transaction(
      id: id ?? this.id,
      type: type ?? this.type,
      amount: amount ?? this.amount,
      title: title ?? this.title,
      note: note ?? this.note,
      categoryId: categoryId ?? this.categoryId,
      accountId: accountId ?? this.accountId,
      moduleId: moduleId ?? this.moduleId,
      date: date ?? this.date,
      tags: tags ?? this.tags,
      images: images ?? this.images,
      isDeleted: isDeleted ?? this.isDeleted,
      deletedAt: deletedAt ?? this.deletedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      beneficiary: beneficiary ?? this.beneficiary,
      quantity: quantity ?? this.quantity,
      warrantyMonths: warrantyMonths ?? this.warrantyMonths,
      warrantyDate: warrantyDate ?? this.warrantyDate,
      event: event ?? this.event,
      store: store ?? this.store,
      categoryName: categoryName ?? this.categoryName,
      accountName: accountName ?? this.accountName,
      moduleName: moduleName ?? this.moduleName,
      customFieldValues: customFieldValues ?? this.customFieldValues,
    );
  }

  /// Create a Transaction from the new unified records table row.
  /// Extracts display values from values_json using field name suffixes.
  factory Transaction.fromRecord(Map<String, dynamic> row) {
    // ignore: avoid_dynamic_calls
    Map<String, dynamic> values = {};
    try {
      final vjson = row['values_json'] as String? ?? '{}';
      values = (Map<String, dynamic>.from(
        const JsonDecoder().convert(vjson) as Map,
      ));
    } catch (_) {}

    // Determine effective module for display
    final moduleId = row['module_id'] as String? ?? '';
    final linkedModuleId = row['linked_module_id'] as String?;
    final effectiveModule = (linkedModuleId != null && linkedModuleId.isNotEmpty) ? linkedModuleId : moduleId;

    // Extract values by suffix (works regardless of prefix)
    String _findStr(String suffix, {String fallback = ''}) {
      for (final key in values.keys) {
        if (key.endsWith('_$suffix')) {
          final v = values[key];
          if (v != null && v.toString().isNotEmpty) return v.toString();
        }
      }
      return fallback;
    }
    double _findNum(String suffix) {
      for (final key in values.keys) {
        if (key.endsWith('_$suffix')) {
          final v = values[key];
          if (v is num) return v.toDouble();
          if (v is String) return double.tryParse(v) ?? 0;
        }
      }
      return 0;
    }

    // Title: try multiple common suffixes
    String title = '';
    for (final s in ['title', 'order_name', 'card_name', 'product_name', 'full_name', 'customer_name', 'room_name']) {
      title = _findStr(s);
      if (title.isNotEmpty) break;
    }
    if (title.isEmpty) title = effectiveModule;

    // Amount: try amount, total_amount, total
    double amount = _findNum('amount');
    if (amount == 0) amount = _findNum('total_amount');
    if (amount == 0) amount = _findNum('total');

    // Type
    final typeStr = _findStr('type');
    int type = 0;
    if (typeStr == '1' || typeStr == 'sell') type = 1;

    // Date
    String dateStr = '';
    for (final s in ['date', 'order_date', 'month']) {
      dateStr = _findStr(s);
      if (dateStr.isNotEmpty) break;
    }
    DateTime date;
    try { date = DateTime.parse(dateStr); } catch (_) { date = DateTime.now(); }

    // Other fields
    final note = _findStr('note');
    final beneficiary = _findStr('beneficiary');
    final account = _findStr('account');

    return Transaction(
      id: row['id'] as String,
      type: type,
      amount: amount,
      title: title,
      note: note.isNotEmpty ? note : null,
      categoryId: row['category_id'] as String?,
      accountId: account.isNotEmpty ? account : null,
      moduleId: effectiveModule,
      date: date,
      tags: null,
      images: null,
      isDeleted: (row['is_deleted'] as int? ?? 0) == 1,
      deletedAt: row['deleted_at'] != null ? DateTime.tryParse(row['deleted_at'] as String) : null,
      createdAt: DateTime.tryParse(row['created_at'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(row['updated_at'] as String? ?? '') ?? DateTime.now(),
      beneficiary: beneficiary.isNotEmpty ? beneficiary : null,
    );
  }
}

class TransactionFieldValue {
  final String id;
  final String transactionId;
  final String fieldId;
  final String? value;

  TransactionFieldValue({
    required this.id,
    required this.transactionId,
    required this.fieldId,
    this.value,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'transaction_id': transactionId,
      'field_id': fieldId,
      'value': value,
    };
  }

  factory TransactionFieldValue.fromMap(Map<String, dynamic> map) {
    return TransactionFieldValue(
      id: map['id'] as String,
      transactionId: map['transaction_id'] as String,
      fieldId: map['field_id'] as String,
      value: map['value'] as String?,
    );
  }
}
