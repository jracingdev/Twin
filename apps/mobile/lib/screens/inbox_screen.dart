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
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _items = await widget.api.listSuggestions(
        twinId: widget.twinId,
        status: 'pending',
      );
    } catch (_) {
      _items = [];
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _send(Map<String, dynamic> item, String text) async {
    final fromChannel = item['metadata']?['source'] == 'channel_webhook';
    if (fromChannel) {
      await widget.api.sendSuggestion(item['id'] as String, text: text);
    } else {
      await widget.api.feedback(item['id'] as String, 'accepted');
    }
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resposta registrada')),
      );
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

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
          final text = item['suggested_text']?.toString() ?? '';
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item['input_text']?.toString() ?? '',
                    style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                  ),
                  const Divider(),
                  Text(text),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: text));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Copiado')),
                          );
                        },
                        child: const Text('Copiar'),
                      ),
                      TextButton(
                        onPressed: () => _send(item, text),
                        child: const Text('Aprovar'),
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
