import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../services/auth_storage.dart';
import '../services/inbox_poller.dart';
import '../services/twin_api.dart';
import 'dashboard_screen.dart';
import 'inbox_screen.dart';
import 'replay_screen.dart';
import 'settings_screen.dart';
import 'suggestions_screen.dart';
import 'trainer_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.api, required this.onLogout});

  final TwinApi api;
  final VoidCallback onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  String? _twinId;
  InboxPoller? _inboxPoller;

  @override
  void initState() {
    super.initState();
    widget.api.listTwins().then((twins) {
      if (twins.isNotEmpty && mounted) {
        final id = twins.first['id'] as String?;
        setState(() => _twinId = id);
        _startInboxPoller(id);
      }
    });
  }

  void _startInboxPoller(String? twinId) {
    _inboxPoller?.dispose();
    _inboxPoller = InboxPoller(api: widget.api, twinId: twinId)
      ..start();
  }

  @override
  void dispose() {
    _inboxPoller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final twinId = _twinId;

    final pages = [
      _ImportTab(api: widget.api, twinId: twinId),
      if (twinId != null)
        DashboardScreen(api: widget.api, twinId: twinId)
      else
        const Center(child: Text('Crie um twin na web primeiro')),
      SuggestionsScreen(api: widget.api, twinId: twinId),
      TrainerScreen(api: widget.api, twinId: twinId),
      ReplayScreen(api: widget.api, twinId: twinId),
      InboxScreen(api: widget.api, twinId: twinId),
      SettingsScreen(api: widget.api),
    ];

    return Scaffold(
      appBar: AppBar(
        title: ShaderMask(
          shaderCallback: (b) => const LinearGradient(
            colors: [Color(0xFF22D3EE), Color(0xFFE879F9)],
          ).createShader(b),
          child: const Text('TWIN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: widget.onLogout),
        ],
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.upload_file), label: 'Importar'),
          NavigationDestination(icon: Icon(Icons.psychology), label: 'DNA'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Sugerir'),
          NavigationDestination(icon: Icon(Icons.school), label: 'Treinar'),
          NavigationDestination(icon: Icon(Icons.replay), label: 'Replay'),
          NavigationDestination(icon: Icon(Icons.inbox), label: 'Inbox'),
          NavigationDestination(icon: Icon(Icons.settings), label: 'Canais'),
        ],
      ),
    );
  }
}

class _ImportTab extends StatefulWidget {
  const _ImportTab({required this.api, this.twinId});

  final TwinApi api;
  final String? twinId;

  @override
  State<_ImportTab> createState() => _ImportTabState();
}

class _ImportTabState extends State<_ImportTab> {
  bool _uploading = false;
  String _status = '';
  final _storage = AuthStorage();

  Future<bool> _showConsentDialog() async {
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Consentimento LGPD'),
        content: Text(
          'Ao importar conversas exportadas, você autoriza o processamento dos dados '
          'exclusivamente para treinar seu gêmeo digital TWIN (versão $consentVersion).\n\n'
          '• Dados isolados por organização\n'
          '• Exclusão total disponível a qualquer momento\n'
          '• Apenas exportações oficiais dos apps',
          style: TextStyle(color: Colors.grey.shade300, fontSize: 14),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Aceito')),
        ],
      ),
    );
    return accepted ?? false;
  }

  Future<void> _pickAndUpload() async {
    if (widget.twinId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nenhum twin disponível')),
      );
      return;
    }

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['txt', 'json', 'csv', 'zip'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    if (file.bytes == null) return;

    setState(() {
      _uploading = true;
      _status = 'Enviando…';
    });

    try {
      final consentId = await widget.api.resolveConsentId(
        getStored: _storage.getConsentId,
        store: _storage.setConsentId,
        promptAccept: _showConsentDialog,
      );
      final batch = await widget.api.uploadImport(
        twinId: widget.twinId!,
        consentId: consentId,
        fileBytes: file.bytes!,
        filename: file.name,
      );
      final batchId = batch['id'] as String;
      setState(() => _status = 'Processando importação…');

      var status = batch['status'] as String? ?? 'queued';
      var attempts = 0;
      while (status != 'completed' && status != 'failed' && attempts < 60) {
        await Future.delayed(const Duration(seconds: 2));
        final updated = await widget.api.getImportStatus(batchId);
        status = updated['status'] as String? ?? status;
        final total = updated['total_messages'] ?? 0;
        if (mounted) {
          setState(() => _status = 'Status: $status ($total msgs)');
        }
        attempts++;
      }

      if (mounted) {
        setState(() => _status = status == 'completed'
            ? 'Importação concluída! DNA sendo extraído.'
            : 'Importação: $status');
      }
    } catch (e) {
      if (mounted) {
        setState(() => _status = 'Erro: $e');
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Importar conversas', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text('Exportações oficiais com consentimento LGPD.', style: TextStyle(color: Colors.grey.shade400)),
          if (_status.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(_status, style: const TextStyle(color: Color(0xFF22D3EE), fontSize: 13)),
          ],
          const Spacer(),
          FilledButton.icon(
            onPressed: _uploading ? null : _pickAndUpload,
            icon: _uploading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.folder_open),
            label: Text(_uploading ? 'Enviando…' : 'Selecionar e enviar'),
          ),
        ],
      ),
    );
  }
}
