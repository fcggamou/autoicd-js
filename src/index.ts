export { AutoICD } from "./client.js";

export type {
  AutoICDOptions,
  CodeOptions,
  CodeMatch,
  CodingEntity,
  CodingResponse,
  SearchOptions,
  CodeDetail,
  CodeDetailFull,
  ChapterInfo,
  CodeSearchResponse,
  PIIEntity,
  AnonymizeResponse,
  RateLimit,
  ICD11CodeDetail,
  ICD11ChapterInfo,
  CrosswalkMapping,
  ICD11CodeDetailFull,
  ICD11CodeSearchResult,
  ICD11CodeSearchResponse,
} from "./types.js";

export {
  AutoICDError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from "./errors.js";
