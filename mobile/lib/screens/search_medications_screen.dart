import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_colors.dart';
import '../utils/med_helpers.dart';
import '../widgets/gradient_header.dart';
import '../widgets/page_transitions.dart';
import '../widgets/primary_button.dart';
import '../services/location_service.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/medication_image.dart';
import 'create_prescription_screen.dart';

class SearchMedicationsScreen extends StatefulWidget {
  final bool embedded;

  const SearchMedicationsScreen({super.key, this.embedded = false});

  @override
  State<SearchMedicationsScreen> createState() => _SearchMedicationsScreenState();
}

class _SearchMedicationsScreenState extends State<SearchMedicationsScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<dynamic> _medications = [];
  List<dynamic> _interactions = [];
  dynamic _selectedMed;
  List<dynamic> _pharmacies = [];
  List<dynamic> _onDutyPharmacies = [];
  double? _userLat;
  double? _userLng;
  String? _locationCity;
  bool _isFindingLocation = false;
  int _mainSection = 0; // 0 = médicaments, 1 = pharmacies
  int _pharmacyTab = 1; // 0 = stock, 1 = garde (défaut : de garde)
  bool _loadingPharmacies = false;
  final TextEditingController _pharmacyFilterController = TextEditingController();
  bool _loading = false;
  bool _aiLoading = false;
  Map<String, dynamic>? _aiResult;
  List<int> _bookmarks = [];
  Timer? _debounce;
  static const _maxResults = 40;

  @override
  void initState() {
    super.initState();
    _fetchInteractions();
    _loadBookmarks();
    _searchController.addListener(_onSearchChanged);
    _pharmacyFilterController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    _pharmacyFilterController.dispose();
    super.dispose();
  }

  Future<void> _loadBookmarks() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getStringList('med_bookmarks');
    if (saved != null) {
      setState(() {
        _bookmarks = saved.map((e) => int.parse(e)).toList();
      });
    }
  }

  Future<void> _toggleBookmark(int id) async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      if (_bookmarks.contains(id)) {
        _bookmarks.remove(id);
      } else {
        _bookmarks.add(id);
      }
    });
    await prefs.setStringList('med_bookmarks', _bookmarks.map((e) => e.toString()).toList());
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _bookmarks.contains(id) 
              ? 'Ajouté aux favoris' 
              : 'Supprimé des favoris'
          ),
        ),
      );
    }
  }

  Future<void> _fetchInteractions() async {
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.getInteractions();
      setState(() {
        _interactions = data['interactions'] ?? [];
      });
    } catch (e) {
      // Ignore errors for now
    }
  }

  void _onSearchChanged() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _runSearch());
  }

  Future<void> _runSearch() async {
    if (!mounted) return;
    final query = _searchController.text.trim();

    if (query.isEmpty) {
      setState(() {
        _loading = false;
        _medications = [];
        _selectedMed = null;
        _aiResult = null;
        _pharmacies = [];
        _onDutyPharmacies = [];
      });
      return;
    }

    setState(() {
      _loading = true;
      _selectedMed = null;
      _aiResult = null;
      _pharmacies = [];
      _onDutyPharmacies = [];
    });

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchMedications(query);
      final raw = (data['medications'] as List<dynamic>?) ?? [];
      if (!mounted || _searchController.text.trim() != query) return;
      setState(() {
        _medications = raw.take(_maxResults).toList();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _medications = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _searchWithAI() async {
    final query = _searchController.text.trim();
    if (query.length < 2) return;
    setState(() { _aiLoading = true; _aiResult = null; });
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchMedicationWithAI(query);
      setState(() {
        _aiResult = data['aiResult'];
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('IA: $e')),
        );
      }
    } finally {
      if (mounted) setState(() { _aiLoading = false; });
    }
  }

  Future<void> _getLocation({bool silent = false}) async {
    setState(() => _isFindingLocation = true);
    try {
      final pos = await LocationService.getCurrentPosition();
      if (pos == null) {
        if (mounted && !silent) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Autorisez la localisation pour trier les pharmacies par distance')),
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
      if (mounted && !silent) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Position récupérée — pharmacies triées par distance')),
        );
      }
    } finally {
      if (mounted) setState(() => _isFindingLocation = false);
    }
  }

  Future<void> _fetchNearbyPharmacies({int? medId}) async {
    setState(() => _loadingPharmacies = true);
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final effectiveMedId =
          medId ?? (_selectedMed != null ? MedHelpers.parseId(_selectedMed['id']) : null);

      final data = await api.searchNearbyPharmacies(
        lat: _userLat,
        lng: _userLng,
        medId: effectiveMedId,
      );

      var withStock = (data['withStock'] as List<dynamic>?) ?? [];
      var onDuty = (data['onDuty'] as List<dynamic>?) ?? [];

      if (withStock.isEmpty && effectiveMedId != null) {
        final legacy = await api.searchPharmacies(
          effectiveMedId,
          lat: _userLat,
          lng: _userLng,
        );
        withStock = (legacy['pharmacies'] as List<dynamic>?) ?? [];
      }

      if (mounted) {
        setState(() {
          _pharmacies = withStock;
          _onDutyPharmacies = onDuty;
          _locationCity = data['location']?['city']?.toString();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _pharmacies = [];
          _onDutyPharmacies = [];
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Pharmacies: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingPharmacies = false);
    }
  }

  Future<void> _openPharmaciesSection({bool stockTab = false}) async {
    setState(() {
      _mainSection = 1;
      _pharmacyTab = stockTab ? 0 : 1;
    });
    if (_userLat == null) {
      await _getLocation(silent: true);
    }
    await _fetchNearbyPharmacies();
  }

  void _switchMainSection(int section) {
    if (_mainSection == section) return;
    setState(() => _mainSection = section);
    if (section == 1) {
      _openPharmaciesSection(stockTab: false);
    }
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

  List<dynamic> _getRelevantInteractions() {
    if (_selectedMed == null) return [];
    final selectedName = MedHelpers.safeString(_selectedMed['name']).toLowerCase();
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
      SlidePageRoute(page: CreatePrescriptionScreen(initialMedName: _selectedMed['name'])),
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
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [AppColors.ai, Color(0xFFA855F7)]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.auto_awesome, color: Colors.white, size: 14),
                      SizedBox(width: 4),
                      Text('Résultat IA', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (ai['category'] != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.deepPurple[50],
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(ai['category'], style: TextStyle(fontSize: 11, color: Colors.deepPurple[700])),
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
              _aiInfoRow(Icons.info_outline, 'Description', ai['description'], Colors.blue),
              const SizedBox(height: 10),
            ],
            if (ai['dosage'] != null) ...[
              _aiInfoRow(Icons.medication, 'Posologie', ai['dosage'], Colors.green),
              const SizedBox(height: 10),
            ],
            if (ai['precautions'] != null) ...[
              _aiInfoRow(Icons.warning_amber, 'Précautions', ai['precautions'], Colors.orange),
              const SizedBox(height: 10),
            ],
            if (ai['sideEffects'] != null) ...[
              _aiInfoRow(Icons.sick_outlined, 'Effets indésirables', ai['sideEffects'], Colors.red),
              const SizedBox(height: 16),
            ],
            ElevatedButton.icon(
              onPressed: () {
                Navigator.push(context, MaterialPageRoute(
                  builder: (context) => CreatePrescriptionScreen(
                    initialMedName: ai['name'] ?? _searchController.text,
                  ),
                ));
              },
              icon: const Icon(Icons.add),
              label: const Text('Ajouter au traitement'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              '⚠️ Ces informations sont générées par IA et ne remplacent pas un avis médical.',
              style: TextStyle(fontSize: 11, color: Colors.grey, fontStyle: FontStyle.italic),
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
              Text(label, style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
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
              subtitle: _mainSection == 0 ? 'Catalogue médicaments' : 'Pharmacies & de garde',
              showBack: true,
            )
          else
            GradientHeader(
              title: 'Rechercher',
              subtitle: _mainSection == 0 ? 'Catalogue médicaments' : 'Pharmacies & de garde',
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
              ? [BoxShadow(color: AppColors.foreground.withValues(alpha: 0.06), blurRadius: 8)]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: selected ? AppColors.primary : AppColors.mutedForeground),
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
                    child: Icon(Icons.search_rounded, color: AppColors.mutedForeground, size: 24),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 18),
                      decoration: const InputDecoration(
                        hintText: 'Rechercher un médicament…',
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.only(right: 12),
                      child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
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
    final list = _filteredPharmacyList(_pharmacyTab == 0 ? _pharmacies : _onDutyPharmacies);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              OutlinedButton.icon(
                onPressed: _isFindingLocation ? null : () => _getLocation(),
                icon: _isFindingLocation
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Icon(
                        _userLat != null ? Icons.location_on_rounded : Icons.my_location_rounded,
                        color: AppColors.primary,
                      ),
                label: Text(
                  _userLat != null
                      ? 'Ma position${_locationCity != null ? ' · $_locationCity' : ''}'
                      : 'Utiliser ma position',
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
              const SizedBox(height: 10),
              Container(
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
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                  ),
                ),
              ),
              if (_selectedMed != null) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.medication_rounded, color: AppColors.primary, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Stock pour : ${_selectedMed['name']}',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Container(
            decoration: BoxDecoration(color: AppColors.muted, borderRadius: BorderRadius.circular(14)),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _pharmacyTab = 1);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _pharmacyTab == 1 ? AppColors.surface : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'De garde (${_onDutyPharmacies.length})',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                          color: _pharmacyTab == 1 ? AppColors.warning : AppColors.mutedForeground,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() => _pharmacyTab = 0);
                      if (_selectedMed != null) {
                        _fetchNearbyPharmacies();
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: _pharmacyTab == 0 ? AppColors.surface : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Avec stock (${_pharmacies.length})',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                          color: _pharmacyTab == 0 ? AppColors.primary : AppColors.mutedForeground,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
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
                          _pharmacyTab == 0
                              ? (_selectedMed == null
                                  ? 'Sélectionnez un médicament dans l\'onglet Médicaments pour voir les stocks.'
                                  : 'Aucune pharmacie avec ce médicament en stock.')
                              : 'Aucune pharmacie de garde${_userLat == null ? '\nActivez votre position pour affiner' : ''}',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.mutedForeground),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                      itemCount: list.length,
                      itemBuilder: (context, index) =>
                          _buildPharmacyCard(list[index], isGarde: _pharmacyTab == 1),
                    ),
        ),
      ],
    );
  }

  Widget _buildResultsList() {
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
                style: const TextStyle(
                  color: Colors.grey,
                  fontSize: 14,
                ),
              ),
            ),
          if (_medications.isEmpty && !_loading && _searchController.text.trim().isNotEmpty)
            Column(
              children: [
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(
                      child: Text('Aucun médicament trouvé dans la base de données.'),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                // AI search button
                if (_aiResult == null)
                  PrimaryButton(
                    label: _aiLoading ? 'Recherche IA...' : 'Rechercher avec l\'IA',
                    icon: Icons.auto_awesome_rounded,
                    isLoading: _aiLoading,
                    gradient: AppColors.aiGradient,
                    onPressed: _searchWithAI,
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
                    Icon(
                      Icons.medication,
                      size: 64,
                      color: Colors.grey,
                    ),
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
                      style: TextStyle(
                        color: Colors.grey,
                      ),
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
              Icon(
                Icons.chevron_right,
                color: Colors.grey[300],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailView(List<dynamic> relevantInteractions) {
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
                      final w = constraints.maxWidth.isFinite ? constraints.maxWidth : 300.0;
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
                                color: Theme.of(context)
                                    .colorScheme
                                    .primaryContainer,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                (_selectedMed['type'] ?? 'médicament')
                                    .toUpperCase(),
                                style: TextStyle(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onPrimaryContainer,
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
                              _bookmarks.contains(MedHelpers.parseId(_selectedMed['id']))
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                              color: _bookmarks.contains(MedHelpers.parseId(_selectedMed['id']))
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
                                    color: Theme.of(context).colorScheme.primary,
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
                      Icon(
                        Icons.warning,
                        color: Colors.amber[700],
                        size: 20,
                      ),
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
                            style: TextStyle(
                              color: Colors.amber[800],
                            ),
                          ),
                        ],
                      ),
                    ),

                  if (relevantInteractions.isNotEmpty)
                    ...relevantInteractions.map(
                      (inter) {
                        final selectedName = MedHelpers.safeString(_selectedMed['name']).toLowerCase();
                        final otherMed =
                            MedHelpers.safeString(inter['med1Name']).toLowerCase() == selectedName
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
                                Icon(
                                  Icons.warning,
                                  color: riskColor,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
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
                                          padding:
                                              const EdgeInsets.only(top: 4.0),
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
                                          borderRadius:
                                              BorderRadius.circular(8),
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
                      },
                    ),
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
            onPressed: () => _openPharmaciesSection(stockTab: true),
            icon: const Icon(Icons.local_pharmacy_rounded),
            label: const Text('Voir disponibilité en pharmacie'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPharmacyCard(dynamic pharmacy, {required bool isGarde}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isGarde ? AppColors.warningLight.withValues(alpha: 0.35) : AppColors.muted,
        border: Border.all(color: isGarde ? AppColors.warning.withValues(alpha: 0.3) : AppColors.border),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (isGarde)
                          Container(
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.warning,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'DE GARDE',
                              style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800),
                            ),
                          ),
                        Expanded(
                          child: Text(
                            MedHelpers.safeString(pharmacy['name'], 'Pharmacie'),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 14, color: AppColors.mutedForeground),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            MedHelpers.safeString(pharmacy['address'], 'Adresse non renseignée'),
                            style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (pharmacy['distance'] != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    MedHelpers.formatDistance(pharmacy['distance']),
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.primary),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              if (!isGarde && pharmacy['quantity'] != null)
                Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
                    const SizedBox(width: 4),
                    Text(
                      'En stock (${pharmacy['quantity']} unités)',
                      style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.success, fontSize: 12),
                    ),
                  ],
                )
              else if (isGarde)
                Row(
                  children: [
                    const Icon(Icons.nightlight_round, color: AppColors.warning, size: 18),
                    const SizedBox(width: 4),
                    Text(
                      pharmacy['status'] ?? 'Ouverte',
                      style: const TextStyle(fontWeight: FontWeight.w600, color: AppColors.warning, fontSize: 12),
                    ),
                  ],
                ),
              const Spacer(),
              if (MedHelpers.safeString(pharmacy['phone']).trim().isNotEmpty)
                OutlinedButton.icon(
                  onPressed: () => _callPharmacy(pharmacy['phone']?.toString()),
                  icon: const Icon(Icons.phone_rounded, size: 18),
                  label: const Text('Appeler'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

