import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';

const consentVersion = '1.0.0';

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
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<void> logout() async {
    if (token == null) return;
    await http.post(Uri.parse('$baseUrl/logout'), headers: _headers);
  }

  Future<List<dynamic>> listTwins() async {
    final res = await http.get(Uri.parse('$baseUrl/twins'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['data'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> getTwinStats(String twinId) async {
    final res = await http.get(Uri.parse('$baseUrl/twins/$twinId/stats'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateTwin(String twinId, Map<String, dynamic> body) async {
    final res = await http.put(
      Uri.parse('$baseUrl/twins/$twinId'),
      headers: _headers,
      body: jsonEncode(body),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getPlan() async {
    final res = await http.get(Uri.parse('$baseUrl/plan'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> suggest({
    required String twinId,
    required String text,
    int intensity = 2,
    bool sellerMode = false,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/suggest'),
      headers: _headers,
      body: jsonEncode({
        'twin_id': twinId,
        'text': text,
        'intensity': intensity,
        if (sellerMode) 'seller_mode': true,
      }),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> feedback(String suggestionId, String status) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/suggestions/$suggestionId'),
      headers: _headers,
      body: jsonEncode({'status': status}),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> listSuggestions({String? twinId, String status = 'pending'}) async {
    final q = <String, String>{'status': status};
    if (twinId != null) q['twin_id'] = twinId;
    final uri = Uri.parse('$baseUrl/suggestions').replace(queryParameters: q);
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['data'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> sendSuggestion(String id, {String? text}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/suggestions/$id/send'),
      headers: _headers,
      body: jsonEncode(text != null ? {'text': text} : {}),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> latestConsent() async {
    final res = await http.get(Uri.parse('$baseUrl/consent/latest?type=import'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createConsent({String type = 'import'}) async {
    final res = await http.post(
      Uri.parse('$baseUrl/consent'),
      headers: _headers,
      body: jsonEncode({'type': type, 'text_version': consentVersion}),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Retorna o ID de consentimento armazenado, busca o último na API ou cria um novo após aceite.
  Future<String> resolveConsentId({
    required Future<String?> Function() getStored,
    required Future<void> Function(String id) store,
    required Future<bool> Function() promptAccept,
  }) async {
    final stored = await getStored();
    if (stored != null && stored.isNotEmpty) return stored;

    try {
      final latest = await latestConsent();
      final id = latest['id']?.toString();
      if (id != null && id.isNotEmpty) {
        await store(id);
        return id;
      }
    } catch (_) {
      // Sem consentimento registrado — solicitar aceite
    }

    final accepted = await promptAccept();
    if (!accepted) {
      throw Exception('Consentimento LGPD necessário para importar conversas.');
    }

    final created = await createConsent();
    final id = created['id']?.toString();
    if (id == null || id.isEmpty) {
      throw Exception('Falha ao registrar consentimento.');
    }
    await store(id);
    return id;
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
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getImportStatus(String id) async {
    final res = await http.get(Uri.parse('$baseUrl/imports/$id'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getDnaEvolution(String twinId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/twins/$twinId/dna/evolution'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getChannelMetrics({String? twinId}) async {
    final uri = Uri.parse('$baseUrl/channel-metrics').replace(
      queryParameters: twinId != null ? {'twin_id': twinId} : null,
    );
    final res = await http.get(uri, headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> listChannelCredentials() async {
    final res = await http.get(Uri.parse('$baseUrl/channel-credentials'), headers: _headers);
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    final data = jsonDecode(res.body);
    if (data is List) return data;
    return (data as Map<String, dynamic>)['data'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> explainSuggestion(String id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/suggestions/$id/explain'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> twinTrain(String twinId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/twins/$twinId/train'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> trainJobStatus(String jobId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/train/jobs/$jobId'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> twinReplay({
    required String twinId,
    required String text,
    int? intensity,
    bool sellerMode = false,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/twins/$twinId/replay'),
      headers: _headers,
      body: jsonEncode({
        'text': text,
        if (intensity != null) 'intensity': intensity,
        if (sellerMode) 'seller_mode': true,
      }),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> listMemoryEntities(String twinId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/twins/$twinId/memory-entities'),
      headers: _headers,
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    return data['data'] as List<dynamic>? ?? [];
  }

  Future<Map<String, dynamic>> createMemoryEntity(
    String twinId, {
    required String type,
    required String label,
    String? content,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/twins/$twinId/memory-entities'),
      headers: _headers,
      body: jsonEncode({
        'type': type,
        'label': label,
        if (content != null && content.isNotEmpty) 'content': content,
      }),
    );
    if (res.statusCode >= 400) throw Exception(_parseError(res));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  String _parseError(http.Response res) {
    try {
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      return json['message']?.toString() ?? res.body;
    } catch (_) {
      return res.body;
    }
  }
}
