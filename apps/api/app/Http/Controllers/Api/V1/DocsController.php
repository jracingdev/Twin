<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;

class DocsController extends Controller
{
    public function openapi(): JsonResponse|\Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $path = base_path('../../packages/shared-contracts/openapi.yaml');
        if (! File::exists($path)) {
            $path = base_path('../packages/shared-contracts/openapi.yaml');
        }

        if (! File::exists($path)) {
            return response()->json([
                'message' => 'openapi.yaml não encontrado em packages/shared-contracts/',
                'docs_url' => config('twin.frontend_url').'/docs',
            ]);
        }

        return response()->file($path, ['Content-Type' => 'application/yaml']);
    }

    public function swaggerUi(): \Illuminate\Http\Response
    {
        $specUrl = url('/api/v1/docs/openapi.yaml');

        $html = <<<HTML
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>TWIN API — Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "{$specUrl}",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
    });
  </script>
</body>
</html>
HTML;

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'title' => 'TWIN API',
            'version' => 'v1',
            'openapi' => url('/api/v1/docs/openapi.yaml'),
            'swagger_ui' => url('/api/v1/docs/ui'),
            'auth' => [
                'login' => 'POST /api/v1/login',
                'header' => 'Authorization: Bearer {token}',
                'tenant' => 'X-Tenant: {organization_uuid}',
            ],
        ]);
    }
}
