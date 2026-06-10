
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_card.dart';
import '../widgets/gradient_header.dart';
import '../widgets/loading_view.dart';
import '../widgets/page_transitions.dart';
import '../widgets/quick_action_tile.dart';
import '../widgets/stat_card.dart';
import 'create_prescription_screen.dart';
import 'commercial_register_screen.dart';
import 'commercial_dashboard_screen.dart';
import 'search_pharmacies_screen.dart';

class DashboardScreen extends StatefulWidget {
  final bool embedded;

  const DashboardScreen({super.key, this.embedded = false});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with WidgetsBindingObserver {
  Map<String, dynamic>? _data;
  bool _isLoading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadData();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadData();
    }
  }

  Future<void> _loadData() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final apiService = Provider.of<ApiService>(context, listen: false);

    if (authProvider.user != null) {
      try {
        final data = await apiService.getDashboard(authProvider.user!.id);
        if (mounted) {
          setState(() {
            _data = data;
            _isLoading = false;
            _loadError = null;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _loadError = 'Impossible de charger les statistiques';
          });
        }
      }
    } else if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  String _accountTypeLabel(String? type) {
    switch (type) {
      case 'commercial':
        return 'Commercial';
      case 'professional':
        return 'Professionnel';
      case 'admin':
        return 'Administrateur';
      default:
        return 'Patient';
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final userName = authProvider.user?.name ?? 'Utilisateur';
    final isCommercial = authProvider.user?.type == 'commercial';
    final isStandard = authProvider.user?.type == 'standard';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: _isLoading
          ? const LoadingView(message: 'Chargement de votre tableau de bord...')
          : RefreshIndicator(
              onRefresh: _loadData,
              color: AppColors.primary,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: GradientHeader(
                      title: 'Bonjour,',
                      subtitle: userName,
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.verified_user_rounded, color: Colors.white, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              _accountTypeLabel(authProvider.user?.type),
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      bottom: _data?['stats']?['nextDose'] != null
                          ? _buildNextDoseCard(_data!['stats']['nextDose'])
                          : null,
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        if (_loadError != null)
                          AnimatedFadeSlide(
                            index: 0,
                            child: AppCard(
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: AppColors.destructive),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _loadError!,
                                      style: const TextStyle(color: AppColors.destructive, fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                  TextButton(onPressed: _loadData, child: const Text('Réessayer')),
                                ],
                              ),
                            ),
                          ),
                        if (_data != null && _data!['stats'] != null) ...[
                          AnimatedFadeSlide(
                            index: 0,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Vos statistiques',
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  children: [
                                    StatCard(
                                      label: 'Observance',
                                      value: '${_data!['stats']['observanceRate']}%',
                                      icon: Icons.check_circle_rounded,
                                      color: AppColors.success,
                                    ),
                                    const SizedBox(width: 12),
                                    StatCard(
                                      label: 'Rappel',
                                      value: '${_data!['stats']['activeReminders']}',
                                      icon: Icons.notifications_active_rounded,
                                      color: AppColors.warning,
                                    ),
                                    const SizedBox(width: 12),
                                    StatCard(
                                      label: 'Planifiés',
                                      value: '${_data!['stats']['plannedReminders']}',
                                      icon: Icons.event_note_rounded,
                                      color: AppColors.primary,
                                    ),
                                  ],
                                ),
                                if (!isStandard) ...[
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      StatCard(
                                        label: 'Pharmacie',
                                        value: '${_data!['stats']['nearbyPharmacies'] ?? 0}',
                                        icon: Icons.local_pharmacy_rounded,
                                        color: AppColors.secondary,
                                      ),
                                      const SizedBox(width: 12),
                                      StatCard(
                                        label: 'En retard',
                                        value: '${_data!['stats']['overdueReminders'] ?? 0}',
                                        icon: Icons.warning_amber_rounded,
                                        color: AppColors.destructive,
                                      ),
                                      const SizedBox(width: 12),
                                      StatCard(
                                        label: 'De garde',
                                        value: '${_data!['stats']['pharmaciesOnDuty'] ?? 0}',
                                        icon: Icons.nightlight_round,
                                        color: const Color(0xFF6366F1),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                          AnimatedFadeSlide(
                            index: 1,
                            child: QuotaSection(
                              ordonnances: QuotaInfo.fromMap(
                                (_data!['stats']['quota'] as Map<String, dynamic>?)?['ordonnances']
                                    as Map<String, dynamic>?,
                              ),
                              rappels: QuotaInfo.fromMap(
                                (_data!['stats']['quota'] as Map<String, dynamic>?)?['rappels']
                                    as Map<String, dynamic>?,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                        ],
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildNextDoseCard(Map<String, dynamic> nextDose) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.access_time_filled_rounded, color: Colors.white, size: 28),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nextDose['isOverdue'] == true ? 'Dose en retard' : 'Prochaine dose',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  nextDose['medicationName'] ?? '',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                Text(
                  nextDose['time'] ?? '',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 500.ms, curve: Curves.easeOut).scale(
          begin: const Offset(0.97, 0.97),
          end: const Offset(1, 1),
          duration: 500.ms,
          curve: Curves.easeOutCubic,
        );
  }
}
