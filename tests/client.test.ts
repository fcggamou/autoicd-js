import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoICD, AuthenticationError, RateLimitError, NotFoundError, AutoICDError } from "../src/index.js";
import type { CodingResponse, CodeSearchResponse, AnonymizeResponse, CodeDetail, ICD11CodeSearchResponse, ICD11CodeDetailFull, AuditResponse, TranslateResponse } from "../src/index.js";

// ─── Mock Helpers ───

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: new Headers({
      "X-RateLimit-Limit": "1000",
      "X-RateLimit-Remaining": "999",
      "X-RateLimit-Reset": "2026-03-11T00:00:00Z",
      ...headers,
    }),
  });
}

function createClient(fetchFn: ReturnType<typeof vi.fn>) {
  return new AutoICD({
    apiKey: "sk_test1234",
    baseURL: "https://test.autoicdapi.com",
    fetch: fetchFn as typeof globalThis.fetch,
  });
}

// ─── Tests ───

describe("AutoICD", () => {
  it("throws if apiKey is empty", () => {
    expect(() => new AutoICD({ apiKey: "" })).toThrow("apiKey is required");
  });

  it("strips trailing slashes from baseURL", () => {
    const fetch = mockFetch(200, { text: "", provider: "", entity_count: 0, entities: [] });
    const client = new AutoICD({ apiKey: "sk_x", baseURL: "https://example.com///", fetch: fetch as typeof globalThis.fetch });
    client.code("test");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/example\.com\/api/),
      expect.anything()
    );
  });
});

describe("code()", () => {
  const mockResponse: CodingResponse = {
    text: "Patient has diabetes",
    provider: "default",
    entity_count: 1,
    entities: [
      {
        entity_text: "diabetes",
        entity_start: 12,
        entity_end: 20,
        negated: false,
        historical: false,
        family_history: false,
        uncertain: false,
        severity: null,
        codes: [
          {
            code: "E11.9",
            description: "Type 2 diabetes mellitus without complications",
            similarity: 0.92,
            confidence: "high",
            matched_term: "diabetes mellitus",
          },
        ],
      },
    ],
  };

  it("sends correct request and returns coding response", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.code("Patient has diabetes");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/code",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test1234",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ text: "Patient has diabetes" }),
      })
    );
    expect(result.entity_count).toBe(1);
    expect(result.entities[0].codes[0].code).toBe("E11.9");
  });

  it("sends options as snake_case fields", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.code("test", { topK: 3, includeNegated: false });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      text: "test",
      top_k: 3,
      include_negated: false,
    });
  });

  it("omits undefined options from body", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.code("test", { topK: 3 });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body).toEqual({ text: "test", top_k: 3 });
    expect(body).not.toHaveProperty("include_negated");
  });

  it("passes include flags to request body", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.code("Lab text", {
      includeLoinc: true,
      includeIcf: true,
      includeIcd11: true,
      includeSnomed: true,
      includeUmls: true,
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.include_loinc).toBe(true);
    expect(body.include_icf).toBe(true);
    expect(body.include_icd11).toBe(true);
    expect(body.include_snomed).toBe(true);
    expect(body.include_umls).toBe(true);
  });

  it("parses loinc_entities and icf_entities when present", async () => {
    const responseWithLoinc = {
      ...mockResponse,
      loinc_entities: [
        {
          entity_text: "hemoglobin A1c",
          codes: [
            {
              code: "4548-4",
              long_common_name: "Hemoglobin A1c/Hemoglobin.total in Blood",
              component: "Hemoglobin A1c",
              system: "Bld",
              similarity: 0.92,
              confidence: "high",
              matched_term: "hemoglobin a1c",
              snomed_ids: [],
              umls_cuis: [],
            },
          ],
        },
      ],
    };
    const fetch = mockFetch(200, responseWithLoinc);
    const client = createClient(fetch);

    const result = await client.code("Order hemoglobin A1c", { includeLoinc: true });
    expect(result.loinc_entities).toBeDefined();
    expect(result.loinc_entities![0].entity_text).toBe("hemoglobin A1c");
    expect(result.loinc_entities![0].codes[0].code).toBe("4548-4");
  });
});

