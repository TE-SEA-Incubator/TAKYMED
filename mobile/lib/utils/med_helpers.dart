/// Helpers partagés pour la recherche médicaments / pharmacies.
class MedHelpers {
  MedHelpers._();

  static int? parseId(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    return int.tryParse(value.toString());
  }

  /// Évite de charger des images base64 lourdes dans les listes.
  static String? photoForList(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final trimmed = url.trim();
    if (trimmed.startsWith('data:image/') || trimmed.length > 512) return null;
    return trimmed;
  }

  static String formatDistance(dynamic distance) {
    if (distance == null) return '';
    if (distance is num) return '${distance.toStringAsFixed(distance is int ? 0 : 1)} km';
    return '$distance km';
  }

  static String safeString(dynamic value, [String fallback = '']) {
    if (value == null) return fallback;
    return value.toString();
  }
}
