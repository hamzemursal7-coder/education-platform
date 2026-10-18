import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../auth/session.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onLogout,
  });

  final ApiClient api;
  final SessionUser user;
  final VoidCallback onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  var loading = true;
  String? error;
  List<_Stat> stats = [];
  List<_ListItem> items = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      switch (widget.user.role) {
        case 'SCHOOL_ADMIN':
          final data = await widget.api.getJson('/api/v1/dashboard/school') as Map;
          final fees = data['fees'] as Map? ?? {};
          stats = [
            _Stat('Students', '${data['students']}'),
            _Stat('Teachers', '${data['teachers']}'),
            _Stat('Collected', '${fees['collected']}'),
            _Stat('Outstanding', '${fees['outstanding']}'),
          ];
          items = [
            _ListItem('School', '${data['school']?['name'] ?? ''}'),
            _ListItem('Active enrollments', '${data['activeEnrollments']}'),
            _ListItem('Attendance rate', '${data['attendanceRate'] ?? '—'}%'),
          ];
          break;
        case 'ACCOUNTANT':
          final data = await widget.api.getJson('/api/v1/dashboard/accountant') as Map;
          stats = [
            _Stat('Collected', '${data['collected']}'),
            _Stat('Outstanding', '${data['outstanding']}'),
            _Stat('Payments', '${data['paymentCount']}'),
          ];
          final payments = (data['recentPayments'] as List? ?? [])
              .cast<Map>()
              .map((row) => _ListItem(
                    '${row['receiptNumber']}',
                    '${row['student']} · ${row['amount']}',
                  ))
              .toList();
          items = payments;
          break;
        case 'TEACHER':
          final data = await widget.api.getJson('/api/v1/dashboard/teacher') as Map;
          stats = [
            _Stat('Assignments', '${data['assignmentCount']}'),
            _Stat('Pending marks', '${data['pendingMarks']}'),
            _Stat('Announcements', '${data['announcements']}'),
          ];
          final sections = (data['sections'] as List? ?? [])
              .cast<Map>()
              .map((row) => _ListItem('${row['level']} ${row['name']}', '${row['year']}'))
              .toList();
          items = sections;
          break;
        case 'PARENT':
          final data = await widget.api.getJson('/api/v1/dashboard/parent') as Map;
          stats = [
            _Stat('Outstanding fees', '${data['outstandingFees']}'),
            _Stat('Announcements', '${data['announcements']}'),
            _Stat('Absent sessions', '${data['absentSessions']}'),
          ];
          items = (data['children'] as List? ?? [])
              .cast<Map>()
              .map((row) => _ListItem(
                    '${row['name']}',
                    '${row['permanentId']} · ${row['school']}',
                  ))
              .toList();
          break;
        case 'SUPER_ADMIN':
          final data = await widget.api.getJson('/api/v1/dashboard/summary') as Map;
          stats = [
            _Stat('Organizations', '${data['organizations']}'),
            _Stat('Schools', '${data['schools']}'),
            _Stat('Students', '${data['students']}'),
            _Stat('Fees collected', '${data['feesCollected']}'),
          ];
          items = (data['schoolList'] as List? ?? [])
              .cast<Map>()
              .map((row) => _ListItem('${row['name']}', '${row['code']} · ${row['activeEnrollments']} active'))
              .toList();
          break;
        default:
          stats = [_Stat('Role', widget.user.role)];
          items = [_ListItem(widget.user.displayName, widget.user.email)];
      }
    } on ApiException catch (caught) {
      error = caught.message;
    } catch (_) {
      error = 'Could not load dashboard.';
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.user.schoolName ?? 'Education'),
        actions: [
          IconButton(
            onPressed: () async {
              await widget.api.logout();
              widget.onLogout();
            },
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
          ),
        ],
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Hello, ${widget.user.firstName}',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  Text(
                    widget.user.role.replaceAll('_', ' '),
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: stats
                        .map(
                          (stat) => SizedBox(
                            width: 160,
                            child: Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      stat.label,
                                      style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      stat.value,
                                      style: const TextStyle(
                                        fontSize: 22,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Details',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 8),
                  ...items.map(
                    (item) => Card(
                      child: ListTile(
                        title: Text(item.title),
                        subtitle: Text(item.subtitle),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _Stat {
  _Stat(this.label, this.value);
  final String label;
  final String value;
}

class _ListItem {
  _ListItem(this.title, this.subtitle);
  final String title;
  final String subtitle;
}
