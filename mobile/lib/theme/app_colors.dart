import 'package:flutter/material.dart';

/// Couleurs alignées sur le design system web TAKYMED (global.css).
class AppColors {
  AppColors._();

  static const primary = Color(0xFF006994);
  static const primaryDark = Color(0xFF004D6E);
  static const primaryLight = Color(0xFFE6F4F9);
  static const primaryForeground = Color(0xFFF8FAFC);

  static const secondary = Color(0xFF00A651);
  static const secondaryLight = Color(0xFFE6F9F0);

  static const background = Color(0xFFF7F9FB);
  static const surface = Color(0xFFFFFFFF);
  static const foreground = Color(0xFF0A1628);

  static const muted = Color(0xFFF1F5F9);
  static const mutedForeground = Color(0xFF64748B);

  static const destructive = Color(0xFFEF4444);
  static const destructiveLight = Color(0xFFFEE2E2);

  static const warning = Color(0xFFF59E0B);
  static const warningLight = Color(0xFFFEF3C7);

  static const success = Color(0xFF00A651);
  static const successLight = Color(0xFFDCFCE7);

  static const ai = Color(0xFF7C3AED);
  static const aiLight = Color(0xFFEDE9FE);

  static const border = Color(0xFFE2E8F0);

  static const gradientStart = Color(0xFF006994);
  static const gradientEnd = Color(0xFF00A651);

  static LinearGradient get primaryGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [gradientStart, gradientEnd],
      );

  static LinearGradient get aiGradient => const LinearGradient(
        colors: [Color(0xFF7C3AED), Color(0xFFA855F7)],
      );
}
