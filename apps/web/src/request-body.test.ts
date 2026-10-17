import { describe, expect, it } from "vitest";

import {
  RequestBodyTooLargeError,
  createConcurrentRequestGate,
  readBoundedFormData,
  readBoundedJson,
  readBoundedText,
} from "./request-body";

describe("bounded request bodies", () => {
  it("rejects a chunked body as soon as it exceeds the cap", async () => {
    let chunksRead = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new Uint8Array(6));
      },
    });
    const request = new Request("https://app.test/webhook", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    await expect(readBoundedText(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
    expect(chunksRead).toBeLessThan(4);
  });

  it("rejects a declared oversized body before reading it", async () => {
    const request = new Request("https://app.test/webhook", {
      method: "POST",
      headers: { "content-length": "100" },
      body: "small",
    });
    await expect(readBoundedText(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("preserves valid webhook text and multipart fields", async () => {
    const payload = '{"event":"é"}';
    await expect(
      readBoundedText(
        new Request("https://app.test/webhook", { method: "POST", body: payload }),
        128,
      ),
    ).resolves.toBe(payload);
    const form = new FormData();
    form.append("avatar", new File(["image"], "a.png", { type: "image/png" }));
    const parsed = await readBoundedFormData(
      new Request("https://app.test/upload", { method: "POST", body: form }),
      1024,
    );
    expect((parsed.get("avatar") as File).name).toBe("a.png");
  });

  it("parses bounded JSON and leaves malformed JSON as a syntax error", async () => {
    await expect(
      readBoundedJson(
        new Request("https://app.test/api", {
          method: "POST",
          body: JSON.stringify({ message: "é" }),
        }),
      ),
    ).resolves.toEqual({ message: "é" });
    await expect(
      readBoundedJson(new Request("https://app.test/api", { method: "POST", body: "{" })),
    ).rejects.toBeInstanceOf(SyntaxError);
  });
});

describe("outbound verification concurrency", () => {
  it("caps concurrent calls and releases a slot after completion", async () => {
    const gate = createConcurrentRequestGate(1);
    let release!: () => void;
    const first = gate.run(
      () =>
        new Promise<string>((resolve) => {
          release = () => resolve("done");
        }),
    );
    await expect(gate.run(async () => "second")).resolves.toBeNull();
    release();
    await expect(first).resolves.toBe("done");
    await expect(gate.run(async () => "second")).resolves.toBe("second");
  });
});