describe("icd10.search()", () => {
  const mockResponse: CodeSearchResponse = {
    query: "diabetes",
    count: 1,
    codes: [
      { code: "E11.9", short_description: "T2DM", long_description: "Type 2 diabetes mellitus without complications", is_billable: true },
    ],
  };

  it("sends correct search request", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.icd10.search("diabetes");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd10/codes/search?q=diabetes",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.codes[0].code).toBe("E11.9");
  });

  it("includes limit param", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.icd10.search("diabetes", { limit: 5 });

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd10/codes/search?q=diabetes&limit=5",
      expect.anything()
    );
  });
});

describe("icd10.get()", () => {
  const mockResponse: CodeDetail = {
    code: "E11.9",
    short_description: "T2DM",
    long_description: "Type 2 diabetes mellitus without complications",
    is_billable: true,
  };

  it("fetches code details with URL encoding", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.icd10.get("E11.9");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd10/codes/E11.9",
      expect.anything()
    );
  });
});

describe("anonymize()", () => {
  const mockResponse: AnonymizeResponse = {
    original_text: "John Smith has COPD",
    anonymized_text: "[NAME] has COPD",
    pii_count: 1,
    pii_entities: [
      { text: "John Smith", start: 0, end: 10, label: "NAME", replacement: "[NAME]" },
    ],
  };

  it("sends anonymize request", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.anonymize("John Smith has COPD");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/anonymize",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ text: "John Smith has COPD" }),
      })
    );
    expect(result.pii_count).toBe(1);
    expect(result.anonymized_text).toBe("[NAME] has COPD");
  });
});

describe("audit()", () => {
  const mockResponse: AuditResponse = {
    capabilities_run: ["hcc"],
    confirmed: [
      {
        code: "E11.9",
        kind: "icd10",
        description: "Type 2 diabetes without complications",
        evidence: [{ document_id: "doc_0", start: 8, end: 23, quote: "type 2 diabetes" }],
        confidence: 0.97,
      },
    ],
    missed: [
      {
        code: "I50.9",
        kind: "icd10",
        description: "Heart failure, unspecified",
        evidence: [{ document_id: "doc_0", start: 28, end: 41, quote: "heart failure" }],
        confidence: 0.93,
        hcc_category: "HCC85",
        raf_weight: 0.323,
        estimated_revenue: 4264,
        hcc_model: "v22",
      },
    ],
    unsupported: [],
    specificity_upgrades: [],
    denial_risk: [],
    totals: {
      missed_raf: 0.323,
      estimated_revenue_recovery: 4264,
      radv_exposure: 0,
      drg_upside: 0,
      codes_confirmed: 1,
      codes_missed: 1,
      codes_unsupported: 0,
      upgrades_available: 0,
    },
    provider: "autoicd-audit-v0.2",
    rates_used: {
      cms_base_rate: 13200,
      hospital_base_rate: 6500,
      source: "cms_national_2026",
      hcc_model: "both",
    },
  };

  it("sends audit request and surfaces findings", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.audit({
      text: "pt has type 2 diabetes and heart failure",
      codes: [{ code: "E11.9", kind: "icd10" }],
      capabilities: ["hcc"],
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/audit",
      expect.objectContaining({ method: "POST" }),
    );
    const call = fetch.mock.calls[0]?.[1] as { body: string };
    const parsed = JSON.parse(call.body);
    expect(parsed.capabilities).toEqual(["hcc"]);
    expect(parsed.codes[0].code).toBe("E11.9");

    expect(result.missed).toHaveLength(1);
    expect(result.missed[0]?.hcc_category).toBe("HCC85");
    expect(result.missed[0]?.hcc_model).toBe("v22");
    expect(result.totals.estimated_revenue_recovery).toBe(4264);
  });

  it("passes context through to the request body", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.audit({
      text: "x",
      codes: [{ code: "E11.9", kind: "icd10" }],
      context: {
        patient: { coverage: "medicare_advantage" },
        hcc_model: "v28",
      },
    });

    const call = fetch.mock.calls[0]?.[1] as { body: string };
    const parsed = JSON.parse(call.body);
    expect(parsed.context.hcc_model).toBe("v28");
    expect(parsed.context.patient.coverage).toBe("medicare_advantage");
  });

  it("updates lastRateLimit from audit response headers", async () => {
    const fetch = mockFetch(200, mockResponse, {
      "X-RateLimit-Limit": "500",
      "X-RateLimit-Remaining": "123",
      "X-RateLimit-Reset": "2026-05-01T00:00:00Z",
    });
    const client = createClient(fetch);
    await client.audit({
      text: "x",
      codes: [{ code: "E11.9", kind: "icd10" }],
    });
    expect(client.lastRateLimit?.limit).toBe(500);
    expect(client.lastRateLimit?.remaining).toBe(123);
  });
});

