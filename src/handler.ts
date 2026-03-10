import { ALL_STATUS_CODES, getStatus, isValidCode } from "./status-codes.ts";
import type { StatusEntry } from "./status-codes.ts";

const MAX_SLEEP_MS = 300_000; // 5 minutes

/** CORS headers applied to all responses. */
function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
  };
}

/** Parse sleep duration from query string or X-HttpStatus-Sleep header. */
function parseSleep(url: URL, headers: Headers): number {
  const sleepParam = url.searchParams.get("sleep") ??
    headers.get("X-HttpStatus-Sleep");
  if (sleepParam === null) return 0;
  const ms = parseInt(sleepParam, 10);
  if (isNaN(ms) || ms < 0) return 0;
  return Math.min(ms, MAX_SLEEP_MS);
}

/** Extract custom response headers from X-HttpStatus-Response-* request headers. */
function extractCustomHeaders(requestHeaders: Headers): Record<string, string> {
  const custom: Record<string, string> = {};
  const prefix = "x-httpstatus-response-";
  for (const [key, value] of requestHeaders.entries()) {
    if (key.toLowerCase().startsWith(prefix)) {
      const headerName = key.slice(prefix.length);
      if (headerName.length > 0) {
        custom[headerName] = value;
      }
    }
  }
  return custom;
}

/** Whether the client wants JSON. */
function wantsJson(headers: Headers): boolean {
  const accept = headers.get("Accept") ?? "";
  return accept.includes("application/json");
}

/** Build the response body for a status code request. */
function buildBody(
  entry: StatusEntry | undefined,
  code: number,
  customHeaders: Record<string, string>,
  json: boolean,
): string {
  const description = entry?.description ?? "Unknown Status Code";
  const nonStandard = entry?.nonStandard !== undefined
    ? " (non-standard status code)"
    : "";

  if (json) {
    const body: Record<string, unknown> = {
      code,
      description: `${description}${nonStandard}`,
    };
    if (Object.keys(customHeaders).length > 0) {
      body.headers = customHeaders;
    }
    return JSON.stringify(body);
  }

  let body = `${code} ${description}${nonStandard}`;
  const customEntries = Object.entries(customHeaders);
  if (customEntries.length > 0) {
    body += "\n" +
      customEntries.map(([k, v]) => `${k}: ${v}`).join("\n");
  }
  return body;
}

/** Parse a range spec like "200,201,500-504" into an array of codes. */
function parseRange(range: string): number[] {
  const codes: number[] = [];
  for (const part of range.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-", 2);
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          codes.push(i);
        }
      }
    } else {
      const code = parseInt(trimmed, 10);
      if (!isNaN(code)) {
        codes.push(code);
      }
    }
  }
  return codes;
}

