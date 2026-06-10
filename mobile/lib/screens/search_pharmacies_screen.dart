import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../utils/med_helpers.dart';
import '../widgets/gradient_header.dart';

class SearchPharmaciesScreen extends StatefulWidget {
  const SearchPharmaciesScreen({super.key});

  @override
  State<SearchPharmaciesScreen> createState() => _SearchPharmaciesScreenState();
}

class _SearchPharmaciesScreenState extends State<SearchPharmaciesScreen> {
  List<dynamic> _pharmacies = [];
  bool _isLoading = false;
  String? _errorMessage;
  final TextEditingController _filterController = TextEditingController();
  bool _showGarde = true; // Par défaut, afficher les pharmacies de garde

  @override
  void initState() {
    super.initState();
    _loadPharmacies();
    _filterController.addListener(() => setState(() {}));
  }

  Future<void> _loadPharmacies() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final pharmacies = await api.getAllPharmacies();
      if (mounted) {
        setState(() => _pharmacies = pharmacies);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = "Erreur: $e");
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> _getFilteredList() {
    final q = _filterController.text.trim().toLowerCase();
    // Filtrer par type (garde ou non) ET par texte de recherche
    return _pharmacies.where((p) {
      final isTypeMatch = (p['est_garde'] == 1 || p['est_garde'] == true) == _showGarde;
      final name = MedHelpers.safeString(p['name']).toLowerCase();
      final address = MedHelpers.safeString(p['address']).toLowerCase();
      final isSearchMatch = q.isEmpty || name.contains(q) || address.contains(q);
      return isTypeMatch && isSearchMatch;
    }).toList();
  }

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

  void _showPharmacyDetails(dynamic p) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(p['name'] ?? 'Pharmacie', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              leading: const Icon(Icons.location_on, color: AppColors.primary),
              title: const Text('Adresse'),
              subtitle: Text(p['address'] ?? 'Aucune adresse'),
              contentPadding: EdgeInsets.zero,
            ),
            ListTile(
              leading: const Icon(Icons.phone, color: AppColors.primary),
              title: const Text('Téléphone'),
              subtitle: Text(p['phone'] ?? 'Non disponible'),
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Fermer')),
          if (p['phone'] != null && p['phone'].toString().isNotEmpty)
            ElevatedButton.icon(
              onPressed: () => _callPharmacy(p['phone'].toString()),
              icon: const Icon(Icons.phone),
              label: const Text('Appeler'),
            ),
          if (p['latitude'] != null && p['longitude'] != null)
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                _openMaps((p['latitude'] as num).toDouble(), (p['longitude'] as num).toDouble());
              },
              icon: const Icon(Icons.map),
              label: const Text('Itinéraire'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.white),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredList = _getFilteredList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const GradientHeader(title: 'Pharmacies', subtitle: 'Trouvez une officine proche'),
          // Barre d'onglets
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(child: ElevatedButton(
                  onPressed: () => setState(() => _showGarde = true),
                  style: ElevatedButton.styleFrom(backgroundColor: _showGarde ? AppColors.primary : AppColors.surface, foregroundColor: _showGarde ? Colors.white : AppColors.primary),
                  child: const Text('De garde'),
                )),
                const SizedBox(width: 10),
                Expanded(child: ElevatedButton(
                  onPressed: () => setState(() => _showGarde = false),
                  style: ElevatedButton.styleFrom(backgroundColor: !_showGarde ? AppColors.primary : AppColors.surface, foregroundColor: !_showGarde ? Colors.white : AppColors.primary),
                  child: const Text('Propriétaires'),
                )),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: TextField(
              controller: _filterController,
              decoration: InputDecoration(
                hintText: 'Rechercher...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _errorMessage != null
                    ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))
                    : ListView.builder(
                        itemCount: filteredList.length,
                        itemBuilder: (context, index) {
                          final p = filteredList[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: ListTile(
                              onTap: () => _showPharmacyDetails(p),
                              title: Text(p['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(p['address'] ?? ''),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _loadPharmacies,
        child: const Icon(Icons.refresh),
      ),
    );
  }
}
