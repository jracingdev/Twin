export interface TwinClientOptions {
  baseUrl: string;
  apiKey?: string;
  token?: string;
}

export class TwinClient {
  constructor(private options: TwinClientOptions) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (this.options.token) h["Authorization"] = `Bearer ${this.options.token}`;
    if (this.options.apiKey) h["X-Api-Key"] = this.options.apiKey;
    return h;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers || {}) },
    });
    if (!res.ok) throw new Error(`TWIN API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  listTwins() {
    return this.request<{ data: unknown[] }>("/twins");
  }

  createTwin(body: {
    name: string;
    intensity?: number;
    seller_mode?: boolean;
    vertical?: string;
  }) {
    return this.request("/twins", { method: "POST", body: JSON.stringify(body) });
  }

  getTwin(id: string) {
    return this.request(`/twins/${id}`);
  }

  suggest(body: {
    twin_id: string;
    text: string;
    contact_id?: string;
    intensity?: number;
    seller_mode?: boolean;
  }) {
    return this.request<{ suggested_text: string }>("/suggest", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  triggerTrain(twinId: string, type: "dna_extract" | "reindex" | "incremental") {
    return this.request("/train/trigger", {
      method: "POST",
      body: JSON.stringify({ twin_id: twinId, type }),
    });
  }

  purgeTwinData(id: string) {
    return this.request(`/twins/${id}/purge`, { method: "POST" });
  }
}

export default TwinClient;
