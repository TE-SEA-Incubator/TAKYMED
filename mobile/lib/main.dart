
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'theme/app_theme.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/prescriptions_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/create_prescription_screen.dart';
import 'screens/search_medications_screen.dart';
import 'screens/commercial_register_screen.dart';
import 'screens/commercial_dashboard_screen.dart';
import 'widgets/main_shell.dart';
import 'screens/splash_screen.dart';
import 'screens/onboarding_screen.dart';
import 'services/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR', null);
  await NotificationService.initialize();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        Provider(create: (_) => ApiService()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TAKYMED',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const AuthWrapper(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/dashboard': (context) => const MainShell(),
        '/prescriptions': (context) => const OrdonnancesScreen(),
        '/create-prescription': (context) => const CreatePrescriptionScreen(),
        '/settings': (context) => const SettingsScreen(),
        '/search-medications': (context) => const SearchMedicationsScreen(),
        '/commercial-register': (context) => const CommercialRegisterScreen(),
        '/commercial-dashboard': (context) => const CommercialDashboardScreen(),
      },
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _onboardingDone = false;
  bool _pollingStarted = false;

  @override
  void initState() {
    super.initState();
    _loadOnboardingStatus();
  }

  Future<void> _loadOnboardingStatus() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _onboardingDone = prefs.getBool('onboarding_done') ?? false;
    });
  }

  void _onOnboardingComplete() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    setState(() => _onboardingDone = true);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final apiService = Provider.of<ApiService>(context, listen: false);

    if (!authProvider.isInitialized) {
      return const SplashScreen();
    }

    if (!_onboardingDone) {
      return OnboardingScreen(onComplete: _onOnboardingComplete);
    }

    if (authProvider.isAuthenticated) {
      if (!_pollingStarted) {
        _pollingStarted = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          PushService.startPolling(apiService, authProvider.user!.id);
        });
      }
      return const MainShell();
    } else {
      if (_pollingStarted) {
        _pollingStarted = false;
        PushService.stopPolling();
      }
      return const LoginScreen();
    }
  }
}
