class GoldDatabase {
  /// Creates all gold module tables. Called from DatabaseHelper during DB creation.
  static Future<void> createTables(dynamic db) async {
    // Gold transactions table - buy/sell
    await db.execute('''
      CREATE TABLE gold_transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'buy',
        gold_type TEXT NOT NULL DEFAULT 'SJC',
        unit TEXT NOT NULL DEFAULT 'chi',
        quantity REAL NOT NULL DEFAULT 0,
        price_per_unit REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // Gold price history table
    await db.execute('''
      CREATE TABLE gold_price_history (
        id TEXT PRIMARY KEY,
        gold_type TEXT NOT NULL DEFAULT 'SJC',
        price REAL NOT NULL DEFAULT 0,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');

    // Indexes
    await db.execute('CREATE INDEX idx_gold_transactions_date ON gold_transactions (date)');
    await db.execute('CREATE INDEX idx_gold_transactions_type ON gold_transactions (type)');
    await db.execute('CREATE INDEX idx_gold_transactions_gold_type ON gold_transactions (gold_type)');
    await db.execute('CREATE INDEX idx_gold_price_history_type ON gold_price_history (gold_type)');
    await db.execute('CREATE INDEX idx_gold_price_history_date ON gold_price_history (date)');
  }

  /// Inserts default sample gold price entry
  static Future<void> insertDefaultData(dynamic db) async {
    final now = DateTime.now().toIso8601String();
    final today = DateTime.now().toIso8601String().substring(0, 10);

    // Insert sample current gold prices
    final defaultPrices = [
      {'id': 'gp_sjc_default', 'gold_type': 'SJC', 'price': 92000000.0},
      {'id': 'gp_pnj_default', 'gold_type': 'PNJ', 'price': 78000000.0},
      {'id': 'gp_9999_default', 'gold_type': '9999', 'price': 78500000.0},
    ];

    for (final price in defaultPrices) {
      await db.insert('gold_price_history', {
        ...price,
        'date': today,
        'created_at': now,
      });
    }
  }
}
