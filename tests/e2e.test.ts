/**
 * E2E sync tests — hit the live API and validate response shapes match SDK types.
 *
 * These tests catch drift between the API and SDK types. They use the test
 * API key from the monorepo CLAUDE.md and run against production.
 *
 * Run with:  AUTOICD_E2E=1 AUTOICD_TEST_API_KEY=sk_... npm test
 * Skip with: npm test  (skipped by default)
 */

import { describe, it, expect } from "vitest";
import { AutoICD } from "../src/index.js";
import type {
  CodingResponse,
  CodingEntity,
  CodeMatch,
  CodeSearchResponse,
  CodeDetail,
  CodeDetailFull,
  ChapterInfo,
  AnonymizeResponse,
  PIIEntity,
} from "../src/index.js";

const API_KEY = process.env.AUTOICD_TEST_API_KEY ?? "";
const RUN_E2E = process.env.AUTOICD_E2E === "1";

// ─── Helpers ───

function assertCodeMatch(match: CodeMatch): void {
  expect(typeof match.code).toBe("string");
  expect(match.code.length).toBeGreaterThan(0);
  expect(typeof match.description).toBe("string");
  expect(typeof match.similarity).toBe("number");
  expect(match.similarity).toBeGreaterThanOrEqual(0);
  expect(match.similarity).toBeLessThanOrEqual(1.01);
  expect(["high", "moderate"]).toContain(match.confidence);
  expect(typeof match.matched_term).toBe("string");
}

function assertCodingEntity(entity: CodingEntity): void {
  expect(typeof entity.entity_text).toBe("string");
  expect(typeof entity.entity_start).toBe("number");
  expect(typeof entity.entity_end).toBe("number");
  expect(typeof entity.negated).toBe("boolean");
  expect(typeof entity.historical).toBe("boolean");
  expect(typeof entity.family_history).toBe("boolean");
  expect(typeof entity.uncertain).toBe("boolean");
  expect(entity.severity === null || typeof entity.severity === "string").toBe(true);
  expect(Array.isArray(entity.codes)).toBe(true);
  for (const code of entity.codes) {
    assertCodeMatch(code);
  }
  // merged_from: optional, null or string[]
  if (entity.merged_from !== undefined && entity.merged_from !== null) {
    expect(Array.isArray(entity.merged_from)).toBe(true);
  }
  // corrected_from: optional, null or string
  if (entity.corrected_from !== undefined && entity.corrected_from !== null) {
    expect(typeof entity.corrected_from).toBe("string");
  }
}

function assertCodeDetail(detail: CodeDetail): void {
  expect(typeof detail.code).toBe("string");
  expect(typeof detail.short_description).toBe("string");
  expect(typeof detail.long_description).toBe("string");
  expect(typeof detail.is_billable).toBe("boolean");
}

function assertChapterInfo(chapter: ChapterInfo): void {
  expect(typeof chapter.number).toBe("number");
  expect(chapter.number).toBeGreaterThanOrEqual(1);
  expect(chapter.number).toBeLessThanOrEqual(22);
  expect(typeof chapter.range).toBe("string");
  expect(typeof chapter.title).toBe("string");
}

function assertCodeDetailFull(detail: CodeDetailFull): void {
  // Basic fields
  assertCodeDetail(detail);

  // synonyms: Record<string, string[]>
  expect(typeof detail.synonyms).toBe("object");
  expect(detail.synonyms).not.toBeNull();
  for (const [source, terms] of Object.entries(detail.synonyms)) {
    expect(typeof source).toBe("string");
    expect(Array.isArray(terms)).toBe(true);
    for (const term of terms) {
      expect(typeof term).toBe("string");
    }
  }

  // cross_references: Record<string, string[]>
  expect(typeof detail.cross_references).toBe("object");
  expect(detail.cross_references).not.toBeNull();
  for (const [source, ids] of Object.entries(detail.cross_references)) {
    expect(typeof source).toBe("string");
    expect(Array.isArray(ids)).toBe(true);
    for (const id of ids) {
      expect(typeof id).toBe("string");
    }
  }

  // parent: CodeDetail | null
  if (detail.parent !== null) {
    assertCodeDetail(detail.parent);
  }

  // children: CodeDetail[]
  expect(Array.isArray(detail.children)).toBe(true);
  for (const child of detail.children) {
    assertCodeDetail(child);
  }

  // chapter: ChapterInfo | null
  if (detail.chapter !== null) {
    assertChapterInfo(detail.chapter);
  }

  // block: string | null
  expect(detail.block === null || typeof detail.block === "string").toBe(true);
}

function assertPIIEntity(entity: PIIEntity): void {
  expect(typeof entity.text).toBe("string");
  expect(typeof entity.start).toBe("number");
  expect(typeof entity.end).toBe("number");
  expect(typeof entity.label).toBe("string");
  expect(["NAME", "DATE", "SSN", "PHONE", "EMAIL", "ADDRESS", "MRN", "AGE"]).toContain(
    entity.label
  );
  expect(typeof entity.replacement).toBe("string");
}

