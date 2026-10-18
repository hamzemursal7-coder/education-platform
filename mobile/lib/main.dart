import 'package:flutter/material.dart';
import 'api/api_client.dart';
import 'auth/session.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = await ApiClient.create();
  runApp(EmpMobileApp(api: api));
}

class EmpMobileApp extends StatefulWidget {
  const EmpMobileApp({super.key, required this.api});

  final ApiClient api;

  @override
  State<EmpMobileApp> createState() => _EmpMobileAppState();
}

class _EmpMobileAppState extends State<EmpMobileApp> {
  SessionUser? user;
  var booting = true;

  @override
  void initState() {
    super.initState();
    restore();
  }

  Future<void> restore() async {
    try {
      final json = await widget.api.me();
      if (!mounted) return;
      setState(() {
        user = SessionUser.fromJson(json);
        booting = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        user = null;
        booting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Education Management',
      theme: empTheme(),
      home: booting
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : user == null
              ? LoginScreen(
                  api: widget.api,
                  onSuccess: (session) => setState(() => user = session),
                )
              : HomeScreen(
                  api: widget.api,
                  user: user!,
                  onLogout: () => setState(() => user = null),
                ),
    );
  }
}
