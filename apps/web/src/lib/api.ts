import { clearToken, getOrganizationId, getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
const AI_ENGINE_URL =
  process.env.NEXT_PUBLIC_AI_ENGINE_URL || "http://127.0.0.1:8000";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export type Twin = {
  id: string;
  name: string;
  description?: string | null;
  intensity: number;
  seller_mode: boolean;
  vertical?: string | null;
  status: string;
};

export type TwinDetail = Twin & {
  active_dna?: { version?: string; payload?: Record<string, unknown> } | null;
};

export type SimilarityBaseline = {
  formalidade?: number;
  tom_emocional?: number;
  vocabulario?: number;
  persuasao?: number;
  geral?: number;
};

export type ScoreBreakdown = SimilarityBaseline & {
  estilo?: number;
  contexto?: number;
  playbook?: number;
};

export type TwinStats = {
  twin_id: string;
  name: string;
  dna_version: string;
  similarity_score: number | null;
  similarity_baseline?: SimilarityBaseline | null;
  messages_indexed: number;
  radar: { trait: string; value: number }[];
  intents: string[];
  suggestions: {
    total: number;
    accepted: number;
    accept_rate: number | null;
  };
};

export type PaginatedTwins = {
  data: Twin[];
  current_page?: number;
  last_page?: number;
};

export type SuggestionResponse = {
  id: string;
  suggested_text: string;
  suggestion?: string;
  score?: number | null;
  status?: string;
  intensity?: number;
  seller_mode?: boolean;
  score_breakdown?: ScoreBreakdown | null;
  metadata?: Record<string, unknown> | null;
};

export type SuggestionExplain = {
  id: string;
  score?: number | null;
  factors: { key: string; label: string; value: number; explanation: string }[];
  summary: string;
};

export type InboxSuggestion = {
  id: string;
  twin_id: string;
  contact_id: string | null;
  input_text: string;
  suggested_text: string;
  intensity: number;
  score: number | null;
  status: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  contact?: { id: string; display_name: string; channel: string } | null;
};

export type ChannelReplyMode = "assistant" | "copilot" | "auto";

export type ChannelCredential = {
  id: string;
  twin_id: string;
  channel: string;
  is_active: boolean;
  reply_mode: ChannelReplyMode | "approval";
  confidence_threshold?: number;
  webhook_token: string;
  webhook_url: string;
  created_at: string;
};

export type DnaEvolutionPoint = {
  version: string;
  created_at: string | null;
  radar: { trait: string; value: number }[];
  deltas: { trait: string; from: number; to: number; delta: number }[];
  change_summary?: string | null;
};

export type DnaEvolution = {
  twin_id: string;
  versions: DnaEvolutionPoint[];
};

export type ChannelMetrics = {
  pending: number;
  sent_today: number;
  accept_rate_7d: number | null;
  avg_response_time_seconds: number | null;
  avg_response_time_minutes: number | null;
};

export type PlanSummary = {
  slug: string;
  name: string;
  seller_mode: boolean;
  twins_limit: number;
  messages_per_month: number;
};

export type ImportBatch = {
  id: string;
  twin_id: string;
  status: string;
  source: string;
  total_messages: number;
  processed_messages: number;
  metadata?: Record<string, unknown> | null;
};

export type TrainingJob = {
  id: string;
  twin_id: string;
  type: string;
  status: string;
  result?: { error?: string } | null;
};

export type TimelineEvent = {
  date: string;
  title: string;
  type: string;
  meta?: Record<string, unknown>;
};

export type ApiKeyRow = {
  id: number;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export type Playbook = {
  id: number;
  intent: string;
  vertical: string;
  template: string;
  usage_count: number;
};

export type MemoryEntity = {
  id: string;
  twin_id: string;
  type: string;
  label: string;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

export type TwinTrainResponse = TrainingJob & {
  examples_used?: number;
};

export type TwinReplayResponse = {
  suggested_text: string;
  suggestion?: string;
  score?: number | null;
  score_breakdown?: ScoreBreakdown | null;
  similarity_baseline?: SimilarityBaseline | null;
  metadata?: Record<string, unknown> | null;
};

export type ApiRequestOptions = {
  organizationId?: string | null;
  /** When true, 401 does not clear the session or redirect to login. */
  softAuth?: boolean;
};

function buildHeaders(
  options: RequestInit,
  token?: string,
  json = true,
  organizationId?: string | null
): HeadersInit {
  const authToken = token ?? getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (json && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const orgId = organizationId ?? getOrganizationId();
  if (orgId) {
    headers["X-Tenant"] = orgId;
  }
  return headers;
}

function parseApiErrorBody(raw: string, status: number): string {
  try {
    const json = JSON.parse(raw) as {
      message?: string;
      error?: string;
      errors?: Record<string, string[]>;
    };
    if (json.errors) {
      const first = Object.values(json.errors).flat()[0];
      if (first) return first;
    }
    return json.message || json.error || raw;
  } catch {
    return raw || `Erro na API (${status})`;
  }
}

export function formatApiError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("connection refused") ||
    lower.includes("couldn't connect to server") ||
    lower.includes("failed to connect")
  ) {
    return "Motor de IA indisponível. Inicie apps/ai-engine na porta 8000.";
  }
  if (lower.includes("cURL error 7") || lower.includes("curl error 7")) {
    return "Motor de IA indisponível. Inicie apps/ai-engine na porta 8000.";
  }
  return message;
}

async function handleResponse<T>(
  res: Response,
  requestOptions?: ApiRequestOptions
): Promise<T> {
  if (res.status === 401) {
    const softAuth = requestOptions?.softAuth === true;
    if (!softAuth) {
      clearToken();
      if (typeof window !== "undefined") {
        const onLogin = window.location.pathname === "/login";
        if (!onLogin) {
          window.location.href = "/login";
        }
      }
    }
    throw new Error("Não autorizado");
  }
  if (res.status === 400) {
    const raw = await res.text();
    const message = parseApiErrorBody(raw, res.status);
    if (message.toLowerCase().includes("x-tenant")) {
      throw new Error(
        "Organização não selecionada. Aguarde o carregamento da conta ou escolha uma organização no menu."
      );
    }
    throw new Error(formatApiError(message));
  }
  if (res.status === 503) {
    const raw = await res.text();
    try {
      const json = JSON.parse(raw) as { code?: string; message?: string };
      if (json.code === "tenant_not_provisioned") {
        throw new Error(
          json.message ||
            "Banco do tenant não provisionado. Execute: php artisan tenants:provision --seed"
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("tenants:provision")) {
        throw e;
      }
    }
    throw new Error(formatApiError(parseApiErrorBody(raw, res.status)));
  }
  if (res.status === 422) {
    const raw = await res.text();
    throw new Error(formatApiError(parseApiErrorBody(raw, res.status)));
  }
  if (!res.ok) {
    const raw = await res.text();
    throw new Error(formatApiError(parseApiErrorBody(raw, res.status)));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json();
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
  requestOptions?: ApiRequestOptions
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: buildHeaders(
      options,
      token,
      true,
      requestOptions?.organizationId
    ),
  });
  return handleResponse<T>(res, requestOptions);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  requestOptions?: ApiRequestOptions
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    body: formData,
    headers: buildHeaders(
      {},
      undefined,
      false,
      requestOptions?.organizationId
    ),
  });
  return handleResponse<T>(res, requestOptions);
}

