import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/push_service.dart';
import '../theme/app_colors.dart';
import '../screens/dashboard_screen.dart';
import '../screens/prescriptions_screen.dart';
import '../screens/search_medications_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/commercial_dashboard_screen.dart';
import '../screens/create_prescription_screen.dart';
import 'page_transitions.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with TickerProviderStateMixin {
  int _currentIndex = 0;
  late final AnimationController _navController;

  static const _tabs = [
    _TabItem(icon: Icons.home_rounded, label: 'Accueil'),
    _TabItem(icon: Icons.description_rounded, label: 'Ordonnances'),
    _TabItem(icon: Icons.search_rounded, label: 'Recherche'),
    _TabItem(icon: Icons.notifications_rounded, label: 'Alertes'),
    _TabItem(icon: Icons.person_rounded, label: 'Profil'),
  ];

  @override
  void initState() {
    super.initState();
    _navController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) => _initPush());
  }

  Future<void> _initPush() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = Provider.of<ApiService>(context, listen: false);
    if (auth.user == null) return;
    await PushService.requestPermission();
    await PushService.registerDevice(api, auth.user!.id);
    await PushService.startPolling(api, auth.user!.id);
  }

  @override
  void dispose() {
    PushService.stopPolling();
    _navController.dispose();
    super.dispose();
  }

  void _onTabTap(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
    _navController.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final isCommercial = auth.user?.type == 'commercial';

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: [
          isCommercial
              ? const CommercialDashboardScreen(embedded: true)
              : const DashboardScreen(embedded: true),
          const OrdonnancesScreen(embedded: true),
          const SearchMedicationsScreen(embedded: true),
          const NotificationsScreen(embedded: true),
          const SettingsScreen(embedded: true),
        ],
      ),
      floatingActionButton: _currentIndex == 1
          ? FloatingActionButton.extended(
              onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Nouveau rappel'),
            )
          : null,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          boxShadow: [
            BoxShadow(
              color: AppColors.foreground.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(_tabs.length, (index) {
                final tab = _tabs[index];
                final isSelected = _currentIndex == index;
                return _NavItem(
                  icon: tab.icon,
                  label: tab.label,
                  isSelected: isSelected,
                  onTap: () => _onTabTap(index),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final IconData icon;
  final String label;
  const _TabItem({required this.icon, required this.label});
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOutCubic,
        padding: EdgeInsets.symmetric(
          horizontal: isSelected ? 16 : 12,
          vertical: 8,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryLight : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              scale: isSelected ? 1.1 : 1.0,
              duration: const Duration(milliseconds: 250),
              child: Icon(
                icon,
                color: isSelected ? AppColors.primary : AppColors.mutedForeground,
                size: 24,
              ),
            ),
            const SizedBox(height: 4),
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 250),
              style: TextStyle(
                fontSize: isSelected ? 11 : 10,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? AppColors.primary : AppColors.mutedForeground,
              ),
              child: Text(label),
            ),
          ],
        ),
      ),
    );
  }
}

class AuthScaffold extends StatelessWidget {
  final Widget child;

  const AuthScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.primaryLight, AppColors.background],
            stops: [0.0, 0.4],
          ),
        ),
        child: SafeArea(child: child),
      ),
    );
  }
}
