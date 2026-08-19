class AppConstants {
  // Database
  static const String dbName = 'expense_tracker.db';
  static const int dbVersion = 10;

  // Default modules
  static const String moduleChiTieu = 'Chi tiêu';
  static const String moduleShopee = 'Shopee';
  static const String moduleVang = 'Vàng';
  static const String moduleNhaTro = 'Nhà trọ';

  // Transaction types
  static const int typeExpense = 0; // Chi
  static const int typeIncome = 1;  // Thu

  // Currency
  static const String currencySymbol = '₫';
  static const String currencyLocale = 'vi_VN';

  // Date formats
  static const String dateFormat = 'dd/MM/yyyy';
  static const String dateTimeFormat = 'dd/MM/yyyy HH:mm';
  static const String monthYearFormat = 'MM/yyyy';
}
