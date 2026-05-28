import 'package:flutter/material.dart';
import 'screens/home_screen.dart';

void main() {
  runApp(const TwinApp());
}

class TwinApp extends StatelessWidget {
  const TwinApp({super.key});

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
      home: const HomeScreen(),
    );
  }
}
