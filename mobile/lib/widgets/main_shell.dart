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
    _TabItem(icon: Icons.search_rounded, label: 'Recherche'),
    _TabItem(icon: Icons.notifications_rounded, label: 'Alertes'),
    _TabItem(icon: Icons.person_rounded, label: 'Profil'),
  ];

  // Helper pour mapper l'index du tab vers l'index de l'IndexedStack
  // Tabs: 0:Home, 1:Search, 2:Alerts, 3:Profile
  // Stack: 0:Home, 1:Search, 2:Alerts, 3:Profile, 4:Ordonnances (via FAB)
  int _mapTabToStack(int tabIndex) {
    if (tabIndex == 0) return 0;
    if (tabIndex == 1) return 2;
    if (tabIndex == 2) return 3;
    if (tabIndex == 3) return 4;
    return 0;
  }
  
  void _onTabTap(int index) {
    if (index == _currentIndex) return;
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final isCommercial = auth.user?.type == 'commercial';

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex == 100 ? 1 : _mapTabToStack(_currentIndex),
        children: [
          isCommercial
              ? const CommercialDashboardScreen(embedded: true)
              : const DashboardScreen(embedded: true),
          const OrdonnancesScreen(embedded: true), // Index 1
          const SearchMedicationsScreen(embedded: true), // Index 2
          const NotificationsScreen(embedded: true), // Index 3
          const SettingsScreen(embedded: true), // Index 4
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _currentIndex = 100), // Index spécial pour Ordonnances
        backgroundColor: AppColors.primary,
        elevation: 4,
        child: const Icon(Icons.add, size: 32, color: Colors.white),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        color: AppColors.surface,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(icon: _tabs[0].icon, label: _tabs[0].label, isSelected: _currentIndex == 0, onTap: () => _onTabTap(0)),
            _NavItem(icon: _tabs[1].icon, label: _tabs[1].label, isSelected: _currentIndex == 1, onTap: () => _onTabTap(1)),
            const SizedBox(width: 40), // Espace pour le FAB
            _NavItem(icon: _tabs[2].icon, label: _tabs[2].label, isSelected: _currentIndex == 2, onTap: () => _onTabTap(2)),
            _NavItem(icon: _tabs[3].icon, label: _tabs[3].label, isSelected: _currentIndex == 3, onTap: () => _onTabTap(3)),
          ],
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