/** Generate the home page HTML listing all supported status codes. */
function homePage(baseUrl: string): string {
  const standardEntries = ALL_STATUS_CODES.filter((e: StatusEntry) =>
    e.nonStandard === undefined
  );
  const nonStandardEntries = ALL_STATUS_CODES.filter((e: StatusEntry) =>
    e.nonStandard !== undefined
  );

  const renderEntry = (entry: StatusEntry): string => {
    const suffix = entry.nonStandard !== undefined
      ? " (non-standard status code)"
      : "";
    return `        <tr>
          <td><a href="/${entry.code}">${entry.code}</a></td>
          <td>${escapeHtml(entry.description)}${suffix}</td>
        </tr>`;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>httpstatus - HTTP Status Code Testing</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem 1rem; line-height: 1.6; color: #333; }
    h1 { border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 5px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    td, th { padding: 0.4rem 0.8rem; text-align: left; border-bottom: 1px solid #eee; }
    td:first-child { font-family: monospace; font-weight: bold; width: 4rem; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    h2 { margin-top: 2rem; }
    section { margin-bottom: 2rem; }
  </style>
</head>
<body>
  <h1>httpstatus</h1>
  <p>A simple service for generating HTTP status code responses, useful for testing how your scripts handle varying responses.</p>

  <section>
    <h2>Usage</h2>
    <p>Add the status code you want to the URL:</p>
    <pre><code>${escapeHtml(baseUrl)}/200</code></pre>

    <p>The response will be:</p>
    <pre><code>HTTP/1.1 {status code} {status description}
Content-Type: text/plain or application/json

{status code} {status description}</code></pre>
  </section>

  <section>
    <h2>JSON responses</h2>
    <p>Set the <code>Accept</code> header to <code>application/json</code> to get a JSON response.</p>
  </section>

  <section>
    <h2>Random responses</h2>
    <p>Use the <code>/random/{range}</code> endpoint to get a random status code from a set. Duplicate entries to increase their probability.</p>
    <pre><code>${escapeHtml(baseUrl)}/random/200,201,500-504</code></pre>
  </section>

  <section>
    <h2>Sleep / delay</h2>
    <p>Add a <code>sleep</code> query parameter (milliseconds, max 5 minutes) or set the <code>X-HttpStatus-Sleep</code> header:</p>
    <pre><code>${escapeHtml(baseUrl)}/200?sleep=5000</code></pre>
  </section>

  <section>
    <h2>Custom response headers</h2>
    <p>Send request headers with the <code>X-HttpStatus-Response-</code> prefix to have them included in the response. For example, <code>X-HttpStatus-Response-Foo: Bar</code> will add <code>Foo: Bar</code> to the response headers.</p>
  </section>

  <section>
    <h2>CORS</h2>
    <p>All endpoints allow all origins, headers, and HTTP methods.</p>
  </section>

  <section>
    <h2>Supported status codes</h2>
    <table>
      <thead><tr><th>Code</th><th>Description</th></tr></thead>
      <tbody>
${standardEntries.map(renderEntry).join("\n")}
      </tbody>
    </table>

    <h3>Non-standard status codes</h3>
    <table>
      <thead><tr><th>Code</th><th>Description</th></tr></thead>
      <tbody>
${nonStandardEntries.map(renderEntry).join("\n")}
      </tbody>
    </table>
  </section>

  <footer>
    <p>A reimplementation of <a href="https://httpstat.us">httpstat.us</a>. <a href="https://github.com/hugojosefson/httpstatus">Source on GitHub</a>.</p>
  </footer>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Main request handler. */
export function handler(request: Request): Response | Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  // Home page
  if (path === "/" || path === "") {
    const baseUrl = `${url.protocol}//${url.host}`;
    return new Response(homePage(baseUrl), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...corsHeaders(),
      },
    });
  }

  // Random endpoint: /random/{range}
  const randomMatch = path.match(/^\/random\/(.+)$/);
  if (randomMatch) {
    const range = decodeURIComponent(randomMatch[1]);
    const codes = parseRange(range);
    if (codes.length === 0) {
      return new Response("Invalid range specification", {
        status: 400,
        headers: { "Content-Type": "text/plain", ...corsHeaders() },
      });
    }
    const randomCode = codes[Math.floor(Math.random() * codes.length)];
    return handleStatusCode(randomCode, url, request.headers);
  }

  // Status code endpoint: /{code}
  const codeMatch = path.match(/^\/(\d{1,3})$/);
  if (codeMatch) {
    const code = parseInt(codeMatch[1], 10);
    return handleStatusCode(code, url, request.headers);
  }

  // Unknown path
  return new Response("Not Found\nTry visiting / for usage information.", {
    status: 404,
    headers: { "Content-Type": "text/plain", ...corsHeaders() },
  });
}

async function handleStatusCode(
  code: number,
  url: URL,
  requestHeaders: Headers,
): Promise<Response> {
  if (!isValidCode(code)) {
    return new Response(
      `${code} is not a supported status code. See / for the list of supported codes.`,
      {
        status: 400,
        headers: { "Content-Type": "text/plain", ...corsHeaders() },
      },
    );
  }

  const sleepMs = parseSleep(url, requestHeaders);
  if (sleepMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }

  const entry = getStatus(code);
  const customHeaders = extractCustomHeaders(requestHeaders);
  const json = wantsJson(requestHeaders);
  const body = buildBody(entry, code, customHeaders, json);

  const contentType = json ? "application/json" : "text/plain";

  const responseHeaders: Record<string, string> = {
    "Content-Type": contentType,
    ...corsHeaders(),
    ...customHeaders,
  };

  // 204 and 304 should not have a body
  const noBody = code === 204 || code === 304;

  return new Response(noBody ? null : body, {
    status: code,
    headers: responseHeaders,
  });
}
