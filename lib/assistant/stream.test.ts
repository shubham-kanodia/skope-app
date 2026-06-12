import { describe, expect, it } from "vitest";
import { sseDeltas } from "./stream";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const delta of sseDeltas(stream)) out.push(delta);
  return out;
}

const event = (content: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

describe("sseDeltas", () => {
  it("extracts delta text from SSE events", async () => {
    const stream = sseStream([event("Hello"), event(" world"), "data: [DONE]\n\n"]);
    expect(await collect(stream)).toEqual(["Hello", " world"]);
  });

  it("handles events split across network chunks", async () => {
    const full = event("Namaste") + event(" DPDP");
    // Split mid-JSON to simulate arbitrary chunking.
    const stream = sseStream([full.slice(0, 25), full.slice(25, 60), full.slice(60)]);
    expect((await collect(stream)).join("")).toBe("Namaste DPDP");
  });

  it("ignores comments, keep-alives, and malformed payloads", async () => {
    const stream = sseStream([
      ": keep-alive\n\n",
      "data: {not json}\n\n",
      `data: ${JSON.stringify({ choices: [{ delta: {} }] })}\n\n`,
      event("ok"),
    ]);
    expect(await collect(stream)).toEqual(["ok"]);
  });
});
