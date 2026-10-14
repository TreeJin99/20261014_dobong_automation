// 구글 트렌드로 키워드 흐름을 봅니다 (최근 12개월, 한국). 키 없이 됩니다.
// 사용: node .agents/skills/keyword/scripts/trends.mjs "챗봇 개발" "AI 챗봇" "챗봇 만들기"   (최대 5개, 첫 번째가 주 키워드)
// 결과: JSON. 값은 검색 횟수가 아니라 「가장 높았던 때 = 100」인 상대 관심도입니다. 네이버 흐름과 다를 수 있습니다.

const kws = process.argv.slice(2).map((s) => s.trim()).filter(Boolean).slice(0, 5);
if (!kws.length) { console.log(JSON.stringify({ error: "키워드를 넣어 주세요" })); process.exit(1); }

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36";
let cookie = "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie }, signal: AbortSignal.timeout(15000) });
    const set = res.headers.getSetCookie?.() || [];
    if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
    if (res.status === 429) { await sleep(2000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  throw new Error("구글이 잠시 막았어요(429). 1분 뒤 다시 해 보세요");
}
const json = (t) => JSON.parse(t.slice(t.indexOf("{")));
const q = (o) => encodeURIComponent(JSON.stringify(o));
const bar = (v, max) => "▁▂▃▄▅▆▇█"[max ? Math.min(7, Math.round((v / max) * 7)) : 0];

const out = { keywords: kws, period: "최근 12개월 · 한국 · 구글 검색", note: "값은 상대 관심도(최고 = 100), 검색 횟수 아님", series: {}, compare: {}, related: {}, regions: [] };
try {
  await get("https://trends.google.com/?geo=KR");
  const req = { comparisonItem: kws.map((k) => ({ keyword: k, geo: "KR", time: "today 12-m" })), category: 0, property: "" };
  const ex = json(await get(`https://trends.google.com/trends/api/explore?hl=ko&tz=-540&req=${q(req)}`));
  for (const w of ex.widgets) {
    if (w.id === "TIMESERIES") {
      const d = json(await get(`https://trends.google.com/trends/api/widgetdata/multiline?hl=ko&tz=-540&req=${q(w.request)}&token=${w.token}`));
      const tl = d.default.timelineData;
      kws.forEach((k, i) => {
        // 주 단위를 달 단위 평균으로
        const months = {};
        for (const p of tl) {
          const m = new Date(Number(p.time) * 1000).toISOString().slice(0, 7);
          (months[m] ||= []).push(p.value[i]);
        }
        const monthly = Object.entries(months).map(([m, v]) => [m, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]);
        const vals = monthly.map((x) => x[1]);
        const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
        const recent = avg(vals.slice(-3)), before = avg(vals.slice(-6, -3));
        const peak = monthly.reduce((a, b) => (b[1] > a[1] ? b : a), monthly[0]);
        out.series[k] = {
          monthly: monthly.map(([m, v]) => `${m.slice(2)}:${v}`).join(" "),
          spark: vals.map((v) => bar(v, Math.max(...vals))).join(""), // 이 말의 가장 높은 달 = █
          average: Math.round(avg(vals)),
          too_few: Math.max(...vals) < 5 ? "구글에서는 검색이 너무 적어 흐름을 보기 어려움" : undefined,
          peak_month: peak[0],
          recent3_vs_prev3: before ? `${Math.round(((recent - before) / before) * 100)}%` : "비교 불가(앞 기간 0)",
        };
      });
      const tot = kws.map((k) => out.series[k].average);
      const top = Math.max(...tot) || 1;
      kws.forEach((k, i) => (out.compare[k] = `평균 ${tot[i]} (가장 많이 찾는 말을 100 으로 하면 ${Math.round((tot[i] / top) * 100)})`));
    }
    if (w.id.startsWith("RELATED_QUERIES")) {
      const kw = kws[Number(w.id.split("_").pop()) || 0];
      await sleep(800);
      try {
        const d = json(await get(`https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=ko&tz=-540&req=${q(w.request)}&token=${w.token}`));
        const [topL, risingL] = d.default.rankedList.map((r) => r.rankedKeyword.slice(0, 7).map((x) => `${x.query} (${x.formattedValue})`));
        out.related[kw] = { 많이_같이_찾는_말: topL || [], 요즘_급상승: risingL || [] };
      } catch { out.related[kw] = "못 가져옴"; }
    }
    if (w.id === "GEO_MAP" && kws.length === 1) {
      try {
        const d = json(await get(`https://trends.google.com/trends/api/widgetdata/comparedgeo?hl=ko&tz=-540&req=${q(w.request)}&token=${w.token}`));
        out.regions = d.default.geoMapData.filter((g) => g.value[0] > 0).sort((a, b) => b.value[0] - a.value[0]).slice(0, 5).map((g) => `${g.geoName} ${g.value[0]}`);
      } catch {}
    }
  }
} catch (e) {
  out.error = String(e.message || e);
}
console.log(JSON.stringify(out, null, 1));
