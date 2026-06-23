import 'package:flutter/material.dart';

/// Couleurs alignées sur le nouveau design system TAKYMED (maquettes juin 2026).
class AppColors {
  AppColors._();

  // --- Teal principal (nouveau branding) ---
  static const primary = Color(0xFF2D9B8A);
  static const primaryDark = Color(0xFF1B6E5E);
  static const primaryLight = Color(0xFFE8F6F4);
  static const primaryForeground = Color(0xFFFFFFFF);

  // --- Vert feuille (accent logo) ---
  static const secondary = Color(0xFF3DB83A);
  static const secondaryLight = Color(0xFFE8F7E8);

  // --- Fond et surfaces ---
  static const background = Color(0xFFEBF5F5);   // fond général bleu-vert clair
  static const surface = Color(0xFFFFFFFF);
  static const foreground = Color(0xFF0D1B1E);

  static const muted = Color(0xFFF0F7F6);
  static const mutedForeground = Color(0xFF6B8B87);

  // --- Statuts ---
  static const destructive = Color(0xFFEF4444);
  static const destructiveLight = Color(0xFFFEE2E2);

  static const warning = Color(0xFFF59E0B);
  static const warningLight = Color(0xFFFEF3C7);

  static const success = Color(0xFF2D9B8A);
  static const successLight = Color(0xFFE8F6F4);

  static const ai = Color(0xFF7C3AED);
  static const aiLight = Color(0xFFEDE9FE);

  static const border = Color(0xFFD5E8E5);

  // --- Dégradé header (teal uniforme, légèrement plus foncé en bas) ---
  static const gradientStart = Color(0xFF2D9B8A);
  static const gradientEnd = Color(0xFF1B6E5E);

  static LinearGradient get primaryGradient => const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [gradientStart, gradientEnd],
      );

  static LinearGradient get aiGradient => const LinearGradient(
        colors: [Color(0xFF7C3AED), Color(0xFFA855F7)],
      );
}