describe("translate()", () => {
  const mockResponse: TranslateResponse = {
    from: {
      code: "E11.9",
      system: "icd10",
      description: "Type 2 diabetes mellitus without complications",
    },
    mappings: {
      icd11: [{ code: "5A11", description: "Type 2 diabetes mellitus", mapping_type: "equivalent" }],
      snomed: [{ code: "44054006" }, { code: "73211009" }],
      umls: [{ code: "C0011860" }],
      icf: [
        { code: "b540", description: "General metabolic functions", component: "b" },
      ],
    },
    unsupported_targets: [],
    provider: "autoicd-translate-v0.1",
  };

  it("sends translate request and returns mapping buckets", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.translate({
      from: { code: "E11.9", system: "icd10" },
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/translate",
      expect.objectContaining({ method: "POST" }),
    );
    const call = fetch.mock.calls[0]?.[1] as { body: string };
    const parsed = JSON.parse(call.body);
    expect(parsed.from.code).toBe("E11.9");
    expect(parsed.from.system).toBe("icd10");

    expect(result.mappings.icd11).toHaveLength(1);
    expect(result.mappings.snomed).toHaveLength(2);
    expect(result.mappings.icf?.[0]?.component).toBe("b");
    expect(result.provider).toBe("autoicd-translate-v0.1");
  });

  it("passes through narrowed to[] targets", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);
    await client.translate({
      from: { code: "E11.9", system: "icd10" },
      to: ["icd11", "snomed"],
    });
    const call = fetch.mock.calls[0]?.[1] as { body: string };
    const parsed = JSON.parse(call.body);
    expect(parsed.to).toEqual(["icd11", "snomed"]);
  });

  it("reports unsupported_targets when the server rejects them", async () => {
    const fetch = mockFetch(200, {
      ...mockResponse,
      mappings: { icd11: mockResponse.mappings.icd11 },
      unsupported_targets: ["snomed"],
    });
    const client = createClient(fetch);
    const result = await client.translate({
      from: { code: "E11.9", system: "icd10" },
      to: ["icd11", "snomed"],
    });
    expect(result.unsupported_targets).toContain("snomed");
  });
});

describe("icd11.search()", () => {
  const mockResponse: ICD11CodeSearchResponse = {
    query: "diabetes",
    count: 1,
    codes: [
      {
        code: "5A11",
        short_description: "Type 2 diabetes mellitus",
        long_description: "Type 2 diabetes mellitus",
        foundation_uri: "http://id.who.int/icd/entity/1691003785",
      },
    ],
  };

  it("sends correct search request", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.icd11.search("diabetes");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd11/codes/search?q=diabetes",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.codes[0].code).toBe("5A11");
    expect(result.codes[0].foundation_uri).toBe("http://id.who.int/icd/entity/1691003785");
  });

  it("includes limit param", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    await client.icd11.search("diabetes", { limit: 5 });

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd11/codes/search?q=diabetes&limit=5",
      expect.anything()
    );
  });
});

