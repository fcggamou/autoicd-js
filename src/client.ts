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
  ICD11CodeSearchResponse,
  ICD11CodeDetailFull,
  ICFCodingResponse,
  ICFCodeDetail,
  ICFSearchResponse,
  ICFCoreSetResult,
  LOINCCodeDetail,
  LOINCSearchResponse,
  LOINCCodingResponse,
  AuditRequest,
  AuditResponse,
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
  readonly icd10: ICD10Codes;

  /** Sub-resource for ICD-11 code lookup. */
  readonly icd11: ICD11Codes;

  /** Sub-resource for ICF code lookup and coding. */
  readonly icf: ICFCodes;

  /** Sub-resource for LOINC code lookup and coding. */
  readonly loinc: LOINCCodes;

  constructor(options: AutoICDOptions) {
    if (!options.apiKey) {
      throw new Error("apiKey is required");
    }
    this.apiKey = options.apiKey;
    this.baseURL = (options.baseURL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this._fetch = options.fetch ?? globalThis.fetch;
    this.icd10 = new ICD10Codes(this);
    this.icd11 = new ICD11Codes(this);
    this.icf = new ICFCodes(this);
    this.loinc = new LOINCCodes(this);
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
      output_system: options?.outputSystem,
      include_icf: options?.includeIcf,
      include_icd11: options?.includeIcd11,
      include_snomed: options?.includeSnomed,
      include_umls: options?.includeUmls,
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

  /**
   * Audit a chart for coding gaps, RADV risk, specificity, denial flags, and
   * a reconciled problem list. Every finding carries extractive evidence spans.
   *
   * @example
   * ```ts
   * const audit = await autoicd.audit({
   *   text: "68yo M, type 2 diabetes, chronic systolic heart failure on furosemide.",
   *   codes: [{ code: "E11.9", kind: "icd10" }],
   *   capabilities: ["hcc", "radv", "specificity", "denial", "problem_list"],
   *   context: { patient: { coverage: "medicare_advantage" } },
   * });
   * console.log(audit.totals.estimated_revenue_recovery);
   * for (const m of audit.missed) {
   *   console.log(`${m.code} ${m.hcc_category} $${m.estimated_revenue}`);
   * }
   * ```
   */
  async audit(request: AuditRequest): Promise<AuditResponse> {
    return this.post<AuditResponse>("/api/v1/audit", request as unknown as Record<string, unknown>);
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

// ─── ICD-10 Codes Sub-resource ───

class ICD10Codes {
  constructor(private readonly client: AutoICD) {}

  /**
   * Search ICD-10 codes by description.
   *
   * @example
   * ```ts
   * const results = await autoicd.icd10.search("diabetes mellitus");
   * ```
   */
  async search(query: string, options?: SearchOptions): Promise<CodeSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    return this.client.get<CodeSearchResponse>(`/api/v1/icd10/codes/search?${params}`);
  }

  /**
   * Get comprehensive details for a single ICD-10 code, including synonyms,
   * hierarchy (parent/children), chapter, and SNOMED CT / UMLS cross-references.
   *
   * @example
   * ```ts
   * const detail = await autoicd.icd10.get("E11.9");
   * console.log(detail.long_description);
   * console.log(detail.synonyms.snomed);  // SNOMED CT synonyms
   * console.log(detail.chapter?.title);   // "Endocrine, Nutritional and Metabolic Diseases"
   * console.log(detail.children.length);  // child codes
   * ```
   */
  async get(code: string): Promise<CodeDetailFull> {
    return this.client.get<CodeDetailFull>(`/api/v1/icd10/codes/${encodeURIComponent(code)}`);
  }

}

// ─── ICD-11 Codes Sub-resource ───

class ICD11Codes {
  constructor(private readonly client: AutoICD) {}

  /**
   * Search ICD-11 codes by description.
   *
   * @example
   * ```ts
   * const results = await autoicd.icd11.search("diabetes mellitus");
   * ```
   */
  async search(query: string, options?: SearchOptions): Promise<ICD11CodeSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    return this.client.get<ICD11CodeSearchResponse>(`/api/v1/icd11/codes/search?${params}`);
  }

  /**
   * Get comprehensive details for a single ICD-11 code, including synonyms,
   * hierarchy (parent/children), chapter, and ICD-10 crosswalk mappings.
   *
   * @example
   * ```ts
   * const detail = await autoicd.icd11.get("5A11");
   * console.log(detail.long_description);
   * console.log(detail.chapter?.title);
   * console.log(detail.icd10_mappings);
   * ```
   */
  async get(code: string): Promise<ICD11CodeDetailFull> {
    return this.client.get<ICD11CodeDetailFull>(`/api/v1/icd11/codes/${encodeURIComponent(code)}`);
  }
}

// ─── ICF Codes Sub-resource ───

class ICFCodes {
  constructor(private readonly client: AutoICD) {}

  /**
   * Code clinical text to ICF codes.
   *
   * @example
   * ```ts
   * const result = await autoicd.icf.code("Patient has difficulty walking");
   * for (const entity of result.results) {
   *   console.log(entity.entity_text, entity.codes[0]?.code);
   * }
   * ```
   */
  async code(text: string, options?: { topK?: number }): Promise<ICFCodingResponse> {
    return this.client.post<ICFCodingResponse>("/api/v1/icf/code", {
      text,
      top_k: options?.topK,
    });
  }

  /**
   * Get full details for a single ICF code, including definition,
   * hierarchy (parent/children), inclusions, exclusions, and index terms.
   *
   * @example
   * ```ts
   * const detail = await autoicd.icf.lookup("b280");
   * console.log(detail.title);
   * console.log(detail.definition);
   * console.log(detail.children.length);
   * ```
   */
  async lookup(code: string): Promise<ICFCodeDetail> {
    return this.client.get<ICFCodeDetail>(`/api/v1/icf/codes/${encodeURIComponent(code)}`);
  }

  /**
   * Search ICF codes by description.
   *
   * @example
   * ```ts
   * const results = await autoicd.icf.search("pain");
   * ```
   */
  async search(query: string, options?: SearchOptions): Promise<ICFSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    return this.client.get<ICFSearchResponse>(`/api/v1/icf/codes/search?${params}`);
  }

  /**
   * Get the ICF Core Set for an ICD-10 diagnosis code.
   *
   * @example
   * ```ts
   * const coreSet = await autoicd.icf.coreSet("M54.5");
   * console.log(coreSet.condition_name);
   * console.log(coreSet.brief.length, "brief codes");
   * console.log(coreSet.comprehensive.length, "comprehensive codes");
   * ```
   */
  async coreSet(icd10Code: string): Promise<ICFCoreSetResult> {
    return this.client.get<ICFCoreSetResult>(`/api/v1/icf/core-set/${encodeURIComponent(icd10Code)}`);
  }
}

