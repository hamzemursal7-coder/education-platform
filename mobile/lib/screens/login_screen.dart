import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../auth/session.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    super.key,
    required this.api,
    required this.onSuccess,
  });

  final ApiClient api;
  final ValueChanged<SessionUser> onSuccess;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  var pending = false;
  String? error;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      pending = true;
      error = null;
    });
    try {
      final json = await widget.api.login(
        emailController.text,
        passwordController.text,
      );
      widget.onSuccess(SessionUser.fromJson(json));
    } on ApiException catch (caught) {
      setState(() => error = caught.message);
    } catch (_) {
      setState(() => error = 'Could not reach the API. Is it running on ${widget.api.baseUrl}?');
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Card(
            margin: const EdgeInsets.all(24),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Education Management',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sign in',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: emailController,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(labelText: 'Email'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: const InputDecoration(labelText: 'Password'),
                    onSubmitted: (_) => pending ? null : submit(),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: pending ? null : submit,
                    child: Text(pending ? 'Signing in...' : 'Sign in'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
