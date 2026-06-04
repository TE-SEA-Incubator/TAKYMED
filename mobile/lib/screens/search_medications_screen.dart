
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_colors.dart';
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
  int _pharmacyTab = 0; // 0 = stock, 1 = garde
  bool _loadingPharmacies = false;
  bool _loading = false;
  bool _aiLoading = false;
  Map<String, dynamic>? _aiResult;
  List<int> _bookmarks = [];

  @override
  void initState() {
    super.initState();
    _fetchInteractions();
    _loadBookmarks();
    _onSearchChanged(); // Load all medications initially
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
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

  Future<void> _onSearchChanged() async {
    final query = _searchController.text.trim();
    
    setState(() {
      _loading = true;
      _selectedMed = null; // Reset selected med when searching or clearing
      _aiResult = null;    // Clear AI result on new search
    });

    // Debounce
    await Future.delayed(const Duration(milliseconds: 300));
    if (_searchController.text.trim() != query) return;

    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchMedications(query);
      setState(() {
        _medications = data['medications'] ?? [];
      });
    } catch (e) {
      setState(() {
        _medications = [];
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
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

  Future<void> _getLocation() async {
    setState(() => _isFindingLocation = true);
    try {
      final pos = await LocationService.getCurrentPosition();
      if (pos == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Autorisez la localisation pour trouver les pharmacies proches')),
          );
        }
        return;
      }
      setState(() {
        _userLat = pos.latitude;
        _userLng = pos.longitude;
      });
      if (_selectedMed != null) {
        await _fetchPharmaciesForMed(_selectedMed);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Position récupérée — pharmacies triées par distance')),
        );
      }
    } finally {
      if (mounted) setState(() => _isFindingLocation = false);
    }
  }

  Future<void> _fetchPharmaciesForMed(dynamic med) async {
    setState(() => _loadingPharmacies = true);
    try {
      final api = Provider.of<ApiService>(context, listen: false);
      final data = await api.searchNearbyPharmacies(
        lat: _userLat,
        lng: _userLng,
        medId: med['id'] as int,
      );

      var withStock = (data['withStock'] as List<dynamic>?) ?? [];
      var onDuty = (data['onDuty'] as List<dynamic>?) ?? [];

      if (withStock.isEmpty && onDuty.isEmpty) {
        final legacy = await api.searchPharmacies(
          med['id'] as int,
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

  Future<void> _selectMedication(dynamic med) async {
    setState(() {
      _selectedMed = med;
      _pharmacyTab = 0;
    });
    if (med != null) {
      await _fetchPharmaciesForMed(med);
    }
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
    return _interactions.where((i) =>
      i['med1Name'].toLowerCase() == _selectedMed['name'].toLowerCase() ||
      i['med2Name'].toLowerCase() == _selectedMed['name'].toLowerCase()
    ).toList();
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
            GradientHeader(title: 'Rechercher', subtitle: 'Catalogue médicaments', showBack: true)
          else
            GradientHeader(title: 'Rechercher', subtitle: 'Catalogue médicaments'),
          Expanded(
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: AppColors.border),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.foreground.withValues(alpha: 0.05),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            child: Row(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  child: Icon(Icons.search_rounded, color: AppColors.mutedForeground, size: 24),
                                ),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              style: const TextStyle(fontSize: 18),
                              decoration: const InputDecoration(
                                hintText: 'Rechercher un médicament...',
                                border: InputBorder.none,
                                hintStyle: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
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
                        const SizedBox(height: 10),
                        OutlinedButton.icon(
                          onPressed: _isFindingLocation ? null : _getLocation,
                          icon: _isFindingLocation
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Icon(
                                  _userLat != null ? Icons.location_on_rounded : Icons.my_location_rounded,
                                  color: AppColors.primary,
                                ),
                          label: Text(
                            _userLat != null
                                ? 'Position active${_locationCity != null ? ' · $_locationCity' : ''}'
                                : 'Pharmacies à proximité',
                          ),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _selectedMed == null
                        ? _buildResultsList()
                        : _buildDetailView(relevantInteractions),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
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
                '${_medications.length} médicaments trouvés',
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
              Hero(
                tag: 'med_photo_${med['id']}',
                child: MedicationImage(
                  photoUrl: med['photoUrl']?.toString(),
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                ),
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
                  // Photo du médicament (URL absolue, /uploads/ ou base64)
                  Hero(
                    tag: 'med_photo_${_selectedMed['id']}',
                    child: SizedBox(
                      width: double.infinity,
                      child: MedicationImage(
                        photoUrl: _selectedMed['photoUrl']?.toString(),
                        width: double.infinity,
                        height: 220,
                        borderRadius: 24,
                        fit: BoxFit.cover,
                      ),
                    ),
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
                            onPressed: () => _toggleBookmark(_selectedMed['id']),
                            icon: Icon(
                              _bookmarks.contains(_selectedMed['id'])
                                  ? Icons.bookmark
                                  : Icons.bookmark_border,
                              color: _bookmarks.contains(_selectedMed['id'])
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
                        final otherMed =
                            inter['med1Name'].toLowerCase() ==
                                    _selectedMed['name'].toLowerCase()
                                ? inter['med2Name']
                                : inter['med1Name'];
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

          // Availability
          _buildPharmacySection(),
        ],
      ),
    );
  }

  Widget _buildPharmacySection() {
    final list = _pharmacyTab == 0 ? _pharmacies : _onDutyPharmacies;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.store_rounded, color: Theme.of(context).colorScheme.primary, size: 24),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Pharmacies proches',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
                  ),
                ),
                if (_userLat == null)
                  TextButton.icon(
                    onPressed: _isFindingLocation ? null : _getLocation,
                    icon: const Icon(Icons.my_location, size: 18),
                    label: const Text('Localiser'),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _pharmacyTab = 0),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _pharmacyTab == 0 ? AppColors.surface : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _pharmacyTab == 0
                              ? [BoxShadow(color: AppColors.foreground.withValues(alpha: 0.06), blurRadius: 8)]
                              : null,
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
                  Expanded(
                    child: GestureDetector(
                      onTap: () => setState(() => _pharmacyTab = 1),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _pharmacyTab == 1 ? AppColors.surface : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _pharmacyTab == 1
                              ? [BoxShadow(color: AppColors.foreground.withValues(alpha: 0.06), blurRadius: 8)]
                              : null,
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
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_loadingPharmacies)
              const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()))
            else if (list.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: AppColors.muted,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppColors.border),
                ),
                child: Center(
                  child: Text(
                    _pharmacyTab == 0
                        ? 'Aucune pharmacie avec ce médicament en stock'
                        : 'Aucune pharmacie de garde trouvée${_userLat == null ? '\nActivez votre position' : ''}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.mutedForeground),
                  ),
                ),
              )
            else
              ...list.map((p) => _buildPharmacyCard(p, isGarde: _pharmacyTab == 1)),
          ],
        ),
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
                            pharmacy['name'] ?? '',
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
                            pharmacy['address'] ?? '',
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
                    '${pharmacy['distance']} km',
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
              if (pharmacy['phone'] != null)
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