// ─── LOINC Codes Sub-resource ───

class LOINCCodes {
  constructor(private readonly client: AutoICD) {}

  /**
   * Code clinical text to LOINC codes.
   *
   * Extracts lab tests, imaging orders, and clinical observations from
   * free text and matches to LOINC codes using NER + SapBERT embeddings.
   *
   * @example
   * ```ts
   * const result = await autoicd.loinc.code("Order CBC, glucose, and TSH");
   * for (const entity of result.results) {
   *   console.log(entity.entity_text, entity.codes[0]?.code);
   * }
   * ```
   */
  async code(text: string, options?: { topK?: number }): Promise<LOINCCodingResponse> {
    return this.client.post<LOINCCodingResponse>("/api/v1/loinc/code", {
      text,
      top_k: options?.topK,
    });
  }

  /**
   * Get full details for a single LOINC code, including 6-axis classification,
   * definition, related names, and cross-references.
   *
   * @example
   * ```ts
   * const detail = await autoicd.loinc.lookup("2345-7");
   * console.log(detail.long_common_name);
   * console.log(detail.component, detail.system);
   * ```
   */
  async lookup(code: string): Promise<LOINCCodeDetail> {
    return this.client.get<LOINCCodeDetail>(`/api/v1/loinc/codes/${encodeURIComponent(code)}`);
  }

  /**
   * Search LOINC codes by description.
   *
   * @example
   * ```ts
   * const results = await autoicd.loinc.search("glucose");
   * ```
   */
  async search(query: string, options?: SearchOptions): Promise<LOINCSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));
    return this.client.get<LOINCSearchResponse>(`/api/v1/loinc/codes/search?${params}`);
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
