import 'dart:convert';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';

/// Affiche l'image d'un médicament (URL absolue, chemin `/uploads/` ou base64).
class MedicationImage extends StatelessWidget {
  final String? photoUrl;
  final double width;
  final double? height;
  final double borderRadius;
  final BoxFit fit;
  final IconData placeholderIcon;

  const MedicationImage({
    super.key,
    required this.photoUrl,
    this.width = 48,
    this.height,
    this.borderRadius = 16,
    this.fit = BoxFit.cover,
    this.placeholderIcon = Icons.medication_rounded,
  });

  int? get _cacheSize {
    final w = width.isFinite ? width : 400.0;
    final h = (height ?? w);
    final px = (w > h ? w : h) * 2;
    if (px <= 0 || !px.isFinite) return null;
    return px.round().clamp(48, 800);
  }

  @override
  Widget build(BuildContext context) {
    final h = height ?? width;
    final displayWidth = width.isFinite ? width : null;

    if (!MediaUrl.isValid(photoUrl)) {
      return _placeholder(h, displayWidth);
    }

    final resolved = MediaUrl.resolve(photoUrl);

    if (resolved.startsWith('data:image/')) {
      return _buildFromBase64(resolved, h, displayWidth);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image.network(
        resolved,
        width: displayWidth,
        height: h,
        fit: fit,
        cacheWidth: _cacheSize,
        cacheHeight: _cacheSize,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return _loadingBox(
            h,
            displayWidth,
            progress.expectedTotalBytes != null
                ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                : null,
          );
        },
        errorBuilder: (_, __, ___) => _placeholder(h, displayWidth),
      ),
    );
  }

  Widget _buildFromBase64(String dataUri, double h, double? displayWidth) {
    try {
      final base64Part = dataUri.contains(',') ? dataUri.split(',').last : dataUri;
      final bytes = base64Decode(base64Part);
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: Image.memory(
          bytes,
          width: displayWidth,
          height: h,
          fit: fit,
          cacheWidth: _cacheSize,
          cacheHeight: _cacheSize,
          errorBuilder: (_, __, ___) => _placeholder(h, displayWidth),
        ),
      );
    } catch (_) {
      return _placeholder(h, displayWidth);
    }
  }

  Widget _placeholder(double h, double? displayWidth) {
    return Container(
      width: displayWidth,
      height: h,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: Icon(
        placeholderIcon,
        size: (displayWidth ?? 48) * 0.45,
        color: AppColors.primary.withValues(alpha: 0.6),
      ),
    );
  }

  Widget _loadingBox(double h, double? displayWidth, double? progress) {
    return Container(
      width: displayWidth,
      height: h,
      decoration: BoxDecoration(
        color: AppColors.muted,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            value: progress,
            color: AppColors.primary,
          ),
        ),
      ),
    );
  }
}
