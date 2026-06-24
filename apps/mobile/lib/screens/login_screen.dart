import 'package:flutter/material.dart';
import '../services/auth_storage.dart';
import '../services/twin_api.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onLoggedIn});

  final VoidCallback onLoggedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(text: 'admin@twin.local');
  final _password = TextEditingController(text: 'password');
  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = TwinApi();
      final res = await api.login(_email.text.trim(), _password.text);
      final token = res['token'] as String?;
      final org = res['organization'] as Map<String, dynamic>?;
      final tenantId = org?['id'] as String?;
      if (token == null || tenantId == null) {
        throw Exception('Resposta de login inválida');
      }
      await AuthStorage().saveSession(
        token: token,
        tenantId: tenantId,
        email: _email.text.trim(),
      );
      widget.onLoggedIn();
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),
              ShaderMask(
                shaderCallback: (b) => const LinearGradient(
                  colors: [Color(0xFF22D3EE), Color(0xFFE879F9)],
                ).createShader(b),
                child: const Text(
                  'TWIN',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: Colors.white),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Gêmeo digital de comunicação',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade400),
              ),
              const SizedBox(height: 32),
              TextField(
                controller: _email,
                decoration: const InputDecoration(labelText: 'E-mail', border: OutlineInputBorder()),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _password,
                decoration: const InputDecoration(labelText: 'Senha', border: OutlineInputBorder()),
                obscureText: true,
                onSubmitted: (_) => _login(),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _loading ? null : _login,
                child: Text(_loading ? 'Entrando…' : 'Entrar'),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
