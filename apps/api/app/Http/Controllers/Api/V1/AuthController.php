<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'two_factor_code' => 'nullable|string',
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Credenciais inválidas.'],
            ]);
        }

        if ($user->two_factor_confirmed_at && $user->two_factor_secret) {
            if (empty($data['two_factor_code'])) {
                return response()->json([
                    'two_factor_required' => true,
                    'message' => 'Informe o código do autenticador.',
                ]);
            }

            $secret = decrypt($user->two_factor_secret);
            $google2fa = new Google2FA;
            if (! $google2fa->verifyKey($secret, $data['two_factor_code'])) {
                throw ValidationException::withMessages([
                    'two_factor_code' => ['Código 2FA inválido.'],
                ]);
            }
        }

        $token = $user->createToken('web')->plainTextToken;
        $organizations = $this->formatOrganizations($user);
        $organization = $organizations[0] ?? null;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
            'organization' => $organization,
            'organizations' => $organizations,
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        if (! config('twin.registration_enabled')) {
            return response()->json([
                'message' => 'Cadastro público desativado. Peça acesso ao administrador.',
            ], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'organization_name' => 'required|string|max:255',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        $org = Organization::create([
            'name' => $data['organization_name'],
            'slug' => Str::slug($data['organization_name']).'-'.Str::random(4),
        ]);
        $org->users()->attach($user->id, ['role' => 'owner']);

        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
            'organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
                'role' => 'owner',
            ],
            'organizations' => [[
                'id' => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
                'role' => 'owner',
            ]],
        ], 201);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $status = Password::sendResetLink($request->only('email'));

        return response()->json([
            'message' => $status === Password::RESET_LINK_SENT
                ? 'Se o e-mail existir, enviaremos o link de redefinição.'
                : 'Não foi possível enviar o link. Verifique o e-mail.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json(['message' => 'Senha redefinida com sucesso.']);
    }

    public function organizations(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->formatOrganizations($request->user()),
        ]);
    }

    public function switchOrganization(Request $request): JsonResponse
    {
        $data = $request->validate([
            'organization_id' => 'required|uuid|exists:organizations,id',
        ]);

        $user = $request->user();
        $org = $user->organizations()->where('organizations.id', $data['organization_id'])->first();

        if (! $org) {
            return response()->json(['message' => 'Organização não encontrada.'], 403);
        }

        return response()->json([
            'organization' => [
                'id' => $org->id,
                'name' => $org->name,
                'slug' => $org->slug,
                'role' => $org->pivot->role,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'ok']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $orgHeader = $request->header('X-Tenant');
        $organization = null;

        if ($orgHeader) {
            $org = $user->organizations()->where('organizations.id', $orgHeader)->first();
            if ($org) {
                $organization = [
                    'id' => $org->id,
                    'name' => $org->name,
                    'slug' => $org->slug,
                    'role' => $org->pivot->role,
                ];
            }
        }

        if (! $organization) {
            $first = $user->organizations()->first();
            $organization = $first ? [
                'id' => $first->id,
                'name' => $first->name,
                'slug' => $first->slug,
                'role' => $first->pivot->role,
            ] : null;
        }

        return response()->json([
            'user' => $this->formatUser($user),
            'organization' => $organization,
            'organizations' => $this->formatOrganizations($user),
            'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
        ]);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    private function formatOrganizations(User $user): array
    {
        return $user->organizations()->get()->map(fn ($org) => [
            'id' => $org->id,
            'name' => $org->name,
            'slug' => $org->slug,
            'role' => $org->pivot->role,
        ])->values()->all();
    }
}
