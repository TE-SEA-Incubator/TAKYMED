
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

enum NativeNotificationKind { reminder, message }

class NotificationService {
  static final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static const String reminderChannelId = 'takymed_reminders';
  static const String messageChannelId = 'takymed_messages';

  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    tz.initializeTimeZones();
    tz.setLocalLocation(tz.getLocation('Africa/Douala'));

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    await flutterLocalNotificationsPlugin.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings),
      onDidReceiveNotificationResponse: (response) {
        debugPrint('Notification tap: ${response.payload}');
      },
    );

    if (Platform.isAndroid) {
      final android = flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

      await android?.createNotificationChannel(const AndroidNotificationChannel(
        reminderChannelId,
        'Rappels médicaments',
        description: 'Rappels natifs pour vos prises de médicaments',
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
      ));

      await android?.createNotificationChannel(const AndroidNotificationChannel(
        messageChannelId,
        'Messages TAKYMED',
        description: 'Messages et alertes de l\'application',
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      ));
    }

    _initialized = true;
  }

  static Future<bool> requestPermissions() async {
    await initialize();

    if (Platform.isAndroid) {
      final android = flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      final notifGranted = await android?.requestNotificationsPermission() ?? true;
      await android?.requestExactAlarmsPermission();
      return notifGranted;
    }

    if (Platform.isIOS) {
      final ios = flutterLocalNotificationsPlugin
          .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
      final granted = await ios?.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }

    return true;
  }

  static NotificationDetails _details(NativeNotificationKind kind) {
    if (kind == NativeNotificationKind.reminder) {
      return const NotificationDetails(
        android: AndroidNotificationDetails(
          reminderChannelId,
          'Rappels médicaments',
          channelDescription: 'Rappels natifs pour vos prises de médicaments',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: true,
          visibility: NotificationVisibility.public,
          ticker: 'Rappel TAKYMED',
          styleInformation: BigTextStyleInformation(''),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          interruptionLevel: InterruptionLevel.timeSensitive,
          categoryIdentifier: 'TAKYMED_REMINDER',
        ),
      );
    }

    return const NotificationDetails(
      android: AndroidNotificationDetails(
        messageChannelId,
        'Messages TAKYMED',
        channelDescription: 'Messages et alertes de l\'application',
        importance: Importance.high,
        priority: Priority.high,
        category: AndroidNotificationCategory.message,
        styleInformation: BigTextStyleInformation(''),
      ),
      iOS: DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
        categoryIdentifier: 'TAKYMED_MESSAGE',
      ),
    );
  }

  static Future<void> showNativeNotification({
    required int id,
    required String title,
    required String body,
    NativeNotificationKind kind = NativeNotificationKind.message,
    String? payload,
  }) async {
    await initialize();
    final details = _details(kind);

    AndroidNotificationDetails? androidDetails = details.android;
    if (androidDetails != null && kind == NativeNotificationKind.message) {
      androidDetails = AndroidNotificationDetails(
        androidDetails.channelId,
        androidDetails.channelName,
        channelDescription: androidDetails.channelDescription,
        importance: androidDetails.importance,
        priority: androidDetails.priority,
        category: androidDetails.category,
        styleInformation: BigTextStyleInformation(body),
      );
    } else if (androidDetails != null && kind == NativeNotificationKind.reminder) {
      androidDetails = AndroidNotificationDetails(
        androidDetails.channelId,
        androidDetails.channelName,
        channelDescription: androidDetails.channelDescription,
        importance: androidDetails.importance,
        priority: androidDetails.priority,
        category: androidDetails.category,
        fullScreenIntent: true,
        styleInformation: BigTextStyleInformation(body),
      );
    }

    await flutterLocalNotificationsPlugin.show(
      id,
      title,
      body,
      NotificationDetails(
        android: androidDetails,
        iOS: details.iOS,
      ),
      payload: payload,
    );
  }

  static Future<void> scheduleReminderNotification({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
    String? payload,
  }) async {
    await initialize();
    if (scheduledDate.isBefore(DateTime.now())) return;

    final tzDate = tz.TZDateTime.from(scheduledDate, tz.local);

    await flutterLocalNotificationsPlugin.zonedSchedule(
      id,
      title,
      body,
      tzDate,
      _details(NativeNotificationKind.reminder),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
      payload: payload,
    );
  }

  static Future<void> cancelAllNotifications() async {
    await flutterLocalNotificationsPlugin.cancelAll();
  }

  static Future<void> cancelNotification(int id) async {
    await flutterLocalNotificationsPlugin.cancel(id);
  }

  static NativeNotificationKind kindFromPayload(String? payload, {String? typeHint}) {
    if (typeHint != null) {
      final t = typeHint.toLowerCase();
      if (t.contains('reminder') || t.contains('rappel') || t.contains('dose')) {
        return NativeNotificationKind.reminder;
      }
    }
    if (payload == null || payload.isEmpty) return NativeNotificationKind.message;
    try {
      final map = jsonDecode(payload) as Map<String, dynamic>;
      final type = map['type']?.toString().toLowerCase() ?? '';
      if (type.contains('reminder') || type.contains('dose')) {
        return NativeNotificationKind.reminder;
      }
    } catch (_) {}
    return NativeNotificationKind.message;
  }
}
