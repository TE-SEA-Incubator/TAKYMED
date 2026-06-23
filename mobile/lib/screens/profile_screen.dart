import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/gradient_header.dart';
import '../widgets/page_transitions.dart';
import 'notifications_screen.dart';
import 'settings_screen.dart';
import 'upgrade_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _lightMode = true;

  String _typeLabel(String? type) {
    switch (type) {
      case 'commercial':
        return 'Commercial';
      case 'professional':
        return 'Professionnel';
      case 'pharmacist':
        return 'Pharmacien';
      case 'admin':
        return 'Administrateur';
      default:
        return 'Patient';
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user;
    final name = user?.name ?? 'Utilisateur';
    final initials = name.trim().isNotEmpty
        ? name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : 'U';
    final typeLabel = _typeLabel(user?.type);
    final phone = user?.phone ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          // ── Header teal ──
          GradientHeader(
            title: 'Profil',
            subtitle: 'Gérez votre compte',
            showLogo: true,
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              children: [
                // ── Carte identité ──
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      // Avatar initiales
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            initials,
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 2),
                            Text(phone.isNotEmpty ? phone : '—',
                                style: const TextStyle(
                                    color: AppColors.mutedForeground, fontSize: 13)),
                          ],
                        ),
                      ),
                      // Badge type
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          typeLabel,
                          style: const TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ── Menu items ──
                _MenuItem(
                  icon: Icons.notifications_outlined,
                  label: 'Notifications',
                  onTap: () => pushSlide(context, const NotificationsScreen(embedded: true)),
                ),
                const SizedBox(height: 10),
                _MenuItem(
                  icon: Icons.devices_outlined,
                  label: 'Mon abonnement',
                  subtitle: 'Standard · Pro · Commercial',
                  onTap: () => pushSlide(context, const UpgradeScreen()),
                ),
                const SizedBox(height: 10),
                _MenuItem(
                  icon: Icons.settings_outlined,
                  label: 'Paramètres',
                  onTap: () => pushSlide(context, const SettingsScreen(embedded: true)),
                ),
                const SizedBox(height: 10),

                // ── Toggle mode clair ──
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.wb_sunny_outlined,
                            color: AppColors.primary, size: 20),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Mode clair',
                                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                            Text('Thème de l\'interface',
                                style: TextStyle(
                                    color: AppColors.mutedForeground, fontSize: 12)),
                          ],
                        ),
                      ),
                      Switch(
                        value: _lightMode,
                        onChanged: (v) => setState(() => _lightMode = v),
                        activeThumbColor: AppColors.primary,
                        activeTrackColor: AppColors.primaryLight,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Déconnexion ──
                GestureDetector(
                  onTap: () => auth.logout(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF0F0),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.destructive.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.logout_rounded, color: AppColors.destructive, size: 20),
                        SizedBox(width: 8),
                        Text('Déconnexion',
                            style: TextStyle(
                                color: AppColors.destructive,
                                fontWeight: FontWeight.w700,
                                fontSize: 15)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryLight,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style:
                          const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  if (subtitle != null)
                    Text(subtitle!,
                        style: const TextStyle(
                            color: AppColors.mutedForeground, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: AppColors.mutedForeground, size: 22),
          ],
        ),
      ),
    );
  }
}
