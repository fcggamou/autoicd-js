import type {
  AutoICDOptions,
  CodeOptions,
  CodingResponse,
  SearchOptions,
  CodeSearchResponse,
  CodeDetail,
  CodeDetailFull,
  AnonymizeResponse,
  RateLimit,
  ErrorBody,
} from "./types.js";
import {
  AutoICDError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from "./errors.js";

const DEFAULT_BASE_URL = "https://autoicdapi.com";
const DEFAULT_TIMEOUT = 30_000;

export class AutoICD {
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly _fetch: typeof globalThis.fetch;

  /** Rate limit info from the most recent API response. */
  lastRateLimit: RateLimit | null = null;

  /** Sub-resource for ICD-10 code lookup. */
  readonly codes: Codes;

  constructor(options: AutoICDOptions) {
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this._fetch = options.fetch ?? globalThis.fetch;
    this.codes = new Codes(this);
  }

  // ─── Public Methods ───

  /**
   * Code clinical text to ICD-10-CM diagnoses.
   *
   * @example
   * ```ts
   * const result = await autoicd.code("Patient has type 2 diabetes");
   * for (const entity of result.entities) {
   *   console.log(entity.entity_text, entity.codes[0]?.code);
   * }
   * ```
   */
  async code(text: string, options?: CodeOptions): Promise<CodingResponse> {
    return this.post<CodingResponse>("/api/v1/code", {
      text,
      top_k: options?.topK,
      include_negated: options?.includeNegated,
    });
  }

  /**
   * Anonymize PHI/PII in clinical text.
   *
   * @example
   * ```ts
   * const result = await autoicd.anonymize("John Smith, DOB 01/15/1980, has COPD");
   * console.log(result.anonymized_text);
   * // "[NAME], DOB [DATE], has COPD"
   * ```
   */
  async anonymize(text: string): Promise<AnonymizeResponse> {
    return this.post<AnonymizeResponse>("/api/v1/anonymize", { text });
  }

  // ─── Internal HTTP ───

  /** @internal */
  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /** @internal */
  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    // Strip undefined values so the API receives clean JSON
    const clean = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    );
    return this.request<T>("POST", path, clean);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await this._fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      // Parse rate limit headers
      this.lastRateLimit = parseRateLimit(res.headers);

      if (res.ok) {
        return (await res.json()) as T;
      }

      // Error responses
      const errorBody = (await res.json().catch(() => null)) as ErrorBody | null;
      const message = errorBody?.error ?? `HTTP ${res.status}`;

      if (res.status === 401) throw new AuthenticationError(message);
      if (res.status === 404) throw new NotFoundError(message);
      if (res.status === 429) {
        throw new RateLimitError(
          message,
          this.lastRateLimit ?? {
            limit: errorBody?.limit ?? 0,
            remaining: 0,
            resetAt: errorBody?.resetAt ? new Date(errorBody.resetAt) : new Date(),
          }
        );
      }

      throw new AutoICDError(res.status, message);
    } catch (err) {
      if (err instanceof AutoICDError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new AutoICDError(0, `Request timed out after ${this.timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// ─── Codes Sub-resource ───

class Codes {
  constructor(private readonly client: AutoICD) {}

  /**
   * Search ICD-10 codes by description.
   *
   * @example
   * ```ts
   * const results = await autoicd.codes.search("diabetes mellitus");
   * ```
   */
  async search(query: string, options?: SearchOptions): Promise<CodeSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    return this.client.get<CodeSearchResponse>(`/api/v1/codes/search?${params}`);
  }

  /**
   * Get comprehensive details for a single ICD-10 code, including synonyms,
   * hierarchy (parent/children), chapter, and SNOMED CT / UMLS cross-references.
   *
   * @example
   * ```ts
   * const detail = await autoicd.codes.get("E11.9");
   * console.log(detail.long_description);
   * console.log(detail.synonyms.snomed);  // SNOMED CT synonyms
   * console.log(detail.chapter?.title);   // "Endocrine, Nutritional and Metabolic Diseases"
   * console.log(detail.children.length);  // child codes
   * ```
   */
  async get(code: string): Promise<CodeDetailFull> {
    return this.client.get<CodeDetailFull>(`/api/v1/codes/${encodeURIComponent(code)}`);
  }

}

// ─── Helpers ───

function parseRateLimit(headers: Headers): RateLimit | null {
  const limit = headers.get("X-RateLimit-Limit");
  const remaining = headers.get("X-RateLimit-Remaining");
  const reset = headers.get("X-RateLimit-Reset");

  if (!limit || !remaining || !reset) return null;

  return {
    limit: parseInt(limit, 10),
    remaining: parseInt(remaining, 10),
    resetAt: new Date(reset),
  };
}
