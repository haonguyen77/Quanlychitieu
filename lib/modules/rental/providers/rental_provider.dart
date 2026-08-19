import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import '../../../database/database_helper.dart';
import '../models/rental_models.dart';

class RentalProvider extends ChangeNotifier {
  List<RentalRoom> _rooms = [];
  List<RentalTenant> _tenants = [];
  List<RentalMonthlyBill> _bills = [];
  bool _isLoading = false;

  List<RentalRoom> get rooms => _rooms;
  List<RentalTenant> get tenants => _tenants;
  List<RentalMonthlyBill> get bills => _bills;
  bool get isLoading => _isLoading;

  List<RentalRoom> get activeRooms => _rooms.where((r) => r.isActive).toList();
  List<RentalTenant> get activeTenants => _tenants.where((t) => t.isActive).toList();
  List<RentalMonthlyBill> get unpaidBills => _bills.where((b) => b.paymentStatus == 'unpaid').toList();

  int get totalRooms => activeRooms.length;
  int get occupiedRooms => activeRooms.where((r) => r.isOccupied).length;
  int get vacantRooms => totalRooms - occupiedRooms;

  double get thisMonthIncome {
    final now = DateTime.now();
    return _bills
        .where((b) => b.year == now.year && b.month == now.month && b.paymentStatus == 'paid')
        .fold(0.0, (sum, b) => sum + b.totalAmount);
  }

  // ===== ROOMS =====

  Future<void> loadRooms() async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;
    final results = await db.rawQuery('''
      SELECT r.*, t.name as tenant_name
      FROM rental_rooms r
      LEFT JOIN rental_tenants t ON t.room_id = r.id AND t.is_active = 1 AND t.move_out_date IS NULL
      WHERE r.is_active = 1
      ORDER BY r.name ASC
    ''');

    _rooms = results.map((map) => RentalRoom.fromMap(map)).toList();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> addRoom(RentalRoom room) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    final id = const Uuid().v4();

    await db.insert('rental_rooms', {
      'id': id,
      'name': room.name,
      'rent_amount': room.rentAmount,
      'note': room.note,
      'is_active': 1,
      'created_at': now,
      'updated_at': now,
    });

