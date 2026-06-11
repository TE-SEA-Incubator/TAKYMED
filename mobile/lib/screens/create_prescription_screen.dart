import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/push_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_card.dart';
import '../widgets/app_text_field.dart';
import '../widgets/gradient_header.dart';
import '../widgets/primary_button.dart';
import '../widgets/reminder_notification_config.dart';

class CreatePrescriptionScreen extends StatefulWidget {
  final String? initialMedName;
  /// Compte patient cible (commercial : client). Null = compte connecté.
  final int? targetUserId;
  final String? targetUserName;

  const CreatePrescriptionScreen({
    super.key,
    this.initialMedName,
    this.targetUserId,
    this.targetUserName,
  });

  @override
  State<CreatePrescriptionScreen> createState() => _CreatePrescriptionScreenState();
}

class _CreatePrescriptionScreenState extends State<CreatePrescriptionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  
  List<Map<String, dynamic>> _medications = [];
  
  bool _isLoading = false;
  int _step = 1;
  final _phoneController = TextEditingController();
  Set<String> _channels = {'push', 'whatsapp'};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadDefaults();
      if (widget.initialMedName != null) {
        _showAddMedicationModal(initialMedName: widget.initialMedName);
      }
    });
  }

  Future<void> _loadDefaults() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = Provider.of<ApiService>(context, listen: false);
    if (auth.user == null) return;

    if (auth.user?.phone != null && _phoneController.text.isEmpty) {
      _phoneController.text = auth.user!.phone!.replaceAll('+237', '').replaceAll(RegExp(r'^\+\d+'), '');
    }

    try {
      final prefs = await api.getNotificationPreferences(auth.user!.id);
      if (!mounted) return;
      final savedChannels = (prefs['channels'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .where((c) => ['sms', 'whatsapp', 'call', 'push'].contains(c))
          .toList();
      final recipients = (prefs['recipients'] as List<dynamic>?) ?? [];
      setState(() {
        if (savedChannels != null && savedChannels.isNotEmpty) {
          _channels = savedChannels.toSet();
        }
        if (recipients.isNotEmpty) {
          final raw = recipients.first.toString();
          _phoneController.text = raw.replaceAll('+237', '').replaceAll(RegExp(r'^\+\d+'), '');
        }
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _titleController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  bool _validateStep1() {
    if (_medications.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez ajouter au moins un médicament')),
      );
      return false;
    }
    return _formKey.currentState?.validate() ?? false;
  }

  void _goToStep2() {
    if (!_validateStep1()) return;
    setState(() => _step = 2);
  }

  void _showAddMedicationModal({String? initialMedName}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: AddMedicationForm(
          initialMedName: initialMedName,
          onAdd: (med) {
            setState(() {
              _medications.add(med);
            });
            Navigator.pop(context);
          },
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (!ReminderNotificationConfig.isValid(_channels, _phoneController)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Sélectionnez au moins un canal et un téléphone si SMS/WhatsApp/Appel sont activés'),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final apiService = Provider.of<ApiService>(context, listen: false);

      final actor = authProvider.user;
      if (actor == null || actor.id <= 0) {
        throw Exception('Session expirée. Reconnectez-vous.');
      }

      final targetUserId = widget.targetUserId ?? actor.id;
      final targetUserName = widget.targetUserName ?? actor.name;

      final today = DateTime.now().toIso8601String().split('T')[0];

      final recipients = <String>[];
      if (_phoneController.text.trim().isNotEmpty) {
        recipients.add('+237${_phoneController.text.trim()}');
      } else if (authProvider.user?.phone != null) {
        recipients.add(authProvider.user!.phone!);
      }

      final titleInput = _titleController.text.trim();
      final resolvedTitle = titleInput.isNotEmpty ? titleInput : 'Ordonnance';

      await apiService.createOrdonnance(
        {
          'userId': targetUserId,
          'title': resolvedTitle,
          'patientName': targetUserName,
          'weight': 0,
          'categorieAge': 'adulte',
          'startDate': today,
          'medications': _medications,
          'notifConfig': {
            'recipients': recipients,
            'channels': _channels.toList(),
          },
        },
        actorUserId: actor.id,
      );

      if (_channels.contains('push')) {
        await PushService.registerDevice(apiService, actor.id);
      }
      await PushService.syncReminders(apiService, targetUserId);

      if (mounted) {
        final methods = _channels.map(_channelLabel).join(', ');
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Ordonnance créée. Notifications via : $methods'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _channelLabel(String id) {
    switch (id) {
      case 'sms':
        return 'SMS';
      case 'call':
        return 'Appel';
      case 'push':
        return 'Push';
      default:
        return 'WhatsApp';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: _step == 1 ? 'Nouvelle ordonnance' : 'Méthodes de rappel',
            subtitle: _step == 1
                ? (widget.targetUserId != null && widget.targetUserName != null
                    ? 'Pour ${widget.targetUserName}'
                    : 'Étape 1 — Médicaments et horaires')
                : 'Étape 2 — Choix des canaux',
            showBack: true,
            bottom: _StepDots(current: _step),
          ),
          Expanded(
            child: _step == 1 ? _buildStep1() : _buildStep2(),
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedFadeSlide(
              index: 0,
              child: AppTextField(
                controller: _titleController,
                label: 'Nom de l\'ordonnance (optionnel)',
                hint: 'Ex. Traitement du matin',
                prefixIcon: Icons.title_rounded,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Médicaments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                TextButton.icon(
                  onPressed: _showAddMedicationModal,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Ajouter'),
                ),
              ],
            ),
            if (_medications.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 20),
                child: Center(
                  child: Text(
                    'Aucun médicament ajouté.',
                    style: TextStyle(color: AppColors.mutedForeground),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _medications.length,
                itemBuilder: (context, index) {
                  final med = _medications[index];
                  final durationDays = med['durationDays'] as int;
                  final times = med['times'] as List<String>;
                  final isPrn = med['frequencyType'] == 'prn';
                  
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: AppCard(
                      child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(med['name'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${med['doseValue']} ${med['unit']} · ${med['frequencyType']} · $durationDays jour(s)'),
                          if (!isPrn)
                            Text(
                              'Heures : ${times.join(', ')}',
                              style: const TextStyle(fontSize: 12),
                            ),
                        ],
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline, color: AppColors.destructive),
                        onPressed: () {
                          setState(() {
                            _medications.removeAt(index);
                          });
                        },
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 32),
            PrimaryButton(
              label: 'Suivant — Choisir les canaux',
              icon: Icons.arrow_forward_rounded,
              onPressed: _goToStep2,
            ).animate().fadeIn(delay: 400.ms),
          ],
        ),
      ),
    );
  }

  Widget _buildStep2() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _titleController.text.isNotEmpty ? _titleController.text : 'Ordonnance',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                const SizedBox(height: 8),
                Text(
                  '${_medications.length} médicament(s)',
                  style: const TextStyle(color: AppColors.mutedForeground),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          ReminderNotificationConfig(
            channels: _channels,
            onChannelsChanged: (next) => setState(() => _channels = next),
            phoneController: _phoneController,
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : () => setState(() => _step = 1),
                  icon: const Icon(Icons.arrow_back_rounded),
                  label: const Text('Retour'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: PrimaryButton(
                  label: 'Enregistrer',
                  icon: Icons.check_rounded,
                  isLoading: _isLoading,
                  onPressed: _submit,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class AddMedicationForm extends StatefulWidget {
  final Function(Map<String, dynamic>) onAdd;
  final String? initialMedName;

  const AddMedicationForm({super.key, required this.onAdd, this.initialMedName});

  @override
  State<AddMedicationForm> createState() => _AddMedicationFormState();
}

class _AddMedicationFormState extends State<AddMedicationForm> {
  final _formKey = GlobalKey<FormState>();
  final _medicationNameController = TextEditingController();
  final _doseController = TextEditingController(text: '1');
  final _durationController = TextEditingController(text: '1');
  String _frequencyType = '1x';
  String _unit = 'comprimé';
  List<String> _times = ['08:00'];
  List<TextEditingController> _timeControllers = [TextEditingController(text: '08:00')];

  @override
  void initState() {
    super.initState();
    if (widget.initialMedName != null) {
      _medicationNameController.text = widget.initialMedName!;
    }
  }

  @override
  void dispose() {
    _medicationNameController.dispose();
    _doseController.dispose();
    _durationController.dispose();
    for (var controller in _timeControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _updateTimes() {
    setState(() {
      if (_frequencyType == 'prn') {
        _times = [];
      } else {
        int count = 0;
        if (_frequencyType == '1x') count = 1;
        else if (_frequencyType == '2x') count = 2;
        else if (_frequencyType == '3x') count = 3;
        else if (_frequencyType == '4x') count = 4;

        if (count > 0) {
          final List<String> newTimes = [];
          const int startHour = 8;
          final int interval = 24 ~/ count;

          for (int i = 0; i < count; i++) {
            final int hour = (startHour + (i * interval)) % 24;
            newTimes.add('${hour.toString().padLeft(2, '0')}:00');
          }
          _times = newTimes;
        } else {
          _times = [];
        }
      }

      for (var controller in _timeControllers) {
        controller.dispose();
      }
      _timeControllers = _times.map((t) => TextEditingController(text: t)).toList();
    });
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    
    final medName = _medicationNameController.text;
    final durationDays = int.tryParse(_durationController.text) ?? 1;
    final doseValue = int.tryParse(_doseController.text) ?? 1;

    widget.onAdd({
      'name': medName,
      'frequencyType': _frequencyType,
      'times': _times,
      'durationDays': durationDays,
      'doseValue': doseValue,
      'unit': _unit,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Ajouter un médicament', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Autocomplete<Map<String, dynamic>>(
              optionsBuilder: (TextEditingValue textEditingValue) async {
                if (textEditingValue.text.length < 2) {
                  return const Iterable<Map<String, dynamic>>.empty();
                }
                final apiService = Provider.of<ApiService>(context, listen: false);
                try {
                  final results = await apiService.searchMedications(textEditingValue.text);
                  return (results['medications'] as List<dynamic>?)
                          ?.whereType<Map>()
                          .map((e) => Map<String, dynamic>.from(e))
                          .toList() ??
                      const <Map<String, dynamic>>[];
                } catch (e) {
                  return const Iterable<Map<String, dynamic>>.empty();
                }
              },
              displayStringForOption: (option) => option['name'] as String,
              fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                controller.text = _medicationNameController.text;
                controller.addListener(() {
                  _medicationNameController.text = controller.text;
                });
                return AppTextField(
                  controller: controller,
                  focusNode: focusNode,
                  label: 'Nom du médicament',
                  prefixIcon: Icons.medication_rounded,
                  validator: (v) => v == null || v.isEmpty ? 'Médicament requis' : null,
                );
              },
              onSelected: (selection) {
                _medicationNameController.text = selection['name'] as String;
              },
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: AppTextField(
                    controller: _doseController,
                    label: 'Dose',
                    keyboardType: TextInputType.number,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _unit,
                    decoration: const InputDecoration(labelText: 'Unité'),
                    items: const [
                      DropdownMenuItem(value: 'comprimé', child: Text('Comprimé')),
                      DropdownMenuItem(value: 'mg', child: Text('mg')),
                      DropdownMenuItem(value: 'ml', child: Text('ml')),
                      DropdownMenuItem(value: 'goutte', child: Text('Goutte')),
                    ],
                    onChanged: (value) => setState(() => _unit = value!),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _frequencyType,
              decoration: const InputDecoration(labelText: 'Fréquence'),
              items: const [
                DropdownMenuItem(value: '1x', child: Text('1× / jour')),
                DropdownMenuItem(value: '2x', child: Text('2× / jour')),
                DropdownMenuItem(value: '3x', child: Text('3× / jour')),
                DropdownMenuItem(value: '4x', child: Text('4× / jour')),
                DropdownMenuItem(value: 'prn', child: Text('Au besoin')),
              ],
              onChanged: (value) {
                setState(() {
                  _frequencyType = value!;
                  _updateTimes();
                });
              },
            ),
            if (_frequencyType != 'prn') ...[
              const SizedBox(height: 16),
              ..._times.asMap().entries.map((entry) {
                final index = entry.key;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppTextField(
                    readOnly: true,
                    controller: _timeControllers[index],
                    label: 'Heure ${index + 1}',
                    prefixIcon: Icons.access_time_rounded,
                    onTap: () async {
                      final timeParts = _times[index].split(':');
                      final pickedTime = await showTimePicker(
                        context: context,
                        initialTime: TimeOfDay(
                          hour: int.parse(timeParts[0]),
                          minute: int.parse(timeParts[1]),
                        ),
                      );
                      if (pickedTime != null) {
                        setState(() {
                          final newTime =
                              '${pickedTime.hour.toString().padLeft(2, '0')}:${pickedTime.minute.toString().padLeft(2, '0')}';
                          _times[index] = newTime;
                          _timeControllers[index].text = newTime;
                        });
                      }
                    },
                  ),
                );
              }),
            ],
            const SizedBox(height: 16),
            AppTextField(
              controller: _durationController,
              label: 'Durée (jours)',
              prefixIcon: Icons.date_range_rounded,
              keyboardType: TextInputType.number,
              validator: (value) {
                if (value == null || value.isEmpty) return 'Durée requise';
                if (int.tryParse(value) == null || int.parse(value) <= 0) return 'Nombre invalide';
                return null;
              },
            ),
            const SizedBox(height: 24),
            PrimaryButton(
              label: 'Ajouter à l\'ordonnance',
              icon: Icons.check_rounded,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}

class _StepDots extends StatelessWidget {
  final int current;

  const _StepDots({required this.current});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _dot(1),
        const SizedBox(width: 8),
        _dot(2),
      ],
    );
  }

  Widget _dot(int step) {
    final active = current >= step;
    return Expanded(
      child: Container(
        height: 4,
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.white.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