describe("icd11.get()", () => {
  const mockResponse: ICD11CodeDetailFull = {
    code: "5A11",
    short_description: "Type 2 diabetes mellitus",
    long_description: "Type 2 diabetes mellitus",
    foundation_uri: "http://id.who.int/icd/entity/1691003785",
    synonyms: { index_terms: ["DM2", "NIDDM"] },
    cross_references: { snomed: ["44054006"], umls: ["C0011860"] },
    parent: {
      code: "5A1",
      short_description: "Diabetes mellitus",
      long_description: "Diabetes mellitus",
      foundation_uri: null,
    },
    children: [],
    chapter: { number: 5, title: "Endocrine, nutritional or metabolic diseases" },
    block: "5A10-5A14",
    icd10_mappings: [
      {
        code: "E11.9",
        description: "Type 2 diabetes mellitus without complications",
        mapping_type: "equivalent",
        system: "icd10",
      },
    ],
  };

  it("fetches ICD-11 code details with URL encoding", async () => {
    const fetch = mockFetch(200, mockResponse);
    const client = createClient(fetch);

    const result = await client.icd11.get("5A11");

    expect(fetch).toHaveBeenCalledWith(
      "https://test.autoicdapi.com/api/v1/icd11/codes/5A11",
      expect.anything()
    );
    expect(result.code).toBe("5A11");
    expect(result.foundation_uri).toBe("http://id.who.int/icd/entity/1691003785");
    expect(result.parent?.code).toBe("5A1");
    expect(result.chapter?.number).toBe(5);
    expect(result.icd10_mappings[0].code).toBe("E11.9");
    expect(result.icd10_mappings[0].mapping_type).toBe("equivalent");
  });

  it("returns 404 for unknown ICD-11 code", async () => {
    const fetch = mockFetch(404, { error: "Code not found" });
    const client = createClient(fetch);

    await expect(client.icd11.get("INVALID")).rejects.toThrow(NotFoundError);
  });
});

describe("error handling", () => {
  it("throws AuthenticationError on 401", async () => {
    const fetch = mockFetch(401, { error: "Invalid API key" });
    const client = createClient(fetch);

    await expect(client.code("test")).rejects.toThrow(AuthenticationError);
  });

  it("throws RateLimitError on 429", async () => {
    const fetch = mockFetch(
      429,
      { error: "Rate limit exceeded", limit: 100, resetAt: "2026-03-11T00:00:00Z" },
      { "X-RateLimit-Remaining": "0" }
    );
    const client = createClient(fetch);

    try {
      await client.code("test");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      if (err instanceof RateLimitError) {
        expect(err.rateLimit.remaining).toBe(0);
      }
    }
  });

  it("throws NotFoundError on 404", async () => {
    const fetch = mockFetch(404, { error: "Code not found" });
    const client = createClient(fetch);

    await expect(client.icd10.get("INVALID")).rejects.toThrow(NotFoundError);
  });

  it("throws AutoICDError on other errors", async () => {
    const fetch = mockFetch(502, { error: "Pipeline unavailable" });
    const client = createClient(fetch);

    await expect(client.code("test")).rejects.toThrow(AutoICDError);
  });
});

describe("rate limit parsing", () => {
  it("populates lastRateLimit from response headers", async () => {
    const fetch = mockFetch(200, { text: "", provider: "", entity_count: 0, entities: [] });
    const client = createClient(fetch);

    await client.code("test");

    expect(client.lastRateLimit).toEqual({
      limit: 1000,
      remaining: 999,
      resetAt: new Date("2026-03-11T00:00:00Z"),
    });
  });

  it("sets lastRateLimit to null when headers are missing", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ text: "", provider: "", entity_count: 0, entities: [] }),
      headers: new Headers(),
    });
    const client = createClient(fetch);

    await client.code("test");

    expect(client.lastRateLimit).toBeNull();
  });
});
