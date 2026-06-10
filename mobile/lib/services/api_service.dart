import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import '../utils/phone_utils.dart';
import '../utils/auth_phone.dart';
import 'auth_exception.dart';

class ApiService {
  static const String baseUrl = 'http://82.165.150.150:3500/api';
  /// Origine du serveur (sans /api) pour les assets statiques (/uploads/...).
  static const String serverOrigin = 'http://82.165.150.150:3500';

  Map<String, dynamic> _decodeJsonMap(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
    throw Exception('Réponse serveur invalide (JSON attendu)');
  }

  String _apiErrorMessage(http.Response response, {String fallback = 'Erreur serveur'}) {
    final contentType = response.headers['content-type'] ?? '';
    if (contentType.contains('application/json')) {
      try {
        final data = _decodeJsonMap(response);
        if (data['error'] != null) return data['error'].toString();
      } catch (_) {}
    }
    if (response.body.contains('<!DOCTYPE') || response.body.contains('<html')) {
      return 'Endpoint indisponible sur le serveur (${response.statusCode})';
    }
    return '$fallback (${response.statusCode})';
  }

  Map<String, dynamic> _normalizeNearbyPharmacies(Map<String, dynamic> data) {
    if (data.containsKey('withStock') || data.containsKey('onDuty')) {
      return data;
    }

    final legacyList = (data['pharmacies'] as List<dynamic>?) ?? [];
    final resolved = data['resolvedLocation'];
    Map<String, dynamic>? location;
    if (resolved is Map) {
      location = {
        'lat': resolved['lat'],
        'lng': resolved['lng'],
        'city': resolved['city'],
        'region': resolved['region'],
      };
    }

    return {
      ...data,
      'withStock': legacyList,
      'onDuty': <dynamic>[],
      'allNearby': legacyList,
      'location': location,
    };
  }

  Future<Map<String, dynamic>> login(String phone, String type, String pin) async {
    final normalizedPhone = _normalizeAuthPhone(phone);
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': normalizedPhone, 'type': type, 'pin': pin.trim()}),
    );

