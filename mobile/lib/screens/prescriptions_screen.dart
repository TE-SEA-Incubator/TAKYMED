
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
import '../widgets/ordonnance_detail_panel.dart';
import '../widgets/page_transitions.dart';
import '../widgets/primary_button.dart';
import '../widgets/status_badge.dart';
import 'create_prescription_screen.dart';
import 'package:intl/intl.dart';

class OrdonnancesScreen extends StatefulWidget {
  final bool embedded;

  const OrdonnancesScreen({super.key, this.embedded = false});

  @override
  State<OrdonnancesScreen> createState() => _OrdonnancesScreenState();
}

class _OrdonnancesScreenState extends State<OrdonnancesScreen> {
  List<dynamic> ordonnances = [];
  int? expandedId;
  Map<int, dynamic> ordonnanceDetails = {};
  bool isLoading = true;
  String? errorMessage;

  bool _isActive(dynamic ord) => ord['est_active'] == 1 || ord['est_active'] == true;

  int get _total => ordonnances.length;
  int get _terminees => ordonnances.where((o) {
        final total = (o['prises_totales'] as num?)?.toInt() ?? 0;
        final done = (o['prises_effectuees'] as num?)?.toInt() ?? 0;
        return _isActive(o) && total > 0 && done >= total;
      }).length;
  int get _enCours => ordonnances.where((o) {
        final total = (o['prises_totales'] as num?)?.toInt() ?? 0;
        final done = (o['prises_effectuees'] as num?)?.toInt() ?? 0;
        return _isActive(o) && (total == 0 || done < total);
      }).length;

  @override
  void initState() {
    super.initState();
    _fetchOrdonnances();
  }

