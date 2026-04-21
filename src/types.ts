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
  /** Output coding system: `"icd10"` (default) or `"icd11"`. */
  outputSystem?: "icd10" | "icd11";
  /** Include ICF functioning code results in the response. Defaults to false. */
  includeIcf?: boolean;
  /** Include ICD-11 crosswalk codes per ICD-10 match. Defaults to false. */
  includeIcd11?: boolean;
  /** Include SNOMED CT concept IDs per ICD-10 match. Defaults to false. */
  includeSnomed?: boolean;
  /** Include UMLS CUIs per ICD-10 match. Defaults to false. */
  includeUmls?: boolean;
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
  /** Mapped ICD-11 codes. */
  icd11_codes: string[];
  /** SNOMED CT concept IDs. */
  snomed_ids: string[];
  /** UMLS CUIs. */
  umls_cuis: string[];
  /** Related ICF category codes. */
  icf_categories: string[];
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
  /** LOINC lab code results. Only present when `includeLoinc` is true. */
  /** ICF functioning code results. Only present when `includeIcf` is true. */
  icf_entities?: ICFCodingEntity[];
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
  /** ICD-11 crosswalk mappings for this ICD-10 code. */
  icd11_mappings: CrosswalkMapping[];
  /** Related ICF categories from WHO Core Sets. */
  icf_categories: ICFCrossReference[];
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

// ─── ICD-11 ───

export interface ICD11CodeDetail {
  /** ICD-11 code (e.g., `"5A11"`). */
  code: string;
  /** Abbreviated description. */
  short_description: string;
  /** Full official description. */
  long_description: string;
  /** ICD-11 Foundation URI, or `null` if unavailable. */
  foundation_uri: string | null;
}

export interface ICD11ChapterInfo {
  /** Chapter number. */
  number: number;
  /** Chapter title. */
  title: string;
}

export interface CrosswalkMapping {
  /** Mapped code (ICD-10 or ICD-11). */
  code: string;
  /** Code description. */
  description: string;
  /** Mapping relationship: `"equivalent"`, `"narrower"`, `"broader"`, or `"approximate"`. */
  mapping_type: string;
  /** Target coding system: `"icd10"` or `"icd11"`. */
  system: string;
}

/** A related ICF category from WHO Core Sets. */
export interface ICFCrossReference {
  /** ICF code (e.g., "b5401"). */
  code: string;
  /** ICF code title. */
  title: string;
  /** Component letter: "b", "s", "d", or "e". */
  component: string;
}

export interface ICD11CodeDetailFull extends ICD11CodeDetail {
  /** Synonyms grouped by source. */
  synonyms: Record<string, string[]>;
  /** Cross-reference IDs grouped by source. */
  cross_references: Record<string, string[]>;
  /** Parent code in the ICD-11 hierarchy, or `null` for top-level categories. */
  parent: ICD11CodeDetail | null;
  /** Direct child codes in the ICD-11 hierarchy. */
  children: ICD11CodeDetail[];
  /** ICD-11 chapter this code belongs to. */
  chapter: ICD11ChapterInfo | null;
  /** Block within the chapter. */
  block: string | null;
  /** ICD-10 crosswalk mappings for this ICD-11 code. */
  icd10_mappings: CrosswalkMapping[];
  /** Related ICF categories (via ICD-10 bridge). */
  icf_categories: ICFCrossReference[];
}

export interface ICD11CodeSearchResult {
  /** ICD-11 code. */
  code: string;
  /** Abbreviated description. */
  short_description: string;
  /** Full official description. */
  long_description: string;
  /** ICD-11 Foundation URI, or `null` if unavailable. */
  foundation_uri: string | null;
}

export interface ICD11CodeSearchResponse {
  /** The search query that was used. */
  query: string;
  /** Number of results returned. */
  count: number;
  /** Matching ICD-11 codes. */
  codes: ICD11CodeSearchResult[];
}

// ─── ICF ───

export type ICFComponent = "b" | "s" | "d" | "e";

export interface ICFCodeSummary {
  /** ICF code (e.g., `"b280"`). */
  code: string;
  /** Code title. */
  title: string;
  /** ICF component: `"b"` (body functions), `"s"` (body structures), `"d"` (activities/participation), `"e"` (environmental factors). */
  component: ICFComponent;
  /** Number of direct child codes. */
  child_count: number;
}

