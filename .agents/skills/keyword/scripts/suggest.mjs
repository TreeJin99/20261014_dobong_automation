// 키워드 하나로 네이버 · 구글 · 유튜브 자동완성(사람들이 실제로 치는 말)을 모읍니다.
// 사용: node .agents/skills/keyword/scripts/suggest.mjs "도봉구 반찬가게"
// 결과: JSON. 플랫폼별로 「어떤 말을 넣었더니 → 무엇이 나왔나」. 검색량 숫자는 없습니다.

const keyword = (process.argv.slice(2).join(" ") || "").trim();
if (!keyword) {
  console.log(JSON.stringify({ error: "키워드를 넣어 주세요" }));
  process.exit(1);
}

// 긴 키워드는 자동완성이 비어 있을 때가 많아, 짧은 말로도 넣어 봅니다.
const words = keyword.split(/\s+/).filter(Boolean);
const tries = [...new Set([
  keyword,
  words.slice(0, 2).join(" "),
  words.slice(-2).join(" "),
  ...words.filter((w) => w.length >= 2),
])].slice(0, 5);

const enc = encodeURIComponent;
const sources = {
  naver: (q) => `https://ac.search.naver.com/nx/ac?q=${enc(q)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`,
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${enc(q)}`,
  youtube: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=ko&q=${enc(q)}`,
};

async function get(name, q) {
  try {
    const res = await fetch(sources[name](q), { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const list = name === "naver" ? (data.items?.[0] || []).map((x) => x[0]) : data[1] || [];
    return list.filter((s) => s && s !== q);
  } catch {
    return null; // 못 가져옴
  }
}

const out = { keyword, date: new Date().toISOString().slice(0, 10), tried: tries, platforms: {} };
for (const name of Object.keys(sources)) {
  out.platforms[name] = {};
  for (const q of tries) {
    const list = await get(name, q);
    out.platforms[name][q] = list === null ? "못 가져옴" : list;
  }
}
console.log(JSON.stringify(out, null, 1));
