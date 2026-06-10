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

  static const _tabs = [
    _TabItem(icon: Icons.home_rounded, label: 'Accueil'),
    _TabItem(icon: Icons.description_rounded, label: 'Ordonnances'),
    _TabItem(icon: Icons.search_rounded, label: 'Recherche'),
    _TabItem(icon: Icons.person_rounded, label: 'Profil'),
  ];

  int _mapTabToStack(int tabIndex) {
    if (tabIndex == 0) return 0; // Home
    if (tabIndex == 1) return 1; // Ordonnances
    if (tabIndex == 2) return 2; // Search
    if (tabIndex == 3) return 4; // Settings/Profile
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
        index: _mapTabToStack(_currentIndex),
        children: [
          Scaffold(
            appBar: AppBar(
              title: const Text('TAKYMED', style: TextStyle(fontWeight: FontWeight.bold)),
              actions: [
                IconButton(
                  icon: const Icon(Icons.notifications_rounded),
                  onPressed: () => pushSlide(context, const NotificationsScreen(embedded: true)),
                ),
              ],
            ),
            body: isCommercial
                ? const CommercialDashboardScreen(embedded: true)
                : const DashboardScreen(embedded: true),
          ),
          const OrdonnancesScreen(embedded: true),
          const SearchMedicationsScreen(embedded: true),
          const SettingsScreen(embedded: true),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
        backgroundColor: AppColors.primary,
        elevation: 4,
        child: const Icon(Icons.add, size: 32, color: Colors.white),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        color: AppColors.surface,
        child: SizedBox(
          height: 60,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(icon: _tabs[0].icon, label: _tabs[0].label, isSelected: _currentIndex == 0, onTap: () => _onTabTap(0)),
              _NavItem(icon: _tabs[1].icon, label: _tabs[1].label, isSelected: _currentIndex == 1, onTap: () => _onTabTap(1)),
              const SizedBox(width: 40), // Space for FAB
              _NavItem(icon: _tabs[2].icon, label: _tabs[2].label, isSelected: _currentIndex == 2, onTap: () => _onTabTap(2)),
              _NavItem(icon: _tabs[3].icon, label: _tabs[3].label, isSelected: _currentIndex == 3, onTap: () => _onTabTap(3)),
            ],
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isSelected ? AppColors.primary : AppColors.mutedForeground,
            size: 24,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              color: isSelected ? AppColors.primary : AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }
}
