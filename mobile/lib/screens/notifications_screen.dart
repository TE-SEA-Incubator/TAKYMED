import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_card.dart';
import '../widgets/gradient_header.dart';
import '../widgets/loading_view.dart';

class NotificationsScreen extends StatefulWidget {
  final bool embedded;

  const NotificationsScreen({super.key, this.embedded = false});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
    _pollingTimer = Timer.periodic(const Duration(seconds: 30), (_) => _fetchNotifications());
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchNotifications() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = Provider.of<ApiService>(context, listen: false);

    try {
      final response = await api.getNotifications(auth.user!.id);
      if (mounted) {
        setState(() {
          _notifications = response['notifications'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => n['isRead'] != 1).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: 'Notifications',
            subtitle: unreadCount > 0 ? '$unreadCount non lue${unreadCount > 1 ? 's' : ''}' : 'Tout est à jour',
            trailing: IconButton(
              onPressed: _fetchNotifications,
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              style: IconButton.styleFrom(backgroundColor: Colors.white.withValues(alpha: 0.15)),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const LoadingView(message: 'Chargement des notifications...')
                : _notifications.isEmpty
                    ? const EmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: 'Aucune notification',
                        subtitle: 'Vous serez alerté ici pour vos rappels et mises à jour',
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchNotifications,
                        color: AppColors.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
                          itemCount: _notifications.length,
                          itemBuilder: (context, index) {
                            final n = _notifications[index];
                            final id = n['id'] as int;
                            final isRead = n['isRead'] == 1;
                            return AnimatedFadeSlide(
                              index: index,
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Dismissible(
                                  key: Key('notif_$id'),
                                  direction: DismissDirection.endToStart,
                                  onDismissed: (direction) async {
                                    final auth = Provider.of<AuthProvider>(context, listen: false);
                                    final api = Provider.of<ApiService>(context, listen: false);
                                    try {
                                      await api.deleteNotification(auth.user!.id, id);
                                      setState(() {
                                        _notifications.removeAt(index);
                                      });
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(content: Text('Notification supprimée')),
                                      );
                                    } catch (e) {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Erreur : $e')),
                                      );
                                      _fetchNotifications();
                                    }
                                  },
                                  background: Container(
                                    decoration: BoxDecoration(
                                      color: AppColors.destructive,
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    alignment: Alignment.centerRight,
                                    padding: const EdgeInsets.only(right: 20),
                                    child: const Icon(Icons.delete_outline, color: Colors.white, size: 28),
                                  ),
                                  child: AppCard(
                                    color: isRead ? AppColors.surface : AppColors.primaryLight.withValues(alpha: 0.5),
                                    padding: const EdgeInsets.all(16),
                                    child: InkWell(
                                      onTap: isRead
                                          ? null
                                          : () async {
                                              final auth = Provider.of<AuthProvider>(context, listen: false);
                                              final api = Provider.of<ApiService>(context, listen: false);
                                              try {
                                                await api.markNotificationAsRead(auth.user!.id, id);
                                                setState(() {
                                                  final updated = Map<String, dynamic>.from(n);
                                                  updated['isRead'] = 1;
                                                  _notifications[index] = updated;
                                                });
                                              } catch (e) {
                                                debugPrint('Error marking notification read: $e');
                                              }
                                            },
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(10),
                                            decoration: BoxDecoration(
                                              color: isRead
                                                  ? AppColors.muted
                                                  : AppColors.primary.withValues(alpha: 0.15),
                                              borderRadius: BorderRadius.circular(12),
                                            ),
                                            child: Icon(
                                              isRead ? Icons.notifications_none_rounded : Icons.notifications_active_rounded,
                                              color: isRead ? AppColors.mutedForeground : AppColors.primary,
                                              size: 22,
                                            ),
                                          ),
                                          const SizedBox(width: 14),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  n['titre'] ?? '',
                                                  style: TextStyle(
                                                    fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                                                    fontSize: 15,
                                                  ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  n['contenu'] ?? '',
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    color: AppColors.mutedForeground,
                                                    height: 1.4,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              if (!isRead)
                                                Container(
                                                  width: 8,
                                                  height: 8,
                                                  decoration: const BoxDecoration(
                                                    color: AppColors.primary,
                                                    shape: BoxShape.circle,
                                                  ),
                                                ).animate(onPlay: (c) => c.repeat(reverse: true)).scale(
                                                      begin: const Offset(0.8, 0.8),
                                                      end: const Offset(1.2, 1.2),
                                                      duration: 800.ms,
                                                    ),
                                              IconButton(
                                                icon: const Icon(Icons.delete_outline, size: 20),
                                                color: AppColors.mutedForeground.withValues(alpha: 0.6),
                                                onPressed: () async {
                                                  final auth = Provider.of<AuthProvider>(context, listen: false);
                                                  final api = Provider.of<ApiService>(context, listen: false);
                                                  try {
                                                    await api.deleteNotification(auth.user!.id, id);
                                                    setState(() {
                                                      _notifications.removeAt(index);
                                                    });
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      const SnackBar(content: Text('Notification supprimée')),
                                                    );
                                                  } catch (e) {
                                                    ScaffoldMessenger.of(context).showSnackBar(
                                                      SnackBar(content: Text('Erreur : $e')),
                                                    );
                                                  }
                                                },
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
