class RentalDatabase {
  /// Creates all rental module tables. Called from DatabaseHelper during DB creation.
  static Future<void> createTables(dynamic db) async {
    // Rental rooms table
    await db.execute('''
      CREATE TABLE rental_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rent_amount REAL DEFAULT 0,
        note TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // Rental tenants table
    await db.execute('''
      CREATE TABLE rental_tenants (
        id TEXT PRIMARY KEY,
        room_id TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        id_number TEXT,
        move_in_date TEXT,
        move_out_date TEXT,
        deposit REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rental_rooms (id) ON DELETE SET NULL
      )
    ''');

    // Rental monthly bills table
    await db.execute('''
      CREATE TABLE rental_monthly_bills (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        tenant_id TEXT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        rent_amount REAL DEFAULT 0,
        electricity_old INTEGER DEFAULT 0,
        electricity_new INTEGER DEFAULT 0,
        electricity_price REAL DEFAULT 3500,
        electricity_amount REAL DEFAULT 0,
        water_amount REAL DEFAULT 0,
        internet_amount REAL DEFAULT 0,
        other_amount REAL DEFAULT 0,
        other_note TEXT,
        total_amount REAL DEFAULT 0,
        payment_status TEXT DEFAULT 'unpaid',
        paid_date TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (room_id) REFERENCES rental_rooms (id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES rental_tenants (id) ON DELETE SET NULL
      )
    ''');

    // Indexes
    await db.execute('CREATE INDEX idx_rental_tenants_room ON rental_tenants (room_id)');
    await db.execute('CREATE INDEX idx_rental_bills_room ON rental_monthly_bills (room_id)');
    await db.execute('CREATE INDEX idx_rental_bills_period ON rental_monthly_bills (year, month)');
    await db.execute('CREATE INDEX idx_rental_bills_status ON rental_monthly_bills (payment_status)');
  }

  /// Inserts default sample rooms
  static Future<void> insertDefaultData(dynamic db) async {
    final now = DateTime.now().toIso8601String();

    final rooms = [
      {'id': 'room_1', 'name': 'Phòng 1', 'rent_amount': 2000000.0},
      {'id': 'room_2', 'name': 'Phòng 2', 'rent_amount': 2500000.0},
      {'id': 'room_3', 'name': 'Phòng 3', 'rent_amount': 3000000.0},
    ];

    for (final room in rooms) {
      await db.insert('rental_rooms', {
        ...room,
        'is_active': 1,
        'created_at': now,
        'updated_at': now,
      });
    }
  }
}
