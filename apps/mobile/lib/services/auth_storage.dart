import 'package:shared_preferences/shared_preferences.dart';

class AuthStorage {
  static const _tokenKey = 'twin_token';
  static const _tenantKey = 'twin_tenant_id';
  static const _emailKey = 'twin_email';
  static const _consentIdKey = 'twin_consent_id';

  Future<void> saveSession({
    required String token,
    required String tenantId,
    String? email,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    await prefs.setString(_tenantKey, tenantId);
    if (email != null) await prefs.setString(_emailKey, email);
  }

  Future<Map<String, String>?> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final tenant = prefs.getString(_tenantKey);
    if (token == null || token.isEmpty || tenant == null || tenant.isEmpty) {
      return null;
    }
    return {
      'token': token,
      'tenantId': tenant,
      'email': prefs.getString(_emailKey) ?? '',
    };
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_tenantKey);
    await prefs.remove(_emailKey);
    await prefs.remove(_consentIdKey);
  }

  Future<String?> getConsentId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_consentIdKey);
  }

  Future<void> setConsentId(String id) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_consentIdKey, id);
  }
}
