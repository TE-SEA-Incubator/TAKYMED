import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_colors.dart';
import '../utils/med_helpers.dart';
import '../widgets/gradient_header.dart';
import '../widgets/page_transitions.dart';
import '../services/location_service.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/medication_image.dart';
import 'create_prescription_screen.dart';
import 'search_pharmacies_screen.dart';

class SearchMedicationsScreen extends StatefulWidget {
  final bool embedded;

  const SearchMedicationsScreen({super.key, this.embedded = false});

  @override
  State<SearchMedicationsScreen> createState() =>
      _SearchMedicationsScreenState();
}

class _SearchMedicationsScreenState extends State<SearchMedicationsScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _medications = [];
  List<dynamic> _interactions = [];
  dynamic _selectedMed;
  List<dynamic> _pharmacies = [];
  double? _userLat;
  double? _userLng;
  String? _locationCity;
  bool _isFindingLocation = false;
  int _mainSection = 0; // 0 = médicaments, 1 = pharmacies
  bool _loadingPharmacies = false;
  final TextEditingController _pharmacyFilterController =
      TextEditingController();
  bool _loading = false;
  bool _aiLoading = false;
  Map<String, dynamic>? _aiResult;
  String? _aiErrorMessage;
  List<int> _bookmarks = [];
  Timer? _debounce;
  String _lastAiQuery = '';
  static const _maxResults = 40;

  @override
  void initState() {
    super.initState();
    _fetchInteractions();
    _loadBookmarks();
    _pharmacyFilterController.addListener(_onPharmacyFilterChanged);
  }

  void _onPharmacyFilterChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _pharmacyFilterController.removeListener(_onPharmacyFilterChanged);
    _searchController.dispose();
    _pharmacyFilterController.dispose();
    super.dispose();
  }

  Future<void> _loadBookmarks() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('med_bookmarks');
    if (saved != null && mounted) {
      setState(() {
        _bookmarks = saved.map((e) => int.parse(e)).toList();
      });
    }
  }

  Future<void> _toggleBookmark(int id) async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      if (_bookmarks.contains(id)) {
        _bookmarks.remove(id);
      } else {
        _bookmarks.add(id);
      }
    });
    await prefs.setStringList(
      'med_bookmarks',
      _bookmarks.map((e) => e.toString()).toList(),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _bookmarks.contains(id)
                ? 'Ajouté aux favoris'
                : 'Supprimé des favoris',
          ),
        ),
      );
    }
  }

  Future<void> _fetchInteractions() async {
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.getInteractions();
      if (mounted) {
        setState(() {
          _interactions = data['interactions'] ?? [];
        });
      }
    } catch (e) {
      // Ignore errors for now
    }
  }

  void _scheduleSearch() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      if (!mounted) return;
      _runSearch();
    });
  }

  // Manual search trigger
  Future<void> _runSearch() async {
    if (!mounted) return;
    final query = _searchController.text.trim();

    if (query.isEmpty) {
      setState(() {
        _loading = false;
        _medications = [];
        _selectedMed = null;
        _aiResult = null;
        _aiErrorMessage = null;
        _lastAiQuery = '';
      });
      return;
    }

    setState(() {
      _loading = true;
      _selectedMed = null;
      _aiResult = null;
      _aiErrorMessage = null;
    });

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchMedications(query);
      final raw = (data['medications'] as List<dynamic>?) ?? [];

      if (!mounted) return;

      if (raw.isEmpty) {
        setState(() {
          _medications = [];
        });
        await _searchWithAI(forcedQuery: query, silent: true);
        return;
      }

      setState(() {
        _medications = raw.take(_maxResults).toList();
        _lastAiQuery = '';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _medications = [];
        _aiResult = null;
        _aiErrorMessage = null;
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _searchWithAI({String? forcedQuery, bool silent = false}) async {
    final query = (forcedQuery ?? _searchController.text).trim();
    if (query.length < 2 || _aiLoading) return;
    if (_lastAiQuery == query && _aiResult != null) return;

    setState(() {
      _aiLoading = true;
      _aiResult = null;
      _aiErrorMessage = null;
      _lastAiQuery = query;
    });
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchMedicationWithAI(query);
      if (!mounted) return;
      setState(() {
        _aiResult = data['aiResult'] as Map<String, dynamic>?;
      });
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceFirst('Exception: ', '').trim();
      setState(() {
        _aiErrorMessage = message.isEmpty
            ? 'Recherche IA indisponible'
            : message;
      });
      if (!silent) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(_aiErrorMessage!)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _aiLoading = false;
        });
      }
    }
  }

  Future<void> _getLocation({bool silent = false}) async {
    setState(() => _isFindingLocation = true);
    try {
      final pos = await LocationService.getCurrentPosition();
      if (pos == null) {
        if (mounted && !silent) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Autorisez la localisation pour trier par proximité',
              ),
            ),
          );
        }
        return;
      }
      setState(() {
        _userLat = pos.latitude;
        _userLng = pos.longitude;
      });
      if (_mainSection == 1) {
        await _fetchNearbyPharmacies();
      }
    } finally {
      if (mounted) setState(() => _isFindingLocation = false);
    }
  }

  Future<void> _fetchNearbyPharmacies() async {
    setState(() => _loadingPharmacies = true);
    try {
      final api = Provider.of<ApiService>(context, listen: false);

      final data = await api.searchNearbyPharmacies(
        lat: _userLat,
        lng: _userLng,
        limit: 80,
      );

      final allNearby = (data['allNearby'] as List<dynamic>?) ?? [];
      final onDuty = (data['onDuty'] as List<dynamic>?) ?? [];

      // Fusionner et marquer les pharmacies de garde
      final Map<dynamic, dynamic> unified = {};
      for (final p in allNearby) {
        p['est_garde'] = false;
        unified[p['id']] = p;
      }
      for (final p in onDuty) {
        p['est_garde'] = true;
        unified[p['id']] = p;
      }

      if (mounted) {
        setState(() {
          _pharmacies = unified.values.toList();
          _locationCity = data['location']?['city']?.toString();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pharmacies = [];
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Pharmacies: $e')));
      }
    } finally {
      if (mounted) setState(() => _loadingPharmacies = false);
    }
  }

  void _switchMainSection(int section) {
    if (_mainSection == section) return;
    setState(() => _mainSection = section);
  }

  List<dynamic> _filteredPharmacyList(List<dynamic> source) {
    final q = _pharmacyFilterController.text.trim().toLowerCase();
    if (q.isEmpty) return source;
    return source.where((p) {
      final name = MedHelpers.safeString(p['name']).toLowerCase();
      final address = MedHelpers.safeString(p['address']).toLowerCase();
      return name.contains(q) || address.contains(q);
    }).toList();
  }

  Future<void> _selectMedication(dynamic med) async {
    setState(() => _selectedMed = med);
  }

  Future<void> _callPharmacy(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:${phone.replaceAll(RegExp(r'\s'), '')}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  Future<void> _openMaps(double lat, double lng) async {
    final url =
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _showPharmacyDetails(dynamic p) {
    final bool isGarde = p['est_garde'] == true || p['est_garde'] == 1;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        elevation: 0,
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: Theme.of(context).scaffoldBackgroundColor,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // En-tête
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 20,
                ),
                decoration: BoxDecoration(
                  color: isGarde
                      ? AppColors.warningLight
                      : AppColors.primaryLight,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color:
                                (isGarde
                                        ? AppColors.warning
                                        : AppColors.primary)
                                    .withValues(alpha: 0.2),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.local_pharmacy_rounded,
                        color: isGarde ? AppColors.warning : AppColors.primary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            p['name'] ?? 'Pharmacie',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (isGarde)
                            Container(
                              margin: const EdgeInsets.only(top: 6),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.warning,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'DE GARDE',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Corps
              Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.location_on_rounded,
                          color: AppColors.mutedForeground,
                          size: 22,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Adresse',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                p['address'] ?? 'Aucune adresse renseignée',
                                style: const TextStyle(
                                  color: AppColors.mutedForeground,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.phone_rounded,
                          color: AppColors.mutedForeground,
                          size: 22,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Téléphone',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                (p['phone'] != null &&
                                        p['phone'].toString().trim().isNotEmpty)
                                    ? p['phone']
                                    : 'Non disponible',
                                style: const TextStyle(
                                  color: AppColors.mutedForeground,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Actions
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (p['latitude'] != null && p['longitude'] != null)
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.pop(context);
                          _openMaps(
                            (p['latitude'] as num).toDouble(),
                            (p['longitude'] as num).toDouble(),
                          );
                        },
                        icon: const Icon(Icons.directions_rounded),
                        label: const Text('Itinéraire Google Maps'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.secondary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                          textStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Text(
                              'Fermer',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                        if (p['phone'] != null &&
                            p['phone'].toString().trim().isNotEmpty) ...[
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () =>
                                  _callPharmacy(p['phone'].toString()),
                              icon: const Icon(
                                Icons.phone_in_talk_rounded,
                                size: 20,
                              ),
                              label: const Text('Appeler'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                textStyle: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<dynamic> _getRelevantInteractions() {
    if (_selectedMed == null) return [];
    final selectedName = MedHelpers.safeString(
      _selectedMed['name'],
    ).toLowerCase();
    if (selectedName.isEmpty) return [];
    return _interactions.where((i) {
      final med1 = MedHelpers.safeString(i['med1Name']).toLowerCase();
      final med2 = MedHelpers.safeString(i['med2Name']).toLowerCase();
      return med1 == selectedName || med2 == selectedName;
    }).toList();
  }

  void _handleAddToTreatment() {
    if (_selectedMed == null) return;
    Navigator.push(
      context,
      SlidePageRoute(
        page: CreatePrescriptionScreen(initialMedName: _selectedMed['name']),
      ),
    );
  }

  Widget _buildAIResultCard(Map<String, dynamic> ai) {
    return Card(
      margin: const EdgeInsets.only(top: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.ai, Color(0xFFA855F7)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.auto_awesome, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text(
                        'Résultat IA',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (ai['category'] != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.deepPurple[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      ai['category'],
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.deepPurple[700],
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              ai['name'] ?? _searchController.text,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            if (ai['description'] != null) ...[
              _aiInfoRow(
                Icons.info_outline,
                'Description',
                ai['description'],
                Colors.blue,
              ),
              const SizedBox(height: 10),
            ],
            if (ai['dosage'] != null) ...[
              _aiInfoRow(
                Icons.medication,
                'Posologie',
                ai['dosage'],
                Colors.green,
              ),
              const SizedBox(height: 10),
            ],
            if (ai['precautions'] != null) ...[
              _aiInfoRow(
                Icons.warning_amber,
                'Précautions',
                ai['precautions'],
                Colors.orange,
              ),
              const SizedBox(height: 10),
            ],
            if (ai['sideEffects'] != null) ...[
              _aiInfoRow(
                Icons.sick_outlined,
                'Effets indésirables',
                ai['sideEffects'],
                Colors.red,
              ),
              const SizedBox(height: 16),
            ],
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => CreatePrescriptionScreen(
                      initialMedName: ai['name'] ?? _searchController.text,
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.add),
              label: const Text('Ajouter au traitement'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '⚠️ Ces informations sont générées par IA et ne remplacent pas un avis médical.',
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _aiInfoRow(IconData icon, String label, String value, Color color) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: color,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 2),
              Text(value, style: const TextStyle(fontSize: 13, height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final relevantInteractions = _getRelevantInteractions();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          if (!widget.embedded)
            GradientHeader(
              title: 'Rechercher',
              subtitle: _mainSection == 0
                  ? 'Catalogue médicaments'
                  : 'Pharmacies',
              showBack: true,
            )
          else
            GradientHeader(
              title: 'Rechercher',
              subtitle: _mainSection == 0
                  ? 'Catalogue médicaments'
                  : 'Pharmacies',
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: _buildMainSectionTabs(),
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: _mainSection == 0
                  ? _buildMedicationsSection(relevantInteractions)
                  : _buildPharmaciesSection(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainSectionTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.muted,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: _sectionTab(
              label: 'Médicaments',
              icon: Icons.medication_rounded,
              selected: _mainSection == 0,
              onTap: () => _switchMainSection(0),
            ),
          ),
          Expanded(
            child: _sectionTab(
              label: 'Pharmacies',
              icon: Icons.local_pharmacy_rounded,
              selected: _mainSection == 1,
              onTap: () => _switchMainSection(1),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTab({
    required String label,
    required IconData icon,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.foreground.withValues(alpha: 0.06),
                    blurRadius: 8,
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: selected ? AppColors.primary : AppColors.mutedForeground,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: selected ? AppColors.primary : AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMedicationsSection(List<dynamic> relevantInteractions) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              child: Row(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    child: Icon(
                      Icons.search_rounded,
                      color: AppColors.mutedForeground,
                      size: 24,
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 18),
                      textInputAction: TextInputAction.search,
                      onChanged: (_) => _scheduleSearch(),
                      onSubmitted: (_) => _runSearch(),
                      decoration: const InputDecoration(
                        hintText: 'Rechercher un médicament…',
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.search_rounded),
                    onPressed: () {
                      _debounce?.cancel();
                      _runSearch();
                    },
                  ),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.only(right: 12),
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: _selectedMed == null
              ? _buildResultsList()
              : _buildDetailView(relevantInteractions),
        ),
      ],
    );
  }

  Widget _buildPharmaciesSection() {
    final list = _filteredPharmacyList(_pharmacies);

    return Column(
      children: [
        _buildPharmacyLocationStrip(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          child: Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.border),
            ),
            child: TextField(
              controller: _pharmacyFilterController,
              decoration: const InputDecoration(
                hintText: 'Filtrer par nom ou adresse…',
                prefixIcon: Icon(Icons.search_rounded),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 14,
                ),
              ),
            ),
          ),
        ),
        Expanded(
          child: _loadingPharmacies
              ? const Center(child: CircularProgressIndicator())
              : list.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Text(
                      _userLat == null
                          ? 'Autorisez la localisation pour lister les pharmacies de votre ville.'
                          : 'Aucune pharmacie trouvée${_locationCity != null ? ' à $_locationCity' : ' près de vous'}.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.mutedForeground),
                    ),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: list.length,
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: 8),
                  itemBuilder: (context, index) =>
                      _buildPharmacyListTile(list[index], index),
                ),
        ),
      ],
    );
  }

  Widget _buildPharmacyLocationStrip() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 0),
      child: Row(
        children: [
          Icon(
            _userLat != null
                ? Icons.near_me_rounded
                : Icons.location_searching_rounded,
            size: 18,
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _isFindingLocation
                  ? 'Localisation en cours…'
                  : _userLat != null
                  ? 'Pharmacies de ${_locationCity ?? 'votre ville'} — du plus proche au plus loin'
                  : 'Appuyez pour afficher les pharmacies de votre ville',
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.mutedForeground,
              ),
            ),
          ),
          if (_isFindingLocation)
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            IconButton(
              visualDensity: VisualDensity.compact,
              tooltip: _userLat != null ? 'Actualiser' : 'Ma position',
              icon: Icon(
                _userLat != null
                    ? Icons.refresh_rounded
                    : Icons.my_location_rounded,
                color: AppColors.primary,
              ),
              onPressed: () => _getLocation(silent: _userLat != null),
            ),
        ],
      ),
    );
  }

  Widget _buildPharmacyListTile(dynamic pharmacy, int index) {
    final name = MedHelpers.safeString(pharmacy['name'], 'Pharmacie');
    final phone = MedHelpers.safeString(pharmacy['phone']).trim();
    final location = MedHelpers.shortLocation(pharmacy);
    final distance = pharmacy['distance'];
    final bool isGarde = pharmacy['est_garde'] == true;

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showPharmacyDetails(pharmacy),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: isGarde
                      ? AppColors.warningLight
                      : AppColors.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                alignment: Alignment.center,
                child: Text(
                  distance != null
                      ? MedHelpers.formatDistanceShort(distance)
                      : '${index + 1}',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: isGarde ? AppColors.warning : AppColors.primary,
                    height: 1.15,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        ),
                        if (isGarde) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'GARDE',
                              style: TextStyle(
                                fontSize: 9,
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      location,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ],
                ),
              ),
              if (phone.isNotEmpty)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: Icon(
                    Icons.phone_in_talk_rounded,
                    color: isGarde ? AppColors.warning : AppColors.primary,
                  ),
                  onPressed: () => _callPharmacy(phone),
                  tooltip: 'Appeler',
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildResultsList() {
    // ... (rest of the file as before)
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_searchController.text.trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: Text(
                _medications.length >= _maxResults
                    ? '$_maxResults+ résultats — affinez votre recherche'
                    : '${_medications.length} médicament(s) trouvé(s)',
                style: const TextStyle(color: Colors.grey, fontSize: 14),
              ),
            ),
          if (_medications.isEmpty &&
              !_loading &&
              _searchController.text.trim().isNotEmpty)
            Column(
              children: [
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                      child: Text(
                        'Aucun médicament trouvé dans la base de données.',
                      ),
                    ),
                  ),
                ),
                if (_aiLoading)
                  const Padding(
                    padding: EdgeInsets.only(top: 12),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                if (_aiErrorMessage != null)
                  Card(
                    margin: const EdgeInsets.only(top: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(
                        _aiErrorMessage!,
                        style: const TextStyle(color: AppColors.warning),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                // AI result card
                if (_aiResult != null) _buildAIResultCard(_aiResult!),
              ],
            ),
          if (_medications.isEmpty && _searchController.text.trim().isEmpty)
            const Card(
              margin: EdgeInsets.only(top: 40),
              child: Padding(
                padding: EdgeInsets.all(48),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.medication, size: 64, color: Colors.grey),
                    SizedBox(height: 16),
                    Text(
                      'Sélectionnez un médicament',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Pour voir sa description et ses stocks en pharmacie.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
          ..._medications.map((med) => _buildMedicationCard(med)),
        ],
      ),
    );
  }

  Widget _buildMedicationCard(dynamic med) {
    final isSelected = _selectedMed?['id'] == med['id'];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(
          color: isSelected
              ? Theme.of(context).colorScheme.primary
              : Colors.transparent,
          width: isSelected ? 2 : 0,
        ),
      ),
      child: InkWell(
        onTap: () => _selectMedication(med),
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              MedicationImage(
                photoUrl: MedHelpers.photoForList(med['photoUrl']?.toString()),
                width: 56,
                height: 56,
                borderRadius: 18,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      med['name'],
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      (med['type'] ?? 'médicament').toUpperCase(),
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[600],
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey[300]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailView(List<dynamic> relevantInteractions) {
    // ... (rest of the file as before)
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Back Button
          Padding(
            padding: const EdgeInsets.only(bottom: 16.0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: IconButton.filledTonal(
                onPressed: () {
                  setState(() {
                    _selectedMed = null;
                  });
                },
                icon: const Icon(Icons.arrow_back),
              ),
            ),
          ),

          // Med Info Card
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(32),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final w = constraints.maxWidth.isFinite
                          ? constraints.maxWidth
                          : 300.0;
                      return MedicationImage(
                        photoUrl: _selectedMed['photoUrl']?.toString(),
                        width: w,
                        height: 220,
                        borderRadius: 24,
                        fit: BoxFit.cover,
                      );
                    },
                  ),
                  const SizedBox(height: 24),
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: Theme.of(
                                  context,
                                ).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                (_selectedMed['type'] ?? 'médicament')
                                    .toUpperCase(),
                                style: TextStyle(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onPrimaryContainer,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _selectedMed['name'],
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 28,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (_selectedMed['price'] != null)
                              Text(
                                _selectedMed['price'].toString(),
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Row(
                        children: [
                          IconButton.filledTonal(
                            onPressed: () {
                              final id = MedHelpers.parseId(_selectedMed['id']);
                              if (id != null) _toggleBookmark(id);
                            },
                            icon: Icon(
                              _bookmarks.contains(
                                    MedHelpers.parseId(_selectedMed['id']),
                                  )
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                              color:
                                  _bookmarks.contains(
                                    MedHelpers.parseId(_selectedMed['id']),
                                  )
                                  ? Colors.amber
                                  : null,
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Description & Precautions
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.info,
                                  color: Theme.of(context).colorScheme.primary,
                                  size: 20,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'Description',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: Theme.of(
                                      context,
                                    ).colorScheme.primary,
                                    fontSize: 16,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _selectedMed['description'] ??
                                  'Aucune description disponible pour ce médicament.',
                              style: TextStyle(
                                color: Colors.grey[600],
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Precautions & Interactions
                  Row(
                    children: [
                      Icon(Icons.warning, color: Colors.amber[700], size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'Précautions & Incompatibilités',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.amber[700],
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  if ((_selectedMed['precautions'] != null &&
                          _selectedMed['precautions'] != 'aucune') ||
                      relevantInteractions.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.amber[50],
                        border: Border.all(color: Colors.amber[100]!),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'RECOMMANDATIONS :',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber[800],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _selectedMed['precautions'] != null &&
                                    _selectedMed['precautions'] != 'aucune'
                                ? _selectedMed['precautions']
                                : 'Aucune précaution spécifique enregistrée.',
                            style: TextStyle(color: Colors.amber[800]),
                          ),
                        ],
                      ),
                    ),

                  if (relevantInteractions.isNotEmpty)
                    ...relevantInteractions.map((inter) {
                      final selectedName = MedHelpers.safeString(
                        _selectedMed['name'],
                      ).toLowerCase();
                      final otherMed =
                          MedHelpers.safeString(
                                inter['med1Name'],
                              ).toLowerCase() ==
                              selectedName
                          ? MedHelpers.safeString(inter['med2Name'])
                          : MedHelpers.safeString(inter['med1Name']);
                      final Color riskColor;
                      final Color bgColor;
                      final Color borderColor;
                      switch (inter['riskLevel']) {
                        case 'critique':
                          riskColor = Colors.red;
                          bgColor = Colors.red[50]!;
                          borderColor = Colors.red[100]!;
                          break;
                        case 'eleve':
                          riskColor = Colors.orange;
                          bgColor = Colors.orange[50]!;
                          borderColor = Colors.orange[100]!;
                          break;
                        default:
                          riskColor = Colors.amber;
                          bgColor = Colors.amber[50]!;
                          borderColor = Colors.amber[100]!;
                      }

                      return Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: bgColor,
                            border: Border.all(color: borderColor),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.warning, color: riskColor),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Ne pas mélanger avec : $otherMed',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: riskColor,
                                      ),
                                    ),
                                    if (inter['description'] != null)
                                      Padding(
                                        padding: const EdgeInsets.only(
                                          top: 4.0,
                                        ),
                                        child: Text(
                                          inter['description'],
                                          style: TextStyle(
                                            color: riskColor,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ),
                                    const SizedBox(height: 8),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: riskColor,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Risque ${inter['riskLevel']}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Add to Treatment
          ElevatedButton.icon(
            onPressed: _handleAddToTreatment,
            icon: const Icon(Icons.add),
            label: const Text('Ajouter au traitement'),
            style: ElevatedButton.styleFrom(
              minimumSize: const Size(double.infinity, 56),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),

          const SizedBox(height: 16),

          OutlinedButton.icon(
            onPressed: () => pushSlide(context, const SearchPharmaciesScreen()),
            icon: const Icon(Icons.local_pharmacy_rounded),
            label: const Text('Voir les pharmacies proches'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
