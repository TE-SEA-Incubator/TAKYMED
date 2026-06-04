import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum TakymedLogoSize { small, medium, large, hero }

class TakymedLogo extends StatelessWidget {
  final TakymedLogoSize size;
  final bool showLabel;
  final Color? labelColor;
  final bool circularBackground;
  final String assetPath;

  const TakymedLogo({
    super.key,
    this.size = TakymedLogoSize.medium,
    this.showLabel = false,
    this.labelColor,
    this.circularBackground = false,
    this.assetPath = 'assets/images/takymed1.png',
  });

  double get _imageSize {
    switch (size) {
      case TakymedLogoSize.small:
        return 44;
      case TakymedLogoSize.medium:
        return 64;
      case TakymedLogoSize.large:
        return 96;
      case TakymedLogoSize.hero:
        return 132;
    }
  }

  double get _labelSize {
    switch (size) {
      case TakymedLogoSize.small:
        return 16;
      case TakymedLogoSize.medium:
        return 20;
      case TakymedLogoSize.large:
        return 26;
      case TakymedLogoSize.hero:
        return 32;
    }
  }

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      assetPath,
      width: _imageSize,
      height: _imageSize,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
    );

    Widget content = showLabel
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              image,
              const SizedBox(width: 12),
              Text(
                'TAKYMED',
                style: TextStyle(
                  fontSize: _labelSize,
                  fontWeight: FontWeight.w800,
                  color: labelColor ?? AppColors.primary,
                  letterSpacing: 1,
                ),
              ),
            ],
          )
        : image;

    if (circularBackground) {
      content = Container(
        padding: EdgeInsets.all(_imageSize * 0.14),
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.22),
              blurRadius: 28,
              offset: const Offset(0, 10),
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
          border: Border.all(color: Colors.white.withValues(alpha: 0.9), width: 2),
        ),
        child: content,
      );
    }

    return content;
  }
}