export async function checkAiEngineHealth(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const res = await fetch(`${AI_ENGINE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, message: "Motor de IA respondeu com erro." };
    }
    const data = (await res.json()) as { status?: string };
    if (data.status === "ok") {
      return { ok: true, message: "Motor de IA disponível." };
    }
    return { ok: false, message: "Resposta inesperada do motor de IA." };
  } catch {
    return {
      ok: false,
      message:
        "Motor de IA indisponível. Inicie apps/ai-engine na porta 8000 antes de importar.",
    };
  }
}

export type Contact = {
  id: string;
  display_name: string;
  channel: string;
  external_id?: string | null;
};

export type ConversationSummary = {
  id: string;
  twin_id: string;
  contact_id: string;
  channel: string;
  last_message_at: string | null;
  contact?: { id: string; display_name: string; channel: string };
};

export type ConversationDetail = {
  conversation: ConversationSummary;
  messages: { id: string; body: string; role: string; sent_at: string }[];
};

export const twinApi = {
  listTwins: (params?: { search?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.page) q.set("page", String(params.page));
    const qs = q.toString();
    return api<PaginatedTwins>(`/twins${qs ? `?${qs}` : ""}`);
  },
  getTwin: (id: string) => api<TwinDetail>(`/twins/${id}`),
  listImports: (twinId: string) =>
    api<{ data: ImportBatch[] }>(`/twins/${twinId}/imports`),
  createTwin: (body: Partial<Twin>) =>
    api<Twin>("/twins", { method: "POST", body: JSON.stringify(body) }),
  updateTwin: (id: string, body: Partial<Twin>) =>
    api<Twin>(`/twins/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTwin: (id: string) =>
    api<void>(`/twins/${id}`, { method: "DELETE" }),
  stats: (id: string) => api<TwinStats>(`/twins/${id}/stats`),
  dnaEvolution: (id: string) => api<DnaEvolution>(`/twins/${id}/dna/evolution`),
  playbooks: (id: string) => api<{ data: Playbook[] }>(`/twins/${id}/playbooks`),
  purge: (id: string) =>
    api<{ message: string }>(`/twins/${id}/purge`, { method: "POST" }),
  latestConsent: (type = "import", organizationId?: string | null) =>
    api<{ id: number }>(`/consent/latest?type=${encodeURIComponent(type)}`, {}, undefined, {
      organizationId,
    }),
  consent: (
    body: { type: string; text_version: string },
    organizationId?: string | null
  ) =>
    api<{ id: number }>("/consent", {
      method: "POST",
      body: JSON.stringify(body),
    }, undefined, { organizationId }),
  importFile: (formData: FormData, requestOptions?: ApiRequestOptions) =>
    apiUpload<ImportBatch>("/imports", formData, requestOptions),
  importStatus: (id: string) => api<ImportBatch>(`/imports/${id}`),
  suggest: (
    body: {
      twin_id: string;
      text: string;
      intensity?: number;
      seller_mode?: boolean;
      contact_id?: string;
      conversation_id?: string;
    },
    organizationId?: string | null
  ) =>
    api<SuggestionResponse>(
      "/suggest",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      undefined,
      { organizationId, softAuth: true }
    ),
  feedback: (id: string, status: "accepted" | "rejected", editedText?: string) =>
    api<{ id: string; status: string }>(`/suggestions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        ...(editedText ? { edited_text: editedText } : {}),
      }),
    }),
  explainSuggestion: (id: string) =>
    api<SuggestionExplain>(`/suggestions/${id}/explain`),
  listSuggestions: (params?: { twin_id?: string; status?: string; page?: number }) => {
    const q = new URLSearchParams();
    if (params?.twin_id) q.set("twin_id", params.twin_id);
    if (params?.status) q.set("status", params.status);
    if (params?.page) q.set("page", String(params.page));
    const qs = q.toString();
    return api<{ data: InboxSuggestion[]; total?: number }>(
      `/suggestions${qs ? `?${qs}` : ""}`
    );
  },
  sendSuggestion: (id: string, text?: string) =>
    api<InboxSuggestion>(`/suggestions/${id}/send`, {
      method: "POST",
      body: JSON.stringify(text ? { text } : {}),
    }),
  channelMetrics: (twinId?: string) =>
    api<ChannelMetrics>(
      `/channel-metrics${twinId ? `?twin_id=${twinId}` : ""}`
    ),
  suggestionMetrics: (twinId?: string) =>
    api<{
      total: number;
      pending: number;
      accepted: number;
      sent: number;
      rejected: number;
      accept_rate: number | null;
    }>(`/suggestions/metrics${twinId ? `?twin_id=${twinId}` : ""}`),
  getPlan: () => api<PlanSummary>("/plan"),
  listChannelCredentials: () => api<ChannelCredential[]>("/channel-credentials"),
  createChannelCredential: (body: {
    twin_id: string;
    channel: string;
    credentials: Record<string, string>;
    reply_mode?: ChannelReplyMode | "approval";
    confidence_threshold?: number;
  }) =>
    api<ChannelCredential>("/channel-credentials", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateChannelCredential: (
    id: string,
    body: Partial<{
      is_active: boolean;
      reply_mode: ChannelReplyMode | "approval";
      confidence_threshold: number;
      credentials: Record<string, string>;
    }>
  ) =>
    api<ChannelCredential>(`/channel-credentials/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteChannelCredential: (id: string) =>
    api<void>(`/channel-credentials/${id}`, { method: "DELETE" }),
  resyncPlaybooks: (twinId: string) =>
    api<{ message: string }>(`/twins/${twinId}/playbooks/resync`, { method: "POST" }),
  trainTrigger: (body: { twin_id: string; type: "dna_extract" | "reindex" | "incremental" }) =>
    api<TrainingJob>("/train/trigger", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  trainJobStatus: (id: string) => api<TrainingJob>(`/train/jobs/${id}`),
  timeline: (twinId?: string) =>
    api<{ data: TimelineEvent[] }>(
      `/timeline${twinId ? `?twin_id=${twinId}` : ""}`
    ),
  listApiKeys: () => api<{ data: ApiKeyRow[] }>("/api-keys"),
  createApiKey: (name: string) =>
    api<{ key: string; prefix: string; message: string }>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  revokeApiKey: (id: number) =>
    api<void>(`/api-keys/${id}`, { method: "DELETE" }),
  listOrganizations: () => api<{ data: Organization[] }>("/organizations"),
  switchOrganization: (organizationId: string) =>
    api<{ organization: Organization }>("/organizations/switch", {
      method: "POST",
      body: JSON.stringify({ organization_id: organizationId }),
    }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    organization_name: string;
  }) =>
    api<{ token: string; organization: Organization }>("/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forgotPassword: (email: string) =>
    api<{ message: string }>("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (body: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    api<{ message: string }>("/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  twoFactorStatus: () =>
    api<{ enabled: boolean }>("/two-factor/status"),
  twoFactorEnable: () =>
    api<{ secret: string; qr_url: string; recovery_codes: string[] }>(
      "/two-factor/enable",
      { method: "POST" }
    ),
  twoFactorConfirm: (code: string) =>
    api<{ message: string }>("/two-factor/confirm", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  twoFactorDisable: (password: string) =>
    api<{ message: string }>("/two-factor", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
  billingSubscription: () =>
    api<{ subscription: unknown; stripe_configured: boolean }>(
      "/billing/subscription"
    ),
  billingPlans: () => api<{ data: unknown[] }>("/billing/plans"),
  billingCheckout: (planSlug: string) =>
    api<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan_slug: planSlug }),
    }),
  billingPortal: () =>
    api<{ portal_url: string }>("/billing/portal", { method: "POST" }),
  lgpdRetention: () =>
    api<{ days: number; auto_purge: boolean; description: string }>(
      "/lgpd/retention"
    ),
  lgpdRequestExport: () =>
    api<{ id: number; status: string; message: string }>("/lgpd/export", {
      method: "POST",
    }),
  lgpdExportStatus: (id: number) =>
    api<{ id: number; status: string; download_url: string | null }>(
      `/lgpd/exports/${id}`
    ),
  lgpdAccountDeletion: (reason?: string) =>
    api<{ message: string }>("/lgpd/account-deletion", {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  webhookSettings: () =>
    api<{ webhook_url: string | null; webhook_events: string[]; enabled: boolean }>(
      "/webhooks/settings"
    ),
  updateWebhookSettings: (body: {
    webhook_url?: string | null;
    webhook_events?: string[];
  }) =>
    api<{ message: string }>("/webhooks/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  testWebhook: () =>
    api<{ ok: boolean; status?: number }>("/webhooks/test", { method: "POST" }),
  listContacts: (search?: string) =>
    api<{ data: Contact[] }>(
      `/contacts${search ? `?search=${encodeURIComponent(search)}` : ""}`
    ),
  createContact: (body: Partial<Contact>) =>
    api<Contact>("/contacts", { method: "POST", body: JSON.stringify(body) }),
  listConversations: (twinId?: string) =>
    api<{ data: ConversationSummary[] }>(
      `/conversations${twinId ? `?twin_id=${twinId}` : ""}`
    ),
  getConversation: (id: string) =>
    api<ConversationDetail>(`/conversations/${id}`),
  createPlaybook: (
    twinId: string,
    body: { intent: string; template: string; vertical?: string }
  ) =>
    api<Playbook>(`/twins/${twinId}/playbooks`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePlaybook: (
    twinId: string,
    playbookId: number,
    body: Partial<Playbook>
  ) =>
    api<Playbook>(`/twins/${twinId}/playbooks/${playbookId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePlaybook: (twinId: string, playbookId: number) =>
    api<void>(`/twins/${twinId}/playbooks/${playbookId}`, { method: "DELETE" }),
  twinTrain: (twinId: string) =>
    api<TwinTrainResponse>(`/twins/${twinId}/train`, { method: "POST" }),
  twinReplay: (
    twinId: string,
    body: { text: string; intensity?: number; seller_mode?: boolean }
  ) =>
    api<TwinReplayResponse>(`/twins/${twinId}/replay`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listMemoryEntities: (twinId: string) =>
    api<{ data: MemoryEntity[] }>(`/twins/${twinId}/memory-entities`),
  createMemoryEntity: (
    twinId: string,
    body: { type: string; label: string; content?: string }
  ) =>
    api<MemoryEntity>(`/twins/${twinId}/memory-entities`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  apiDocs: () =>
    api<{ title: string; openapi: string; swagger_ui: string }>("/docs"),
};
