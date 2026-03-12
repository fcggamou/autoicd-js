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
} from "./types.js";

export {
  AutoICDError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
} from "./errors.js";
