import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/twin_api.dart';

class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key, required this.api, this.twinId});

  final TwinApi api;
  final String? twinId;

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  List<dynamic> _items = [];
  final Map<String, TextEditingController> _editors = {};
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _editors.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _editorFor(String id, String initial) {
    return _editors.putIfAbsent(
      id,
      () => TextEditingController(text: initial),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _items = await widget.api.listSuggestions(
        twinId: widget.twinId,
        status: 'pending',
      );
    } catch (e) {
      _items = [];
      _error = e.toString();
    }
    if (mounted) setState(() => _loading = false);
  }

  String _replyText(Map<String, dynamic> item) {
    final id = item['id'] as String;
    return _editors[id]?.text ?? item['suggested_text']?.toString() ?? '';
  }

  Future<void> _send(Map<String, dynamic> item) async {
    final text = _replyText(item);
    final fromChannel = item['metadata']?['source'] == 'channel_webhook';
    try {
      if (fromChannel) {
        await widget.api.sendSuggestion(item['id'] as String, text: text);
      } else {
        final original = item['suggested_text']?.toString() ?? '';
        await widget.api.feedback(
          item['id'] as String,
          'accepted',
          editedText: text != original ? text : null,
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(fromChannel ? 'Resposta enviada ao canal' : 'Sugestão aceita'),
          ),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  Future<void> _reject(Map<String, dynamic> item) async {
    try {
      await widget.api.feedback(item['id'] as String, 'rejected');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sugestão rejeitada')),
        );
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  String? _formatScore(dynamic score) {
    if (score == null) return null;
    final n = (score is num) ? score.toDouble() : double.tryParse(score.toString());
    if (n == null) return null;
    final pct = n <= 1 ? (n * 100).round() : n.round();
    return '$pct%';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, style: TextStyle(color: Colors.red.shade300)),
              const SizedBox(height: 12),
              TextButton(onPressed: _load, child: const Text('Tentar novamente')),
            ],
          ),
        ),
      );
    }

    if (_items.isEmpty) {
      return Center(
        child: Text('Nenhuma sugestão pendente', style: TextStyle(color: Colors.grey.shade500)),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _items.length,
        itemBuilder: (context, i) {
          final item = _items[i] as Map<String, dynamic>;
          final id = item['id'] as String;
          final initial = item['suggested_text']?.toString() ?? '';
          final fromChannel = item['metadata']?['source'] == 'channel_webhook';
          final channel = item['metadata']?['channel']?.toString();
          final scoreLabel = _formatScore(item['score']);
          final contact = item['contact']?['display_name']?.toString();

          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          contact ?? 'Cliente',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                      if (fromChannel && channel != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.cyan.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(channel, style: const TextStyle(fontSize: 11, color: Colors.cyan)),
                        ),
                      if (scoreLabel != null) ...[
                        const SizedBox(width: 8),
                        Text(scoreLabel, style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    item['input_text']?.toString() ?? '',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  ),
                  const Divider(),
                  TextField(
                    controller: _editorFor(id, initial),
                    maxLines: 4,
                    decoration: const InputDecoration(
                      border: OutlineInputBorder(),
                      isDense: true,
                      labelText: 'Resposta sugerida',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 4,
                    children: [
                      TextButton(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: _replyText(item)));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Copiado')),
                          );
                        },
                        child: const Text('Copiar'),
                      ),
                      if (fromChannel)
                        FilledButton(
                          onPressed: () => _send(item),
                          child: const Text('Aprovar e enviar'),
                        )
                      else
                        TextButton(
                          onPressed: () => _send(item),
                          child: const Text('Aceitar'),
                        ),
                      TextButton(
                        onPressed: () => _reject(item),
                        child: Text('Rejeitar', style: TextStyle(color: Colors.red.shade300)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
