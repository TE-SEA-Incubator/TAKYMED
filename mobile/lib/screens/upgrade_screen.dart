
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_card.dart';
import '../widgets/gradient_header.dart';
import '../widgets/primary_button.dart';

class UpgradeScreen extends StatefulWidget {
  const UpgradeScreen({super.key});

  @override
  State<UpgradeScreen> createState() => _UpgradeScreenState();
}

class _UpgradeScreenState extends State<UpgradeScreen> {
  List<dynamic> _plans = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final settings = await api.getAccountSettings(auth.user!.id);
      setState(() {
        _plans = (settings['types'] as List<dynamic>? ?? [])
            .where((p) => !(p['name'] as String).toLowerCase().contains('admin'))
            .toList();
      });
    } catch (e) {
      setState(() => _error = 'Impossible de charger les offres');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handlePlanSelection(Map<String, dynamic> plan) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final currentType = auth.user?.type ?? 'standard';
    final planName = plan['name'] as String;
    
    // Simple check if current
    bool isCurrent = false;
    if (currentType == 'standard' && planName.toLowerCase().contains('standard')) isCurrent = true;
    if ((currentType == 'professional' || currentType == 'pharmacist') && planName.toLowerCase().contains('pro')) isCurrent = true;
    if (currentType == 'commercial' && planName.toLowerCase().contains('commercial')) isCurrent = true;

    if (isCurrent) return;

    final motiveController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text('Passer à la formule $planName'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Pourquoi souhaitez-vous changer de formule ?',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: motiveController,
              maxLines: 3,
              decoration: InputDecoration(
                hintText: 'Ex: Besoin de plus d\'ordonnances...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                filled: true,
                fillColor: AppColors.surface,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Votre demande sera examinée par un administrateur.',
              style: TextStyle(fontSize: 11, color: AppColors.mutedForeground, fontStyle: FontStyle.italic),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Envoyer la demande', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true && motiveController.text.trim().isNotEmpty) {
      _submitRequest(planName, motiveController.text.trim());
    } else if (confirmed == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez indiquer un motif')),
      );
    }
  }

  Future<void> _submitRequest(String planName, String motive) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = Provider.of<ApiService>(context, listen: false);

    try {
      await api.submitUpgradeRequest(auth.user!.id, planName, motive: motive);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Demande envoyée avec succès !'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: AppColors.destructive),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final currentType = auth.user?.type ?? 'standard';

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const GradientHeader(
            title: 'Changer de formule',
            subtitle: 'Boostez votre expérience TAKYMED',
            showBack: true,
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!))
                    : ListView.builder(
                        padding: const EdgeInsets.all(20),
                        itemCount: _plans.length,
                        itemBuilder: (context, index) {
                          final plan = _plans[index];
                          final name = plan['name'] as String;
                          final price = plan['price'] as num;
                          final currency = plan['currency'] as String;
                          
                          bool isCurrent = false;
                          if (currentType == 'standard' && name.toLowerCase().contains('standard')) isCurrent = true;
                          if ((currentType == 'professional' || currentType == 'pharmacist') && name.toLowerCase().contains('pro')) isCurrent = true;
                          if (currentType == 'commercial' && name.toLowerCase().contains('commercial')) isCurrent = true;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        name,
                                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                                      ),
                                      if (isCurrent)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppColors.primary.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: const Text(
                                            'Actuelle',
                                            style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    price == 0 ? 'Gratuit' : '${price.toInt().toString()} $currency / mois',
                                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.primary),
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    plan['description'] ?? '',
                                    style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground),
                                  ),
                                  const SizedBox(height: 20),
                                  PrimaryButton(
                                    label: isCurrent ? 'Formule actuelle' : 'Choisir cette formule',
                                    onPressed: isCurrent ? null : () => _handlePlanSelection(plan),
                                    backgroundColor: isCurrent ? Colors.grey.shade300 : AppColors.primary,
                                  ),
                                ],
                              ),
                            ).animate().fadeIn(delay: (index * 100).ms).slideX(begin: 0.1),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
