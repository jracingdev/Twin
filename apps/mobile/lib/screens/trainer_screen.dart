import 'package:flutter/material.dart';
import '../services/twin_api.dart';

const _statusLabels = {
  'queued': 'Na fila',
  'processing': 'Processando',
  'completed': 'Concluído',
  'failed': 'Falhou',
};

class TrainerScreen extends StatefulWidget {
  const TrainerScreen({super.key, required this.api, this.twinId});

  final TwinApi api;
  final String? twinId;

  @override
  State<TrainerScreen> createState() => _TrainerScreenState();
}

class _TrainerScreenState extends State<TrainerScreen> {
  String? _twinId;
  List<dynamic> _examples = [];
  Map<String, dynamic>? _job;
  bool _loading = true;
  bool _training = false;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _twinId = widget.twinId;
    if (_twinId == null) _loadTwin();
    _loadExamples();
  }

  Future<void> _loadTwin() async {
    try {
      final twins = await widget.api.listTwins();
      if (twins.isNotEmpty && mounted) {
        setState(() => _twinId = twins.first['id'] as String?);
        await _loadExamples();
      }
    } catch (_) {}
  }

  Future<void> _loadExamples() async {
    if (_twinId == null) return;
    setState(() => _loading = true);
    try {
      final accepted = await widget.api.listSuggestions(
        twinId: _twinId,
        status: 'accepted',
      );
      final sent = await widget.api.listSuggestions(
        twinId: _twinId,
        status: 'sent',
      );
      final seen = <String>{};
      final merged = <dynamic>[];
      for (final s in [...accepted, ...sent]) {
        final id = s['id'] as String?;
        if (id != null && seen.add(id)) merged.add(s);
      }
      if (mounted) setState(() => _examples = merged.take(20).toList());
    } catch (e) {
      if (mounted) setState(() => _message = 'Erro: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _train() async {
    if (_twinId == null) return;
    setState(() {
      _training = true;
      _message = '';
      _job = null;
    });
    try {
      var job = await widget.api.twinTrain(_twinId!);
      if (mounted) {
        setState(() {
          _job = job;
          _message = 'Treinamento iniciado.';
        });
      }

      var attempts = 0;
      while (
        job['status'] != 'completed' &&
        job['status'] != 'failed' &&
        attempts < 30
      ) {
        await Future.delayed(const Duration(seconds: 2));
        job = await widget.api.trainJobStatus(job['id'] as String);
        if (mounted) setState(() => _job = job);
        attempts++;
      }

      if (mounted) {
        setState(() {
          _message = job['status'] == 'completed'
              ? 'Treinamento concluído.'
              : (job['result'] as Map?)?['error']?.toString() ??
                  'Falha no treinamento.';
        });
      }
    } catch (e) {
      if (mounted) setState(() => _message = 'Erro: $e');
    } finally {
      if (mounted) setState(() => _training = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobStatus = _job?['status'] as String?;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Twin Trainer',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '${_examples.length} exemplos de treino disponíveis',
            style: TextStyle(color: Colors.grey.shade400, fontSize: 13),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _training || _examples.isEmpty ? null : _train,
            child: Text(_training ? 'Treinando…' : 'Treinar agora'),
          ),
          if (_job != null) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Text(
                  'Job ${_job!['id']?.toString().substring(0, 8)}…\n'
                  'Status: ${_statusLabels[jobStatus] ?? jobStatus}',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ),
          ],
          if (_message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _message,
              style: TextStyle(
                color: _message.contains('Erro') || _message.contains('Falha')
                    ? Colors.red.shade300
                    : const Color(0xFF22D3EE),
                fontSize: 13,
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Text('Exemplos recentes', style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _examples.isEmpty
                    ? Center(
                        child: Text(
                          'Aceite sugestões no playground para alimentar o treino.',
                          style: TextStyle(color: Colors.grey.shade500),
                          textAlign: TextAlign.center,
                        ),
                      )
                    : ListView.builder(
                        itemCount: _examples.length,
                        itemBuilder: (_, i) {
                          final s = _examples[i] as Map<String, dynamic>;
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    s['input_text']?.toString() ?? '',
                                    style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(s['suggested_text']?.toString() ?? ''),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
