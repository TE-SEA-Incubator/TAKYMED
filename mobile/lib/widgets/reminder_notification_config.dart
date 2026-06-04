import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'app_card.dart';
import 'app_text_field.dart';

/// Sélection des canaux et destinataires — même logique que l'étape 2 du web (Prescription.tsx).
class ReminderNotificationConfig extends StatelessWidget {
  final Set<String> channels;
  final ValueChanged<Set<String>> onChannelsChanged;
  final TextEditingController phoneController;
  final String phonePrefix;

  const ReminderNotificationConfig({
    super.key,
    required this.channels,
    required this.onChannelsChanged,
    required this.phoneController,
    this.phonePrefix = '+237 ',
  });

  bool get needsPhone => channels.any((c) => c != 'push');

  static bool isValid(Set<String> channels, TextEditingController phone) {
    if (channels.isEmpty) return false;
    if (channels.any((c) => c != 'push') && phone.text.trim().isEmpty) return false;
    return true;
  }

  void _toggleChannel(String id) {
    final next = Set<String>.from(channels);
    if (next.contains(id)) {
      if (next.length > 1) next.remove(id);
    } else {
      next.add(id);
    }
    onChannelsChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.notifications_active_rounded, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Méthodes de rappel',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      'Choisissez comment recevoir chaque rappel',
                      style: TextStyle(fontSize: 12, color: AppColors.mutedForeground.withValues(alpha: 0.9)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'CANAUX DE NOTIFICATION',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: AppColors.mutedForeground,
            ),
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 2.4,
            children: [
              _ChannelOption(
                id: 'sms',
                label: 'SMS',
                icon: Icons.sms_rounded,
                color: const Color(0xFF10B981),
                selected: channels.contains('sms'),
                onTap: () => _toggleChannel('sms'),
              ),
              _ChannelOption(
                id: 'whatsapp',
                label: 'WhatsApp',
                icon: Icons.chat_rounded,
                color: const Color(0xFF25D366),
                selected: channels.contains('whatsapp'),
                onTap: () => _toggleChannel('whatsapp'),
              ),
              _ChannelOption(
                id: 'call',
                label: 'Appel',
                icon: Icons.phone_in_talk_rounded,
                color: const Color(0xFF3B82F6),
                selected: channels.contains('call'),
                onTap: () => _toggleChannel('call'),
              ),
              _ChannelOption(
                id: 'push',
                label: 'Push',
                icon: Icons.notifications_rounded,
                color: const Color(0xFF8B5CF6),
                selected: channels.contains('push'),
                onTap: () => _toggleChannel('push'),
              ),
            ],
          ),
          if (needsPhone) ...[
            const SizedBox(height: 20),
            Text(
              'DESTINATAIRE',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: AppColors.mutedForeground,
              ),
            ),
            const SizedBox(height: 10),
            AppTextField(
              controller: phoneController,
              label: 'Téléphone destinataire',
              prefixIcon: Icons.phone_rounded,
              prefixText: phonePrefix,
              keyboardType: TextInputType.phone,
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.primaryLight.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, size: 18, color: AppColors.primary.withValues(alpha: 0.8)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Ces canaux s\'appliquent à ce rappel uniquement, comme sur la version web.',
                    style: TextStyle(fontSize: 12, color: AppColors.primary.withValues(alpha: 0.85), height: 1.35),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChannelOption extends StatelessWidget {
  final String id;
  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const _ChannelOption({
    required this.id,
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? color : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? color : AppColors.border,
              width: selected ? 2 : 1,
            ),
            boxShadow: selected
                ? [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 8, offset: const Offset(0, 3))]
                : null,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: selected ? Colors.white.withValues(alpha: 0.25) : color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: selected ? Colors.white : color),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: selected ? Colors.white : AppColors.foreground,
                  ),
                ),
              ),
              if (selected) const Icon(Icons.check_circle_rounded, color: Colors.white, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
