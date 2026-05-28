/// Configure via --dart-define=TWIN_API_URL=http://192.168.x.x:8080/api/v1
class TwinConfig {
  static const String apiUrl = String.fromEnvironment(
    'TWIN_API_URL',
    defaultValue: 'http://10.0.2.2:8080/api/v1',
  );

  static const String tenantId = String.fromEnvironment(
    'TWIN_TENANT_ID',
    defaultValue: '',
  );

  static const String token = String.fromEnvironment(
    'TWIN_TOKEN',
    defaultValue: '',
  );
}
