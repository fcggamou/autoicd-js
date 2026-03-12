// ─── Client Options ───

export interface AutoICDOptions {
  /** API key (starts with `sk_`). */
  apiKey: string;
  /** Base URL. Defaults to `https://autoicdapi.com`. */
  baseURL?: string;
  /** Default timeout in milliseconds. Defaults to 30_000. */
  timeout?: number;
  /** Custom fetch implementation (for testing or non-standard runtimes). */
  fetch?: typeof globalThis.fetch;
}

// ─── Coding ───

export interface CodeOptions {
  /** Number of top ICD-10 candidates per entity (1-25). Defaults to 5. */
  topK?: number;
  /** Include negated entities in results. Defaults to true. */
  includeNegated?: boolean;
}

export interface CodeMatch {
  /** ICD-10-CM code (e.g., `"E11.21"`). */
  code: string;
  /** Official code description. */
  description: string;
  /** Cosine similarity score (0-1). */
  similarity: number;
  /** `"high"` if above high-confidence threshold, else `"moderate"`. */
  confidence: "high" | "moderate";
  /** The index term that produced this match. */
  matched_term: string;
}

export interface CodingEntity {
  /** Entity text as extracted from the input. */
  entity_text: string;
  /** Character offset start in input text. */
  entity_start: number;
  /** Character offset end in input text. */
  entity_end: number;
  /** Whether this entity was negated in context. */
  negated: boolean;
  /** Entity refers to a past/resolved condition. */
  historical: boolean;
  /** Entity refers to a family member's condition. */
  family_history: boolean;
  /** Entity is hedged or uncertain. */
  uncertain: boolean;
  /** Severity modifier if detected (e.g., `"severe"`). */
  severity: string | null;
  /** Ranked ICD-10 code candidates. */
  codes: CodeMatch[];
  /** Source entity texts if this result was created by merging consecutive entities. */
  merged_from?: string[] | null;
  /** Original text before spell correction (null if no correction). */
  corrected_from?: string | null;
}

export interface CodingResponse {
  /** The input text that was processed. */
  text: string;
  /** Coding provider used. */
  provider: string;
  /** Total number of entities in results. */
  entity_count: number;
  /** Coding results per entity, sorted by position in text. */
  entities: CodingEntity[];
}

// ─── Code Search ───

export interface SearchOptions {
  /** Maximum number of results (1-100). Defaults to 20. */
  limit?: number;
  /** Number of results to skip (for pagination). Defaults to 0. */
  offset?: number;
}

export interface CodeDetail {
  /** ICD-10-CM code. */
  code: string;
  /** Abbreviated description. */
  short_description: string;
  /** Full official description. */
  long_description: string;
  /** Whether this is a billable (leaf) code. */
  is_billable: boolean;
}

export interface ChapterInfo {
  /** Chapter number (1-22). */
  number: number;
  /** Code range (e.g., `"E00-E89"`). */
  range: string;
  /** Chapter title. */
  title: string;
}

export interface CodeDetailFull extends CodeDetail {
  /** Synonyms grouped by source: `"snomed"`, `"umls"`, `"icd10_augmented"`. */
  synonyms: Record<string, string[]>;
  /** Cross-reference IDs grouped by source: `"snomed"` (SNOMED CT concept IDs), `"umls"` (UMLS CUIs). */
  cross_references: Record<string, string[]>;
  /** Parent code in the ICD-10 hierarchy, or `null` for top-level categories. */
  parent: CodeDetail | null;
  /** Direct child codes in the ICD-10 hierarchy. */
  children: CodeDetail[];
  /** ICD-10-CM chapter this code belongs to. */
  chapter: ChapterInfo | null;
  /** Code block range (e.g., `"E08-E13"`). */
  block: string | null;
}
export interface CodeSearchResponse {
  /** The search query that was used. */
  query: string;
  /** Number of results returned. */
  count: number;
  /** Matching ICD-10 codes. */
  codes: CodeDetail[];
}

// ─── Anonymization ───

export interface PIIEntity {
  /** Original PII text. */
  text: string;
  /** Character offset start. */
  start: number;
  /** Character offset end. */
  end: number;
  /** PII category (NAME, DATE, SSN, PHONE, EMAIL, ADDRESS, MRN, AGE). */
  label: string;
  /** Replacement token (e.g., `"[NAME]"`). */
  replacement: string;
}

export interface AnonymizeResponse {
  /** The input text that was processed. */
  original_text: string;
  /** Text with PII replaced by type labels. */
  anonymized_text: string;
  /** Number of PII entities detected. */
  pii_count: number;
  /** Detected PII spans with original offsets. */
  pii_entities: PIIEntity[];
}

// ─── Rate Limit ───

export interface RateLimit {
  /** Total requests allowed in the current period. */
  limit: number;
  /** Requests remaining. */
  remaining: number;
  /** UTC timestamp when the limit resets. */
  resetAt: Date;
}

// ─── Error ───

export interface ErrorBody {
  error: string;
  limit?: number;
  resetAt?: string;
}
