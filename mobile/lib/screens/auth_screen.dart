import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/auth_exception.dart';
import '../theme/app_colors.dart';
import '../utils/auth_phone.dart';
import '../widgets/app_text_field.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/page_transitions.dart';
import '../widgets/primary_button.dart';
import '../widgets/takymed_logo.dart';
import 'settings_screen.dart';

enum AuthMode { login, register }

/// Flux identique au web : téléphone → PIN (SMS à l'inscription).
class AuthScreen extends StatefulWidget {
  final AuthMode mode;

  const AuthScreen({super.key, required this.mode});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();

  AuthStep _step = AuthStep.phone;
  bool _isLoading = false;
  bool _obscurePin = true;
  String _selectedCountry = 'CM';
  List<CountryOption> _countries = [CountryOption.fallback];
  final String _selectedType = 'standard';

  @override
  void initState() {
    super.initState();
    _loadCountries();
  }

  Future<void> _loadCountries() async {
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final list = await api.getCountries();
      if (mounted && list.isNotEmpty) {
        setState(() => _countries = list);
      }
    } catch (_) {}
  }

  String get _fullPhone => buildFullPhone(
        _phoneController.text,
        _selectedCountry,
        _countries,
      );

  bool get _isSpecialAccount {
    final p = _phoneController.text.trim();
    return p == 'admin' || p == 'commercial';
  }

  Future<void> _onContinue() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    try {
      if (widget.mode == AuthMode.login) {
        setState(() => _step = AuthStep.pin);
      } else {
        final api = Provider.of<ApiService>(context, listen: false);
        final message = await api.register(_fullPhone, _selectedType);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(message)),
          );
          setState(() => _step = AuthStep.pin);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_cleanError(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onSubmitPin() async {
    if (_pinController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez entrer votre PIN')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final api = Provider.of<ApiService>(context, listen: false);
      final success = await auth.login(_fullPhone, _selectedType, _pinController.text.trim(), api);
      if (mounted && success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.mode == AuthMode.register
                  ? 'Compte créé et connecté !'
                  : 'Connexion réussie',
            ),
          ),
        );
      }
    } on AuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.message),
            backgroundColor: e.pinRegenerated ? AppColors.warning : null,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_cleanError(e))),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _cleanError(Object e) {
    return e.toString().replaceFirst('Exception: ', '');
  }

  @override
  Widget build(BuildContext context) {
    final isRegister = widget.mode == AuthMode.register;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.primaryLight, AppColors.background],
            stops: [0.0, 0.4],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
              const SizedBox(height: 40),
              if (widget.mode == AuthMode.login)
                Align(
                  alignment: Alignment.topRight,
                  child: IconButton(
                    onPressed: () => pushSlide(context, const SettingsScreen()),
                    icon: const Icon(Icons.settings_outlined),
                    style: IconButton.styleFrom(backgroundColor: AppColors.surface),
                  ),
                ).animate().fadeIn(delay: 100.ms),
              if (isRegister)
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back_rounded),
                    style: IconButton.styleFrom(backgroundColor: AppColors.surface),
                  ),
                ),
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
                isRegister ? 'Créer un compte' : 'TAKYMED',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: isRegister ? null : AppColors.primary,
                      letterSpacing: isRegister ? 0 : 1,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                isRegister
                    ? 'Un PIN vous sera envoyé par SMS'
                    : 'Votre assistant santé au quotidien',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.mutedForeground,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              if (_step == AuthStep.phone) ...[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: DropdownButtonFormField<String>(
                        value: _selectedCountry,
                        decoration: InputDecoration(
                          labelText: 'Pays',
                          filled: true,
                          fillColor: AppColors.surface,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        items: _countries
                            .map(
                              (c) => DropdownMenuItem(
                                value: c.code,
                                child: Text('${c.flag} ${c.dialCode}', overflow: TextOverflow.ellipsis),
                              ),
                            )
                            .toList(),
                        onChanged: (v) {
                          if (v != null) setState(() => _selectedCountry = v);
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: AppTextField(
                        controller: _phoneController,
                        label: 'Numéro de téléphone',
                        hint: '6XXXXXXXX',
                        prefixIcon: Icons.phone_rounded,
                        keyboardType: TextInputType.phone,
                        validator: (v) =>
                            v == null || v.trim().isEmpty ? 'Numéro requis' : null,
                      ),
                    ),
                  ],
                ),
                if (isRegister) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
                    ),
                    child: Text(
                      'Compte Standard gratuit. Votre code PIN sera envoyé par SMS après inscription.',
                      style: TextStyle(color: AppColors.mutedForeground, fontSize: 13),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                PrimaryButton(
                  label: isRegister ? 'S\'inscrire' : 'Continuer',
                  icon: Icons.arrow_forward_rounded,
                  isLoading: _isLoading,
                  onPressed: _onContinue,
                ),
                if (widget.mode == AuthMode.login) ...[
                  const SizedBox(height: 12),
                  SecondaryButton(
                    label: 'Créer un compte',
                    icon: Icons.person_add_rounded,
                    onPressed: () => pushSlide(context, const AuthScreen(mode: AuthMode.register)),
                  ),
                ],
              ] else ...[
                AppTextField(
                  controller: _pinController,
                  label: 'Code PIN',
                  hint: _isSpecialAccount ? 'PIN' : '••••••',
                  prefixIcon: Icons.lock_rounded,
                  obscureText: _obscurePin,
                  keyboardType: TextInputType.number,
                  maxLength: _isSpecialAccount ? 20 : 6,
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => setState(() => _obscurePin = !_obscurePin),
                    child: Text(_obscurePin ? 'Afficher le PIN' : 'Masquer le PIN'),
                  ),
                ),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.info_outline, size: 18, color: AppColors.warning),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Conservez votre PIN en lieu sûr.',
                          style: TextStyle(fontSize: 12, color: AppColors.warning),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                PrimaryButton(
                  label: _isLoading ? 'Connexion…' : 'Valider et entrer',
                  icon: Icons.login_rounded,
                  isLoading: _isLoading,
                  onPressed: _onSubmitPin,
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() {
                    _step = AuthStep.phone;
                    _pinController.clear();
                  }),
                  child: const Text('Retour'),
                ),
              ],
              const SizedBox(height: 32),
            ],
          ),
        ),
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

enum AuthStep { phone, pin }
