# AutoICD API — TypeScript SDK

[![npm version](https://img.shields.io/npm/v/autoicd.svg)](https://www.npmjs.com/package/autoicd)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)

Official TypeScript SDK for the [AutoICD API](https://autoicdapi.com) — AI medical coding that converts clinical text to ICD-10-CM, ICD-11, and ICF codes using medical NLP. Automate ICD-10 coding, ICF functioning classification, and disability assessment in your application.

Zero dependencies. Works in **Node.js 18+**, **Deno**, **Bun**, and **edge runtimes**.

> Built for EHR integrations, health-tech platforms, medical billing, clinical decision support, and revenue cycle management.

---

## Why AutoICD API

| | |
|---|---|
| **AI-Powered ICD-10, ICD-11 & ICF Coding** | Clinical NLP extracts diagnoses from free-text notes and maps them to ICD-10-CM, ICD-11, or ICF codes — no manual lookup required |
| **Chart Audit with HCC Gap Capture** | Find missed HCCs, unsupported codes, and specificity upgrades with RAF-weighted revenue estimates (CMS v22 + v28 PY2026). Every finding carries evidence spans |
| **Cross-Standard Code Translation** | Map a code between ICD-10, ICD-11, SNOMED CT, UMLS, and ICF in one call. Forward ICD-10 → all other systems, plus reverse ICD-11 → ICD-10 and ICF → ICD-10 |
| **74,000+ ICD-10-CM Codes** | Full 2025 code set enriched with SNOMED CT synonyms for comprehensive matching |
| **ICD-11 Support** | Search and look up ICD-11 codes, with full ICD-10 ↔ ICD-11 crosswalk mappings |
| **ICF Functioning Codes** | Code clinical text to WHO ICF categories, search 1,400+ codes, and access Core Sets for 12+ conditions |
| **Negation & Context Detection** | Knows the difference between "patient has diabetes" and "patient denies diabetes" — flags negated, historical, uncertain, and family-history mentions |
| **PHI De-identification** | HIPAA-compliant anonymization of names, dates, SSNs, phone numbers, emails, addresses, MRNs, and ages |
| **Confidence Scoring** | Every code match includes a similarity score and confidence level so you can set your own acceptance thresholds |
| **Spell Correction** | Handles misspellings in clinical text — "diabeties" still maps to the right code |
| **Fully Type-Safe** | Complete TypeScript definitions for all requests and responses |
| **Zero Dependencies** | Lightweight, no bloat, no supply-chain risk |

---

## Install

```bash
npm install autoicd
```

<details>
<summary>yarn / pnpm / bun</summary>

```bash
yarn add autoicd
pnpm add autoicd
bun add autoicd
```

</details>

---

## Quick Start

```ts
import { AutoICD } from "autoicd";

const autoicd = new AutoICD({ apiKey: "sk_..." });

const result = await autoicd.code(
  "Patient has type 2 diabetes and essential hypertension"
);

for (const entity of result.entities) {
  console.log(entity.entity_text, "→", entity.codes[0]?.code);
}
// "type 2 diabetes"       → "E11.9"
// "essential hypertension" → "I10"
```

---

## Features

### Chart Audit (HCC gap capture, RADV defense, specificity, denial risk)

Audit a chart to surface coding gaps, unsupported codes, specificity upgrades, and denial-risk flags in a single call. Every finding carries extractive evidence spans pointing back to the source text, and HCC gaps include RAF-weighted revenue estimates using the CMS PY2026 V22 and V28 community models.

```ts
const audit = await autoicd.audit({
  text:
    "68yo M, type 2 diabetes stable on metformin, chronic systolic heart failure " +
    "on furosemide, edema controlled. A1c 7.4 today.",
  codes: [{ code: "E11.9", kind: "icd10" }],
  capabilities: ["hcc", "radv", "specificity", "denial", "problem_list"],
  context: {
    patient: { coverage: "medicare_advantage" },
    hcc_model: "both",
  },
});

console.log(`Missed revenue: $${audit.totals.estimated_revenue_recovery.toFixed(0)}`);
console.log(`RADV exposure:  $${audit.totals.radv_exposure.toFixed(0)}`);

for (const m of audit.missed) {
  console.log(
    `MISSED ${m.code} (${m.hcc_category ?? "non-HCC"} ${m.hcc_model ?? ""}) ` +
    `→ $${m.estimated_revenue?.toFixed(0) ?? 0}: ${m.description}`
  );
  for (const span of m.evidence) {
    console.log(`    evidence: "${span.quote}" [${span.start}-${span.end}]`);
  }
}
```

| Capability | What it surfaces |
|---|---|
| `hcc` | Missed HCC codes with `hcc_category`, `raf_weight`, `estimated_revenue` per v22/v28 model |
| `radv` | Submitted codes with no supporting documentation, with `what_would_support_it` guidance and exposure dollars |
| `specificity` | Upgrade opportunities from unspecified to more specific child codes |
| `denial` | Documentation-quality risk flags (missing laterality, missing duration, age/sex mismatches) |
| `problem_list` | Deduplicated active-conditions list with status (active/historical) and evidence |

Default behavior runs all five capabilities. Pass `capabilities: ["hcc"]` to run a targeted audit.

> **`hcc_model`:** use `"v22"`, `"v28"`, or `"both"` (default). CMS PY2026 MA payment uses V22 and V28 as the two main community models. V24 is the ESRD-specific model and is not accepted here.

Read more about the Audit endpoint at [autoicdapi.com/audit](https://autoicdapi.com/audit).

### Cross-Standard Code Translation

Translate a code between healthcare coding systems in one call. Forward from ICD-10 to ICD-11, SNOMED CT, UMLS, and ICF, plus reverse ICD-11 → ICD-10 and ICF → ICD-10. Built on CMS-published crosswalks, code-level SNOMED / UMLS concept IDs, and WHO ICF Core Sets.

```ts
const mapping = await autoicd.translate({
  from: { code: "E11.9", system: "icd10" },
});

console.log(mapping.mappings.icd11);
// [{ code: "5A11", description: "Type 2 diabetes mellitus", mapping_type: "equivalent" }]
console.log(mapping.mappings.snomed);
// [{ code: "44054006" }, { code: "73211009" }, ...]
console.log(mapping.mappings.icf);
// [{ code: "b540", description: "General metabolic functions", component: "b" }, ...]
```

Narrow the targets when you only need specific systems:

```ts
const targeted = await autoicd.translate({
  from: { code: "I50.9", system: "icd10" },
  to: ["icd11"],
});
```

Requested systems that aren't reachable from the source are returned in `unsupported_targets[]` rather than as errors, so clients can request a broad target list and use whatever comes back.

| From | To | Source |
|------|----|--------|
| ICD-10-CM | ICD-11, SNOMED, UMLS, ICF | CMS crosswalk + concept refsets + WHO Core Sets |
| ICD-11 MMS | ICD-10-CM | Reverse CMS crosswalk |
| ICF | ICD-10-CM | Reverse WHO ICF Core Set index |

Read more about the Translate endpoint at [autoicdapi.com/interop](https://autoicdapi.com/interop).

### Automated ICD-10 Medical Coding

Extract diagnosis entities from clinical notes and map them to ICD-10-CM codes. Each entity includes ranked candidates with confidence scores, negation status, and context flags.

```ts
const result = await autoicd.code(
  "History of severe COPD with acute exacerbation. Patient denies chest pain."
);

for (const entity of result.entities) {
  console.log(entity.entity_text);
  console.log(`  Negated: ${entity.negated}`);
  console.log(`  Historical: ${entity.historical}`);
  for (const match of entity.codes) {
    console.log(
      `  ${match.code} — ${match.description} (${match.confidence}, ${(match.similarity * 100).toFixed(1)}%)`
    );
  }
}
```

Fine-tune results with coding options:

```ts
const result = await autoicd.code(
  "Patient presents with acute bronchitis and chest pain",
  {
    topK: 3,               // Top 3 ICD-10 candidates per entity (default: 5)
    includeNegated: false, // Exclude negated conditions from results
  }
);
```

### ICD-10 Code Search

Search the full ICD-10-CM 2025 code set by description. Perfect for building code lookup UIs, autocomplete fields, and validation workflows.

```ts
const results = await autoicd.icd10.search("diabetes mellitus");
// results.codes → [{ code: "E11.9", short_description: "...", long_description: "...", is_billable: true }, ...]

const results = await autoicd.icd10.search("heart failure", { limit: 5 });
```

### ICD-10 Code Details

Get full details for any ICD-10-CM code — descriptions, billable status, synonyms, hierarchy, and chapter classification.

```ts
const detail = await autoicd.icd10.get("E11.9");
console.log(detail.code);              // "E11.9"
console.log(detail.long_description);  // "Type 2 diabetes mellitus without complications"
console.log(detail.is_billable);       // true
console.log(detail.synonyms.snomed);   // ["Diabetes mellitus type 2", ...]
console.log(detail.chapter?.title);    // "Endocrine, Nutritional and Metabolic Diseases"
```

### ICD-11 Code Search

Search the ICD-11 code set by description. The AutoICD API includes the full WHO ICD-11 MMS hierarchy.

```ts
const results = await autoicd.icd11.search("diabetes mellitus");
// results.codes → [{ code: "5A11", short_description: "...", foundation_uri: "..." }, ...]

const results = await autoicd.icd11.search("heart failure", { limit: 5 });
```

### ICD-11 Code Details & Crosswalk

Get full details for any ICD-11 code — descriptions, Foundation URI, hierarchy, synonyms, and ICD-10 crosswalk mappings.

```ts
const detail = await autoicd.icd11.get("5A11");
console.log(detail.code);              // "5A11"
console.log(detail.short_description); // "Type 2 diabetes mellitus"
console.log(detail.foundation_uri);    // "http://id.who.int/icd/entity/1691003785"
console.log(detail.chapter?.title);    // "Endocrine, nutritional or metabolic diseases"

// ICD-10 crosswalk
for (const mapping of detail.icd10_mappings) {
  console.log(`${mapping.code} — ${mapping.description} (${mapping.mapping_type})`);
  // "E11.9 — Type 2 diabetes mellitus without complications (equivalent)"
}
```

### ICD-10 → ICD-11 Crosswalk

ICD-10 code details now include ICD-11 crosswalk mappings when available:

```ts
const detail = await autoicd.icd10.get("E11.9");
for (const mapping of detail.icd11_mappings ?? []) {
  console.log(`${mapping.code} — ${mapping.description}`);
  // "5A11 — Type 2 diabetes mellitus"
}
```

### ICF Functioning Codes

Code clinical text to WHO ICF categories, look up codes, search, and access ICF Core Sets for 12+ conditions.

```typescript
// Code clinical text to ICF categories
const icf = await client.icf.code("Patient with stroke and hemiplegia");
console.log(icf.results[0].codes);
// [{ code: "b730", description: "Muscle power functions", component: "b", ... }]

// Look up an ICF code
const code = await client.icf.lookup("d450");
console.log(code.title); // "Walking"
console.log(code.definition); // "Moving along a surface on foot..."

// Search ICF codes
const results = await client.icf.search("mobility");

// Get ICF Core Set for a diagnosis
const coreSet = await client.icf.coreSet("E11.9");
console.log(coreSet.conditionName); // "Diabetes Mellitus"
console.log(coreSet.brief); // [{ code: "b530", title: "Weight maintenance functions", ... }]
```

### PHI De-identification

Strip protected health information from clinical notes before storage or analysis. HIPAA-compliant de-identification for names, dates, SSNs, phone numbers, emails, addresses, MRNs, and ages.

```ts
const result = await autoicd.anonymize(
  "John Smith, DOB 01/15/1980, MRN 123456, has COPD"
);

console.log(result.anonymized_text);
// "[NAME], DOB [DATE], MRN [MRN], has COPD"

console.log(result.pii_count);    // 3
console.log(result.pii_entities); // [{ text: "John Smith", label: "NAME", ... }, ...]
```

---

## Common ICD-10 Codes

The SDK can code any of the 74,000+ ICD-10-CM codes. Here are some of the most commonly coded conditions:

| Condition | ICD-10 Code | Description |
|-----------|-------------|-------------|
| [Hypertension](https://autoicdapi.com/icd10/condition/hypertension) | [I10](https://autoicdapi.com/icd10/I10) | Essential (primary) hypertension |
| [Type 2 Diabetes](https://autoicdapi.com/icd10/condition/diabetes) | [E11.9](https://autoicdapi.com/icd10/E11.9) | Type 2 diabetes mellitus without complications |
| [Depression](https://autoicdapi.com/icd10/condition/depression) | [F32.9](https://autoicdapi.com/icd10/F32.9) | Major depressive disorder, single episode, unspecified |
| [Anxiety](https://autoicdapi.com/icd10/condition/anxiety) | [F41.1](https://autoicdapi.com/icd10/F41.1) | Generalized anxiety disorder |
| [Low Back Pain](https://autoicdapi.com/icd10/condition/back-pain) | [M54.5](https://autoicdapi.com/icd10/M54.5) | Low back pain |
| [COPD](https://autoicdapi.com/icd10/condition/copd) | [J44.9](https://autoicdapi.com/icd10/J44.9) | Chronic obstructive pulmonary disease, unspecified |
| [Heart Failure](https://autoicdapi.com/icd10/condition/heart-failure) | [I50.9](https://autoicdapi.com/icd10/I50.9) | Heart failure, unspecified |
| [UTI](https://autoicdapi.com/icd10/condition/urinary-tract-infection) | [N39.0](https://autoicdapi.com/icd10/N39.0) | Urinary tract infection, site not specified |
| [Pneumonia](https://autoicdapi.com/icd10/condition/pneumonia) | [J18.9](https://autoicdapi.com/icd10/J18.9) | Pneumonia, unspecified organism |
| [Atrial Fibrillation](https://autoicdapi.com/icd10/condition/atrial-fibrillation) | [I48.91](https://autoicdapi.com/icd10/I48.91) | Unspecified atrial fibrillation |
| [Obesity](https://autoicdapi.com/icd10/condition/obesity) | [E66.01](https://autoicdapi.com/icd10/E66.01) | Morbid (severe) obesity due to excess calories |
| [GERD](https://autoicdapi.com/icd10/condition/gerd) | [K21.9](https://autoicdapi.com/icd10/K21.9) | Gastro-esophageal reflux disease without esophagitis |
| [Hypothyroidism](https://autoicdapi.com/icd10/condition/hypothyroidism) | [E03.9](https://autoicdapi.com/icd10/E03.9) | Hypothyroidism, unspecified |
| [CKD](https://autoicdapi.com/icd10/condition/chronic-kidney-disease) | [N18.9](https://autoicdapi.com/icd10/N18.9) | Chronic kidney disease, unspecified |

Browse all 74,000+ codes in the [ICD-10-CM Code Directory](https://autoicdapi.com/icd10) or find codes by [condition](https://autoicdapi.com/icd10/condition).

---

## Use Cases

- **EHR / EMR Integration** — Auto-code clinical notes as providers type, reducing manual coding burden
- **Medical Billing & RCM** — Accelerate claim submission with accurate ICD-10 codes
- **Clinical Decision Support** — Map patient conditions to standardized codes for analytics and alerts
- **Health-Tech SaaS** — Add ICD-10 coding to your platform without building ML infrastructure
- **Clinical Research** — Extract and standardize diagnoses from unstructured medical records
- **Insurance & Payer Systems** — Validate and suggest diagnosis codes during claims processing
- **Telehealth Platforms** — Generate diagnosis codes from visit notes and transcriptions

---

## Error Handling

```ts
import {
  AutoICD,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from "autoicd";

try {
  await autoicd.code("...");
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid or revoked API key (401)
  } else if (err instanceof RateLimitError) {
    // Request limit exceeded (429)
    console.log(err.rateLimit.remaining, err.rateLimit.resetAt);
  } else if (err instanceof NotFoundError) {
    // ICD-10 code not found (404)
  }
}
```

Rate limit info is available after every request:

```ts
await autoicd.code("...");
console.log(autoicd.lastRateLimit);
// { limit: 1000, remaining: 987, resetAt: Date }
```

---

## Configuration

```ts
const autoicd = new AutoICD({
  apiKey: "sk_...",             // Required — get yours at https://autoicdapi.com
  baseURL: "https://...",      // Default: https://autoicdapi.com
  timeout: 60_000,             // Default: 30000ms
  fetch: customFetch,          // Custom fetch (for testing or non-standard runtimes)
});
```

---

## API Reference

Full REST API documentation at [autoicdapi.com/docs](https://autoicdapi.com/docs).

| Method | Description |
|--------|-------------|
| `autoicd.code(text, options?)` | Code clinical text to ICD-10-CM diagnoses |
| `autoicd.anonymize(text)` | De-identify PHI/PII in clinical text |
| `autoicd.icd10.search(query, options?)` | Search ICD-10-CM codes by description |
| `autoicd.icd10.get(code)` | Get details for an ICD-10-CM code (incl. ICD-11 crosswalk) |
| `autoicd.icd11.search(query, options?)` | Search ICD-11 codes by description |
| `autoicd.icd11.get(code)` | Get details for an ICD-11 code (incl. ICD-10 crosswalk) |
| `autoicd.icf.code(text, options?)` | Code clinical text to ICF functioning categories |
| `autoicd.icf.lookup(code)` | Get details for an ICF code |
| `autoicd.icf.search(query, options?)` | Search ICF codes by keyword |
| `autoicd.icf.coreSet(icd10Code)` | Get ICF Core Set for an ICD-10 diagnosis |

---

## TypeScript Types

All request and response types are exported:

```ts
import type {
  CodingResponse,
  CodingEntity,
  CodeMatch,
  CodeOptions,
  CodeDetail,
  CodeSearchResponse,
  AnonymizeResponse,
  PIIEntity,
  RateLimit,
  ICD11CodeDetail,
  ICD11CodeDetailFull,
  ICD11CodeSearchResponse,
  CrosswalkMapping,
  ICFCodingResponse,
  ICFCodeDetail,
  ICFCodeSearchResponse,
  ICFCoreSetResponse,
} from "autoicd";
```

---

## Requirements

- **Node.js 18+**, Deno, Bun, or any runtime with `fetch` support
- An API key from [autoicdapi.com](https://autoicdapi.com)

---

## Links

- [AutoICD API](https://autoicdapi.com) — Homepage and API key management
- [API Documentation](https://autoicdapi.com/docs) — Full REST API reference
- [ICD-10-CM Code Directory](https://autoicdapi.com/icd10) — Browse all 74,000+ diagnosis codes
- [ICD-11 Code Directory](https://autoicdapi.com/icd11) — Browse the WHO ICD-11 MMS hierarchy
- [ICD-10 ↔ ICD-11 Crosswalk](https://autoicdapi.com/icd10-to-icd11) — Map codes between revisions
- [ICD-10 Codes by Condition](https://autoicdapi.com/icd10/condition) — Find codes for common conditions
- [Python SDK](https://pypi.org/project/autoicd/) — `pip install autoicd`
- [MCP Server](https://www.npmjs.com/package/autoicd-mcp) — For Claude Desktop, Cursor, VS Code
- [SNOMED CT & UMLS Cross-References](https://autoicdapi.com/snomed-ct-umls) — Terminology mappings
- [ICD-10-CM 2025 Code Set](https://www.cms.gov/medicare/coding-billing/icd-10-codes) — Official CMS reference

---

## License

MIT