export interface ICFCodeDetail {
  /** ICF code. */
  code: string;
  /** Code title. */
  title: string;
  /** Full definition text, or `null` if not available. */
  definition: string | null;
  /** ICF component. */
  component: ICFComponent;
  /** Chapter this code belongs to. */
  chapter: string;
  /** Parent code in the ICF hierarchy, or `null` for top-level. */
  parent: ICFCodeSummary | null;
  /** Direct child codes. */
  children: ICFCodeSummary[];
  /** Inclusion notes. */
  inclusions: string[];
  /** Exclusion notes. */
  exclusions: string[];
  /** Index terms for this code. */
  index_terms: string[];
  /** Related ICD-10 codes from WHO Core Sets. */
  icd10_mappings: CrosswalkMapping[];
  /** Related ICD-11 codes (via ICD-10 bridge). */
  icd11_mappings: CrosswalkMapping[];
  /** Cross-reference IDs: "snomed" (concept IDs), "umls" (CUIs). */
  cross_references: Record<string, string[]>;
}

export interface ICFCodeResult {
  /** Matched ICF code. */
  code: string;
  /** Code description. */
  description: string;
  /** ICF component. */
  component: ICFComponent;
  /** Cosine similarity score (0-1). */
  similarity: number;
  /** `"high"` if above high-confidence threshold, else `"moderate"`. */
  confidence: "high" | "moderate";
  /** The index term that produced this match. */
  matched_term: string;
  /** Related ICD-10 codes. */
  icd10_codes: string[];
  /** Related ICD-11 codes. */
  icd11_codes: string[];
  /** SNOMED CT concept IDs. */
  snomed_ids: string[];
  /** UMLS CUIs. */
  umls_cuis: string[];
}

export interface ICFCodingEntity {
  /** Entity text as extracted from the input. */
  entity_text: string;
  /** Ranked ICF code candidates. */
  codes: ICFCodeResult[];
}

export interface ICFCodingResponse {
  /** The input text that was processed. */
  text: string;
  /** Coding provider used. */
  provider: string;
  /** Total number of entities in results. */
  entity_count: number;
  /** Coding results per entity. */
  results: ICFCodingEntity[];
}

export interface ICFSearchResponse {
  /** The search query that was used. */
  query: string;
  /** Number of results returned. */
  count: number;
  /** Matching ICF codes. */
  codes: ICFCodeSummary[];
}

export interface ICFCoreSetResult {
  /** ICD-10 code used to look up the core set. */
  icd10_code: string;
  /** Condition name for this ICD-10 code. */
  condition_name: string;
  /** Brief ICF Core Set codes. */
  brief: ICFCodeSummary[];
  /** Comprehensive ICF Core Set codes. */
  comprehensive: ICFCodeSummary[];
}

// ─── LOINC ───

export interface LOINCCodeSummary {
  /** LOINC code (e.g., `"2345-7"`). */
  code: string;
  /** Primary description. */
  long_common_name: string;
  /** Abbreviated name. */
  short_name: string;
  /** LOINC class (e.g., `"CHEM"`). */
  class_name: string;
  /** 1=Lab, 2=Clinical, 3=Claims, 4=Surveys. */
  class_type: number;
  /** Order, Observation, or Both. */
  order_obs: string;
}

export interface LOINCCodeDetail {
  /** LOINC code. */
  code: string;
  /** Primary description. */
  long_common_name: string;
  /** Abbreviated name. */
  short_name: string;
  /** Display name. */
  display_name: string;
  /** Consumer-friendly name. */
  consumer_name: string;
  /** What is measured (e.g., `"Glucose"`). */
  component: string;
  /** Measurement property (e.g., `"MCnc"`). */
  property: string;
  /** Timing (e.g., `"Pt"` = point in time). */
  time_aspect: string;
  /** Specimen type (e.g., `"Ser/Plas"`). */
  system: string;
  /** Scale (e.g., `"Qn"` = quantitative). */
  scale_type: string;
  /** Method used. */
  method_type: string;
  /** LOINC class. */
  class_name: string;
  /** 1=Lab, 2=Clinical, 3=Claims, 4=Surveys. */
  class_type: number;
  /** Definition text, or `null`. */
  definition: string | null;
  /** Order, Observation, or Both. */
  order_obs: string;
  /** Synonym terms. */
  related_names: string[];
  /** Popularity rank. */
  common_test_rank: number;
  /** Order popularity rank. */
  common_order_rank: number;
  /** Cross-reference IDs: `"snomed"` (concept IDs), `"umls"` (CUIs). */
  cross_references: Record<string, string[]>;
}

export interface LOINCSearchResponse {
  /** The search query that was used. */
  query: string;
  /** Number of results returned. */
  count: number;
  /** Matching LOINC codes. */
  codes: LOINCCodeSummary[];
}

/** A single LOINC code match from the coding endpoint. */
export interface LOINCCodeResult {
  code: string;
  long_common_name: string;
  component: string;
  system: string;
  similarity: number;
  confidence: "high" | "moderate";
  matched_term: string;
  snomed_ids: string[];
  umls_cuis: string[];
}

