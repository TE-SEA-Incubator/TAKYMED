import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

enum StatusType { active, completed, cancelled, pending, validated }

class StatusBadge extends StatelessWidget {
  final String label;
  final StatusType type;

  const StatusBadge({
    super.key,
    required this.label,
    required this.type,
  });

  factory StatusBadge.fromOrdonnance(dynamic ord) {
    if (ord['est_active'] != 1) {
      return const StatusBadge(label: 'Annulée', type: StatusType.cancelled);
    }
    if (ord['prises_effectuees'] >= ord['prises_totales'] && ord['prises_totales'] > 0) {
      return const StatusBadge(label: 'Terminée', type: StatusType.completed);
    }
    return const StatusBadge(label: 'En cours', type: StatusType.active);
  }

  (Color bg, Color fg) get _colors {
    switch (type) {
      case StatusType.active:
        return (AppColors.primaryLight, AppColors.primary);
      case StatusType.completed:
        return (AppColors.successLight, AppColors.success);
      case StatusType.cancelled:
        return (AppColors.muted, AppColors.mutedForeground);
      case StatusType.pending:
        return (AppColors.warningLight, AppColors.warning);
      case StatusType.validated:
        return (AppColors.successLight, AppColors.success);
    }
  }

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontWeight: FontWeight.w700,
          fontSize: 11,
        ),
      ),
    );
  }
}
