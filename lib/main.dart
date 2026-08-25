import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'app/app.dart';
import 'providers/transaction_provider.dart';
import 'providers/category_provider.dart';
import 'providers/account_provider.dart';
import 'providers/module_provider.dart';
import 'providers/security_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/beneficiary_provider.dart';
import 'modules/wine/providers/wine_product_provider.dart';
import 'modules/wine/providers/wine_customer_provider.dart';
import 'modules/wine/providers/wine_stock_provider.dart';
import 'modules/wine/providers/wine_data_provider.dart';
import 'modules/credit_card/providers/credit_card_provider.dart';
import 'modules/rental/providers/rental_provider.dart';
import 'modules/gold/providers/gold_provider.dart';
import 'database/database_helper.dart';
import 'services/notification_service.dart';
import 'services/auto_sync.dart';
import 'services/usage_frequency_service.dart';
import 'services/crypto_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('vi', null);
  await DatabaseHelper.instance.database;
  await NotificationService.instance.init();

  // Load the saved encryption PIN (if any) so syncing doesn't prompt every launch.
  await CryptoService.instance.autoUnlock();

  // Initialize auto-sync (will sync on app open if signed in)
  AutoSync.instance.init();

  // Initialize usage frequency tracking (smart defaults)
  await UsageFrequencyService.instance.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => TransactionProvider()),
        ChangeNotifierProvider(create: (_) => CategoryProvider()),
        ChangeNotifierProvider(create: (_) => AccountProvider()),
        ChangeNotifierProvider(create: (_) => ModuleProvider()),
        ChangeNotifierProvider(create: (_) => SecurityProvider()),
        ChangeNotifierProvider(create: (_) => BeneficiaryProvider()),
        ChangeNotifierProvider(create: (_) => WineProductProvider()),
        ChangeNotifierProvider(create: (_) => WineCustomerProvider()),
        ChangeNotifierProvider(create: (_) => WineStockProvider()),
        ChangeNotifierProvider(create: (_) => WineDataProvider()),
        ChangeNotifierProvider(create: (_) => CreditCardProvider()),
        ChangeNotifierProvider(create: (_) => RentalProvider()),
        ChangeNotifierProvider(create: (_) => GoldProvider()),
      ],
      child: const MyApp(),
    ),
  );
}
