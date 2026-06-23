import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/app_colors.dart';
import '../widgets/primary_button.dart';
import '../widgets/takymed_logo.dart';

class OnboardingScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const OnboardingScreen({super.key, required this.onComplete});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  static const _pages = [
    _OnboardingPageData(
      icon: Icons.notifications_active_rounded,
      accent: AppColors.primary,
      accentLight: AppColors.primaryLight,
      title: 'Rappels & ordonnances',
      subtitle: 'Suivez votre traitement en toute sérénité',
      features: [
        _FeatureItem(
          Icons.smartphone_rounded,
          'Connexion simple par téléphone et code PIN',
        ),
        _FeatureItem(
          Icons.alarm_rounded,
          'Rappels actifs avec notifications SMS et push',
        ),
        _FeatureItem(
          Icons.insights_rounded,
          'Tableau de bord : observance, rappels et doses planifiées',
        ),
        _FeatureItem(
          Icons.schedule_rounded,
          'Valider, reporter ou modifier une prise en un clic',
        ),
      ],
    ),
    _OnboardingPageData(
      icon: Icons.psychology_rounded,
      accent: AppColors.ai,
      accentLight: AppColors.aiLight,
      title: 'Médicaments & IA',
      subtitle: 'Recherchez, comprenez, soignez-vous mieux',
      features: [
        _FeatureItem(
          Icons.search_rounded,
          'Catalogue dynamique avec photos et favoris',
        ),
        _FeatureItem(
          Icons.auto_awesome_rounded,
          'Fiches enrichies par intelligence artificielle',
        ),
        _FeatureItem(
          Icons.menu_book_rounded,
          'Posologie, effets et contre-indications détaillés',
        ),
        _FeatureItem(
          Icons.warning_amber_rounded,
          'Alertes d\'interactions entre vos médicaments',
        ),
      ],
      useAiGradient: true,
    ),
    _OnboardingPageData(
      icon: Icons.local_pharmacy_rounded,
      accent: AppColors.secondary,
      accentLight: AppColors.secondaryLight,
      title: 'Pharmacies & de garde',
      subtitle: 'Trouvez une officine près de chez vous',
      features: [
        _FeatureItem(
          Icons.storefront_rounded,
          'Onglet Pharmacie : officines de votre ville, triées par distance',
        ),
        _FeatureItem(
          Icons.nightlight_round,
          'Onglet De garde : pharmacies ouvertes 24h/24 à proximité',
        ),
        _FeatureItem(
          Icons.my_location_rounded,
          'Localisation automatique pour un tri par proximité',
        ),
        _FeatureItem(
          Icons.phone_in_talk_rounded,
          'Appel et itinéraire vers la pharmacie en un clic',
        ),
      ],
    ),
  ];

  void _finish() {
    widget.onComplete();
  }

  void _next() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    } else {
      _finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _currentPage == _pages.length - 1;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.primaryLight, AppColors.background],
            stops: [0.0, 0.45],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
                child: Row(
                  children: [
                    if (_currentPage == 0)
                      const Padding(
                        padding: EdgeInsets.only(left: 8),
                        child: TakymedLogo(size: TakymedLogoSize.small),
                      )
                    else
                      const SizedBox(width: 48),
                    const Spacer(),
                    TextButton(
                      onPressed: _finish,
                      child: Text(
                        'Passer',
                        style: TextStyle(color: AppColors.mutedForeground),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: _pages.length,
                  onPageChanged: (i) => setState(() => _currentPage = i),
                  itemBuilder: (context, index) {
                    return _OnboardingPage(
                      data: _pages[index],
                      pageIndex: index,
                    );
                  },
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(_pages.length, (i) {
                        final active = i == _currentPage;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: active ? 28 : 8,
                          height: 8,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            color: active
                                ? AppColors.primary
                                : AppColors.primary.withValues(alpha: 0.25),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),
                    PrimaryButton(
                      label: isLast ? 'Commencer' : 'Suivant',
                      icon: isLast
                          ? Icons.rocket_launch_rounded
                          : Icons.arrow_forward_rounded,
                      gradient: _pages[_currentPage].useAiGradient
                          ? AppColors.aiGradient
                          : null,
                      onPressed: _next,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }
}

class _OnboardingPage extends StatelessWidget {
  final _OnboardingPageData data;
  final int pageIndex;

  const _OnboardingPage({required this.data, required this.pageIndex});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: Column(
        children: [
          const SizedBox(height: 16),
          Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  gradient: data.useAiGradient
                      ? AppColors.aiGradient
                      : LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            data.accent,
                            data.accent.withValues(alpha: 0.75),
                          ],
                        ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: data.accent.withValues(alpha: 0.35),
                      blurRadius: 28,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Icon(data.icon, size: 64, color: Colors.white),
              )
              .animate(key: ValueKey('icon-$pageIndex'))
              .scale(
                begin: const Offset(0.6, 0.6),
                duration: 500.ms,
                curve: Curves.elasticOut,
              )
              .fadeIn(duration: 300.ms),
          const SizedBox(height: 32),
          Text(
                data.title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: AppColors.foreground,
                  height: 1.2,
                ),
              )
              .animate(key: ValueKey('title-$pageIndex'))
              .fadeIn(delay: 100.ms)
              .slideY(begin: 0.1),
          const SizedBox(height: 10),
          Text(
            data.subtitle,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: AppColors.mutedForeground),
          ).animate(key: ValueKey('sub-$pageIndex')).fadeIn(delay: 180.ms),
          const SizedBox(height: 32),
          Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.foreground.withValues(alpha: 0.04),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < data.features.length; i++)
                      Padding(
                        padding: EdgeInsets.only(
                          bottom: i < data.features.length - 1 ? 16 : 0,
                        ),
                        child: _FeatureRow(
                          item: data.features[i],
                          accent: data.accent,
                          delay: 250 + i * 80,
                          pageIndex: pageIndex,
                          featureIndex: i,
                        ),
                      ),
                  ],
                ),
              )
              .animate(key: ValueKey('card-$pageIndex'))
              .fadeIn(delay: 220.ms)
              .slideY(begin: 0.08),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final _FeatureItem item;
  final Color accent;
  final int delay;
  final int pageIndex;
  final int featureIndex;

  const _FeatureRow({
    required this.item,
    required this.accent,
    required this.delay,
    required this.pageIndex,
    required this.featureIndex,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(item.icon, size: 20, color: accent),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  item.label,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: AppColors.foreground,
                  ),
                ),
              ),
            ),
          ],
        )
        .animate(key: ValueKey('f-$pageIndex-$featureIndex'))
        .fadeIn(delay: delay.ms)
        .slideX(begin: 0.05);
  }
}

class _OnboardingPageData {
  final IconData icon;
  final Color accent;
  final Color accentLight;
  final String title;
  final String subtitle;
  final List<_FeatureItem> features;
  final bool useAiGradient;

  const _OnboardingPageData({
    required this.icon,
    required this.accent,
    required this.accentLight,
    required this.title,
    required this.subtitle,
    required this.features,
    this.useAiGradient = false,
  });
}

class _FeatureItem {
  final IconData icon;
  final String label;

  const _FeatureItem(this.icon, this.label);
}
