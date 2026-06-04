
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/app_text_field.dart';
import '../widgets/main_shell.dart';
import '../widgets/primary_button.dart';
import '../widgets/takymed_logo.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();
  final _confirmPinController = TextEditingController();
  final String _selectedType = 'standard';
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final apiService = Provider.of<ApiService>(context);

    return AuthScaffold(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.arrow_back_rounded),
                  style: IconButton.styleFrom(backgroundColor: AppColors.surface),
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 16),
                    Center(
                      child: const Hero(
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
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Créer un compte',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                    ).animate().fadeIn().slideX(begin: -0.1),
                    const SizedBox(height: 8),
                    Text(
                      'Rejoignez TAKYMED pour gérer vos traitements',
                      style: TextStyle(color: AppColors.mutedForeground),
                    ).animate().fadeIn(delay: 100.ms),
                    const SizedBox(height: 32),
                    AppTextField(
                      controller: _nameController,
                      label: 'Nom complet',
                      prefixIcon: Icons.person_rounded,
                      validator: (v) => v == null || v.isEmpty ? 'Nom requis' : null,
                    ).animate().fadeIn(delay: 200.ms),
                    const SizedBox(height: 16),
                    AppTextField(
                      controller: _phoneController,
                      label: 'Numéro de téléphone',
                      prefixIcon: Icons.phone_rounded,
                      keyboardType: TextInputType.phone,
                      validator: (v) => v == null || v.isEmpty ? 'Numéro requis' : null,
                    ).animate().fadeIn(delay: 300.ms),
                    const SizedBox(height: 16),
                    AppTextField(
                      controller: _pinController,
                      label: 'Code PIN (4 chiffres min.)',
                      prefixIcon: Icons.lock_rounded,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'PIN requis';
                        if (v.length < 4) return 'Minimum 4 chiffres';
                        return null;
                      },
                    ).animate().fadeIn(delay: 400.ms),
                    const SizedBox(height: 16),
                    AppTextField(
                      controller: _confirmPinController,
                      label: 'Confirmer le PIN',
                      prefixIcon: Icons.lock_outline_rounded,
                      obscureText: true,
                      keyboardType: TextInputType.number,
                      validator: (v) {
                        if (v != _pinController.text) return 'Les PINs ne correspondent pas';
                        return null;
                      },
                    ).animate().fadeIn(delay: 500.ms),
                    const SizedBox(height: 32),
                    PrimaryButton(
                      label: 'Créer mon compte',
                      icon: Icons.check_rounded,
                      isLoading: _isLoading,
                      onPressed: () async {
                        if (!_formKey.currentState!.validate()) return;
                        setState(() => _isLoading = true);
                        try {
                          await authProvider.register(
                            _nameController.text,
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
                    ).animate().fadeIn(delay: 600.ms),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _pinController.dispose();
    _confirmPinController.dispose();
    super.dispose();
  }
}
