import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/auth_exception.dart';
import '../theme/app_colors.dart';
import '../utils/auth_phone.dart';
import '../widgets/page_transitions.dart';
import '../widgets/takymed_logo.dart';
import 'settings_screen.dart';

enum AuthMode { login, register }
enum AuthStep { phone, pin }

/// Écran d'auth redesigné — maquettes juin 2026.
class AuthScreen extends StatefulWidget {
  final AuthMode mode;
  const AuthScreen({super.key, required this.mode});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _pinController = TextEditingController();

  AuthStep _step = AuthStep.phone;
  bool _isLoading = false;
  bool _acceptedTerms = false;
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
      if (mounted && list.isNotEmpty) setState(() => _countries = list);
    } catch (_) {}
  }

  CountryOption get _currentCountry =>
      _countries.firstWhere((c) => c.code == _selectedCountry, orElse: () => CountryOption.fallback);

  String get _fullPhone => buildFullPhone(_phoneController.text, _selectedCountry, _countries);

  bool get _isSpecialAccount {
    final p = _phoneController.text.trim().toLowerCase();
    return p == 'admin' || p == 'commercial';
  }

  Future<void> _onContinue() async {
    if (!_formKey.currentState!.validate()) return;
    if (widget.mode == AuthMode.register && !_acceptedTerms) {
      _showSnack('Veuillez accepter les conditions d\'utilisation', isWarning: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      if (widget.mode == AuthMode.login) {
        setState(() => _step = AuthStep.pin);
      } else {
        final api = Provider.of<ApiService>(context, listen: false);
        final message = await api.register(_fullPhone, _selectedType);
        if (mounted) {
          _showSnack(message);
          setState(() => _step = AuthStep.pin);
        }
      }
    } catch (e) {
      if (mounted) _showSnack(_cleanError(e), isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onSubmitPin() async {
    if (_pinController.text.trim().isEmpty) {
      _showSnack('Veuillez entrer votre PIN', isWarning: true);
      return;
    }
    setState(() => _isLoading = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final api = Provider.of<ApiService>(context, listen: false);
      await auth.login(_fullPhone, _selectedType, _pinController.text.trim(), api);
      if (mounted) _showSnack(widget.mode == AuthMode.register ? 'Compte créé !' : 'Connecté !');
    } on AuthException catch (e) {
      if (mounted) _showSnack(e.message, isError: true);
    } catch (e) {
      if (mounted) _showSnack(_cleanError(e), isError: true);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showSnack(String msg, {bool isError = false, bool isWarning = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError
          ? AppColors.destructive
          : isWarning
              ? AppColors.warning
              : null,
    ));
  }

  String _cleanError(Object e) => e.toString().replaceFirst('Exception: ', '');

  // ──────────────────────────────────────────────
  // BUILD
  // ──────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final isLogin = widget.mode == AuthMode.login;
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              children: [
                // ── Bouton settings (login) ou retour (register) ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Row(
                    mainAxisAlignment:
                        isLogin ? MainAxisAlignment.end : MainAxisAlignment.start,
                    children: [
                      if (!isLogin && _step == AuthStep.phone)
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.arrow_back_rounded),
                        )
                      else if (_step == AuthStep.pin)
                        IconButton(
                          onPressed: () => setState(() {
                            _step = AuthStep.phone;
                            _pinController.clear();
                          }),
                          icon: const Icon(Icons.arrow_back_rounded),
                        ),
                      if (isLogin && _step == AuthStep.phone)
                        IconButton(
                          onPressed: () => pushSlide(context, const SettingsScreen()),
                          icon: const Icon(Icons.settings_outlined),
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.surface,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Logo ──
                if (_step == AuthStep.phone)
                  _buildLogo(isLogin)
                else
                  _buildPinHeader(),

                const SizedBox(height: 32),

                // ── Contenu form ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: _step == AuthStep.phone
                      ? (isLogin ? _buildLoginForm() : _buildRegisterForm())
                      : _buildPinForm(),
                ),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  // Logo + tagline (écran phone)
  // ──────────────────────────────────────────────
  Widget _buildLogo(bool isLogin) {
    if (isLogin) {
      return Column(
        children: [
          const TakymedLogo(size: TakymedLogoSize.hero, circularBackground: false)
              .animate()
              .scale(begin: const Offset(0.8, 0.8), duration: 600.ms, curve: Curves.elasticOut),
          const SizedBox(height: 14),
          Text(
            'Votre assistant santé au quotidien',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.mutedForeground,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      );
    }
    return Column(
      children: [
        const TakymedLogo(size: TakymedLogoSize.large, circularBackground: false)
            .animate()
            .scale(begin: const Offset(0.8, 0.8), duration: 600.ms, curve: Curves.elasticOut),
        const SizedBox(height: 16),
        Text(
          'Créer un compte',
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Rejoignez TAKYMED — votre assistant santé',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.mutedForeground,
              ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  // Header écran PIN (icône SMS)
  Widget _buildPinHeader() {
    return Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.primaryLight,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.chat_bubble_outline_rounded,
              color: AppColors.primary, size: 34),
        ).animate().scale(begin: const Offset(0.8, 0.8), duration: 500.ms),
        const SizedBox(height: 20),
        Text(
          'Code de vérification',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          'Un code a été envoyé par SMS au',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.mutedForeground,
              ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          _isSpecialAccount ? _phoneController.text : _fullPhone,
          style: const TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────
  // Formulaire login (téléphone)
  // ──────────────────────────────────────────────
  Widget _buildLoginForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            // Sélecteur de pays
            GestureDetector(
              onTap: _showCountryPicker,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_currentCountry.flag, style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 6),
                    Text(_currentCountry.dialCode,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(width: 4),
                    const Icon(Icons.expand_more_rounded, size: 18, color: AppColors.mutedForeground),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _PhoneField(controller: _phoneController),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _PrimaryBtn(
          label: 'Continuer',
          icon: Icons.arrow_forward_rounded,
          isLoading: _isLoading,
          onPressed: _onContinue,
        ),
        const SizedBox(height: 12),
        _OutlineBtn(
          label: 'Créer un compte',
          onPressed: () => pushSlide(context, const AuthScreen(mode: AuthMode.register)),
        ),
        const SizedBox(height: 16),
        Center(
          child: RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground),
              children: [
                const TextSpan(text: 'En continuant, vous acceptez nos '),
                WidgetSpan(
                  child: GestureDetector(
                    child: const Text('conditions d\'utilisation',
                        style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w700,
                            fontSize: 12)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────
  // Formulaire inscription
  // ──────────────────────────────────────────────
  Widget _buildRegisterForm() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FieldLabel('Prénom'),
        const SizedBox(height: 6),
        _TextInput(
          controller: _firstNameController,
          hint: 'Ex: Amina',
          prefixIcon: Icons.person_outline_rounded,
          validator: (v) => v == null || v.trim().isEmpty ? 'Requis' : null,
        ),
        const SizedBox(height: 14),
        _FieldLabel('Nom de famille'),
        const SizedBox(height: 6),
        _TextInput(
          controller: _lastNameController,
          hint: 'Ex: Nguema',
          prefixIcon: Icons.person_outline_rounded,
          validator: (v) => v == null || v.trim().isEmpty ? 'Requis' : null,
        ),
        const SizedBox(height: 14),
        _FieldLabel('Numéro de téléphone'),
        const SizedBox(height: 6),
        Row(
          children: [
            GestureDetector(
              onTap: _showCountryPicker,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_currentCountry.flag, style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 6),
                    Text(_currentCountry.dialCode,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(width: 4),
                    const Icon(Icons.expand_more_rounded,
                        size: 18, color: AppColors.mutedForeground),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: _PhoneField(controller: _phoneController)),
          ],
        ),
        const SizedBox(height: 16),
        // Checkbox conditions
        GestureDetector(
          onTap: () => setState(() => _acceptedTerms = !_acceptedTerms),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 22,
                  height: 22,
                  decoration: BoxDecoration(
                    color: _acceptedTerms ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _acceptedTerms ? AppColors.primary : AppColors.border,
                      width: 2,
                    ),
                  ),
                  child: _acceptedTerms
                      ? const Icon(Icons.check_rounded, size: 14, color: Colors.white)
                      : null,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      style: const TextStyle(fontSize: 13, color: AppColors.foreground),
                      children: [
                        const TextSpan(text: 'J\'accepte les '),
                        const TextSpan(
                          text: 'conditions d\'utilisation',
                          style: TextStyle(
                              color: AppColors.primary, fontWeight: FontWeight.w700),
                        ),
                        const TextSpan(text: ' et la '),
                        const TextSpan(
                          text: 'politique de confidentialité',
                          style: TextStyle(
                              color: AppColors.primary, fontWeight: FontWeight.w700),
                        ),
                        const TextSpan(text: ' de TAKYMED.'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 20),
        _PrimaryBtn(
          label: 'Créer mon compte',
          icon: Icons.person_add_rounded,
          isLoading: _isLoading,
          onPressed: _onContinue,
        ),
        const SizedBox(height: 16),
        Center(
          child: RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 13, color: AppColors.mutedForeground),
              children: [
                const TextSpan(text: 'Vous avez déjà un compte ? '),
                WidgetSpan(
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Text('Se connecter',
                        style: TextStyle(
                            color: AppColors.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────
  // Formulaire PIN
  // ──────────────────────────────────────────────
  Widget _buildPinForm() {
    return Column(
      children: [
        // Widget OTP : TextField invisible + 6 cases visuelles
        _PinInputRow(
          controller: _pinController,
          onCompleted: _onSubmitPin,
        ),
        const SizedBox(height: 28),
        _PrimaryBtn(
          label: 'Vérifier',
          icon: Icons.shield_outlined,
          isLoading: _isLoading,
          onPressed: _onSubmitPin,
        ),
        const SizedBox(height: 20),
        const Text(
          'Vous n\'avez pas reçu le code ?',
          style: TextStyle(color: AppColors.mutedForeground, fontSize: 13),
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: _isLoading
              ? null
              : () async {
                  setState(() => _isLoading = true);
                  try {
                    final api = Provider.of<ApiService>(context, listen: false);
                    final msg = await api.forgotPin(_fullPhone);
                    if (mounted) _showSnack(msg);
                  } catch (e) {
                    if (mounted) _showSnack(_cleanError(e), isError: true);
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(Icons.refresh_rounded, color: AppColors.primary, size: 16),
              SizedBox(width: 4),
              Text('Renvoyer le code',
                  style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                      fontSize: 13)),
            ],
          ),
        ),
      ],
    );
  }

  void _showCountryPicker() async {
    final selected = await showModalBottomSheet<CountryOption>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (_, scroll) => ListView.builder(
          controller: scroll,
          itemCount: _countries.length + 1,
          itemBuilder: (_, i) {
            if (i == 0) {
              return const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text('Choisir un pays',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                ),
              );
            }
            final c = _countries[i - 1];
            return ListTile(
              leading: Text(c.flag, style: const TextStyle(fontSize: 24)),
              title: Text(c.name),
              subtitle: Text(c.dialCode),
              onTap: () => Navigator.pop(ctx, c),
            );
          },
        ),
      ),
    );
    if (selected != null) setState(() => _selectedCountry = selected.code);
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    _pinController.dispose();
    super.dispose();
  }
}

// ──────────────────────────────────────────────
// Widgets locaux
// ──────────────────────────────────────────────

class _FieldLabel extends StatelessWidget {
  final String text;
  const _FieldLabel(this.text);
  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      );
}

class _TextInput extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final IconData prefixIcon;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;

  const _TextInput({
    required this.controller,
    required this.hint,
    required this.prefixIcon,
    this.validator,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: Icon(prefixIcon, color: AppColors.mutedForeground, size: 20),
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  final TextEditingController controller;
  const _PhoneField({required this.controller});
  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.phone,
      validator: (v) => v == null || v.trim().isEmpty ? 'Requis' : null,
      decoration: const InputDecoration(
        hintText: '6 XX XX XX XX',
        prefixIcon: Icon(Icons.phone_outlined, color: AppColors.mutedForeground, size: 20),
      ),
    );
  }
}

class _PrimaryBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isLoading;
  final VoidCallback? onPressed;
  const _PrimaryBtn(
      {required this.label, required this.icon, required this.isLoading, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton.icon(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        icon: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : Icon(icon, size: 20),
        label: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      ),
    );
  }
}

class _OutlineBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  const _OutlineBtn({required this.label, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: const BorderSide(color: AppColors.primary, width: 1.5),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        ),
        child: Text(label,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
      ),
    );
  }
}

/// Saisie OTP : TextField invisible focusé + 6 cases visuelles.
/// Le TextField est transparent et positionné en Stack sous les cases.
class _PinInputRow extends StatefulWidget {
  final TextEditingController controller;
  final VoidCallback? onCompleted;
  final int length;

  const _PinInputRow({
    required this.controller,
    this.onCompleted,
    this.length = 6,
  });

  @override
  State<_PinInputRow> createState() => _PinInputRowState();
}

class _PinInputRowState extends State<_PinInputRow> {
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode();
    widget.controller.addListener(_onChanged);
    // Ouvrir le clavier automatiquement
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  void _onChanged() {
    // Limiter à `length` chiffres
    final text = widget.controller.text;
    if (text.length > widget.length) {
      widget.controller.text = text.substring(0, widget.length);
      widget.controller.selection = TextSelection.collapsed(offset: widget.length);
    }
    setState(() {});
    if (widget.controller.text.length == widget.length) {
      _focusNode.unfocus();
      widget.onCompleted?.call();
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pin = widget.controller.text;

    return GestureDetector(
      onTap: () => _focusNode.requestFocus(),
      child: Stack(
        children: [
          // ── TextField invisible qui reçoit la saisie ──
          SizedBox(
            height: 1,
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              keyboardType: TextInputType.number,
              maxLength: widget.length,
              obscureText: false,
              autofocus: true,
              showCursor: false,
              style: const TextStyle(color: Colors.transparent, fontSize: 1),
              decoration: const InputDecoration(
                border: InputBorder.none,
                counterText: '',
                filled: false,
              ),
            ),
          ),

          // ── Cases visuelles ──
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: List.generate(widget.length, (i) {
                final isFilled = i < pin.length;
                final isActive = i == pin.length && _focusNode.hasFocus;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 46,
                  height: 56,
                  decoration: BoxDecoration(
                    color: isFilled ? AppColors.primaryLight : AppColors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isActive
                          ? AppColors.primary
                          : isFilled
                              ? AppColors.primary
                              : AppColors.border,
                      width: (isActive || isFilled) ? 2 : 1.5,
                    ),
                    boxShadow: isActive
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.18),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            )
                          ]
                        : null,
                  ),
                  child: Center(
                    child: isFilled
                        ? Container(
                            width: 12,
                            height: 12,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          )
                        : isActive
                            ? Container(
                                width: 2,
                                height: 22,
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              )
                            : null,
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cases PIN individuelles — conservé pour compatibilité.
class _PinBox extends StatefulWidget {
  final int index;
  final TextEditingController controller;
  const _PinBox({required this.index, required this.controller});

  @override
  State<_PinBox> createState() => _PinBoxState();
}

class _PinBoxState extends State<_PinBox> {
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filled = widget.controller.text.length > widget.index;
    return Container(
      width: 46,
      height: 52,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: filled ? AppColors.primary : AppColors.border,
          width: filled ? 2 : 1,
        ),
      ),
      child: Center(
        child: filled
            ? Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
              )
            : Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.border,
                  shape: BoxShape.circle,
                ),
              ),
      ),
    );
  }
}
