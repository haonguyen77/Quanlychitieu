class WineDatabase {
  /// Creates all wine module tables. Called from DatabaseHelper during DB creation.
  static Future<void> createTables(dynamic db) async {
    // Products table
    await db.execute('''
      CREATE TABLE wine_products (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        short_name TEXT,
        volume_ml INTEGER,
        wine_type TEXT,
        bottle_type TEXT,
        images TEXT,
        note TEXT,
        is_active INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // Product dynamic fields definition
    await db.execute('''
      CREATE TABLE wine_product_fields (
        id TEXT PRIMARY KEY,
        field_name TEXT NOT NULL,
        field_label TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'text',
        sort_order INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        options TEXT,
        created_at TEXT NOT NULL
      )
    ''');

    // Product dynamic field values
    await db.execute('''
      CREATE TABLE wine_product_field_values (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        field_id TEXT NOT NULL,
        value TEXT,
        FOREIGN KEY (product_id) REFERENCES wine_products (id) ON DELETE CASCADE,
        FOREIGN KEY (field_id) REFERENCES wine_product_fields (id) ON DELETE CASCADE
      )
    ''');

    // Variant types (e.g., "Màu sắc", "Dung tích", "Kiểu nắp")
    await db.execute('''
      CREATE TABLE wine_variant_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    ''');

    // Variant options (e.g., "Đỏ", "Đen", "Xanh", "Trắng")
    await db.execute('''
      CREATE TABLE wine_variant_options (
        id TEXT PRIMARY KEY,
        variant_type_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (variant_type_id) REFERENCES wine_variant_types (id) ON DELETE CASCADE
      )
    ''');

    // Product variants (combination of product + variant options)
    await db.execute('''
      CREATE TABLE wine_product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        variant_option_id TEXT NOT NULL,
        min_stock INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES wine_products (id) ON DELETE CASCADE,
        FOREIGN KEY (variant_option_id) REFERENCES wine_variant_options (id) ON DELETE CASCADE
      )
    ''');

    // Customers
    await db.execute('''
      CREATE TABLE wine_customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        district TEXT,
        city TEXT,
        note TEXT,
        total_orders INTEGER DEFAULT 0,
        last_order_date TEXT,
        is_active INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // Stock-in receipts (Phiếu nhập kho)
    await db.execute('''
      CREATE TABLE wine_stock_in (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        note TEXT,
        images TEXT,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    ''');

    // Stock-in line items (batch entries)
    await db.execute('''
      CREATE TABLE wine_stock_in_items (
        id TEXT PRIMARY KEY,
        stock_in_id TEXT NOT NULL,
        product_variant_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        remaining_quantity INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (stock_in_id) REFERENCES wine_stock_in (id) ON DELETE CASCADE,
        FOREIGN KEY (product_variant_id) REFERENCES wine_product_variants (id) ON DELETE CASCADE
      )
    ''');

    // Sales orders (Phiếu bán hàng)
    await db.execute('''
      CREATE TABLE wine_sales_orders (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        customer_district TEXT,
        customer_city TEXT,
        shipping_fee REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        note1 TEXT,
        note2 TEXT,
        images TEXT,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES wine_customers (id) ON DELETE SET NULL
      )
    ''');

    // Sales order line items
    await db.execute('''
      CREATE TABLE wine_sales_order_items (
        id TEXT PRIMARY KEY,
        sales_order_id TEXT NOT NULL,
        product_variant_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL DEFAULT 0,
        has_glass INTEGER DEFAULT 0,
        has_box INTEGER DEFAULT 0,
        note TEXT,
        sync_status TEXT DEFAULT 'synced',
        device_id TEXT,
        FOREIGN KEY (sales_order_id) REFERENCES wine_sales_orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_variant_id) REFERENCES wine_product_variants (id) ON DELETE CASCADE
      )
    ''');

    // Stock deduction log (FIFO tracking)
    await db.execute('''
      CREATE TABLE wine_stock_deductions (
        id TEXT PRIMARY KEY,
        sales_order_item_id TEXT NOT NULL,
        stock_in_item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (sales_order_item_id) REFERENCES wine_sales_order_items (id) ON DELETE CASCADE,
        FOREIGN KEY (stock_in_item_id) REFERENCES wine_stock_in_items (id) ON DELETE CASCADE
      )
    ''');

    // Indexes
    await db.execute('CREATE INDEX idx_wine_products_sku ON wine_products (sku)');
    await db.execute('CREATE INDEX idx_wine_product_variants_product ON wine_product_variants (product_id)');
    await db.execute('CREATE INDEX idx_wine_product_variants_option ON wine_product_variants (variant_option_id)');
    await db.execute('CREATE INDEX idx_wine_stock_in_items_variant ON wine_stock_in_items (product_variant_id)');
    await db.execute('CREATE INDEX idx_wine_stock_in_items_remaining ON wine_stock_in_items (remaining_quantity)');
    await db.execute('CREATE INDEX idx_wine_sales_orders_date ON wine_sales_orders (date)');
    await db.execute('CREATE INDEX idx_wine_sales_orders_customer ON wine_sales_orders (customer_id)');
    await db.execute('CREATE INDEX idx_wine_sales_order_items_order ON wine_sales_order_items (sales_order_id)');
    await db.execute('CREATE INDEX idx_wine_sales_order_items_variant ON wine_sales_order_items (product_variant_id)');
    await db.execute('CREATE INDEX idx_wine_stock_deductions_batch ON wine_stock_deductions (stock_in_item_id)');
  }

  /// Inserts default data for the wine module
  static Future<void> insertDefaultData(dynamic db) async {
    final now = DateTime.now().toIso8601String();

    // Default variant type: Màu sắc
    await db.insert('wine_variant_types', {
      'id': 'wvt_color',
      'name': 'Màu sắc',
      'sort_order': 0,
      'is_active': 1,
      'created_at': now,
    });

    // Default color options
    final colors = [
      {'id': 'wvo_xanhngoc', 'name': 'Xanh ngọc', 'sort_order': 0},
      {'id': 'wvo_xanhreu', 'name': 'Xanh rêu', 'sort_order': 1},
      {'id': 'wvo_xanhbutbi', 'name': 'Xanh bút bi', 'sort_order': 2},
      {'id': 'wvo_red', 'name': 'Đỏ', 'sort_order': 3},
      {'id': 'wvo_black', 'name': 'Đen', 'sort_order': 4},
      {'id': 'wvo_white', 'name': 'Trắng', 'sort_order': 5},
      {'id': 'wvo_brown', 'name': 'Nâu', 'sort_order': 6},
    ];

    for (final color in colors) {
      await db.insert('wine_variant_options', {
        ...color,
        'variant_type_id': 'wvt_color',
        'is_active': 1,
        'created_at': now,
      });
    }

    // Default wine products with SKU
    final products = [
      {'id': 'wp_g21l', 'sku': 'G21L', 'name': 'Gạo loại 2 1L', 'note': 'Rượu bàu đá gạo loại 2 - 1L'},
      {'id': 'wp_g22l', 'sku': 'G22L', 'name': 'Gạo loại 2 2L', 'note': 'Rượu bàu đá gạo loại 2 - 2L'},
      {'id': 'wp_g25l', 'sku': 'G25L', 'name': 'Gạo loại 2 5L', 'note': 'Rượu bàu đá gạo loại 2 - 5L'},
      {'id': 'wp_g500ml', 'sku': 'G500ML', 'name': 'Gạo 500ml', 'note': 'Rượu bàu đá gạo 500ml'},
      {'id': 'wp_g1l', 'sku': 'G1L', 'name': 'Gạo 1L', 'note': 'Rượu bàu đá gạo 1L'},
      {'id': 'wp_g2l', 'sku': 'G2L', 'name': 'Gạo 2L', 'note': 'Rượu bàu đá gạo 2L'},
      {'id': 'wp_g5l', 'sku': 'G5L', 'name': 'Gạo 5L', 'note': 'Rượu bàu đá gạo 5L'},
      {'id': 'wp_n500ml', 'sku': 'N500ML', 'name': 'Nếp 500ml', 'note': 'Rượu bàu đá nếp 500ml'},
      {'id': 'wp_n1l', 'sku': 'N1L', 'name': 'Nếp 1L', 'note': 'Rượu bàu đá nếp 1L'},
      {'id': 'wp_n2l', 'sku': 'N2L', 'name': 'Nếp 2L', 'note': 'Rượu bàu đá nếp 2L'},
      {'id': 'wp_n5l', 'sku': 'N5L', 'name': 'Nếp 5L', 'note': 'Rượu bàu đá nếp 5L'},
      {'id': 'wp_dx500ml', 'sku': 'DX500ML', 'name': 'Đậu xanh 500ml', 'note': 'Rượu bàu đá đậu xanh 500ml'},
      {'id': 'wp_dx1l', 'sku': 'DX1L', 'name': 'Đậu xanh 1L', 'note': 'Rượu bàu đá đậu xanh 1L'},
      {'id': 'wp_dx2l', 'sku': 'DX2L', 'name': 'Đậu xanh 2L', 'note': 'Rượu bàu đá đậu xanh 2L'},
      {'id': 'wp_dx5l', 'sku': 'DX5L', 'name': 'Đậu xanh 5L', 'note': 'Rượu bàu đá đậu xanh 5L'},
      {'id': 'wp_hl350ml', 'sku': 'HL350ML', 'name': 'Hồ Lô 350ml', 'note': 'Chai sứ Hồ Lô 350ml'},
      {'id': 'wp_rn350ml', 'sku': 'RN350ML', 'name': 'Rồng nhỏ 350ml', 'note': 'Chai sứ Rồng nhỏ 350ml'},
      {'id': 'wp_3b650ml', 'sku': '3B650ML', 'name': 'Ba Bầu 650ml', 'note': 'Chai sứ Ba Bầu 650ml'},
      {'id': 'wp_lp650ml', 'sku': 'LP650ML', 'name': 'Long Phụng 650ml', 'note': 'Chai sứ Long Phụng 650ml'},
      {'id': 'wp_vr650ml', 'sku': 'VR650ML', 'name': 'Vòi Rót 650ml', 'note': 'Chai sứ Vòi Rót 650ml'},
      {'id': 'wp_ch650ml', 'sku': 'CH650ML', 'name': 'Chum 650ml', 'note': 'Chum 650ml'},
      {'id': 'wp_hl650ml', 'sku': 'HL650ML', 'name': 'Hồ Lô 650ml', 'note': 'Hồ Lô 650ml'},
      {'id': 'wp_tc700ml', 'sku': 'TC700ML', 'name': 'Thuyền Chim 700ml', 'note': 'Thuyền Chim 700ml'},
      {'id': 'wp_tl1l', 'sku': 'TL1L', 'name': 'Thuyền Lớn 1L', 'note': 'Thuyền Lớn 1L'},
      {'id': 'wp_cs25l', 'sku': 'CS25L', 'name': 'Chai sứ 2.5L', 'note': 'Chai sứ 2.5L'},
      {'id': 'wp_vn300ml', 'sku': 'VN300ML', 'name': 'Vang 300ml', 'note': 'Vang nếp 300ml'},
      {'id': 'wp_vn500ml', 'sku': 'VN500ML', 'name': 'Vang 500ml', 'note': 'Vang nếp 500ml'},
      {'id': 'wp_vn750ml', 'sku': 'VN750ML', 'name': 'Vang 750ml', 'note': 'Vang nếp 750ml'},
      {'id': 'wp_dxtt500ml', 'sku': 'DXTT500ML', 'name': 'ĐX Thủy tinh 500ml', 'note': 'Đậu xanh thủy tinh 500ml'},
      {'id': 'wp_dtht500ml_t', 'sku': 'DTHT500ML-T', 'name': 'ĐTHT Tròn', 'note': 'Đông trùng hạ thảo 500ml - Tròn'},
      {'id': 'wp_dtht500ml_d', 'sku': 'DTHT500ML-D', 'name': 'ĐTHT Dẹp', 'note': 'Đông trùng hạ thảo 500ml - Dẹp'},
    ];

    for (final product in products) {
      await db.insert('wine_products', {
        ...product,
        'is_active': 1,
        'created_at': now,
        'updated_at': now,
      });
    }
  }
}