/** LOINC coding results for a single extracted entity. */
export interface LOINCCodingEntity {
  entity_text: string;
  codes: LOINCCodeResult[];
}

/** Full LOINC coding response. */
export interface LOINCCodingResponse {
  text: string;
  provider: string;
  entity_count: number;
  results: LOINCCodingEntity[];
}

// ─── Chart Audit ───

/**
 * Audit capability selector. Defaults to all five when omitted.
 *
 * - `hcc`: missed HCC codes with RAF-weighted revenue estimates (v22/v28)
 * - `radv`: submitted codes that cannot be defended against RADV clawback
 * - `specificity`: suggestions to upgrade unspecified codes to more precise children
 * - `denial`: documentation-quality flags that correlate with claim denials
 * - `problem_list`: reconciled active-conditions list across the documentation
 */
export type AuditCapability =
  | "hcc"
  | "radv"
  | "specificity"
  | "denial"
  | "problem_list";

export interface AuditDocument {
  id: string;
  text: string;
  type?:
    | "progress_note"
    | "discharge_summary"
    | "h_and_p"
    | "operative_note"
    | "consult"
    | "other";
  date?: string;
}

export interface AuditCode {
  code: string;
  kind: "icd10" | "icd11" | "cpt" | "hcpcs";
}

export interface AuditContext {
  patient?: {
    age?: number;
    sex?: "male" | "female";
    coverage?:
      | "medicare_advantage"
      | "fee_for_service"
      | "medicaid"
      | "commercial"
      | "aco";
  };
  claim?: {
    date_of_service?: string;
    place_of_service?: string;
    provider_type?: string;
  };
  payer?: {
    id?: string;
    type?: string;
  };
  rates?: {
    cms_base_rate?: number;
    hospital_base_rate?: number;
    denial_rework_cost?: number;
  };
  /** Defaults to `"both"`. `"v24"` is ESRD-specific and NOT accepted; PY2026 MA payment uses v22 + v28. */
  hcc_model?: "v22" | "v28" | "both";
}

export interface AuditRequest {
  text?: string;
  documents?: AuditDocument[];
  codes?: AuditCode[];
  capabilities?: AuditCapability[];
  context?: AuditContext;
}

export interface EvidenceSpan {
  document_id: string;
  start: number;
  end: number;
  quote: string;
}

export interface ConfirmedCode {
  code: string;
  kind: string;
  description: string;
  evidence: EvidenceSpan[];
  confidence: number;
  hcc_category?: string;
  raf_weight?: number;
}

export interface MissedCode {
  code: string;
  kind: string;
  description: string;
  evidence: EvidenceSpan[];
  confidence: number;
  hcc_category?: string;
  raf_weight?: number;
  estimated_revenue?: number;
  hcc_model?: "v22" | "v28";
}

export interface UnsupportedCode {
  code: string;
  kind: string;
  description: string;
  reason: string;
  what_would_support_it: string;
  radv_risk: "high" | "moderate" | "low";
  estimated_exposure?: number;
}

export interface SpecificityUpgrade {
  from_code: string;
  to_code: string;
  from_description: string;
  to_description: string;
  evidence: EvidenceSpan[];
  mcc_cc_change?: {
    from: "none" | "cc" | "mcc";
    to: "none" | "cc" | "mcc";
  };
  drg_impact?: number;
}

export interface DenialRisk {
  code: string;
  kind: string;
  description: string;
  risk: "high" | "moderate" | "low";
  probability: number;
  reasons: string[];
}

export interface ProblemListEntry {
  condition: string;
  icd10_code: string;
  status: "active" | "resolved" | "historical";
  first_seen: { document_id: string; date?: string };
  last_seen: { document_id: string; date?: string };
  evidence: EvidenceSpan[];
}

export interface AuditTotals {
  missed_raf: number;
  estimated_revenue_recovery: number;
  radv_exposure: number;
  drg_upside: number;
  codes_confirmed: number;
  codes_missed: number;
  codes_unsupported: number;
  upgrades_available: number;
}

export interface RatesUsed {
  cms_base_rate: number;
  hospital_base_rate: number;
  source: "cms_national_2026" | "customer_provided";
  hcc_model: "v22" | "v28" | "both";
}

export interface AuditResponse {
  capabilities_run: AuditCapability[];
  confirmed: ConfirmedCode[];
  missed: MissedCode[];
  unsupported: UnsupportedCode[];
  specificity_upgrades: SpecificityUpgrade[];
  denial_risk: DenialRisk[];
  problem_list?: ProblemListEntry[];
  totals: AuditTotals;
  provider: string;
  rates_used: RatesUsed;
}

// ─── Error ───

export interface ErrorBody {
  error: string;
  limit?: number;
  resetAt?: string;
}
