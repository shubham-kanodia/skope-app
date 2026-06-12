import { describe, expect, it } from "vitest";
import { ZipBuilder, crc32 } from "./zip";

// Tiny reader: walks the central directory and extracts stored entries, so the
// test proves the archive parses by-the-spec, not just that bytes exist.
function parseZip(buf: Uint8Array): Map<string, { data: Uint8Array; crc: number }> {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // EOCD is the last 22 bytes (we write no comment).
  const eocd = buf.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  let pos = v.getUint32(eocd + 16, true); // central directory offset

  const out = new Map<string, { data: Uint8Array; crc: number }>();
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(pos, true)).toBe(0x02014b50);
    const crc = v.getUint32(pos + 16, true);
    const size = v.getUint32(pos + 20, true);
    const nameLen = v.getUint16(pos + 28, true);
    const extraLen = v.getUint16(pos + 30, true);
    const commentLen = v.getUint16(pos + 32, true);
    const localOff = v.getUint32(pos + 42, true);
    const name = new TextDecoder().decode(buf.subarray(pos + 46, pos + 46 + nameLen));

    // Follow the local header to the data.
    expect(v.getUint32(localOff, true)).toBe(0x04034b50);
    const lNameLen = v.getUint16(localOff + 26, true);
    const lExtraLen = v.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    out.set(name, { data: buf.subarray(dataStart, dataStart + size), crc });

    pos += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe("crc32", () => {
  it("matches known vectors", () => {
    // Standard test vector for "123456789".
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("ZipBuilder", () => {
  it("round-trips entries through a spec-following parser", () => {
    const zip = new ZipBuilder();
    zip.add("hello.txt", "hello world");
    zip.add("dir/nested.json", JSON.stringify({ ok: true }));
    zip.add("empty.bin", new Uint8Array(0));
    const buf = zip.finish();

    const entries = parseZip(buf);
    expect([...entries.keys()]).toEqual(["hello.txt", "dir/nested.json", "empty.bin"]);
    expect(new TextDecoder().decode(entries.get("hello.txt")!.data)).toBe("hello world");
    expect(JSON.parse(new TextDecoder().decode(entries.get("dir/nested.json")!.data))).toEqual({ ok: true });
    expect(entries.get("empty.bin")!.data.length).toBe(0);

    // CRCs in the directory match the actual data.
    for (const { data, crc } of entries.values()) expect(crc32(data)).toBe(crc);
  });

  it("handles UTF-8 names and binary data", () => {
    const zip = new ZipBuilder();
    const bin = new Uint8Array([0, 255, 1, 254, 127]);
    zip.add("नोटिस.txt", bin);
    const entries = parseZip(zip.finish());
    expect([...entries.get("नोटिस.txt")!.data]).toEqual([0, 255, 1, 254, 127]);
  });

  it("refuses use after finish", () => {
    const zip = new ZipBuilder();
    zip.add("a.txt", "a");
    zip.finish();
    expect(() => zip.add("b.txt", "b")).toThrow();
    expect(() => zip.finish()).toThrow();
  });
});
