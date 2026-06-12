/**
 * Minimal ZIP writer for audit bundles: stored entries (no compression), which
 * every unzip tool reads. Hand-rolled like the rest of lib/* — audit bundles
 * are read-once artifacts, so compression is a nicety we skip for zero deps.
 *
 * Layout per the PKWARE APPNOTE: local file headers + data, then a central
 * directory, then the end-of-central-directory record. Names are UTF-8
 * (general-purpose bit 11 set).
 */

// Table-based CRC-32 (IEEE 802.3 polynomial, reflected).
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
  dosTime: number;
  dosDate: number;
}

export class ZipBuilder {
  private entries: Entry[] = [];
  private chunks: Uint8Array[] = [];
  private offset = 0;
  private finished = false;

  /** Add a file. Call order defines archive order. */
  add(name: string, data: Uint8Array | string): void {
    if (this.finished) throw new Error("zip already finished");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(bytes);

    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    const header = new Uint8Array(30 + nameBytes.length);
    const v = new DataView(header.buffer);
    v.setUint32(0, 0x04034b50, true); // local file header signature
    v.setUint16(4, 20, true); // version needed
    v.setUint16(6, 0x0800, true); // flags: UTF-8 names
    v.setUint16(8, 0, true); // method: stored
    v.setUint16(10, dosTime, true);
    v.setUint16(12, dosDate, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, bytes.length, true); // compressed size (= raw, stored)
    v.setUint32(22, bytes.length, true); // uncompressed size
    v.setUint16(26, nameBytes.length, true);
    v.setUint16(28, 0, true); // extra length
    header.set(nameBytes, 30);

    this.entries.push({ nameBytes, data: bytes, crc, offset: this.offset, dosTime, dosDate });
    this.chunks.push(header, bytes);
    this.offset += header.length + bytes.length;
  }

  finish(): Uint8Array {
    if (this.finished) throw new Error("zip already finished");
    this.finished = true;

    const centralStart = this.offset;
    for (const e of this.entries) {
      const rec = new Uint8Array(46 + e.nameBytes.length);
      const v = new DataView(rec.buffer);
      v.setUint32(0, 0x02014b50, true); // central directory signature
      v.setUint16(4, 20, true); // version made by
      v.setUint16(6, 20, true); // version needed
      v.setUint16(8, 0x0800, true); // flags: UTF-8 names
      v.setUint16(10, 0, true); // method: stored
      v.setUint16(12, e.dosTime, true);
      v.setUint16(14, e.dosDate, true);
      v.setUint32(16, e.crc, true);
      v.setUint32(20, e.data.length, true);
      v.setUint32(24, e.data.length, true);
      v.setUint16(28, e.nameBytes.length, true);
      // extra/comment/disk/attrs all zero
      v.setUint32(42, e.offset, true); // local header offset
      rec.set(e.nameBytes, 46);
      this.chunks.push(rec);
      this.offset += rec.length;
    }

    const eocd = new Uint8Array(22);
    const v = new DataView(eocd.buffer);
    v.setUint32(0, 0x06054b50, true); // EOCD signature
    v.setUint16(8, this.entries.length, true); // entries on this disk
    v.setUint16(10, this.entries.length, true); // entries total
    v.setUint32(12, this.offset - centralStart, true); // central directory size
    v.setUint32(16, centralStart, true); // central directory offset
    this.chunks.push(eocd);

    const total = this.chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of this.chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
}
