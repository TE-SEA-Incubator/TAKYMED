import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
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

  @override
  Widget build(BuildContext context) {
    final h = height ?? width;

    if (!MediaUrl.isValid(photoUrl)) {
      return _placeholder(h);
    }

    final resolved = MediaUrl.resolve(photoUrl);

    if (resolved.startsWith('data:image/')) {
      return _buildFromBase64(resolved, h);
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: Image.network(
        resolved,
        width: width,
        height: h,
        fit: fit,
        loadingBuilder: (context, child, progress) {
          if (progress == null) {
            return child.animate().fadeIn(duration: 300.ms);
          }
          return _loadingBox(h, progress.expectedTotalBytes != null
              ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
              : null);
        },
        errorBuilder: (_, __, ___) => _placeholder(h),
      ),
    );
  }

  Widget _buildFromBase64(String dataUri, double h) {
    try {
      final base64Part = dataUri.contains(',') ? dataUri.split(',').last : dataUri;
      final bytes = base64Decode(base64Part);
      return ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: Image.memory(
          bytes,
          width: width,
          height: h,
          fit: fit,
          errorBuilder: (_, __, ___) => _placeholder(h),
        ),
      ).animate().fadeIn(duration: 300.ms);
    } catch (_) {
      return _placeholder(h);
    }
  }

  Widget _placeholder(double h) {
    return Container(
      width: width,
      height: h,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: AppColors.border),
      ),
      child: Icon(
        placeholderIcon,
        size: width * 0.45,
        color: AppColors.primary.withValues(alpha: 0.6),
      ),
    );
  }

  Widget _loadingBox(double h, double? progress) {
    return Container(
      width: width,
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
