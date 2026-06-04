
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_text_field.dart';
import '../widgets/gradient_header.dart';
import '../widgets/primary_button.dart';

class CommercialRegisterScreen extends StatefulWidget {
  const CommercialRegisterScreen({super.key});

  @override
  State<CommercialRegisterScreen> createState() => _CommercialRegisterScreenState();
}

class _CommercialRegisterScreenState extends State<CommercialRegisterScreen> {
  int _step = 1;
  final _clientNameController = TextEditingController();
  final _clientPhoneController = TextEditingController();
  final _pinController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _clientNameController.dispose();
    _clientPhoneController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _registerClient() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final apiService = Provider.of<ApiService>(context, listen: false);

    final clientName = _clientNameController.text.trim();
    final clientPhone = '+237${_clientPhoneController.text.replaceAll(RegExp(r'\s+'), '')}';

    if (clientName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Nom du client requis')));
      return;
    }
    if (_clientPhoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Numéro de téléphone requis')));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final availability = await apiService.checkCommercialClientAvailability(
        authProvider.user!.id,
        clientName,
        clientPhone,
      );

      if (availability['available'] != true) {
        final errors = availability['errors'];
        final message = errors is List && errors.isNotEmpty
            ? errors.first.toString()
            : 'Ce client ne peut pas être inscrit.';
        throw Exception(message);
      }

      await apiService.registerCommercialClient(
        authProvider.user!.id,
        clientName,
        clientPhone,
        {
          'title': 'Ordonnance initiale',
          'medications': [
            {
              'name': 'Doliprane 1000',
              'frequencyType': '1x',
              'times': ['08:00'],
              'durationDays': 7,
              'doseValue': 1,
              'unit': 'comprimé',
            },
          ],
        },
        DateTime.now().toIso8601String().split('T').first,
      );
      setState(() {
        _step = 4;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
        );
      }
    }
  }

  Future<void> _validateClient() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final apiService = Provider.of<ApiService>(context, listen: false);

    if (_pinController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PIN requis')));
      return;
    }

    setState(() => _isLoading = true);

    try {
      await apiService.validateCommercialClient(
        authProvider.user!.id,
        '+237${_clientPhoneController.text.replaceAll(RegExp(r'\s+'), '')}',
        _pinController.text.trim(),
      );
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Client validé avec succès !'), backgroundColor: AppColors.success),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    if (authProvider.user == null || authProvider.user?.type != 'commercial') {
      return Scaffold(
        body: Center(child: Text('Accès réservé aux commerciaux', style: TextStyle(color: AppColors.mutedForeground))),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: 'Inscrire un client',
            subtitle: 'Étape $_step sur 4',
            showBack: true,
            bottom: _buildStepIndicator(),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: _buildStep(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepIndicator() {
    return Row(
      children: List.generate(4, (i) {
        final stepNum = i + 1;
        final isActive = stepNum <= _step;
        final isCurrent = stepNum == _step;
        return Expanded(
          child: Container(
            margin: EdgeInsets.only(right: i < 3 ? 8 : 0),
            height: 4,
            decoration: BoxDecoration(
              color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ).animate(target: isCurrent ? 1 : 0).scaleX(begin: 0.8, duration: 300.ms),
        );
      }),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 1:
        return _buildStep1();
      case 4:
        return _buildStep4();
      default:
        return Center(
          child: Text('Étape en développement', style: TextStyle(color: AppColors.mutedForeground)),
        );
    }
  }

  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Informations du client',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ).animate().fadeIn(),
        const SizedBox(height: 8),
        Text(
          'Saisissez les coordonnées du nouveau patient',
          style: TextStyle(color: AppColors.mutedForeground),
        ),
        const SizedBox(height: 24),
        AnimatedFadeSlide(
          index: 0,
          child: AppTextField(
            controller: _clientNameController,
            label: 'Nom complet du client',
            prefixIcon: Icons.person_rounded,
          ),
        ),
        const SizedBox(height: 16),
        AnimatedFadeSlide(
          index: 1,
          child: AppTextField(
            controller: _clientPhoneController,
            label: 'Téléphone (6XXXXXXXX)',
            prefixIcon: Icons.phone_rounded,
            prefixText: '+237 ',
            keyboardType: TextInputType.phone,
          ),
        ),
        const SizedBox(height: 32),
        PrimaryButton(
          label: _isLoading ? 'Inscription en cours...' : 'Continuer',
          icon: Icons.arrow_forward_rounded,
          isLoading: _isLoading,
          onPressed: _registerClient,
        ),
      ],
    );
  }

  Widget _buildStep4() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.successLight,
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: AppColors.success),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Client inscrit ! Demandez-lui son code PIN reçu par SMS.',
                  style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ).animate().fadeIn().scale(begin: const Offset(0.95, 0.95)),
        const SizedBox(height: 24),
        AnimatedFadeSlide(
          index: 0,
          child: AppTextField(
            controller: _pinController,
            label: 'Code PIN du client',
            prefixIcon: Icons.security_rounded,
            keyboardType: TextInputType.number,
          ),
        ),
        const SizedBox(height: 32),
        PrimaryButton(
          label: _isLoading ? 'Validation...' : 'Valider le compte',
          icon: Icons.verified_rounded,
          isLoading: _isLoading,
          backgroundColor: AppColors.success,
          onPressed: _validateClient,
        ),
      ],
    );
  }
}
