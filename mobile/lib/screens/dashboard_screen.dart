import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_card.dart';
import '../widgets/loading_view.dart';
import '../widgets/stat_card.dart';

class DashboardScreen extends StatefulWidget {
  final bool embedded;
  const DashboardScreen({super.key, this.embedded = false});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with WidgetsBindingObserver {
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
    if (state == AppLifecycleState.resumed) _loadData();
  }

  Future<void> _loadData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = Provider.of<ApiService>(context, listen: false);
    if (auth.user == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    try {
      final data = await api.getDashboard(auth.user!.id);
      if (mounted) setState(() { _data = data; _isLoading = false; _loadError = null; });
    } catch (e) {
      if (mounted) setState(() { _isLoading = false; _loadError = 'Impossible de charger les statistiques'; });
    }
  }

  String _typeLabel(String? type) {
    switch (type) {
      case 'commercial': return 'Commercial';
      case 'professional': return 'Professionnel';
      case 'admin': return 'Administrateur';
      default: return 'Patient';
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final userName = auth.user?.name ?? 'Utilisateur';

    if (_isLoading) return const LoadingView(message: 'Chargement du tableau de bord...');

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildHeader(auth, userName)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (_loadError != null)
                    AppCard(
                      child: Row(children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.destructive),
                        const SizedBox(width: 12),
                        Expanded(child: Text(_loadError!, style: const TextStyle(color: AppColors.destructive, fontWeight: FontWeight.w600))),
                        TextButton(onPressed: _loadData, child: const Text('Réessayer')),
                      ]),
                    ),
                  if (_data?['stats'] != null) ...[
                    AnimatedFadeSlide(
                      index: 0,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Vos statistiques',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 14),
                          Row(children: [
                            StatCard(label: 'Observance', value: '${_data!['stats']['observanceRate']}%', icon: Icons.check_circle_rounded, color: AppColors.success),
                            const SizedBox(width: 12),
                            StatCard(label: 'Rappels', value: '${_data!['stats']['activeReminders']}', icon: Icons.notifications_active_rounded, color: AppColors.warning),
                            const SizedBox(width: 12),
                            StatCard(label: 'Planifiés', value: '${_data!['stats']['plannedReminders']}', icon: Icons.event_note_rounded, color: AppColors.primary),
                          ]),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    AnimatedFadeSlide(
                      index: 1,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Quotas',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 14),
                          QuotaSection(
                            ordonnances: QuotaInfo.fromMap(
                              (_data!['stats']['quota'] as Map<String, dynamic>?)?['ordonnances'] as Map<String, dynamic>?,
                            ),
                            rappels: QuotaInfo.fromMap(
                              (_data!['stats']['quota'] as Map<String, dynamic>?)?['rappels'] as Map<String, dynamic>?,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Header teal avec avatar + badge compte ───
  Widget _buildHeader(dynamic auth, String userName) {
    final initials = userName.trim().isNotEmpty
        ? userName.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : 'U';
    final now = DateTime.now();
    final weekdays = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
    final months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    final dateStr = '${weekdays[now.weekday - 1]} ${now.day} ${months[now.month - 1]} ${now.year}';

    return Container(
      color: AppColors.primary,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                // Avatar initiales
                Container(
                  width: 46, height: 46,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    shape: BoxShape.circle,
                  ),
                  child: Center(child: Text(initials,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Bonjour, $userName 👋',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 17)),
                    Text(dateStr,
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.78), fontSize: 12)),
                  ],
                )),
                // Badge type
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.verified_rounded, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(_typeLabel(auth.user?.type),
                        style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                ),
              ]),
              const SizedBox(height: 16),
              // Carte dose / tout à jour
              _data?['stats']?['nextDose'] != null
                  ? _buildNextDoseCard(_data!['stats']['nextDose'])
                  : _buildAllGoodCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAllGoodCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: AppColors.primaryLight, shape: BoxShape.circle),
          child: const Icon(Icons.check_circle_rounded, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 12),
        const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Tout est à jour !', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          Text('Aucun rappel en retard.', style: TextStyle(color: AppColors.mutedForeground, fontSize: 12)),
        ]),
      ]),
    );
  }

  Widget _buildNextDoseCard(Map<String, dynamic> nextDose) {
    final isOverdue = nextDose['isOverdue'] == true;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isOverdue ? Border.all(color: AppColors.warning.withValues(alpha: 0.4)) : null,
      ),
      child: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: isOverdue ? AppColors.warningLight : AppColors.primaryLight,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.access_time_rounded,
              color: isOverdue ? AppColors.warning : AppColors.primary, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            isOverdue ? 'Dose en retard' : 'Prochaine dose',
            style: TextStyle(
              color: isOverdue ? AppColors.warning : AppColors.foreground,
              fontWeight: FontWeight.w700, fontSize: 14,
            ),
          ),
          Text(
            '${nextDose['medicationName'] ?? ''} — prévu à ${nextDose['time'] ?? ''}',
            style: const TextStyle(color: AppColors.mutedForeground, fontSize: 12),
          ),
        ])),
        Text('Voir →',
            style: TextStyle(
                color: isOverdue ? AppColors.warning : AppColors.primary,
                fontWeight: FontWeight.w700, fontSize: 13)),
      ]),
    ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.97, 0.97), duration: 400.ms);
  }
}
