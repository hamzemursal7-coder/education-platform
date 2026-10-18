class SessionUser {
  SessionUser({
    required this.id,
    required this.email,
    required this.role,
    required this.firstName,
    required this.lastName,
    this.schoolId,
    this.schoolName,
  });

  final String id;
  final String email;
  final String role;
  final String firstName;
  final String lastName;
  final String? schoolId;
  final String? schoolName;

  factory SessionUser.fromJson(Map<String, dynamic> json) {
    final school = json['school'];
    return SessionUser(
      id: json['id'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      schoolId: json['schoolId'] as String?,
      schoolName: school is Map ? school['name'] as String? : null,
    );
  }

  String get displayName => '$firstName $lastName';
}
