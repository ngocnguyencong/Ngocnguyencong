import { describe, expect, it } from "vitest";

import { MAX_JSON_BODY_BYTES, readBoundedRequest } from "./request-body";

describe("readBoundedRequest", () => {
  it("preserves JSON and form-urlencoded bytes and parser headers", async () => {
    const requests = [
      new Request("https://app.test/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: ' { "email": "é", "space": true }\n',
      }),
      new Request("https://app.test/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "email=a%2Bb%40example.test&redirect=%2Fhome",
      }),
    ];

    for (const request of requests) {
      const expectedContentType = request.headers.get("content-type");
      const expectedBody = await request.text();
      const forwarded = new Request(request.url, {
        method: request.method,
        headers: { "content-type": expectedContentType ?? "" },
        body: expectedBody,
      });
      const result = await readBoundedRequest(forwarded);

      expect("request" in result).toBe(true);
      if ("request" in result) {
        expect(result.request.method).toBe("POST");
        expect(result.request.url).toBe(request.url);
        expect(result.request.headers.get("content-type")).toBe(expectedContentType);
        expect(await result.request.text()).toBe(expectedBody);
      }
    }
  });

  it("rejects a declared oversized body before reading its stream", async () => {
    let reads = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array([1]));
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("https://app.test/api/auth/callback/a.b", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);
    request.headers.set("content-length", String(MAX_JSON_BODY_BYTES + 1));

    const readsBefore = reads;
    const result = await readBoundedRequest(request);
    expect("response" in result && result.response.status).toBe(413);
    expect(reads).toBe(readsBefore);
  });

  it("rejects and cancels when actual chunked bytes exceed the limit", async () => {
    let reads = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(MAX_JSON_BODY_BYTES + 1));
        },
        cancel() {
          cancelled = true;
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("https://app.test/api/auth/callback/a.b", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": "1",
      },
      body,
      duplex: "half",
    } as RequestInit);

    const result = await readBoundedRequest(request);
    expect("response" in result && result.response.status).toBe(413);
    expect(reads).toBeLessThan(4);
    expect(cancelled).toBe(true);
  });
});
