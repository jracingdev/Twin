import 'dart:async';
import 'notification_service.dart';
import 'twin_api.dart';

class InboxPoller {
  InboxPoller({required this.api, this.twinId, this.interval = const Duration(seconds: 45)});

  final TwinApi api;
  final String? twinId;
  final Duration interval;

  Timer? _timer;
  final Set<String> _knownIds = {};
  bool _primed = false;

  void start() {
    _timer?.cancel();
    _poll();
    _timer = Timer.periodic(interval, (_) => _poll());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  void dispose() => stop();

  Future<void> _poll() async {
    try {
      final items = await api.listSuggestions(twinId: twinId, status: 'pending');
      final ids = items
          .map((e) => (e as Map<String, dynamic>)['id']?.toString())
          .whereType<String>()
          .toSet();

      if (!_primed) {
        _knownIds
          ..clear()
          ..addAll(ids);
        _primed = true;
        return;
      }

      final newIds = ids.difference(_knownIds);
      if (newIds.isEmpty) {
        _knownIds.retainWhere(ids.contains);
        _knownIds.addAll(ids);
        return;
      }

      String? contactName;
      for (final item in items) {
        final map = item as Map<String, dynamic>;
        if (newIds.contains(map['id']?.toString())) {
          contactName = map['contact']?['display_name']?.toString();
          break;
        }
      }

      await NotificationService.instance.showNewSuggestions(
        count: newIds.length,
        contactName: contactName,
      );

      _knownIds
        ..clear()
        ..addAll(ids);
    } catch (_) {
      // Polling silencioso — falhas de rede não interrompem o app
    }
  }
}