// ─── Tests ───

describe.skipIf(!RUN_E2E)("E2E sync tests", () => {
  const client = new AutoICD({ apiKey: API_KEY, timeout: 60_000 });

  it("POST /code — response matches CodingResponse shape", async () => {
    const result: CodingResponse = await client.code(
      "Patient presents with type 2 diabetes and essential hypertension. No evidence of heart failure.",
      { topK: 3, includeNegated: true }
    );

    expect(typeof result.text).toBe("string");
    expect(typeof result.provider).toBe("string");
    expect(typeof result.entity_count).toBe("number");
    expect(result.entity_count).toBeGreaterThan(0);
    expect(Array.isArray(result.entities)).toBe(true);
    expect(result.entities.length).toBe(result.entity_count);

    for (const entity of result.entities) {
      assertCodingEntity(entity);
    }

    // Verify we got real codes back
    const allCodes = result.entities.flatMap((e) => e.codes.map((c) => c.code));
    expect(allCodes.length).toBeGreaterThan(0);

    // Should detect negation for "heart failure"
    const negated = result.entities.filter((e) => e.negated);
    expect(negated.length).toBeGreaterThan(0);
  });

  it("POST /anonymize — response matches AnonymizeResponse shape", async () => {
    const result: AnonymizeResponse = await client.anonymize(
      "John Smith, DOB 03/15/1980, was seen at 123 Main St for chronic obstructive pulmonary disease."
    );

    expect(typeof result.original_text).toBe("string");
    expect(typeof result.anonymized_text).toBe("string");
    expect(typeof result.pii_count).toBe("number");
    expect(result.pii_count).toBeGreaterThan(0);
    expect(Array.isArray(result.pii_entities)).toBe(true);

    for (const entity of result.pii_entities) {
      assertPIIEntity(entity);
    }

    // The anonymized text should contain replacement tokens
    expect(result.anonymized_text).toContain("[");
  });

  it("GET /codes/search — response matches CodeSearchResponse shape", async () => {
    const result: CodeSearchResponse = await client.codes.search("diabetes", { limit: 5 });

    expect(typeof result.query).toBe("string");
    expect(result.query).toBe("diabetes");
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.codes)).toBe(true);
    expect(result.codes.length).toBeLessThanOrEqual(5);

    for (const code of result.codes) {
      assertCodeDetail(code);
    }
  });

  it("GET /codes/:code — response matches CodeDetailFull shape", async () => {
    const result: CodeDetailFull = await client.codes.get("E11.9");

    assertCodeDetailFull(result);

    // Specific expectations for E11.9 (Type 2 diabetes)
    expect(result.code).toBe("E11.9");
    expect(result.is_billable).toBe(true);
    expect(result.chapter).not.toBeNull();
    expect(result.parent).not.toBeNull();

    // Must have cross_references (this caught the OpenAPI spec drift)
    expect(result.cross_references).toBeDefined();
    expect(typeof result.cross_references).toBe("object");

    // Must have synonyms
    expect(Object.keys(result.synonyms).length).toBeGreaterThan(0);
  });

  it("rate limit headers are parsed", async () => {
    await client.codes.search("test", { limit: 1 });

    expect(client.lastRateLimit).not.toBeNull();
    expect(typeof client.lastRateLimit!.limit).toBe("number");
    expect(typeof client.lastRateLimit!.remaining).toBe("number");
    expect(client.lastRateLimit!.resetAt).toBeInstanceOf(Date);
  });

  it("no unexpected extra fields in coding response", async () => {
    const result = await client.code("Patient has asthma", { topK: 1 });

    // Check top-level keys
    const allowedTopLevel = ["text", "provider", "entity_count", "entities"];
    for (const key of Object.keys(result)) {
      expect(allowedTopLevel).toContain(key);
    }

    // Check entity keys
    const allowedEntity = [
      "entity_text", "entity_start", "entity_end",
      "negated", "historical", "family_history", "uncertain", "severity",
      "codes", "merged_from", "corrected_from",
    ];
    for (const entity of result.entities) {
      for (const key of Object.keys(entity)) {
        expect(allowedEntity).toContain(key);
      }
    }

    // Check code match keys
    const allowedCode = ["code", "description", "similarity", "confidence", "matched_term"];
    for (const entity of result.entities) {
      for (const code of entity.codes) {
        for (const key of Object.keys(code)) {
          expect(allowedCode).toContain(key);
        }
      }
    }
  });

  it("no unexpected extra fields in code detail response", async () => {
    const result = await client.codes.get("I10");

    const allowedFull = [
      "code", "short_description", "long_description", "is_billable",
      "synonyms", "cross_references", "parent", "children", "chapter", "block",
    ];
    for (const key of Object.keys(result)) {
      expect(allowedFull).toContain(key);
    }
  });
});
