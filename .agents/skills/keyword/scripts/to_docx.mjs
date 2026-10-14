// 키워드 보고서(.md)를 워드 파일(.docx)로 바꿉니다. 따로 설치할 것 없이 Node 만 있으면 됩니다.
// 사용: node .agents/skills/keyword/scripts/to_docx.mjs 작업파일/키워드보고서.md
// 결과: 같은 폴더에 같은 이름의 .docx (한글 프로그램에서도 열려요)
import fs from "node:fs";
import zlib from "node:zlib";

const src = process.argv[2] || "작업파일/키워드보고서.md";
if (!fs.existsSync(src)) { console.log(`${src} 가 없어요`); process.exit(1); }
const out = src.replace(/\.md$/, "") + ".docx";
const md = fs.readFileSync(src, "utf8").replace(/\r/g, "");

const links = []; // [글](주소) 는 누르면 열리는 링크로
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// **굵게** 와 [글](주소) 를 워드 글자로
function runs(text, base = {}) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ t: text.slice(last, m.index) });
    if (m[1]) parts.push({ t: m[1], b: true });
    else if (m[2]) parts.push({ t: m[2], url: m[3] });
    else parts.push({ t: m[4] });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ t: text.slice(last) });
  return parts.map((p) => {
    const b = p.b || base.b ? "<w:b/>" : "";
    const color = p.url ? '<w:color w:val="1D4ED8"/><w:u w:val="single"/>' : base.color ? `<w:color w:val="${base.color}"/>` : "";
    const size = `<w:sz w:val="${base.size || 21}"/><w:szCs w:val="${base.size || 21}"/>`;
    const r = `<w:r><w:rPr>${b}${color}${size}</w:rPr><w:t xml:space="preserve">${esc(p.t)}</w:t></w:r>`;
    if (!p.url) return r;
    links.push(p.url);
    return `<w:hyperlink r:id="rIdL${links.length}">${r}</w:hyperlink>`;
  }).join("");
}
const para = (text, o = {}) =>
  `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 80}"/>${o.ind ? `<w:ind w:left="${o.ind}" w:hanging="240"/>` : ""}</w:pPr>${runs(text, o)}</w:p>`;
function table(rows) {
  const cols = Math.max(...rows.map((r) => r.length));
  const w = Math.floor(9000 / cols);
  const border = '<w:tblBorders>' + ["top", "left", "bottom", "right", "insideH", "insideV"].map((s) => `<w:${s} w:val="single" w:sz="4" w:color="BBBBBB"/>`).join("") + "</w:tblBorders>";
  const tr = rows.map((r, i) => "<w:tr>" + Array.from({ length: cols }, (_, j) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${i === 0 ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F0EC"/>' : ""}</w:tcPr>${para(r[j] || "", { b: i === 0, size: 19, after: 0 })}</w:tc>`).join("") + "</w:tr>").join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/>${border}<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${tr}</w:tbl>` + para("", { after: 60 });
}

let body = "";
const lines = md.split("\n");
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/^\|/.test(l)) {
    const rows = [];
    while (i < lines.length && /^\|/.test(lines[i])) {
      if (!/^\|\s*-/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      i++;
    }
    i--; body += table(rows); continue;
  }
  if (/^# /.test(l)) body += para(l.slice(2), { b: true, size: 32, after: 200 });
  else if (/^## /.test(l)) body += para(l.slice(3), { b: true, size: 26, before: 240, after: 100, color: "D24025" });
  else if (/^### /.test(l)) body += para(l.slice(4), { b: true, size: 22, before: 160 });
  else if (/^- \[ \] /.test(l)) body += para("□ " + l.slice(6), { ind: 360 });
  else if (/^- \[x\] /i.test(l)) body += para("■ " + l.slice(6), { ind: 360 });
  else if (/^\s*[-*] /.test(l)) body += para("· " + l.replace(/^\s*[-*] /, ""), { ind: 360 });
  else if (/^\d+\. /.test(l)) body += para(l, { ind: 360 });
  else if (l.trim()) body += para(l);
}

const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="600" w:footer="600" w:gutter="0"/></w:sectPr></w:body></w:document>`;
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  "word/document.xml": doc,
  "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links.map((u, i) => `<Relationship Id="rIdL${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(u)}" TargetMode="External"/>`).join("")}</Relationships>`,
};

// 아주 작은 zip 만들기 (docx = xml 묶음 zip)
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const local = [], central = [];
let offset = 0;
for (const [name, text] of Object.entries(files)) {
  const data = Buffer.from(text, "utf8"), comp = zlib.deflateRawSync(data), nm = Buffer.from(name, "utf8"), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
  h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
  local.push(h, nm, comp);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
  c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(offset, 42);
  central.push(c, nm);
  offset += 30 + nm.length + comp.length;
}
const cd = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`워드 파일을 만들었어요: ${out}`);
