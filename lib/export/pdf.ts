/**
 * Minimal single-page text-only PDF, for the audit bundle's cover sheet.
 * Fixed object layout: catalog → pages → page → content stream → two base-14
 * fonts (Helvetica / Helvetica-Bold), correct xref offsets. Enough for a cover
 * sheet every viewer opens; anything fancier belongs in a real library.
 */
export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
}

const PAGE_W = 595; // A4 points
const PAGE_H = 842;
const MARGIN = 56;

export function buildSimplePdf(lines: PdfLine[]): Uint8Array {
  const ops: string[] = ["BT"];
  let y = PAGE_H - MARGIN;
  for (const line of lines) {
    const size = line.size ?? 11;
    y -= size * 1.45;
    if (y < MARGIN) break; // single page; cover sheets are short
    const font = line.bold ? "/F2" : "/F1";
    ops.push(`${font} ${size} Tf`, `1 0 0 1 ${MARGIN} ${y.toFixed(1)} Tm`, `(${escapeText(line.text)}) Tj`);
  }
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  body += xref;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

// PDF string literals: escape backslash and parens. Strip to printable ASCII
// so string length == byte length, keeping /Length and xref offsets honest
// (cover sheets are English; richer text belongs in a real library).
function escapeText(s: string): string {
  return s
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}
