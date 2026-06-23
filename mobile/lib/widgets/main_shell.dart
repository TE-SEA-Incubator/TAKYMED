import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../screens/dashboard_screen.dart';
import '../screens/prescriptions_screen.dart';
import '../screens/search_medications_screen.dart';
import '../screens/profile_screen.dart';
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
        index: _currentIndex,
        children: [
          isCommercial
              ? const CommercialDashboardScreen(embedded: true)
              : const DashboardScreen(embedded: true),
          const OrdonnancesScreen(embedded: true),
          const SearchMedicationsScreen(embedded: true),
          const ProfileScreen(),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
        backgroundColor: AppColors.primary,
        elevation: 6,
        shape: const CircleBorder(),
        child: const Icon(Icons.add, size: 30, color: Colors.white),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 10,
        color: AppColors.surface,
        elevation: 8,
        shadowColor: Colors.black12,
        child: SizedBox(
          height: 62,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Expanded(child: _NavItem(icon: _tabs[0].icon, label: _tabs[0].label, isSelected: _currentIndex == 0, onTap: () => _onTabTap(0))),
              Expanded(child: _NavItem(icon: _tabs[1].icon, label: _tabs[1].label, isSelected: _currentIndex == 1, onTap: () => _onTabTap(1))),
              const SizedBox(width: 56), // espace FAB
              Expanded(child: _NavItem(icon: _tabs[2].icon, label: _tabs[2].label, isSelected: _currentIndex == 2, onTap: () => _onTabTap(2))),
              Expanded(child: _NavItem(icon: _tabs[3].icon, label: _tabs[3].label, isSelected: _currentIndex == 3, onTap: () => _onTabTap(3))),
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
