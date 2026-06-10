import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../theme/app_colors.dart';
import '../widgets/gradient_header.dart';
import '../widgets/page_transitions.dart';

class PharmacyDetailsScreen extends StatelessWidget {
  final dynamic p;

  const PharmacyDetailsScreen({super.key, required this.p});

  Future<void> _callPharmacy(String phone) async {
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _openMaps(double lat, double lng) async {
    final url = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: p['name'] ?? 'Pharmacie',
            subtitle: 'Détails et itinéraire',
            showBack: true,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                ListTile(
                  leading: const Icon(Icons.location_on, color: AppColors.primary),
                  title: const Text('Adresse'),
                  subtitle: Text(p['address'] ?? 'Aucune adresse'),
                ),
                ListTile(
                  leading: const Icon(Icons.phone, color: AppColors.primary),
                  title: const Text('Téléphone'),
                  subtitle: Text(p['phone'] ?? 'Non disponible'),
                ),
                const SizedBox(height: 32),
                if (p['phone'] != null && p['phone'].toString().isNotEmpty)
                  ElevatedButton.icon(
                    onPressed: () => _callPharmacy(p['phone'].toString()),
                    icon: const Icon(Icons.phone),
                    label: const Text('Appeler la pharmacie'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                  ),
                const SizedBox(height: 16),
                if (p['latitude'] != null && p['longitude'] != null)
                  ElevatedButton.icon(
                    onPressed: () => _openMaps((p['latitude'] as num).toDouble(), (p['longitude'] as num).toDouble()),
                    icon: const Icon(Icons.map),
                    label: const Text('Itinéraire (Google Maps)'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.secondary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
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
