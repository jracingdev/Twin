import 'package:flutter/material.dart';
import '../config.dart';
import '../services/twin_api.dart';

class SuggestionsScreen extends StatefulWidget {
  const SuggestionsScreen({super.key, this.api, this.twinId});

  final TwinApi? api;
  final String? twinId;

  @override
  State<SuggestionsScreen> createState() => _SuggestionsScreenState();
}

class _SuggestionsScreenState extends State<SuggestionsScreen> {
  final _controller = TextEditingController();
  String? _suggestion;
  String? _suggestionId;
  bool _loading = false;
  late TwinApi _api;
  String? _twinId;

  @override
  void initState() {
    super.initState();
    _api = widget.api ?? TwinApi();
    _loadTwin();
  }

  Future<void> _loadTwin() async {
    if (widget.twinId != null) {
      setState(() => _twinId = widget.twinId);
      return;
    }
    try {
      final twins = await _api.listTwins();
      if (twins.isNotEmpty) {
        setState(() => _twinId = twins.first['id'] as String?);
      }
    } catch (_) {}
  }

  Future<void> _generate() async {
    if (_twinId == null) {
      setState(() => _suggestion = 'Configure TWIN_TOKEN e TWIN_TENANT_ID.');
      return;
    }
    setState(() {
      _loading = true;
      _suggestion = null;
      _suggestionId = null;
    });
    try {
      final res = await _api.suggest(twinId: _twinId!, text: _controller.text);
      setState(() {
        _suggestion = res['suggested_text'] as String? ?? res['suggestion'] as String?;
        _suggestionId = res['id'] as String?;
      });
    } catch (e) {
      setState(() => _suggestion = 'Erro: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _feedback(String status) async {
    if (_suggestionId == null) return;
    await _api.feedback(_suggestionId!, status);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(status == 'accepted' ? 'Aceita' : 'Rejeitada')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          if (TwinConfig.token.isEmpty)
            const Text('Use --dart-define=TWIN_TOKEN=... TWIN_TENANT_ID=...',
                style: TextStyle(color: Colors.amber, fontSize: 12)),
          TextField(
            controller: _controller,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Mensagem recebida',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: _loading ? null : _generate,
                  child: Text(_loading ? '...' : 'Sugerir resposta'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: _suggestionId == null ? null : () => _feedback('accepted'),
                icon: const Icon(Icons.check, color: Colors.greenAccent),
                tooltip: 'Aprovar',
              ),
              IconButton(
                onPressed: _suggestionId == null ? null : () => _feedback('rejected'),
                icon: const Icon(Icons.close, color: Colors.redAccent),
                tooltip: 'Rejeitar',
              ),
            ],
          ),
          if (_suggestion != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(_suggestion!),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