    if (response.statusCode == 200) {
      return _decodeJsonMap(response);
    }
    if (response.statusCode == 401) {
      try {
        final data = _decodeJsonMap(response);
        final error = data['error']?.toString() ?? 'Échec de la connexion';
        if (data['pinRegenerated'] == true) {
          throw AuthException(error, pinRegenerated: true);
        }
        throw AuthException(error);
      } catch (e) {
        if (e is AuthException) rethrow;
      }
    }
    throw AuthException(_apiErrorMessage(response, fallback: 'Échec de la connexion'));
  }

  Future<Map<String, dynamic>> getOrdonnances(int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/ordonnances?userId=$userId'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Échec de la récupération des ordonnances');
    }
  }

  Future<Map<String, dynamic>> getOrdonnanceDetails(int id) async {
    final response = await http.get(
      Uri.parse('$baseUrl/ordonnances/$id'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Échec de la récupération de l\'ordonnance');
    }
  }

  Future<Map<String, dynamic>> getDashboard(int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/prescriptions?userId=$userId'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Échec de la récupération des données du tableau de bord');
    }
  }

  Future<void> markDoseAsTaken(int doseId) async {
    await toggleDoseStatus(doseId, true);
  }

  Future<void> markDoseAsUntaken(int doseId) async {
    await toggleDoseStatus(doseId, false);
  }

  Future<void> toggleDoseStatus(int doseId, bool taken) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/ordonnances/prises/$doseId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'statut_prise': taken ? 1 : 0}),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la mise à jour de la prise');
    }
  }

  Future<void> delayDose(int doseId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/prescriptions/doses/$doseId/delay'),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec du report de la prise');
    }
  }

  Future<void> updateDoseTime(int doseId, String heurePrevue) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/ordonnances/prises/$doseId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'heure_prevue': heurePrevue}),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la mise à jour de l\'heure');
    }
  }

  Future<String> ping() async {
    final stopwatch = Stopwatch()..start();
    final response = await http.get(Uri.parse('$baseUrl/ping'));
    stopwatch.stop();
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return '${data['message']} (${stopwatch.elapsedMilliseconds}ms)';
    } else {
      throw Exception('Erreur de ping: ${response.statusCode}');
    }
  }

  Future<Map<String, dynamic>> getNotifications(int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/notifications'),
      headers: {'x-user-id': userId.toString()},
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Échec de la récupération des notifications');
    }
  }

  Future<Map<String, dynamic>> getNotificationPreferences(int userId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/notifications/preferences'),
      headers: {'x-user-id': userId.toString()},
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }
    throw Exception('Échec de la récupération des préférences');
  }

  Future<void> saveNotificationPreferences(
    int userId, {
    required List<String> channels,
    List<String>? recipients,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/notifications/preferences'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId.toString(),
      },
      body: jsonEncode({
        'channels': channels,
        if (recipients != null) 'recipients': recipients,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception(jsonDecode(response.body)['error'] ?? 'Échec de la sauvegarde');
    }
  }

  Future<void> registerDevice(
    int userId,
    String platform,
    String token, {
    String? deviceLabel,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/notifications/register-device'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId.toString(),
      },
      body: jsonEncode({
        'platform': platform,
        'token': token,
        if (deviceLabel != null) 'deviceLabel': deviceLabel,
      }),
    );
    if (response.statusCode != 200) {
      throw Exception('Échec enregistrement appareil push');
    }
  }

  Future<List<dynamic>> getPendingPushNotifications(int userId, {String? since}) async {
    final uri = Uri.parse('$baseUrl/notifications/pending-push').replace(
      queryParameters: since != null ? {'since': since} : null,
    );
    final response = await http.get(
      uri,
      headers: {'x-user-id': userId.toString()},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data['notifications'] as List<dynamic>? ?? [];
    }
    return [];
  }

  Future<void> ackPushNotifications(int userId, List<int> ids) async {
    await http.post(
      Uri.parse('$baseUrl/notifications/ack-push'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId.toString(),
      },
      body: jsonEncode({'ids': ids}),
    );
  }

  Future<Map<String, dynamic>> createOrdonnance(
    Map<String, dynamic> data, {
    int? actorUserId,
  }) async {
    final targetUserId = data['userId'];
    final headerUserId = actorUserId ?? targetUserId;
    final response = await http.post(
      Uri.parse('$baseUrl/prescriptions'),
      headers: {
        'Content-Type': 'application/json',
        if (headerUserId != null) 'x-user-id': headerUserId.toString(),
      },
      body: jsonEncode(data),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception(jsonDecode(response.body)['error'] ?? 'Échec de la création de l\'ordonnance');
    }
  }

  Future<List<CountryOption>> getCountries() async {
    final response = await http.get(Uri.parse('$baseUrl/countries'));
    if (response.statusCode == 200) {
      final data = _decodeJsonMap(response);
      final list = data['countries'] as List<dynamic>? ?? [];
      return list
          .map((c) => CountryOption.fromJson(Map<String, dynamic>.from(c as Map)))
          .toList();
    }
    return [CountryOption.fallback];
  }

  /// Inscription identique au web : téléphone + type → PIN envoyé par SMS.
  Future<String> register(String phone, String type) async {
    final normalizedPhone = _normalizeAuthPhone(phone);
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': normalizedPhone, 'type': type}),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = _decodeJsonMap(response);
      return data['message']?.toString() ??
          'Compte créé. Votre PIN a été envoyé par SMS.';
    }
    throw Exception(_apiErrorMessage(response, fallback: 'Échec de l\'inscription'));
  }

  String _normalizeAuthPhone(String phone) {
    final trimmed = phone.trim();
    if (trimmed.toLowerCase() == 'admin') return 'admin';
    if (trimmed.toLowerCase() == 'commercial') return 'commercial';
    if (trimmed.startsWith('+')) return trimmed.replaceAll(' ', '');
    return PhoneUtils.normalizeCameroon(trimmed);
  }

  Future<void> updateProfile(int userId, String name, String phone) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/auth/profile'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId.toString(),
      },
      body: jsonEncode({'name': name, 'phone': phone}),
    );

    if (response.statusCode != 200) {
      throw Exception(jsonDecode(response.body)['error'] ?? 'Échec de la mise à jour du profil');
    }
  }

  Future<Map<String, dynamic>> searchMedications(String query) async {
    final response = await http.get(
      Uri.parse('$baseUrl/medications?q=${Uri.encodeComponent(query)}'),
    );

    if (response.statusCode == 200) {
      return _decodeJsonMap(response);
    }
    throw Exception(_apiErrorMessage(response, fallback: 'Échec de la recherche de médicaments'));
  }

  Future<Map<String, dynamic>> searchMedicationWithAI(String name) async {
    final response = await http.get(
      Uri.parse('$baseUrl/medications/ai-info?name=${Uri.encodeComponent(name)}'),
    );

    if (response.statusCode == 200) {
      return _decodeJsonMap(response);
    }
    throw Exception(_apiErrorMessage(response, fallback: 'Recherche IA indisponible'));
  }

  Future<List<dynamic>> getAllPharmacies() async {
    final uri = Uri.parse('$baseUrl/pharmacies/all');
    
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200) {
        final data = _decodeJsonMap(response);
        return data['pharmacies'] as List<dynamic>? ?? [];
      } else {
        throw Exception('Erreur serveur (${response.statusCode})');
      }
    } on TimeoutException {
      throw Exception('La connexion au serveur a expiré (Timeout).');
    } on http.ClientException catch (e) {
      throw Exception('Erreur réseau: Impossible de joindre le serveur. $e');
    } catch (e) {
      throw Exception('Erreur inattendue: $e');
    }
  }

  Future<Map<String, dynamic>> getInteractions() async {
    final response = await http.get(
      Uri.parse('$baseUrl/medications/interactions'),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Échec de la récupération des interactions');
    }
  }

  Future<Map<String, dynamic>> searchPharmacies(int medId, {double? lat, double? lng}) async {
    String url = '$baseUrl/pharmacies/search?medId=$medId';
    if (lat != null && lng != null) {
      url += '&lat=$lat&lng=$lng';
    }
    final response = await http.get(Uri.parse(url));

    if (response.statusCode == 200) {
      return _decodeJsonMap(response);
    }
    throw Exception(_apiErrorMessage(response, fallback: 'Échec de la recherche de pharmacies'));
  }

  /// Recherche unifiée : stock + pharmacies de garde, triées par proximité.
  Future<Map<String, dynamic>> searchNearbyPharmacies({
    double? lat,
    double? lng,
    int? medId,
    int limit = 80,
  }) async {
    final params = <String, String>{'limit': limit.toString()};
    if (lat != null && lng != null) {
      params['lat'] = lat.toString();
      params['lng'] = lng.toString();
    }
    if (medId != null) params['medId'] = medId.toString();

    final uri = Uri.parse('$baseUrl/pharmacies/nearby').replace(queryParameters: params);
    
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        return _normalizeNearbyPharmacies(_decodeJsonMap(response));
      } else {
        throw Exception('Erreur serveur (${response.statusCode}): ${response.body}');
      }
    } on TimeoutException {
      throw Exception('La connexion au serveur a expiré (Timeout). Vérifiez votre connexion.');
    } on http.ClientException catch (e) {
      throw Exception('Erreur réseau: Impossible de joindre le serveur. $e');
    } catch (e) {
      throw Exception('Erreur inattendue: $e');
    }
  }

  Future<Map<String, dynamic>> checkCommercialClientAvailability(
    int commercialId,
    String clientName,
    String clientPhone, {
    int? excludeUserId,
  }) async {
    final params = {
      'commercialId': commercialId.toString(),
      'name': clientName,
      'phone': clientPhone,
      if (excludeUserId != null) 'excludeUserId': excludeUserId.toString(),
    };
    final uri = Uri.parse('$baseUrl/commercial/check-client').replace(queryParameters: params);
    final response = await http.get(
      uri,
      headers: {'x-user-id': commercialId.toString()},
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }

    final body = jsonDecode(response.body);
    throw Exception(body is Map ? (body['error'] ?? 'Vérification impossible') : 'Vérification impossible');
  }

  Future<Map<String, dynamic>> registerCommercialClient(int commercialId, String clientName, String clientPhone, Map<String, dynamic> prescription, String? startDate) async {
    final response = await http.post(
      Uri.parse('$baseUrl/commercial/register-client'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': commercialId.toString(),
      },
      body: jsonEncode({
        'commercialId': commercialId,
        'clientName': clientName,
        'clientPhone': clientPhone,
        'prescription': prescription,
        'startDate': startDate,
      }),
    );

    final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body is Map<String, dynamic> ? body : {'success': true};
    }

    throw Exception(body is Map ? (body['error'] ?? 'Échec de l\'inscription du client') : 'Échec de l\'inscription du client');
  }

  Future<Map<String, dynamic>> validateCommercialClient(
    int commercialId,
    String clientPhone,
    String pin, {
    int? clientId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/commercial/validate-client'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': commercialId.toString(),
      },
      body: jsonEncode({
        'commercialId': commercialId,
        'clientPhone': clientPhone,
        'pin': pin,
        if (clientId != null) 'clientId': clientId,
      }),
    );

    final body = response.body.isNotEmpty ? jsonDecode(response.body) : {};
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body is Map<String, dynamic> ? body : {'success': true};
    }

    throw Exception(body is Map ? (body['error'] ?? 'Échec de la validation du client') : 'Échec de la validation du client');
  }

  Future<List<dynamic>> getCommercialClients(int commercialId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/commercial/clients?commercialId=$commercialId'),
      headers: {'x-user-id': commercialId.toString()},
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return (data['clients'] as List<dynamic>?) ?? [];
    } else {
      final body = response.body;
      throw Exception('Échec clients (${response.statusCode}): $body');
    }
  }

  Future<Map<String, dynamic>> getCommercialStats(int commercialId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/commercial/stats?commercialId=$commercialId'),
      headers: {'x-user-id': commercialId.toString()},
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    } else {
      throw Exception('Échec stats (${response.statusCode}): ${response.body}');
    }
  }

  Future<void> updateClientName(int commercialId, int clientId, String newName) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/commercial/clients/$clientId'),
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': commercialId.toString(),
      },
      body: jsonEncode({'commercialId': commercialId, 'name': newName}),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la modification du client');
    }
  }

  Future<void> deleteClient(int commercialId, int clientId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/commercial/clients/$clientId?commercialId=$commercialId'),
      headers: {'x-user-id': commercialId.toString()},
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la suppression du client');
    }
  }

  Future<void> updateOrdonnance(
    int id,
    String titre,
    String nomPatient,
    double? poidsPatient,
    String categorieAge, {
    int? userId,
  }) async {
    final response = await http.put(
      Uri.parse('$baseUrl/ordonnances/$id'),
      headers: {
        'Content-Type': 'application/json',
        if (userId != null) 'x-user-id': userId.toString(),
      },
      body: jsonEncode({
        'titre': titre,
        'nom_patient': nomPatient,
        'poids_patient': poidsPatient,
        'categorie_age': categorieAge,
      }),
    );

    if (response.statusCode != 200) {
      final err = _apiErrorMessage(response, fallback: 'Échec de la mise à jour de l\'ordonnance');
      throw Exception(err);
    }
  }

  Future<void> cancelOrdonnance(int id) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/ordonnances/$id/cancel'),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de l\'annulation de l\'ordonnance');
    }
  }

  Future<void> reactivateOrdonnance(int id) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/ordonnances/$id/reactivate'),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la réactivation de l\'ordonnance');
    }
  }

  Future<void> deleteOrdonnance(int id, {int? userId}) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/ordonnances/$id'),
      headers: {
        if (userId != null) 'x-user-id': userId.toString(),
      },
    );

    if (response.statusCode != 200) {
      throw Exception(_apiErrorMessage(response, fallback: 'Échec de la suppression de l\'ordonnance'));
    }
  }

  Future<void> addMedicament(int ordonnanceId, Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ordonnances/$ordonnanceId/medicaments'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de l\'ajout du médicament');
    }
  }

  Future<void> updateMedicament(int ordonnanceId, int elementId, Map<String, dynamic> data) async {
    final response = await http.put(
      Uri.parse('$baseUrl/ordonnances/$ordonnanceId/medicaments/$elementId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la mise à jour du médicament');
    }
  }

  Future<void> deleteMedicament(int ordonnanceId, int elementId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/ordonnances/$ordonnanceId/medicaments/$elementId'),
    );

    if (response.statusCode != 200) {
      throw Exception('Échec de la suppression du médicament');
    }
  }

  Future<void> markAllPrisesTaken(int ordonnanceId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/ordonnances/$ordonnanceId/prises/mark-all-taken'),
      headers: {'Content-Type': 'application/json'},
    );

    if (response.statusCode != 200) {
      throw Exception('Échec du marquage des prises');
    }
  }
}
