import 'package:flutter/material.dart';
import 'config.dart';
import 'screens/login_screen.dart';
import 'services/auth_storage.dart';
import 'services/notification_service.dart';
import 'services/twin_api.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.instance.init();
  runApp(const TwinApp());
}

class TwinApp extends StatefulWidget {
  const TwinApp({super.key});

  @override
  State<TwinApp> createState() => _TwinAppState();
}

class _TwinAppState extends State<TwinApp> {
  TwinApi? _api;
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final session = await AuthStorage().loadSession();
    if (session != null) {
      _api = TwinApi(token: session['token'], tenantId: session['tenantId']);
    } else if (TwinConfig.token.isNotEmpty && TwinConfig.tenantId.isNotEmpty) {
      _api = TwinApi();
    }
    if (mounted) setState(() => _checking = false);
  }

  Future<void> _onLoggedIn() async {
    final session = await AuthStorage().loadSession();
    if (session != null) {
      setState(() {
        _api = TwinApi(token: session['token'], tenantId: session['tenantId']);
      });
    }
  }

  Future<void> _logout() async {
    try {
      await _api?.logout();
    } catch (_) {}
    await AuthStorage().clear();
    setState(() => _api = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TWIN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF22D3EE),
          secondary: Color(0xFFE879F9),
          surface: Color(0xFF0A0E17),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0E17),
      ),
      home: _checking
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : _api == null
              ? LoginScreen(onLoggedIn: _onLoggedIn)
              : HomeScreen(api: _api!, onLogout: _logout),
    );
  }
}
