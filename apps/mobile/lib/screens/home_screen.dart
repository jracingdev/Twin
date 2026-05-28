import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../config.dart';
import '../services/twin_api.dart';
import 'suggestions_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  TwinApi? _api;
  String? _twinId;

  @override
  void initState() {
    super.initState();
    if (TwinConfig.token.isNotEmpty && TwinConfig.tenantId.isNotEmpty) {
      _api = TwinApi();
      _api!.listTwins().then((twins) {
        if (twins.isNotEmpty && mounted) {
          setState(() => _twinId = twins.first['id'] as String?);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _ImportTab(api: _api, twinId: _twinId, onOpenSuggestions: () => setState(() => _index = 1)),
      SuggestionsScreen(api: _api, twinId: _twinId),
    ];

    return Scaffold(
      appBar: AppBar(
        title: ShaderMask(
          shaderCallback: (b) => const LinearGradient(
            colors: [Color(0xFF22D3EE), Color(0xFFE879F9)],
          ).createShader(b),
          child: const Text('TWIN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ),
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.upload_file), label: 'Importar'),
          NavigationDestination(icon: Icon(Icons.chat), label: 'Sugestões'),
        ],
      ),
    );
  }
}

class _ImportTab extends StatefulWidget {
  const _ImportTab({this.api, this.twinId, required this.onOpenSuggestions});

  final TwinApi? api;
  final String? twinId;
  final VoidCallback onOpenSuggestions;

  @override
  State<_ImportTab> createState() => _ImportTabState();
}

class _ImportTabState extends State<_ImportTab> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    if (widget.api == null || widget.twinId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configure TWIN_TOKEN e TWIN_TENANT_ID via dart-define')),
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

    setState(() => _uploading = true);
    try {
      final batch = await widget.api!.uploadImport(
        twinId: widget.twinId!,
        consentId: '1',
        fileBytes: file.bytes!,
        filename: file.name,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Import enfileirado: ${batch['id']}')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erro: $e')),
        );
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
          const Text(
            'Importar conversas',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'Exportações oficiais com consentimento LGPD.',
            style: TextStyle(color: Colors.grey.shade400),
          ),
          const Spacer(),
          FilledButton.icon(
            onPressed: _uploading ? null : _pickAndUpload,
            icon: _uploading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.folder_open),
            label: Text(_uploading ? 'Enviando…' : 'Selecionar e enviar'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: widget.onOpenSuggestions,
            child: const Text('Ver sugestões'),
          ),
        ],
      ),
    );
  }
}