  Future<void> _fetchOrdonnances() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    if (authProvider.user == null) {
      setState(() {
        isLoading = false;
        errorMessage = 'Utilisateur non connecté';
      });
      return;
    }

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.getOrdonnances(authProvider.user!.id);
      setState(() {
        ordonnances = data['ordonnances'] ?? [];
        isLoading = false;
        errorMessage = null;
      });
      if (expandedId != null) {
        await _fetchOrdonnanceDetails(expandedId!);
      }
    } catch (e) {
      setState(() {
        errorMessage = e.toString();
        isLoading = false;
      });
    }
  }

  Future<void> _fetchOrdonnanceDetails(int id) async {
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.getOrdonnanceDetails(id);
      if (mounted) setState(() => ordonnanceDetails[id] = data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    }
  }

  void _toggleExpand(int id) {
    if (expandedId == id) {
      setState(() => expandedId = null);
    } else {
      setState(() => expandedId = id);
      if (!ordonnanceDetails.containsKey(id)) _fetchOrdonnanceDetails(id);
    }
  }

  Future<bool?> _confirmDialog(String title, String content, {bool destructive = false}) {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: destructive ? AppColors.destructive : AppColors.primary),
            child: Text(destructive ? 'Supprimer' : 'Confirmer'),
          ),
        ],
      ),
    );
  }

  Future<void> _cancelOrdonnance(int id) async {
    if (await _confirmDialog('Annuler l\'ordonnance', 'Les rappels seront suspendus. Vous pourrez réactiver plus tard.') != true) return;
    try {
      await Provider.of<ApiService>(context, listen: false).cancelOrdonnance(id);
      await _fetchOrdonnances();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ordonnance annulée')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _reactivateOrdonnance(int id) async {
    if (await _confirmDialog('Réactiver l\'ordonnance', 'Réactiver cette ordonnance et reprendre les rappels ?') != true) return;
    try {
      await Provider.of<ApiService>(context, listen: false).reactivateOrdonnance(id);
      await _fetchOrdonnances();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ordonnance réactivée')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _deleteOrdonnance(int id) async {
    if (await _confirmDialog(
          'Supprimer définitivement',
          'Cette action est irréversible. Toutes les données seront effacées.',
          destructive: true,
        ) !=
        true) return;

    final userId = Provider.of<AuthProvider>(context, listen: false).user?.id;
    try {
      await Provider.of<ApiService>(context, listen: false).deleteOrdonnance(id, userId: userId);
      setState(() {
        ordonnances.removeWhere((o) => o['id'] == id);
        ordonnanceDetails.remove(id);
        if (expandedId == id) expandedId = null;
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ordonnance supprimée')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _showManageDialog(dynamic ord) async {
    final action = await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.cancel_outlined, color: AppColors.destructive),
              title: const Text('Annuler l\'ordonnance'),
              onTap: () => Navigator.pop(ctx, 'cancel'),
            ),
            if (!_isActive(ord))
              ListTile(
                leading: const Icon(Icons.delete_forever_outlined, color: AppColors.destructive),
                title: const Text('Supprimer définitivement'),
                onTap: () => Navigator.pop(ctx, 'delete'),
              ),
          ],
        ),
      ),
    );

    if (action == 'cancel') await _cancelOrdonnance(ord['id'] as int);
    if (action == 'delete') await _deleteOrdonnance(ord['id'] as int);
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: LoadingView(message: 'Chargement des ordonnances...'),
      );
    }

    if (errorMessage != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: EmptyState(
          icon: Icons.error_outline_rounded,
          title: 'Erreur de chargement',
          subtitle: errorMessage,
          action: PrimaryButton(label: 'Réessayer', onPressed: _fetchOrdonnances),
        ),
      );
    }

    final userId = Provider.of<AuthProvider>(context, listen: false).user!.id;

    return Scaffold(
      backgroundColor: AppColors.background,
      floatingActionButton: FloatingActionButton(
        onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, size: 28, color: Colors.white),
      ),
      body: Column(
        children: [
          GradientHeader(
            title: 'Mes ordonnances',
            subtitle: '$_total ordonnance${_total > 1 ? 's' : ''}',
            trailing: IconButton(
              onPressed: _fetchOrdonnances,
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.15)),
            ),
          ),
          if (ordonnances.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                children: [
                  _statChip('Total', '$_total', AppColors.primary),
                  const SizedBox(width: 8),
                  _statChip('En cours', '$_enCours', AppColors.warning),
                  const SizedBox(width: 8),
                  _statChip('Terminées', '$_terminees', AppColors.success),
                ],
              ),
            ),
          Expanded(
            child: ordonnances.isEmpty
                ? EmptyState(
                    icon: Icons.description_outlined,
                    title: 'Aucune ordonnance',
                    subtitle: 'Créez votre premier rappel de traitement',
                    action: PrimaryButton(
                      label: 'Nouveau rappel',
                      icon: Icons.add_rounded,
                      onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _fetchOrdonnances,
                    color: AppColors.primary,
                    child: ListView.builder(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                      itemCount: ordonnances.length,
                      itemBuilder: (context, index) {
                        final ord = ordonnances[index];
                        return AnimatedFadeSlide(
                          index: index,
                          child: _buildOrdonnanceCard(ord, userId),
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _statChip(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: color)),
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.mutedForeground)),
          ],
        ),
      ),
    );
  }

  Widget _buildOrdonnanceCard(dynamic ord, int userId) {
    final isExpanded = expandedId == ord['id'];
    final details = ordonnanceDetails[ord['id']];
    final total = (ord['prises_totales'] as num?)?.toInt() ?? 0;
    final done = (ord['prises_effectuees'] as num?)?.toInt() ?? 0;
    final progressPercent = total > 0 ? ((done / total) * 100).round() : 0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: AppCard(
        padding: const EdgeInsets.all(0),
        child: Column(
          children: [
            InkWell(
              onTap: () => _toggleExpand(ord['id'] as int),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            ord['titre'] ?? 'Ordonnance #${ord['id']}',
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
                          ),
                        ),
                        StatusBadge.fromOrdonnance(ord),
                        const SizedBox(width: 8),
                        AnimatedRotation(
                          turns: isExpanded ? 0.5 : 0,
                          duration: 300.ms,
                          child: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.mutedForeground),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _infoRow(Icons.person_outline_rounded, ord['nom_patient'] ?? ''),
                    const SizedBox(height: 6),
                    _infoRow(
                      Icons.calendar_today_rounded,
                      DateFormat.yMMMd('fr_FR').format(DateTime.parse(ord['date_ordonnance'].toString())),
                    ),
                    const SizedBox(height: 6),
                    _infoRow(Icons.medication_outlined, '${ord['nombre_medicaments']} médicament(s)'),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Text('$progressPercent%', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: LinearProgressIndicator(
                              value: progressPercent / 100,
                              minHeight: 8,
                              backgroundColor: AppColors.muted,
                              color: progressPercent == 100 ? AppColors.success : AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Text('$done/$total', style: const TextStyle(color: AppColors.mutedForeground, fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (_isActive(ord))
                    _actionChip('Gérer', Icons.settings_outlined, AppColors.mutedForeground, () => _showManageDialog(ord)),
                  if (_isActive(ord))
                    _actionChip('Annuler', Icons.cancel_outlined, AppColors.destructive, () => _cancelOrdonnance(ord['id'])),
                  if (!_isActive(ord)) ...[
                    _actionChip('Réactiver', Icons.refresh_rounded, AppColors.primary, () => _reactivateOrdonnance(ord['id'])),
                    _actionChip('Supprimer', Icons.delete_outline_rounded, AppColors.destructive, () => _deleteOrdonnance(ord['id'])),
                  ],
                ],
              ),
            ),
            AnimatedCrossFade(
              firstChild: const SizedBox.shrink(),
              secondChild: details != null
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                      child: OrdonnanceDetailPanel(
                        ord: ord,
                        details: details,
                        userId: userId,
                        api: Provider.of<ApiService>(context, listen: false),
                        onRefresh: () async {
                          await _fetchOrdonnanceDetails(ord['id'] as int);
                          await _fetchOrdonnances();
                        },
                      ),
                    )
                  : const Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()),
              crossFadeState: isExpanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
              duration: 300.ms,
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.mutedForeground),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground))),
      ],
    );
  }

  Widget _actionChip(String label, IconData icon, Color color, VoidCallback onTap) {
    return ActionChip(
      avatar: Icon(icon, size: 16, color: color),
      label: Text(label, style: TextStyle(color: color, fontSize: 12)),
      backgroundColor: color.withValues(alpha: 0.08),
      side: BorderSide(color: color.withValues(alpha: 0.2)),
      onPressed: onTap,
    );
  }
}
