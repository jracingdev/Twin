import 'package:flutter/material.dart';
import '../services/twin_api.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.api, required this.twinId});

  final TwinApi api;
  final String twinId;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with SingleTickerProviderStateMixin {
  Map<String, dynamic>? _stats;
  Map<String, dynamic>? _evolution;
  Map<String, dynamic>? _channelMetrics;
  bool _sellerMode = false;
  bool _planSeller = false;
  bool _loading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final twins = await widget.api.listTwins();
      final twin = twins.cast<Map<String, dynamic>?>().firstWhere(
            (t) => t?['id'] == widget.twinId,
            orElse: () => twins.isNotEmpty ? twins.first as Map<String, dynamic> : null,
          );
      _sellerMode = twin?['seller_mode'] == true;
      final plan = await widget.api.getPlan();
      _planSeller = plan['seller_mode'] == true;
      final results = await Future.wait([
        widget.api.getTwinStats(widget.twinId),
        widget.api.getDnaEvolution(widget.twinId),
        widget.api.getChannelMetrics(twinId: widget.twinId),
      ]);
      _stats = results[0];
      _evolution = results[1];
      _channelMetrics = results[2];
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _toggleSeller(bool v) async {
    if (!_planSeller) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Modo vendedor requer plano Pro ou Business')),
      );
      return;
    }
    await widget.api.updateTwin(widget.twinId, {'seller_mode': v});
    setState(() => _sellerMode = v);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());

    final radar = (_stats?['radar'] as List<dynamic>?) ?? [];
    final suggestions = _stats?['suggestions'] as Map<String, dynamic>?;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _stats?['name']?.toString() ?? 'Twin',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              Text(
                'DNA v${_stats?['dna_version'] ?? '0'}',
                style: TextStyle(color: Colors.grey.shade400),
              ),
            ],
          ),
        ),
        TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF22D3EE),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF22D3EE),
          tabs: const [
            Tab(text: 'Perfil'),
            Tab(text: 'Evolução'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_planSeller)
                      SwitchListTile(
                        title: const Text('Modo vendedor'),
                        subtitle: const Text('Usa playbooks comerciais nas sugestões'),
                        value: _sellerMode,
                        onChanged: _toggleSeller,
                      ),
                    const SizedBox(height: 8),
                    ...radar.map((r) {
                      final m = r as Map<String, dynamic>;
                      final value = (m['value'] as num?)?.toDouble() ?? 0;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(m['trait']?.toString() ?? '', style: const TextStyle(fontSize: 12)),
                            LinearProgressIndicator(value: value / 100, minHeight: 6),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 16),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Métricas', style: TextStyle(fontWeight: FontWeight.bold)),
                            Text('Mensagens: ${_stats?['messages_indexed'] ?? 0}'),
                            Text('Sugestões: ${suggestions?['total'] ?? 0}'),
                            Text('Taxa aceite: ${suggestions?['accept_rate'] ?? '—'}%'),
                            if (_channelMetrics != null) ...[
                              const Divider(),
                              Text('Pendentes: ${_channelMetrics!['pending'] ?? 0}'),
                              Text('Enviadas hoje: ${_channelMetrics!['sent_today'] ?? 0}'),
                              Text(
                                'Aceite 7d: ${_channelMetrics!['accept_rate_7d'] ?? '—'}%',
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              _EvolutionTab(evolution: _evolution, onRefresh: _load),
            ],
          ),
        ),
      ],
    );
  }
}

class _EvolutionTab extends StatelessWidget {
  const _EvolutionTab({required this.evolution, required this.onRefresh});

  final Map<String, dynamic>? evolution;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    final versions = (evolution?['versions'] as List<dynamic>?) ?? [];

    if (versions.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          children: [
            Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Nenhuma versão de DNA. Importe conversas na web.',
                style: TextStyle(color: Colors.grey.shade400),
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: versions.length,
        itemBuilder: (context, index) {
          final v = versions[index] as Map<String, dynamic>;
          final deltas = (v['deltas'] as List<dynamic>?) ?? [];
          final createdAt = v['created_at']?.toString();
          final summary = v['change_summary']?.toString();
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'v${v['version']}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFE879F9),
                        ),
                      ),
                      if (createdAt != null)
                        Text(
                          DateTime.tryParse(createdAt)?.toLocal().toString().split(' ').first ?? '',
                          style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                        ),
                    ],
                  ),
                  if (summary != null && summary.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(summary, style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                    ),
                  if (deltas.isEmpty && (summary == null || summary.isEmpty))
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        index == 0 ? 'Primeira versão — sem deltas.' : 'Sem alterações de radar.',
                        style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                      ),
                    )
                  else
                    ...deltas.map((d) {
                      final delta = d as Map<String, dynamic>;
                      final from = delta['from'];
                      final to = delta['to'];
                      final change = (delta['delta'] as num?)?.toDouble() ?? 0;
                      final color = change > 0
                          ? Colors.green.shade300
                          : change < 0
                              ? Colors.red.shade300
                              : Colors.grey;
                      return Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Row(
                          children: [
                            Expanded(child: Text(delta['trait']?.toString() ?? '')),
                            Text(
                              '$from → $to',
                              style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              change == 0 ? '—' : '${change > 0 ? '+' : ''}$change',
                              style: TextStyle(color: color, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
