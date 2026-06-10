import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import '../utils/med_helpers.dart';
import '../widgets/gradient_header.dart';
import 'package:url_launcher/url_launcher.dart';

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

      setState(() {
        _pharmacies = pharmacies;
      });
    } catch (e) {
      setState(() {
        _errorMessage = "Erreur lors du chargement: $e";
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  List<dynamic> _getFilteredList() {
    final q = _filterController.text.trim().toLowerCase();
    if (q.isEmpty) return _pharmacies;
    return _pharmacies.where((p) {
      final name = MedHelpers.safeString(p['name']).toLowerCase();
      final address = MedHelpers.safeString(p['address']).toLowerCase();
      return name.contains(q) || address.contains(q);
    }).toList();
  }

  Future<void> _callPharmacy(String phone) async {
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible de lancer l\'appel')),
      );
    }
  }

  Future<void> _openMaps(double lat, double lng, String name) async {
    final url = 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Impossible d\'ouvrir Google Maps')),
      );
    }
  }

  void _showPharmacyDetails(dynamic p) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p['name'] ?? 'Pharmacie', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.location_on, color: AppColors.primary),
              title: const Text('Adresse'),
              subtitle: Text(p['address'] ?? 'Aucune adresse'),
            ),
            ListTile(
              leading: const Icon(Icons.phone, color: AppColors.primary),
              title: const Text('Téléphone'),
              subtitle: Text(p['phone'] ?? 'Non disponible'),
              onTap: p['phone'] != null && p['phone'].toString().isNotEmpty
                  ? () => _callPharmacy(p['phone'].toString())
                  : null,
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: p['phone'] != null && p['phone'].toString().isNotEmpty
                        ? () => _callPharmacy(p['phone'].toString())
                        : null,
                    icon: const Icon(Icons.phone),
                    label: const Text('Appeler'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: p['latitude'] != null && p['longitude'] != null
                        ? () => _openMaps((p['latitude'] as num).toDouble(), (p['longitude'] as num).toDouble(), p['name'])
                        : null,
                    icon: const Icon(Icons.map),
                    label: const Text('Itinéraire'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
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
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _filterController,
              decoration: InputDecoration(
                hintText: 'Rechercher par nom ou adresse...',
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
                          final bool isGarde = p['est_garde'] == 1 || p['est_garde'] == true;
                          
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: ListTile(
                              onTap: () => _showPharmacyDetails(p),
                              title: Row(
                                children: [
                                  Expanded(child: Text(p['name'], style: const TextStyle(fontWeight: FontWeight.bold))),
                                  if (isGarde) 
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(color: Colors.amber, borderRadius: BorderRadius.circular(4)),
                                      child: const Text('GARDE', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                                    )
                                ],
                              ),
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