    await loadRooms();
  }

  Future<void> updateRoom(RentalRoom room) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    await db.update(
      'rental_rooms',
      {
        'name': room.name,
        'rent_amount': room.rentAmount,
        'note': room.note,
        'updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [room.id],
    );

    await loadRooms();
  }

  Future<void> deleteRoom(String roomId) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    await db.update(
      'rental_rooms',
      {'is_active': 0, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [roomId],
    );

    await loadRooms();
  }

  // ===== TENANTS =====

  Future<void> loadTenants() async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;
    final results = await db.rawQuery('''
      SELECT t.*, r.name as room_name
      FROM rental_tenants t
      LEFT JOIN rental_rooms r ON r.id = t.room_id
      WHERE t.is_active = 1
      ORDER BY t.name ASC
    ''');

    _tenants = results.map((map) => RentalTenant.fromMap(map)).toList();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> addTenant(RentalTenant tenant) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    final id = const Uuid().v4();

    await db.insert('rental_tenants', {
      'id': id,
      'room_id': tenant.roomId,
      'name': tenant.name,
      'phone': tenant.phone,
      'id_number': tenant.idNumber,
      'move_in_date': tenant.moveInDate?.toIso8601String(),
      'move_out_date': tenant.moveOutDate?.toIso8601String(),
      'deposit': tenant.deposit,
      'is_active': 1,
      'note': tenant.note,
      'created_at': now,
      'updated_at': now,
    });

    await loadTenants();
    await loadRooms();
  }

  Future<void> updateTenant(RentalTenant tenant) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    await db.update(
      'rental_tenants',
      {
        'room_id': tenant.roomId,
        'name': tenant.name,
        'phone': tenant.phone,
        'id_number': tenant.idNumber,
        'move_in_date': tenant.moveInDate?.toIso8601String(),
        'move_out_date': tenant.moveOutDate?.toIso8601String(),
        'deposit': tenant.deposit,
        'note': tenant.note,
        'updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [tenant.id],
    );

    await loadTenants();
    await loadRooms();
  }

  Future<void> deleteTenant(String tenantId) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    await db.update(
      'rental_tenants',
      {'is_active': 0, 'move_out_date': now, 'updated_at': now},
      where: 'id = ?',
      whereArgs: [tenantId],
    );

    await loadTenants();
    await loadRooms();
  }

  // ===== BILLS =====

  Future<void> loadBills(int year, int month) async {
    _isLoading = true;
    notifyListeners();

    final db = await DatabaseHelper.instance.database;
    final results = await db.rawQuery('''
      SELECT b.*, r.name as room_name, t.name as tenant_name
      FROM rental_monthly_bills b
      LEFT JOIN rental_rooms r ON r.id = b.room_id
      LEFT JOIN rental_tenants t ON t.id = b.tenant_id
      WHERE b.year = ? AND b.month = ?
      ORDER BY r.name ASC
    ''', [year, month]);

    _bills = results.map((map) => RentalMonthlyBill.fromMap(map)).toList();
    _isLoading = false;
    notifyListeners();
  }

  Future<void> addBill(RentalMonthlyBill bill) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();
    final id = const Uuid().v4();

    final electricityAmount = (bill.electricityNew - bill.electricityOld) * bill.electricityPrice;
    final totalAmount = bill.rentAmount + electricityAmount + bill.waterAmount + bill.internetAmount + bill.otherAmount;

    await db.insert('rental_monthly_bills', {
      'id': id,
      'room_id': bill.roomId,
      'tenant_id': bill.tenantId,
      'year': bill.year,
      'month': bill.month,
      'rent_amount': bill.rentAmount,
      'electricity_old': bill.electricityOld,
      'electricity_new': bill.electricityNew,
      'electricity_price': bill.electricityPrice,
      'electricity_amount': electricityAmount,
      'water_amount': bill.waterAmount,
      'internet_amount': bill.internetAmount,
      'other_amount': bill.otherAmount,
      'other_note': bill.otherNote,
      'total_amount': totalAmount,
      'payment_status': 'unpaid',
      'note': bill.note,
      'created_at': now,
      'updated_at': now,
    });

    await loadBills(bill.year, bill.month);
  }

  Future<void> updateBill(RentalMonthlyBill bill) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    final electricityAmount = (bill.electricityNew - bill.electricityOld) * bill.electricityPrice;
    final totalAmount = bill.rentAmount + electricityAmount + bill.waterAmount + bill.internetAmount + bill.otherAmount;

    await db.update(
      'rental_monthly_bills',
      {
        'room_id': bill.roomId,
        'tenant_id': bill.tenantId,
        'rent_amount': bill.rentAmount,
        'electricity_old': bill.electricityOld,
        'electricity_new': bill.electricityNew,
        'electricity_price': bill.electricityPrice,
        'electricity_amount': electricityAmount,
        'water_amount': bill.waterAmount,
        'internet_amount': bill.internetAmount,
        'other_amount': bill.otherAmount,
        'other_note': bill.otherNote,
        'total_amount': totalAmount,
        'note': bill.note,
        'updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [bill.id],
    );

    await loadBills(bill.year, bill.month);
  }

  Future<void> markAsPaid(String billId, int year, int month) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    await db.update(
      'rental_monthly_bills',
      {
        'payment_status': 'paid',
        'paid_date': now,
        'updated_at': now,
      },
      where: 'id = ?',
      whereArgs: [billId],
    );

    await loadBills(year, month);
  }

  Future<void> createBillsForAllRooms(int year, int month) async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now().toIso8601String();

    // Get active rooms with their current tenants
    final roomResults = await db.rawQuery('''
      SELECT r.*, t.id as current_tenant_id
      FROM rental_rooms r
      LEFT JOIN rental_tenants t ON t.room_id = r.id AND t.is_active = 1 AND t.move_out_date IS NULL
      WHERE r.is_active = 1
    ''');

    for (final room in roomResults) {
      final roomId = room['id'] as String;

      // Check if bill already exists for this room/month
      final existing = await db.query(
        'rental_monthly_bills',
        where: 'room_id = ? AND year = ? AND month = ?',
        whereArgs: [roomId, year, month],
      );

      if (existing.isNotEmpty) continue;

      // Get last month's bill for electricity carry-over
      int prevMonth = month - 1;
      int prevYear = year;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear = year - 1;
      }

      final lastBill = await db.query(
        'rental_monthly_bills',
        where: 'room_id = ? AND year = ? AND month = ?',
        whereArgs: [roomId, prevYear, prevMonth],
        limit: 1,
      );

      final electricityOld = lastBill.isNotEmpty ? (lastBill.first['electricity_new'] as int?) ?? 0 : 0;
      final rentAmount = (room['rent_amount'] as num?)?.toDouble() ?? 0;
      final tenantId = room['current_tenant_id'] as String?;

      await db.insert('rental_monthly_bills', {
        'id': const Uuid().v4(),
        'room_id': roomId,
        'tenant_id': tenantId,
        'year': year,
        'month': month,
        'rent_amount': rentAmount,
        'electricity_old': electricityOld,
        'electricity_new': electricityOld,
        'electricity_price': 3500.0,
        'electricity_amount': 0.0,
        'water_amount': 0.0,
        'internet_amount': 0.0,
        'other_amount': 0.0,
        'total_amount': rentAmount,
        'payment_status': 'unpaid',
        'created_at': now,
        'updated_at': now,
      });
    }

    await loadBills(year, month);
  }

  // ===== REPORTS =====

  Future<List<Map<String, dynamic>>> getMonthlyReport() async {
    final db = await DatabaseHelper.instance.database;
    final now = DateTime.now();

    final List<Map<String, dynamic>> report = [];

    for (int i = 11; i >= 0; i--) {
      final date = DateTime(now.year, now.month - i, 1);
      final result = await db.rawQuery('''
        SELECT 
          COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as paid_total,
          COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount ELSE 0 END), 0) as unpaid_total,
          COUNT(*) as bill_count,
          SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count
        FROM rental_monthly_bills
        WHERE year = ? AND month = ?
      ''', [date.year, date.month]);

      report.add({
        'year': date.year,
        'month': date.month,
        'paid_total': (result.first['paid_total'] as num?)?.toDouble() ?? 0,
        'unpaid_total': (result.first['unpaid_total'] as num?)?.toDouble() ?? 0,
        'bill_count': (result.first['bill_count'] as int?) ?? 0,
        'paid_count': (result.first['paid_count'] as int?) ?? 0,
      });
    }

    return report;
  }
}
