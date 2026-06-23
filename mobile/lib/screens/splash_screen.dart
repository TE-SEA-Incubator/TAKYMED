import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/app_colors.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo icône dans un cercle blanc
            Container(
              width: 140,
              height: 140,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.15),
                    blurRadius: 32,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Image.asset(
                'assets/images/logo.png',
                fit: BoxFit.contain,
                filterQuality: FilterQuality.high,
              ),
            )
                .animate()
                .scale(
                  begin: const Offset(0.75, 0.75),
                  duration: 700.ms,
                  curve: Curves.elasticOut,
                )
                .fadeIn(duration: 400.ms),
            const SizedBox(height: 28),
            // Texte TAKYMED
            Text(
              'TAKYMED',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppColors.primary,
                    letterSpacing: 2,
                  ),
            ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.15),
            const SizedBox(height: 8),
            Text(
              'Votre assistant santé au quotidien',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.mutedForeground,
                  ),
            ).animate().fadeIn(delay: 380.ms),
            const SizedBox(height: 56),
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.primary.withValues(alpha: 0.6),
              ),
            ).animate().fadeIn(delay: 520.ms),
          ],
        ),
      ),
    );
  }
}
