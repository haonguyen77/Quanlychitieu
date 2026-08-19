class GoldTransaction {
  final String id;
  final String type; // 'buy' or 'sell'
  final String goldType; // SJC, PNJ, 9999, Nhẫn, Khác
  final String unit; // chi, luong, gram
  final double quantity;
  final double pricePerUnit;
  final double totalAmount;
  final DateTime date;
  final String? note;
  final DateTime createdAt;
  final DateTime updatedAt;

  GoldTransaction({
    required this.id,
    required this.type,
    required this.goldType,
    required this.unit,
    required this.quantity,
    required this.pricePerUnit,
    required this.totalAmount,
    required this.date,
    this.note,
    required this.createdAt,
    required this.updatedAt,
  });

  factory GoldTransaction.fromMap(Map<String, dynamic> map) {
    return GoldTransaction(
      id: map['id'] as String,
      type: map['type'] as String? ?? 'buy',
      goldType: map['gold_type'] as String? ?? 'SJC',
      unit: map['unit'] as String? ?? 'chi',
      quantity: (map['quantity'] as num?)?.toDouble() ?? 0,
      pricePerUnit: (map['price_per_unit'] as num?)?.toDouble() ?? 0,
      totalAmount: (map['total_amount'] as num?)?.toDouble() ?? 0,
      date: DateTime.parse(map['date'] as String),
      note: map['note'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: DateTime.parse(map['updated_at'] as String),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type,
      'gold_type': goldType,
      'unit': unit,
      'quantity': quantity,
      'price_per_unit': pricePerUnit,
      'total_amount': totalAmount,
      'date': date.toIso8601String().substring(0, 10),
      'note': note,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  String get typeLabel => type == 'buy' ? 'Mua' : 'Bán';
  String get unitLabel {
    switch (unit) {
      case 'luong':
        return 'lượng';
      case 'gram':
        return 'gram';
      default:
        return 'chỉ';
    }
  }

  /// Convert quantity to chỉ for standardized calculations
  double get quantityInChi {
    switch (unit) {
      case 'luong':
        return quantity * 10;
      case 'gram':
        return quantity / 3.75; // 1 chỉ ≈ 3.75 gram
      default:
        return quantity;
    }
  }
}

class GoldPriceHistory {
  final String id;
  final String goldType;
  final double price;
  final DateTime date;
  final DateTime createdAt;

  GoldPriceHistory({
    required this.id,
    required this.goldType,
    required this.price,
    required this.date,
    required this.createdAt,
  });

  factory GoldPriceHistory.fromMap(Map<String, dynamic> map) {
    return GoldPriceHistory(
      id: map['id'] as String,
      goldType: map['gold_type'] as String? ?? 'SJC',
      price: (map['price'] as num?)?.toDouble() ?? 0,
      date: DateTime.parse(map['date'] as String),
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'gold_type': goldType,
      'price': price,
      'date': date.toIso8601String().substring(0, 10),
      'created_at': createdAt.toIso8601String(),
    };
  }
}

/// Portfolio summary per gold type
class GoldHolding {
  final String goldType;
  final double quantity; // in original unit (chỉ)
  final double avgBuyPrice;
  final double currentPrice;
  final double totalInvested;
  final double currentValue;
  final double profitLoss;
  final double profitLossPercent;

  GoldHolding({
    required this.goldType,
    required this.quantity,
    required this.avgBuyPrice,
    required this.currentPrice,
    required this.totalInvested,
    required this.currentValue,
    required this.profitLoss,
    required this.profitLossPercent,
  });
}
