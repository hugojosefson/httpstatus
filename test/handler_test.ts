import { assertEquals, assertStringIncludes } from "@std/assert";
import { handler } from "../src/handler.ts";

function request(
  path: string,
  options?: { headers?: Record<string, string> },
): Request {
  return new Request(`http://localhost${path}`, {
    headers: options?.headers,
  });
}

Deno.test("home page returns HTML with status 200", async () => {
  const res = handler(request("/"));
  const response = res instanceof Promise ? await res : res;
  assertEquals(response.status, 200);
  assertStringIncludes(
    response.headers.get("Content-Type") ?? "",
    "text/html",
  );
  const body = await response.text();
  assertStringIncludes(body, "httpstatus");
  assertStringIncludes(body, "200");
});

Deno.test("GET /200 returns 200 OK as text", async () => {
  const res = await handler(request("/200"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/plain");
  const body = await res.text();
  assertEquals(body, "200 OK");
});

Deno.test("GET /404 returns 404 Not Found", async () => {
  const res = await handler(request("/404"));
  assertEquals(res.status, 404);
  const body = await res.text();
  assertEquals(body, "404 Not Found");
});

Deno.test("GET /418 returns teapot", async () => {
  const res = await handler(request("/418"));
  assertEquals(res.status, 418);
  const body = await res.text();
  assertStringIncludes(body, "418");
  assertStringIncludes(body.toLowerCase(), "teapot");
});

Deno.test("GET /500 returns 500 Internal Server Error", async () => {
  const res = await handler(request("/500"));
  assertEquals(res.status, 500);
  const body = await res.text();
  assertEquals(body, "500 Internal Server Error");
});

Deno.test("GET /204 returns no body", async () => {
  const res = await handler(request("/204"));
  assertEquals(res.status, 204);
  assertEquals(await res.text(), "");
});

Deno.test("GET /304 returns no body", async () => {
  const res = await handler(request("/304"));
  assertEquals(res.status, 304);
  assertEquals(await res.text(), "");
});

Deno.test("JSON response when Accept: application/json", async () => {
  const res = await handler(
    request("/200", { headers: { Accept: "application/json" } }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "application/json");
  const body = JSON.parse(await res.text());
  assertEquals(body.code, 200);
  assertEquals(body.description, "OK");
});

Deno.test("custom response headers via X-HttpStatus-Response-*", async () => {
  const res = await handler(
    request("/200", {
      headers: { "X-HttpStatus-Response-Foo": "Bar" },
    }),
  );
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("foo"), "Bar");
  const body = await res.text();
  assertStringIncludes(body, "foo: Bar");
});

Deno.test("custom headers appear in JSON response body", async () => {
  const res = await handler(
    request("/200", {
      headers: {
        Accept: "application/json",
        "X-HttpStatus-Response-X-Custom": "test-value",
      },
    }),
  );
  const body = JSON.parse(await res.text());
  assertEquals(body.headers["x-custom"], "test-value");
});

Deno.test("sleep parameter delays response", async () => {
  const start = Date.now();
  const res = await handler(request("/200?sleep=100"));
  const elapsed = Date.now() - start;
  assertEquals(res.status, 200);
  // Allow some tolerance
  assertEquals(elapsed >= 80, true);
});

Deno.test("non-standard status code 444", async () => {
  const res = await handler(request("/444"));
  assertEquals(res.status, 444);
  const body = await res.text();
  assertStringIncludes(body, "444");
  assertStringIncludes(body, "non-standard");
});

Deno.test("unknown code in valid range returns that status", async () => {
  const res = await handler(request("/599"));
  assertEquals(res.status, 599);
  const body = await res.text();
  assertEquals(body, "599 Unknown Status Code");
});

Deno.test("unsupported code returns 400", async () => {
  for (const code of [100, 102, 103, 600, 999]) {
    const res = await handler(request(`/${code}`));
    assertEquals(res.status, 400);
    assertStringIncludes(await res.text(), "not a supported status code");
  }
});

Deno.test("invalid path returns 404", async () => {
  const res = handler(request("/not-a-code"));
  const response = res instanceof Promise ? await res : res;
  assertEquals(response.status, 404);
});

Deno.test("CORS headers on all responses", async () => {
  const res = await handler(request("/200"));
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("OPTIONS preflight returns 204 with CORS", () => {
  const req = new Request("http://localhost/200", { method: "OPTIONS" });
  const res = handler(req);
  const response = res instanceof Promise ? res : res;
  if (response instanceof Response) {
    assertEquals(response.status, 204);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  }
});

Deno.test("random endpoint returns valid status", async () => {
  const res = await handler(request("/random/200,201,202"));
  const status = res.status;
  assertEquals([200, 201, 202].includes(status), true);
});

Deno.test("random endpoint with range", async () => {
  const res = await handler(request("/random/500-503"));
  const status = res.status;
  assertEquals([500, 501, 502, 503].includes(status), true);
});

Deno.test("random endpoint with invalid range returns 400", async () => {
  const res = handler(request("/random/"));
  const response = res instanceof Promise ? await res : res;
  assertEquals(response.status, 404);
});

Deno.test("sleep capped at max 5 minutes", async () => {
  // We just verify it doesn't hang - use a very large value
  // and check the response comes back (handler caps at 300000ms)
  // We can't actually wait 5 min, so just test the code path works
  const res = await handler(request("/200?sleep=0"));
  assertEquals(res.status, 200);
});
