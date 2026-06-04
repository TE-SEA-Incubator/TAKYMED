
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
import '../widgets/primary_button.dart';
import '../widgets/status_badge.dart';
import 'commercial_register_screen.dart';
import 'create_prescription_screen.dart';

class CommercialDashboardScreen extends StatefulWidget {
  final bool embedded;

  const CommercialDashboardScreen({super.key, this.embedded = false});

  @override
  State<CommercialDashboardScreen> createState() => _CommercialDashboardScreenState();
}

class _CommercialDashboardScreenState extends State<CommercialDashboardScreen> {
  List<dynamic> clients = [];
  Map<String, dynamic>? summary;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    fetchClients();
  }

  Future<void> fetchClients() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user == null) return;
    setState(() => isLoading = true);

    final api = Provider.of<ApiService>(context, listen: false);
    List<dynamic> loadedClients = [];
    Map<String, dynamic>? loadedSummary;
    String? errorMessage;

    try {
      loadedClients = await api.getCommercialClients(auth.user!.id);
    } catch (e) {
      errorMessage = 'Impossible de charger la liste des clients';
      debugPrint('Commercial clients error: $e');
    }

    try {
      loadedSummary = await api.getCommercialStats(auth.user!.id);
    } catch (e) {
      debugPrint('Commercial stats error: $e');
    }

    if (!mounted) return;
    setState(() {
      clients = loadedClients;
      summary = loadedSummary;
      isLoading = false;
    });

    if (errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errorMessage)),
      );
    }
  }

  Future<void> renameClient(int id, String currentName) async {
    final newName = await showDialog<String>(
      context: context,
      builder: (context) {
        final controller = TextEditingController(text: currentName);
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Renommer le client'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(labelText: 'Nouveau nom'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
            TextButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('OK')),
          ],
        );
      },
    );
    if (newName == null || newName == currentName) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await Provider.of<ApiService>(context, listen: false).updateClientName(auth.user!.id, id, newName);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Client renommé')));
      await fetchClients();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Échec de la modification')));
    }
  }

  Future<void> deleteClient(int id, String name) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Supprimer $name ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.destructive),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await Provider.of<ApiService>(context, listen: false).deleteClient(auth.user!.id, id);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Client supprimé')));
      await fetchClients();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Échec de la suppression')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    if (auth.user == null || auth.user!.type != 'commercial') {
      return Scaffold(
        body: EmptyState(
          icon: Icons.lock_rounded,
          title: 'Accès refusé',
          subtitle: 'Réservé aux commerciaux',
        ),
      );
    }

    final totalClients = (summary?['totalClients'] as num?)?.toInt() ?? clients.length;
    final validClients = (summary?['validClients'] as num?)?.toInt() ??
        clients.where((c) => (c['isValid'] as dynamic) == 1 || (c['isValid'] as dynamic) == true).length;
    final pendingClients = (summary?['pendingClients'] as num?)?.toInt() ?? (totalClients - validClients);
    final totalPrescriptions = (summary?['totalPrescriptions'] as num?)?.toInt() ??
        clients.fold<int>(0, (acc, c) => acc + ((c['prescriptionCount'] as num?)?.toInt() ?? 0));
    final totalReminders = (summary?['totalReminders'] as num?)?.toInt() ??
        clients.fold<int>(0, (acc, c) => acc + ((c['reminderCount'] as num?)?.toInt() ?? 0));

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: 'Espace commercial',
            subtitle: '$totalClients client${totalClients > 1 ? 's' : ''} enregistré${totalClients > 1 ? 's' : ''}',
            showBack: !widget.embedded,
            bottom: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton.icon(
                  onPressed: () => pushSlide(context, const CreatePrescriptionScreen()),
                  icon: const Icon(Icons.add_alarm_rounded),
                  label: const Text('Créer un rappel pour moi'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white54),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
                const SizedBox(height: 10),
                PrimaryButton(
                  label: 'Inscrire un client',
                  icon: Icons.person_add_rounded,
                  onPressed: () async {
                    await pushSlide(context, const CommercialRegisterScreen());
                    await fetchClients();
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: fetchClients,
              color: AppColors.primary,
              child: isLoading
                  ? const LoadingView(message: 'Chargement des clients...')
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                      children: [
                        AppCard(
                          gradient: AppColors.primaryGradient,
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              _statRow('Clients total', totalClients.toString()),
                              _statRow('Validés', validClients.toString()),
                              _statRow('En attente', pendingClients.toString()),
                              _statRow('Ordonnances', totalPrescriptions.toString()),
                              _statRow('Rappels total', totalReminders.toString()),
                              _statRow('Rappels actifs', '${(summary?['activeReminders'] as num?)?.toInt() ?? totalReminders}'),
                              _statRow('En retard', '${(summary?['overdueReminders'] as num?)?.toInt() ?? 0}'),
                            ],
                          ),
                        ).animate().fadeIn().slideY(begin: 0.1),
                        const SizedBox(height: 24),
                        Text(
                          'Vos clients',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        if (clients.isEmpty)
                          const EmptyState(
                            icon: Icons.people_outline_rounded,
                            title: 'Aucun client',
                            subtitle: 'Inscrivez votre premier client pour commencer',
                          )
                        else
                          ...clients.asMap().entries.map((entry) {
                            final index = entry.key;
                            final client = entry.value;
                            final isValid = (client['isValid'] as dynamic) == 1 || (client['isValid'] as dynamic) == true;
                            return AnimatedFadeSlide(
                              index: index,
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: AppCard(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            width: 48,
                                            height: 48,
                                            decoration: BoxDecoration(
                                              color: isValid ? AppColors.successLight : AppColors.warningLight,
                                              borderRadius: BorderRadius.circular(14),
                                            ),
                                            child: Icon(
                                              isValid ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
                                              color: isValid ? AppColors.success : AppColors.warning,
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        client['name'] as String,
                                                        style: const TextStyle(fontWeight: FontWeight.w700),
                                                      ),
                                                    ),
                                                    IconButton(
                                                      icon: const Icon(Icons.edit_rounded, size: 18),
                                                      onPressed: () => renameClient(client['id'] as int, client['name'] as String),
                                                    ),
                                                  ],
                                                ),
                                                Text(
                                                  client['phone'] as String? ?? '',
                                                  style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                                                ),
                                              ],
                                            ),
                                          ),
                                          StatusBadge(
                                            label: isValid ? 'Validé' : 'En attente',
                                            type: isValid ? StatusType.validated : StatusType.pending,
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Row(
                                        children: [
                                          _miniStat(Icons.description_outlined, '${(client['prescriptionCount'] as num?)?.toInt() ?? 0} ordo.'),
                                          const SizedBox(width: 16),
                                          _miniStat(Icons.notifications_outlined, '${(client['reminderCount'] as num?)?.toInt() ?? 0} rappels'),
                                          const Spacer(),
                                          if (isValid)
                                            IconButton(
                                              icon: const Icon(Icons.add_alarm_rounded, size: 20, color: AppColors.primary),
                                              tooltip: 'Créer une ordonnance',
                                              onPressed: () {
                                                final clientId = (client['id'] as num?)?.toInt();
                                                if (clientId == null || clientId <= 0) return;
                                                pushSlide(
                                                  context,
                                                  CreatePrescriptionScreen(
                                                    targetUserId: clientId,
                                                    targetUserName: client['name'] as String?,
                                                  ),
                                                );
                                              },
                                            ),
                                          IconButton(
                                            icon: const Icon(Icons.delete_outline_rounded, color: AppColors.destructive),
                                            onPressed: () => deleteClient(client['id'] as int, client['name'] as String),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20)),
        ],
      ),
    );
  }

  Widget _miniStat(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.mutedForeground),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 11, color: AppColors.mutedForeground)),
      ],
    );
  }
}
