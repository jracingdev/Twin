<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $user->two_factor_confirmed_at !== null,
            'confirmed_at' => $user->two_factor_confirmed_at,
        ]);
    }

    public function enable(Request $request): JsonResponse
    {
        $user = $request->user();
        $google2fa = new Google2FA;
        $secret = $google2fa->generateSecretKey();

        $user->forceFill([
            'two_factor_secret' => encrypt($secret),
            'two_factor_recovery_codes' => encrypt(json_encode(Collection::times(8, fn () => bin2hex(random_bytes(5)))->all())),
            'two_factor_confirmed_at' => null,
        ])->save();

        $qrUrl = $google2fa->getQRCodeUrl(
            config('app.name', 'TWIN'),
            $user->email,
            $secret
        );

        return response()->json([
            'secret' => $secret,
            'qr_url' => $qrUrl,
            'recovery_codes' => json_decode(Crypt::decryptString($user->two_factor_recovery_codes)),
            'message' => 'Confirme com um código do autenticador.',
        ]);
    }

    public function confirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => 'required|string|size:6']);

        $user = $request->user();
        if (! $user->two_factor_secret) {
            return response()->json(['message' => 'Ative o 2FA primeiro.'], 422);
        }

        $secret = decrypt($user->two_factor_secret);
        $google2fa = new Google2FA;

        if (! $google2fa->verifyKey($secret, $data['code'])) {
            return response()->json(['message' => 'Código inválido.'], 422);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();

        return response()->json(['message' => '2FA ativado com sucesso.']);
    }

    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate(['password' => 'required|string']);

        $user = $request->user();
        if (! \Illuminate\Support\Facades\Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Senha incorreta.'], 422);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json(['message' => '2FA desativado.']);
    }
}
