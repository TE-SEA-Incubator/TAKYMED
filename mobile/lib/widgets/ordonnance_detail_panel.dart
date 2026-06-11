import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';
import '../services/reminder_schedule_service.dart';
import '../theme/app_colors.dart';

typedef OrdonnanceRefresh = Future<void> Function();

class OrdonnanceDetailPanel extends StatefulWidget {
  final dynamic ord;
  final dynamic details;
  final int userId;
  final ApiService api;
  final OrdonnanceRefresh onRefresh;

  const OrdonnanceDetailPanel({
    super.key,
    required this.ord,
    required this.details,
    required this.userId,
    required this.api,
    required this.onRefresh,
  });

  @override
  State<OrdonnanceDetailPanel> createState() => _OrdonnanceDetailPanelState();
}

class _OrdonnanceDetailPanelState extends State<OrdonnanceDetailPanel> {
  bool get _active => widget.ord['est_active'] == 1 || widget.ord['est_active'] == true;

  Future<void> _reloadDetails() async {
    await widget.onRefresh();
    await ReminderScheduleService.syncFromServer(widget.api, widget.userId);
  }

  Future<void> _toggleDose(int doseId, bool currentlyTaken) async {
    try {
      await widget.api.toggleDoseStatus(doseId, !currentlyTaken);
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _delayDose(int doseId) async {
    try {
      await widget.api.delayDose(doseId);
      await _reloadDetails();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Prise reportée de 1 heure')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _editDoseTime(int doseId, DateTime current) async {
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(current));
    if (time == null) return;
    final updated = DateTime(current.year, current.month, current.day, time.hour, time.minute);
    try {
      await widget.api.updateDoseTime(doseId, updated.toIso8601String());
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _markAllTaken() async {
    try {
      await widget.api.markAllPrisesTaken(widget.ord['id'] as int);
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _editOrdonnance() async {
    final titreCtrl = TextEditingController(text: widget.ord['titre']?.toString() ?? '');
    final patientCtrl = TextEditingController(text: widget.ord['nom_patient']?.toString() ?? '');
    final poidsCtrl = TextEditingController(text: widget.ord['poids_patient']?.toString() ?? '');
    final catCtrl = TextEditingController(text: widget.ord['categorie_age']?.toString() ?? 'adulte');

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Modifier l\'ordonnance', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 16),
            TextField(controller: titreCtrl, decoration: const InputDecoration(labelText: 'Titre')),
            const SizedBox(height: 12),
            TextField(controller: patientCtrl, decoration: const InputDecoration(labelText: 'Patient')),
            const SizedBox(height: 12),
            TextField(controller: poidsCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Poids (kg)')),
            const SizedBox(height: 12),
            TextField(controller: catCtrl, decoration: const InputDecoration(labelText: 'Catégorie d\'âge')),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Enregistrer'),
            ),
          ],
        ),
      ),
    );

    if (saved != true) return;

    try {
      await widget.api.updateOrdonnance(
        widget.ord['id'] as int,
        titreCtrl.text.trim(),
        patientCtrl.text.trim(),
        double.tryParse(poidsCtrl.text.trim()),
        catCtrl.text.trim(),
        userId: widget.userId,
      );
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _addMedicament() async {
    final nameCtrl = TextEditingController();
    final doseCtrl = TextEditingController(text: '1');
    final daysCtrl = TextEditingController(text: '7');
    String freq = '1x';

    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModal) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Ajouter un médicament', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 16),
              TextField(controller: nameCtrl, decoration: const InputDecoration(labelText: 'Nom du médicament')),
              const SizedBox(height: 12),
              TextField(controller: doseCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Dose')),
              const SizedBox(height: 12),
              TextField(controller: daysCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Durée (jours)')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: freq,
                decoration: const InputDecoration(labelText: 'Fréquence'),
                items: const [
                  DropdownMenuItem(value: '1x', child: Text('1x / jour')),
                  DropdownMenuItem(value: '2x', child: Text('2x / jour')),
                  DropdownMenuItem(value: '3x', child: Text('3x / jour')),
                  DropdownMenuItem(value: 'interval', child: Text('Intervalle')),
                  DropdownMenuItem(value: 'prn', child: Text('Si besoin')),
                ],
                onChanged: (v) => setModal(() => freq = v ?? '1x'),
              ),
              const SizedBox(height: 20),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Ajouter')),
            ],
          ),
        ),
      ),
    );

    if (ok != true || nameCtrl.text.trim().isEmpty) return;

    try {
      await widget.api.addMedicament(widget.ord['id'] as int, {
        'medicamentName': nameCtrl.text.trim(),
        'dose': int.tryParse(doseCtrl.text) ?? 1,
        'type_frequence': freq,
        'intervalle_heures': freq == 'interval' ? 8 : null,
        'duree_jours': int.tryParse(daysCtrl.text) ?? 7,
        'times': ['08:00'],
      });
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _editMedicament(dynamic med) async {
    final doseCtrl = TextEditingController(text: '${med['dose']}');
    final daysCtrl = TextEditingController(text: '${med['duree_jours']}');
    String freq = med['type_frequence']?.toString() ?? '1x';

    final ok = await showModalBottomSheet<bool>(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModal) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(med['medicament']?.toString() ?? 'Médicament', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
              const SizedBox(height: 16),
              TextField(controller: doseCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Dose')),
              const SizedBox(height: 12),
              TextField(controller: daysCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Durée (jours)')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: freq,
                decoration: const InputDecoration(labelText: 'Fréquence'),
                items: const [
                  DropdownMenuItem(value: '1x', child: Text('1x / jour')),
                  DropdownMenuItem(value: '2x', child: Text('2x / jour')),
                  DropdownMenuItem(value: '3x', child: Text('3x / jour')),
                  DropdownMenuItem(value: 'interval', child: Text('Intervalle')),
                  DropdownMenuItem(value: 'prn', child: Text('Si besoin')),
                ],
                onChanged: (v) => setModal(() => freq = v ?? '1x'),
              ),
              const SizedBox(height: 20),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Enregistrer')),
            ],
          ),
        ),
      ),
    );

    if (ok != true) return;

    try {
      await widget.api.updateMedicament(widget.ord['id'] as int, med['id'] as int, {
        'dose': int.tryParse(doseCtrl.text) ?? 1,
        'type_frequence': freq,
        'intervalle_heures': freq == 'interval' ? 8 : null,
        'duree_jours': int.tryParse(daysCtrl.text) ?? 7,
      });
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _deleteMedicament(int elementId) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer le médicament ?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Supprimer')),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await widget.api.deleteMedicament(widget.ord['id'] as int, elementId);
      await _reloadDetails();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Future<void> _openWhatsApp(String phone) async {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final uri = Uri.parse('https://wa.me/$digits');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _openPhone(String phone) async {
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.details == null) {
      return const Center(child: CircularProgressIndicator());
    }
    final medicaments = widget.details['medicaments'] as List<dynamic>? ?? [];
    final rappels = widget.details['rappels'] as List<dynamic>? ?? [];
    final phone = widget.ord['phone']?.toString();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_active)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _editOrdonnance,
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Modifier l\'ordonnance'),
                  ),
                ),
              ],
            ),
          ),
        if (phone != null && phone.isNotEmpty) ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openWhatsApp(phone),
                  icon: const Icon(Icons.chat_rounded, size: 16, color: Colors.green),
                  label: const Text('WhatsApp'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _openPhone(phone),
                  icon: const Icon(Icons.phone_rounded, size: 16),
                  label: const Text('Appeler'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Médicaments', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            if (_active)
              TextButton.icon(
                onPressed: _addMedicament,
                icon: const Icon(Icons.add_rounded, size: 18),
                label: const Text('Ajouter'),
              ),
          ],
        ),
        ...medicaments.map((med) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.muted,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(med['medicament']?.toString() ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          'Dose: ${med['dose']} • ${med['type_frequence']} • ${med['duree_jours']} j',
                          style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground),
                        ),
                      ],
                    ),
                  ),
                  if (_active) ...[
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      onPressed: () => _editMedicament(med),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppColors.destructive),
                      onPressed: () => _deleteMedicament(med['id'] as int),
                    ),
                  ],
                ],
              ),
            )),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text('Rappels', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            if (_active && rappels.any((r) => r['statut_prise'] != 1))
              TextButton.icon(
                onPressed: _markAllTaken,
                icon: const Icon(Icons.done_all_rounded, size: 18),
                label: const Text('Tout marquer'),
              ),
          ],
        ),
        if (rappels.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('Aucun rappel planifié', style: TextStyle(color: AppColors.mutedForeground)),
          )
        else
          ...rappels.take(20).map((rappel) {
            final taken = rappel['statut_prise'] == 1;
            final dt = DateTime.parse(rappel['heure_prevue'].toString());
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: taken ? AppColors.successLight : AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: taken ? AppColors.success.withValues(alpha: 0.3) : AppColors.border),
              ),
              child: Row(
                children: [
                  Checkbox(
                    value: taken,
                    onChanged: !_active ? null : (_) => _toggleDose(rappel['id'] as int, taken),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rappel['medicament']?.toString() ?? '',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            decoration: taken ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        Text('Dose: ${rappel['dose']}', style: const TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      InkWell(
                        onTap: _active && !taken ? () => _editDoseTime(rappel['id'] as int, dt) : null,
                        child: Text(DateFormat.Hm('fr_FR').format(dt), style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                      Text(DateFormat.yMMMd('fr_FR').format(dt), style: const TextStyle(fontSize: 11, color: AppColors.mutedForeground)),
                      if (_active && !taken)
                        TextButton(
                          onPressed: () => _delayDose(rappel['id'] as int),
                          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                          child: const Text('+1h', style: TextStyle(fontSize: 11)),
                        ),
                    ],
                  ),
                ],
              ),
            );
          }),
      ],
    );
  }
}
