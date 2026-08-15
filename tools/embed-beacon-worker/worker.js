/**
 * 埋め込みウィジェットの「設置面」を数える受け口（Cloudflare Workers・無料枠）。
 *
 * ★なぜ要るか:
 *   keiri-tools は GitHub Pages で配信しているので**アクセスログが取れない**。
 *   /embed/ の31本が実際にどこかに設置されているのか、90日PV0が
 *   「設置ゼロ」なのか「測れていないだけ」なのか判別できなかった。
 *
 * ★何を受け取るか（これ以上は受け取らない）:
 *   { origin: "https://example.com", slug: "tedori" }
 *   - パス・クエリ・利用者の入力値・IP は保存しない
 *   - 数えたいのは「どのサイトが設置したか」であって「誰が何を計算したか」ではない
 *
 * ★保存先: Workers KV（無料枠）。キーは `日付|origin|slug`、値は回数。
 *   1オリジン×1ウィジェット×1日 = 1件（送信側でも sessionStorage で抑制している）。
 *
 * デプロイ:
 *   1. npm i -g wrangler && wrangler login
 *   2. wrangler kv namespace create BEACON
 *   3. wrangler.toml の id を書き換える
 *   4. wrangler deploy
 *   5. 出てきた URL を docs/assets/embed_beacon.js の ENDPOINT に書いて push
 *
 * 読む: GET /stats?days=30  → 設置元オリジンの一覧と件数
 */
const ALLOW = "https://keiri-tools.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",           // iframe は任意のサイトに置かれる
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // ── 記録 ──────────────────────────────────────────────
    if (url.pathname === "/hit" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return new Response("bad", { status: 400, headers: cors }); }

      // ★受け取る値を厳しく検証する。任意の文字列をキーにしない（KVを汚される）
      const origin = String(body.origin || "");
      const slug = String(body.slug || "");
      if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin)) return new Response("bad origin", { status: 400, headers: cors });
      if (!/^[a-z0-9-]{1,40}$/.test(slug)) return new Response("bad slug", { status: 400, headers: cors });
      if (origin.includes("keiri-tools.com")) return new Response("self", { headers: cors });

      const day = new Date().toISOString().slice(0, 10);
      const key = `${day}|${origin}|${slug}`;
      const prev = Number((await env.BEACON.get(key)) || 0);
      // ★90日で自動的に消す。設置面の推移を見るのが目的で、永久保存は要らない
      await env.BEACON.put(key, String(prev + 1), { expirationTtl: 60 * 60 * 24 * 90 });
      return new Response("ok", { headers: cors });
    }

    // ── 読み出し ──────────────────────────────────────────
    if (url.pathname === "/stats") {
      const days = Math.min(Number(url.searchParams.get("days") || 30), 90);
      const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const out = {};
      let cursor;
      do {
        const list = await env.BEACON.list({ cursor });
        for (const k of list.keys) {
          const [day, origin, slug] = k.name.split("|");
          if (day < since) continue;
          out[origin] ??= { total: 0, slugs: {}, days: new Set() };
          out[origin].total++;
          out[origin].slugs[slug] = (out[origin].slugs[slug] || 0) + 1;
          out[origin].days.add(day);
        }
        cursor = list.list_complete ? null : list.cursor;
      } while (cursor);

      const rows = Object.entries(out)
        .map(([origin, v]) => ({ origin, hits: v.total, widgets: Object.keys(v.slugs).length, days: v.days.size }))
        .sort((a, b) => b.hits - a.hits);
      return new Response(JSON.stringify({ since, sites: rows.length, rows }, null, 1),
        { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    }

    return new Response("keiri-tools embed beacon", { headers: cors });
  },
};
