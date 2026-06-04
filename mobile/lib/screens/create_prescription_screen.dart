
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/push_service.dart';
import '../theme/app_colors.dart';
import '../widgets/animated_fade_slide.dart';
import '../widgets/app_text_field.dart';
import '../widgets/gradient_header.dart';
import '../widgets/primary_button.dart';

class CreatePrescriptionScreen extends StatefulWidget {
  final String? initialMedName;

  const CreatePrescriptionScreen({super.key, this.initialMedName});

  @override
  State<CreatePrescriptionScreen> createState() => _CreatePrescriptionScreenState();
}

class _CreatePrescriptionScreenState extends State<CreatePrescriptionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _medicationNameController = TextEditingController();
  final _doseController = TextEditingController(text: '1');
  final _durationController = TextEditingController(text: '1');
  String _frequencyType = '1x';
  String _unit = 'comprimé';
  List<String> _times = ['08:00'];
  List<TextEditingController> _timeControllers = [TextEditingController(text: '08:00')];
  bool _isLoading = false;
  final _phoneController = TextEditingController();
  final Set<String> _channels = {'push', 'whatsapp'};

  @override
  void initState() {
    super.initState();
    if (widget.initialMedName != null) {
      _medicationNameController.text = widget.initialMedName!;
      _titleController.text = widget.initialMedName!;
    }
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.user?.phone != null) {
      _phoneController.text = auth.user!.phone!.replaceAll('+237', '');
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _medicationNameController.dispose();
    _doseController.dispose();
    _durationController.dispose();
    _phoneController.dispose();
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final apiService = Provider.of<ApiService>(context, listen: false);

      final today = DateTime.now().toIso8601String().split('T')[0];
      final medName = _medicationNameController.text;
      final durationDays = int.tryParse(_durationController.text) ?? 1;
      final doseValue = int.tryParse(_doseController.text) ?? 1;

      await apiService.createOrdonnance({
        'userId': authProvider.user!.id,
        'title': _titleController.text,
        'weight': 0,
        'categorieAge': 'adulte',
        'startDate': today,
        'medications': [
          {
            'name': medName,
            'frequencyType': _frequencyType,
            'times': _times,
            'durationDays': durationDays,
            'doseValue': doseValue,
            'unit': _unit,
          }
        ],
        'notifConfig': {
          'recipients': [
            if (_phoneController.text.trim().isNotEmpty)
              '+237${_phoneController.text.trim()}'
            else if (authProvider.user?.phone != null)
              authProvider.user!.phone,
          ],
          'channels': _channels.toList(),
        },
      });

      if (_channels.contains('push')) {
        await PushService.registerDevice(apiService, authProvider.user!.id);
      }
      await PushService.syncReminders(apiService, authProvider.user!.id);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Rappel créé avec succès !'), backgroundColor: AppColors.success),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          GradientHeader(
            title: 'Nouveau rappel',
            subtitle: 'Planifiez vos prises de médicaments',
            showBack: true,
          ),
          Expanded(
            child: SingleChildScrollView(
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
                        label: 'Titre de la prescription',
                        prefixIcon: Icons.title_rounded,
                        validator: (v) => v == null || v.isEmpty ? 'Titre requis' : null,
                      ),
                    ),
                    const SizedBox(height: 16),
                    AnimatedFadeSlide(
                      index: 1,
                      child: Autocomplete<Map<String, dynamic>>(
                        optionsBuilder: (TextEditingValue textEditingValue) async {
                          if (textEditingValue.text.length < 2) {
                            return const Iterable<Map<String, dynamic>>.empty();
                          }
                          final apiService = Provider.of<ApiService>(context, listen: false);
                          try {
                            final results = await apiService.searchMedications(textEditingValue.text);
                            return (results['medications'] as List<dynamic>).cast<Map<String, dynamic>>();
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
                          _titleController.text = selection['name'] as String;
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    AnimatedFadeSlide(
                      index: 2,
                      child: Row(
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
                              value: _unit,
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
                    ),
                    const SizedBox(height: 16),
                    AnimatedFadeSlide(
                      index: 3,
                      child: DropdownButtonFormField<String>(
                        value: _frequencyType,
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
                    ),
                    if (_frequencyType != 'prn') ...[
                      const SizedBox(height: 16),
                      ..._times.asMap().entries.map((entry) {
                        final index = entry.key;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: AnimatedFadeSlide(
                            index: 4 + index,
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
                          ),
                        );
                      }),
                    ],
                    const SizedBox(height: 16),
                    AnimatedFadeSlide(
                      index: 8,
                      child: AppTextField(
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
                    ),
                    const SizedBox(height: 24),
                    AnimatedFadeSlide(
                      index: 8,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Canaux de notification',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _channelChip('sms', 'SMS', Icons.sms_rounded),
                              _channelChip('whatsapp', 'WhatsApp', Icons.chat_rounded),
                              _channelChip('call', 'Appel', Icons.phone_rounded),
                              _channelChip('push', 'Push', Icons.notifications_active_rounded),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (_channels.any((c) => c != 'push'))
                            AppTextField(
                              controller: _phoneController,
                              label: 'Téléphone destinataire',
                              prefixIcon: Icons.phone_rounded,
                              prefixText: '+237 ',
                              keyboardType: TextInputType.phone,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    PrimaryButton(
                      label: 'Créer le rappel',
                      icon: Icons.notifications_active_rounded,
                      isLoading: _isLoading,
                      onPressed: _submit,
                    ).animate().fadeIn(delay: 500.ms),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _channelChip(String id, String label, IconData icon) {
    final selected = _channels.contains(id);
    return FilterChip(
      selected: selected,
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: selected ? Colors.white : AppColors.primary),
          const SizedBox(width: 6),
          Text(label),
        ],
      ),
      selectedColor: AppColors.primary,
      checkmarkColor: Colors.white,
      labelStyle: TextStyle(color: selected ? Colors.white : AppColors.foreground),
      onSelected: (value) {
        setState(() {
          if (value) {
            _channels.add(id);
          } else if (_channels.length > 1) {
            _channels.remove(id);
          }
        });
      },
    );
  }
}
