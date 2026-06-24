import 'package:flutter/material.dart';
import '../services/twin_api.dart';

const _modeLabels = {
  'assistant': 'Assistente',
  'copilot': 'Copiloto',
  'approval': 'Copiloto',
  'auto': 'Autônomo',
};

String _modeLabel(String? mode) {
  if (mode == null) return 'Copiloto';
  return _modeLabels[mode] ?? mode;
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.api});

  final TwinApi api;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  List<dynamic> _credentials = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await widget.api.listChannelCredentials();
      if (mounted) {
        setState(() {
          _credentials = list;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Canais',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Modos de resposta (somente leitura). Edite na web.',
            style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          if (_credentials.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Nenhum canal conectado.',
                  style: TextStyle(color: Colors.grey.shade400),
                ),
              ),
            )
          else
            ..._credentials.map((raw) {
              final c = raw as Map<String, dynamic>;
              final mode = c['reply_mode']?.toString() ?? 'copilot';
              final threshold = (c['confidence_threshold'] as num?)?.toDouble() ?? 0.75;
              final isActive = c['is_active'] == true;

              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  title: Text(
                    (c['channel']?.toString() ?? 'canal').toUpperCase(),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 4),
                      Text('Modo: ${_modeLabel(mode)}'),
                      if (mode == 'auto')
                        Text('Limiar: ${(threshold * 100).round()}%'),
                      Text(isActive ? 'Ativo' : 'Inativo',
                          style: TextStyle(
                            color: isActive ? Colors.greenAccent : Colors.grey,
                            fontSize: 12,
                          )),
                    ],
                  ),
                  isThreeLine: true,
                ),
              );
            }),
        ],
      ),
    );
  }
}
