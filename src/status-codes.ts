/**
 * HTTP status codes and their descriptions.
 *
 * Standard codes come from @std/http/status.
 * Non-standard codes used by nginx, Cloudflare, AWS, etc. are listed here
 * as a supplement.
 */

import { STATUS_CODE, STATUS_TEXT } from "@std/http/status";

export interface StatusEntry {
  code: number;
  description: string;
  nonStandard?: true;
}

/**
 * Build the standard entries from @std/http/status.
 * STATUS_TEXT is keyed by status code number, values are description strings.
 */
const standardCodes: StatusEntry[] = Object.entries(STATUS_TEXT)
  .map(([codeStr, description]) => ({
    code: Number(codeStr),
    description: description as string,
  }))
  .sort((a, b) => a.code - b.code);

// Re-export for handler convenience
export { STATUS_CODE, STATUS_TEXT };

/**
 * Non-standard codes used by various servers and services.
 * These are not in the IANA registry but are commonly encountered.
 */
const nonStandardCodes: StatusEntry[] = [
  { code: 306, description: "Switch Proxy", nonStandard: true },
  {
    code: 419,
    description: "CSRF Token Missing or Expired",
    nonStandard: true,
  },
  { code: 420, description: "Enhance Your Calm", nonStandard: true },
  { code: 440, description: "Login Time-out", nonStandard: true },
  { code: 444, description: "No Response", nonStandard: true },
  { code: 449, description: "Retry With", nonStandard: true },
  {
    code: 450,
    description: "Blocked by Windows Parental Controls",
    nonStandard: true,
  },
  {
    code: 460,
    description: "Client closed the connection with AWS Elastic Load Balancer",
    nonStandard: true,
  },
  {
    code: 463,
    description:
      "The load balancer received an X-Forwarded-For request header with more than 30 IP addresses",
    nonStandard: true,
  },
  { code: 494, description: "Request header too large", nonStandard: true },
  { code: 495, description: "SSL Certificate Error", nonStandard: true },
  { code: 496, description: "SSL Certificate Required", nonStandard: true },
  {
    code: 497,
    description: "HTTP Request Sent to HTTPS Port",
    nonStandard: true,
  },
  { code: 498, description: "Invalid Token (Esri)", nonStandard: true },
  { code: 499, description: "Client Closed Request", nonStandard: true },
  {
    code: 520,
    description: "Web Server Returned an Unknown Error",
    nonStandard: true,
  },
  { code: 521, description: "Web Server Is Down", nonStandard: true },
  { code: 522, description: "Connection Timed out", nonStandard: true },
  { code: 523, description: "Origin Is Unreachable", nonStandard: true },
  { code: 524, description: "A Timeout Occurred", nonStandard: true },
  { code: 525, description: "SSL Handshake Failed", nonStandard: true },
  { code: 526, description: "Invalid SSL Certificate", nonStandard: true },
  { code: 527, description: "Railgun Error", nonStandard: true },
  { code: 530, description: "Origin DNS Error", nonStandard: true },
  {
    code: 561,
    description: "Unauthorized (AWS Elastic Load Balancer)",
    nonStandard: true,
  },
];

/** All supported status codes, standard first, then non-standard. */
export const ALL_STATUS_CODES: StatusEntry[] = [
  ...standardCodes,
  ...nonStandardCodes,
];

/** Lookup map from status code number to entry. */
export const STATUS_MAP: ReadonlyMap<number, StatusEntry> = new Map(
  ALL_STATUS_CODES.map((entry) => [entry.code, entry]),
);

/** Get a status entry by code number. Returns undefined for unknown codes. */
export function getStatus(code: number): StatusEntry | undefined {
  return STATUS_MAP.get(code);
}

/**
 * Check if a code can be used in a Deno Response.
 * Deno allows 101 and 200-599.
 */
export function isValidCode(code: number): boolean {
  return Number.isInteger(code) &&
    (code === 101 || (code >= 200 && code <= 599));
}

/**
 * Check if a value looks like a 3-digit HTTP status code number,
 * even if Deno can't serve it.
 */
export function isThreeDigitCode(code: number): boolean {
  return Number.isInteger(code) && code >= 100 && code <= 999;
}
