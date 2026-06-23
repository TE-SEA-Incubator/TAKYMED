import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';

/// Header teal arrondi en bas — design maquettes juin 2026.
class GradientHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final Widget? bottom;
  final bool showBack;
  final bool showLogo;

  const GradientHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.bottom,
    this.showBack = false,
    this.showLogo = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(0),
          bottomRight: Radius.circular(0),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showLogo)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      // Icône logo dans un petit cercle blanc
                      Container(
                        width: 36,
                        height: 36,
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Image.asset(
                          'assets/images/logo.png',
                          fit: BoxFit.contain,
                          filterQuality: FilterQuality.high,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'TAKYMED',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.97),
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                          Text(
                            'Take Your Medicine',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.72),
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (showBack)
                    Padding(
                      padding: const EdgeInsets.only(right: 10),
                      child: GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.arrow_back_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.82),
                              fontSize: 13,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              if (bottom != null) ...[
                const SizedBox(height: 16),
                bottom!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// AppBar secondaire pour les écrans pushés (sans logo, avec retour).
class SecondaryAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget>? actions;

  const SecondaryAppBar({
    super.key,
    required this.title,
    this.actions,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 4);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      elevation: 0,
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Image.asset(
              'assets/images/logo.png',
              width: 26,
              height: 26,
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      actions: actions,
      systemOverlayStyle: SystemUiOverlayStyle.light,
    );
  }
}
