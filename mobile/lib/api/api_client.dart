import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

class ApiClient {
  ApiClient._(this.dio, this.baseUrl);

  final Dio dio;
  final String baseUrl;

  static Future<ApiClient> create({String? baseUrl}) async {
    final resolved = baseUrl ??
        const String.fromEnvironment(
          'API_BASE',
          defaultValue: 'http://127.0.0.1:4000',
        );
    final dio = Dio(
      BaseOptions(
        baseUrl: resolved,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
        validateStatus: (status) => status != null && status < 500,
      ),
    );
    final dir = await getApplicationDocumentsDirectory();
    final jar = PersistCookieJar(storage: FileStorage('${dir.path}/cookies'));
    dio.interceptors.add(CookieManager(jar));
    return ApiClient._(dio, resolved);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await dio.post(
      '/api/v1/auth/login',
      data: {'email': email.trim(), 'password': password},
    );
    if (response.statusCode != 200) {
      throw ApiException(_message(response) ?? 'Email or password is incorrect.');
    }
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> me() async {
    final response = await dio.get('/api/v1/auth/me');
    if (response.statusCode == 401) {
      final refreshed = await dio.post('/api/v1/auth/refresh');
      if (refreshed.statusCode != 200) {
        throw ApiException('Authentication is required.');
      }
      final retry = await dio.get('/api/v1/auth/me');
      if (retry.statusCode != 200) {
        throw ApiException('Authentication is required.');
      }
      return Map<String, dynamic>.from(retry.data as Map);
    }
    if (response.statusCode != 200) {
      throw ApiException(_message(response) ?? 'Could not load session.');
    }
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<void> logout() async {
    await dio.post('/api/v1/auth/logout');
  }

  Future<dynamic> getJson(String path) async {
    final response = await dio.get(path);
    if (response.statusCode == 401) {
      final refreshed = await dio.post('/api/v1/auth/refresh');
      if (refreshed.statusCode != 200) {
        throw ApiException('Authentication is required.');
      }
      final retry = await dio.get(path);
      if (retry.statusCode != 200) {
        throw ApiException(_message(retry) ?? 'Request failed.');
      }
      return retry.data;
    }
    if (response.statusCode != 200) {
      throw ApiException(_message(response) ?? 'Request failed.');
    }
    return response.data;
  }

  String? _message(Response response) {
    final data = response.data;
    if (data is Map && data['message'] is String) {
      return data['message'] as String;
    }
    return null;
  }
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}
