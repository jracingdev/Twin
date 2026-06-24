import 'package:flutter/material.dart';
import '../services/twin_api.dart';

const _breakdownLabels = {
  'formalidade': 'Formalidade',
  'tom_emocional': 'Tom emocional',
  'vocabulario': 'Vocabulário',
  'persuasao': 'Persuasão',
  'geral': 'Geral',
};

class ReplayScreen extends StatefulWidget {
  const ReplayScreen({super.key, required this.api, this.twinId});

  final TwinApi api;
  final String? twinId;

  @override
  State<ReplayScreen> createState() => _ReplayScreenState();
}

class _ReplayScreenState extends State<ReplayScreen> {
  final _controller = TextEditingController();
  String? _twinId;
  Map<String, dynamic>? _result;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _twinId = widget.twinId;
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

  Future<void> _simulate() async {
    if (_twinId == null || _controller.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _result = null;
    });
    try {
      final res = await widget.api.twinReplay(
        twinId: _twinId!,
        text: _controller.text,
      );
      if (mounted) setState(() => _result = res);
    } catch (e) {
      if (mounted) {
        setState(() => _result = {'error': e.toString()});
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Map<String, dynamic>? _breakdown() {
    if (_result == null) return null;
    final b = _result!['score_breakdown'] ?? _result!['similarity_baseline'];
    if (b is Map<String, dynamic>) return b;
    final meta = _result!['metadata'];
    if (meta is Map) {
      final fromMeta = meta['score_breakdown'] ?? meta['similarity_baseline'];
      if (fromMeta is Map<String, dynamic>) return fromMeta;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final output = _result?['suggested_text'] ?? _result?['suggestion'];
    final error = _result?['error'];
    final score = _result?['score'];
    final breakdown = _breakdown();

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Twin Replay',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Simule respostas sem gravar no inbox.',
            style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Mensagem recebida',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _loading || _twinId == null ? null : _simulate,
            child: Text(_loading ? 'Simulando…' : 'Simular'),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error.toString(), style: TextStyle(color: Colors.red.shade300)),
          ],
          if (output != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(output.toString()),
                    if (score != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Similaridade: ${_formatScore(score)}%',
                        style: const TextStyle(color: Color(0xFFE879F9)),
                      ),
                    ],
                    if (breakdown != null && breakdown.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text(
                        'Decomposição',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      ...breakdown.entries.where((e) => e.value is num).map((e) {
                        final pct = _formatScore(e.value);
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _breakdownLabels[e.key] ?? e.key,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade400,
                                  ),
                                ),
                              ),
                              Text('$pct%', style: const TextStyle(color: Color(0xFF22D3EE))),
                            ],
                          ),
                        );
                      }),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  int _formatScore(dynamic value) {
    final n = (value as num).toDouble();
    return n <= 1 ? (n * 100).round() : n.round();
  }
}
