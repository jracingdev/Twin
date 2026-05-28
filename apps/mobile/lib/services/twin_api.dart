import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

class TwinApi {
  TwinApi({
    String? baseUrl,
    String? token,
    String? tenantId,
  })  : baseUrl = baseUrl ?? TwinConfig.apiUrl,
        token = token ?? (TwinConfig.token.isNotEmpty ? TwinConfig.token : null),
        tenantId = tenantId ?? (TwinConfig.tenantId.isNotEmpty ? TwinConfig.tenantId : null);

  final String baseUrl;
  final String? token;
  final String? tenantId;

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
        if (tenantId != null) 'X-Tenant': tenantId!,
      };

  Future<Map<String, dynamic>> login(String email, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/login'),
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    if (res.statusCode >= 400) throw Exception(res.body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> listTwins() async {
    final res = await http.get(Uri.parse('$baseUrl/twins'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(res.body);
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['data'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> suggest({
    required String twinId,
    required String text,
    int intensity = 2,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/suggest'),
      headers: _headers,
      body: jsonEncode({
        'twin_id': twinId,
        'text': text,
        'intensity': intensity,
      }),
    );
    if (res.statusCode >= 400) throw Exception(res.body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> feedback(String suggestionId, String status) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/suggestions/$suggestionId'),
      headers: _headers,
      body: jsonEncode({'status': status}),
    );
    if (res.statusCode >= 400) throw Exception(res.body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> uploadImport({
    required String twinId,
    required String consentId,
    required List<int> fileBytes,
    required String filename,
    String source = 'whatsapp',
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/imports'));
    request.headers.addAll({
      if (token != null) 'Authorization': 'Bearer $token',
      if (tenantId != null) 'X-Tenant': tenantId!,
      'Accept': 'application/json',
    });
    request.fields['twin_id'] = twinId;
    request.fields['consent_id'] = consentId;
    request.fields['source'] = source;
    request.files.add(http.MultipartFile.fromBytes('file', fileBytes, filename: filename));
    final streamed = await request.send();
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode >= 400) throw Exception(res.body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getImportStatus(String id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/imports/$id'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(res.body);
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
