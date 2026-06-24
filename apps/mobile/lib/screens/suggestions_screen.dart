import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/twin_api.dart';

class SuggestionsScreen extends StatefulWidget {
  const SuggestionsScreen({super.key, required this.api, this.twinId});

  final TwinApi api;
  final String? twinId;

  @override
  State<SuggestionsScreen> createState() => _SuggestionsScreenState();
}

class _SuggestionsScreenState extends State<SuggestionsScreen> {
  final _controller = TextEditingController();
  String? _suggestion;
  String? _suggestionId;
  bool _loading = false;
  bool _sellerMode = false;
  bool _planSeller = false;
  String? _twinId;

  @override
  void initState() {
    super.initState();
    _twinId = widget.twinId;
    widget.api.getPlan().then((p) {
      if (mounted) setState(() => _planSeller = p['seller_mode'] == true);
    });
    if (_twinId == null) _loadTwin();
  }

  Future<void> _loadTwin() async {
    try {
      final twins = await widget.api.listTwins();
      if (twins.isNotEmpty && mounted) {
        setState(() => _twinId = twins.first['id'] as String?);
      }
    } catch (_) {}
  }

  Future<void> _generate() async {
    if (_twinId == null) return;
    setState(() {
      _loading = true;
      _suggestion = null;
      _suggestionId = null;
    });
    try {
      final res = await widget.api.suggest(
        twinId: _twinId!,
        text: _controller.text,
        sellerMode: _sellerMode,
      );
      setState(() {
        _suggestion = res['suggested_text'] as String? ?? res['suggestion'] as String?;
        _suggestionId = res['id'] as String?;
      });
    } catch (e) {
      setState(() => _suggestion = 'Erro: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _feedback(String status) async {
    if (_suggestionId == null) return;
    await widget.api.feedback(_suggestionId!, status);
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
          if (_planSeller)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Modo vendedor', style: TextStyle(fontSize: 14)),
              value: _sellerMode,
              onChanged: (v) => setState(() => _sellerMode = v),
            ),
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
                  onPressed: _loading || _twinId == null ? null : _generate,
                  child: Text(_loading ? 'Gerando…' : 'Sugerir resposta'),
                ),
              ),
            ],
          ),
          if (_suggestion != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_suggestion!),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        TextButton(
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: _suggestion!));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Copiado')),
                            );
                          },
                          child: const Text('Copiar'),
                        ),
                        TextButton(
                          onPressed: _suggestionId == null ? null : () => _feedback('accepted'),
                          child: const Text('Aceitar'),
                        ),
                        TextButton(
                          onPressed: _suggestionId == null ? null : () => _feedback('rejected'),
                          child: const Text('Rejeitar'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
