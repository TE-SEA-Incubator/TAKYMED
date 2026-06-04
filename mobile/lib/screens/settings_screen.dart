
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/push_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/gradient_header.dart';
import '../widgets/primary_button.dart';

class SettingsScreen extends StatefulWidget {
  final bool embedded;

  const SettingsScreen({super.key, this.embedded = false});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String? _pingResult;
  bool _isPinging = false;
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  bool _isSavingProfile = false;
  bool _isLoadingNotifPrefs = false;
  bool _isSavingNotifPrefs = false;
  final Set<String> _notifChannels = {'push', 'whatsapp'};
  final _notifPhoneController = TextEditingController();

  @override
  void initState() {
    super.initState();
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    _nameController.text = authProvider.user?.name ?? '';
    _phoneController.text = authProvider.user?.phone ?? '';
    _notifPhoneController.text = (authProvider.user?.phone ?? '').replaceAll('+237', '');
    _loadNotificationPreferences();
  }

  Future<void> _loadNotificationPreferences() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user == null) return;
    setState(() => _isLoadingNotifPrefs = true);
    try {
      final prefs = await Provider.of<ApiService>(context, listen: false)
          .getNotificationPreferences(auth.user!.id);
      setState(() {
        _notifChannels
          ..clear()
          ..addAll((prefs['channels'] as List<dynamic>? ?? ['push']).map((e) => e.toString()));
        final recipients = prefs['recipients'] as List<dynamic>? ?? [];
        if (recipients.isNotEmpty) {
          _notifPhoneController.text = recipients.first.toString().replaceAll('+237', '');
        }
      });
    } catch (_) {
      // keep defaults
    } finally {
      if (mounted) setState(() => _isLoadingNotifPrefs = false);
    }
  }

  Future<void> _saveNotificationPreferences() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user == null) return;
    setState(() => _isSavingNotifPrefs = true);
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final recipients = _notifChannels.any((c) => c != 'push')
          ? ['+237${_notifPhoneController.text.trim()}']
          : <String>[];
      await api.saveNotificationPreferences(
        auth.user!.id,
        channels: _notifChannels.toList(),
        recipients: recipients,
      );
      if (_notifChannels.contains('push')) {
        await PushService.registerDevice(api, auth.user!.id);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Préférences de notification enregistrées'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: AppColors.destructive),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingNotifPrefs = false);
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _notifPhoneController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final apiService = Provider.of<ApiService>(context, listen: false);

    if (_nameController.text.trim().isEmpty || _phoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez remplir tous les champs')),
      );
      return;
    }

    setState(() => _isSavingProfile = true);

    try {
      await apiService.updateProfile(
        authProvider.user!.id,
        _nameController.text.trim(),
        _phoneController.text.trim(),
      );
      await authProvider.updateUser(
        _nameController.text.trim(),
        _phoneController.text.trim(),
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profil mis à jour avec succès'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e'), backgroundColor: AppColors.destructive),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingProfile = false);
    }
  }

  Future<void> _pingServer() async {
    final apiService = Provider.of<ApiService>(context, listen: false);
    setState(() {
      _isPinging = true;
      _pingResult = null;
    });

    try {
      final result = await apiService.ping();
      setState(() => _pingResult = result);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Connexion au serveur OK'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      setState(() => _pingResult = 'Erreur: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Échec: $e'), backgroundColor: AppColors.destructive),
        );
      }
    } finally {
      if (mounted) setState(() => _isPinging = false);
    }
  }

  String getAccountTypeLabel(String type) {
    switch (type) {
      case 'standard':
        return 'Patient';
      case 'professional':
        return 'Professionnel';
      case 'commercial':
        return 'Commercial';
      case 'admin':
        return 'Administrateur';
      default:
        return type;
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final currentType = authProvider.user?.type ?? 'standard';
    final isLoggedIn = authProvider.isAuthenticated;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: isLoggedIn ? 'Mon profil' : 'Paramètres',
            subtitle: isLoggedIn ? authProvider.user?.phone ?? '' : 'Configuration',
            trailing: isLoggedIn
                ? IconButton(
                    onPressed: () => authProvider.logout(),
                    icon: const Icon(Icons.logout_rounded, color: Colors.white),
                    style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.15)),
                    tooltip: 'Déconnexion',
                  )
                : null,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
              children: [
                if (isLoggedIn) ...[
                  AnimatedFadeSlide(
                    index: 0,
                    child: AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  gradient: AppColors.primaryGradient,
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Center(
                                  child: Text(
                                    (authProvider.user?.name ?? 'U')[0].toUpperCase(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      authProvider.user?.name ?? '',
                                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
                                    ),
                                    Container(
                                      margin: const EdgeInsets.only(top: 4),
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: AppColors.primaryLight,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        getAccountTypeLabel(currentType),
                                        style: const TextStyle(
                                          color: AppColors.primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          AppTextField(
                            controller: _nameController,
                            label: 'Nom complet',
                            prefixIcon: Icons.person_rounded,
                          ),
                          const SizedBox(height: 16),
                          AppTextField(
                            controller: _phoneController,
                            label: 'Numéro de téléphone',
                            prefixIcon: Icons.phone_rounded,
                            keyboardType: TextInputType.phone,
                          ),
                          const SizedBox(height: 20),
                          PrimaryButton(
                            label: 'Enregistrer',
                            icon: Icons.save_rounded,
                            isLoading: _isSavingProfile,
                            onPressed: _saveProfile,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  AnimatedFadeSlide(
                    index: 1,
                    child: AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Notifications', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 12),
                          if (_isLoadingNotifPrefs)
                            const Center(child: CircularProgressIndicator())
                          else ...[
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _notifChip('sms', 'SMS'),
                                _notifChip('whatsapp', 'WhatsApp'),
                                _notifChip('call', 'Appel'),
                                _notifChip('push', 'Push'),
                              ],
                            ),
                            if (_notifChannels.any((c) => c != 'push')) ...[
                              const SizedBox(height: 16),
                              AppTextField(
                                controller: _notifPhoneController,
                                label: 'Téléphone pour SMS / WhatsApp',
                                prefixIcon: Icons.phone_rounded,
                                prefixText: '+237 ',
                                keyboardType: TextInputType.phone,
                              ),
                            ],
                            const SizedBox(height: 16),
                            PrimaryButton(
                              label: 'Enregistrer les canaux',
                              icon: Icons.notifications_rounded,
                              isLoading: _isSavingNotifPrefs,
                              onPressed: _saveNotificationPreferences,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
                AnimatedFadeSlide(
                  index: 2,
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: AppColors.secondaryLight,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: const Icon(Icons.dns_rounded, color: AppColors.secondary),
                            ),
                            const SizedBox(width: 14),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Connexion serveur', style: TextStyle(fontWeight: FontWeight.w700)),
                                  Text(
                                    'Vérifier la disponibilité de l\'API',
                                    style: TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        PrimaryButton(
                          label: _isPinging ? 'Test en cours...' : 'Tester la connexion',
                          icon: Icons.network_check_rounded,
                          isLoading: _isPinging,
                          backgroundColor: AppColors.secondary,
                          onPressed: _pingServer,
                        ),
                        if (_pingResult != null) ...[
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: _pingResult!.startsWith('Erreur')
                                  ? AppColors.destructiveLight
                                  : AppColors.successLight,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Text(
                              _pingResult!,
                              style: TextStyle(
                                color: _pingResult!.startsWith('Erreur')
                                    ? AppColors.destructive
                                    : AppColors.success,
                                fontSize: 13,
                              ),
                            ),
                          ).animate().fadeIn().slideY(begin: 0.1),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: Text(
                    'TAKYMED v1.0.0',
                    style: TextStyle(color: AppColors.mutedForeground.withValues(alpha: 0.6), fontSize: 12),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _notifChip(String id, String label) {
    final selected = _notifChannels.contains(id);
    return FilterChip(
      selected: selected,
      label: Text(label),
      selectedColor: AppColors.primary,
      checkmarkColor: Colors.white,
      labelStyle: TextStyle(color: selected ? Colors.white : AppColors.foreground),
      onSelected: (value) {
        setState(() {
          if (value) {
            _notifChannels.add(id);
          } else if (_notifChannels.length > 1) {
            _notifChannels.remove(id);
          }
        });
      },
    );
  }
}
