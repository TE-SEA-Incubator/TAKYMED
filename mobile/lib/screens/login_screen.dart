
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_text_field.dart';
import '../widgets/main_shell.dart';
import '../widgets/page_transitions.dart';
import '../widgets/primary_button.dart';
import '../widgets/takymed_logo.dart';
import 'register_screen.dart';
import 'settings_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();
  final String _selectedType = 'standard';
  bool _isLoading = false;
  bool _obscurePin = true;

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final apiService = Provider.of<ApiService>(context);

    return AuthScaffold(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              const SizedBox(height: 40),
              Align(
                alignment: Alignment.topRight,
                child: IconButton(
                  onPressed: () => pushSlide(context, const SettingsScreen()),
                  icon: const Icon(Icons.settings_outlined),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.surface,
                  ),
                ),
              ).animate().fadeIn(delay: 100.ms),
              const SizedBox(height: 16),
              const Hero(
                tag: 'takymed_logo',
                child: TakymedLogo(
                  size: TakymedLogoSize.hero,
                  circularBackground: true,
                ),
              ).animate().scale(
                    begin: const Offset(0.8, 0.8),
                    duration: 600.ms,
                    curve: Curves.elasticOut,
                  ),
              const SizedBox(height: 24),
              Text(
                'TAKYMED',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                      letterSpacing: 1,
                    ),
              ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.2),
              const SizedBox(height: 8),
              Text(
                'Votre assistant santé au quotidien',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.mutedForeground,
                    ),
              ).animate().fadeIn(delay: 300.ms),
              const SizedBox(height: 48),
              AppTextField(
                controller: _phoneController,
                label: 'Numéro de téléphone',
                hint: '+237 6XX XXX XXX',
                prefixIcon: Icons.phone_rounded,
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Veuillez entrer votre numéro';
                  }
                  return null;
                },
              ).animate().fadeIn(delay: 400.ms).slideX(begin: -0.1),
              const SizedBox(height: 16),
              AppTextField(
                controller: _pinController,
                label: 'Code PIN',
                prefixIcon: Icons.lock_rounded,
                obscureText: _obscurePin,
                keyboardType: TextInputType.number,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Veuillez entrer votre PIN';
                  }
                  return null;
                },
              ).animate().fadeIn(delay: 500.ms).slideX(begin: -0.1),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => setState(() => _obscurePin = !_obscurePin),
                  child: Text(_obscurePin ? 'Afficher le PIN' : 'Masquer le PIN'),
                ),
              ),
              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Se connecter',
                icon: Icons.login_rounded,
                isLoading: _isLoading,
                onPressed: () async {
                  if (!_formKey.currentState!.validate()) return;
                  setState(() => _isLoading = true);
                  try {
                    await authProvider.login(
                      _phoneController.text,
                      _selectedType,
                      _pinController.text,
                      apiService,
                    );
                  } catch (e) {
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString())),
                      );
                    }
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
              ).animate().fadeIn(delay: 600.ms).slideY(begin: 0.2),
              const SizedBox(height: 12),
              SecondaryButton(
                label: 'Créer un compte',
                icon: Icons.person_add_rounded,
                onPressed: () => pushSlide(context, const RegisterScreen()),
              ).animate().fadeIn(delay: 700.ms),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _pinController.dispose();
    super.dispose();
  }
}
