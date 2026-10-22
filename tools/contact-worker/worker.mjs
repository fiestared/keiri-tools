/**
 * keiri-tools.com の問い合わせの受け口（Cloudflare Worker `keiri-contact` ＋ D1 `keiri-contact`）。
 *
 * なぜ要るか（2026-10-22 Masahiro「フォーム送信のやつは対応するようにしておいて」）:
 *   /contact/ は Formspree（f/mzdnbbyp）に送るだけで、届く先は司令塔が読めないメールの箱だった。
 *   「問い合わせが来たか」を誰も知らないまま、10-22 に誰かがフォームを開いていた。
 *   → ここに**同じ内容をもう1通**保存し、Mac の launchd（keiri-commander/tools/contact_poll.py）が
 *     10分おきに読んで keiri の Slack チャンネルに1件1通で流す（道しるべ shirube-contact と同じ形）。
 *
 * 決まり:
 *   - **Slack の Webhook・トークンをここに置かない。** 通知は Mac 側だけが持つ鍵で送る。
 *     この Worker は保存するだけ（secret は1つも無い）。
 *   - **Formspree は残す。** ページは両方へ送り、どちらか一方が受けたら利用者には「送信しました」と出す。
 *   - 無料枠だけで動く（Workers 10万要求/日・D1 無料枠）。
 */
const ALLOWED_ORIGINS = new Set(["https://keiri-tools.com", "https://www.keiri-tools.com"]);
// フォームの name 属性 → 保存するキー。ここに無い項目は保存しない（何でも溜め込まない）。
export const FIELDS = [
  ["category", 200],
  ["name", 200],
  ["email", 320],
  ["page", 500],
  ["message", 10000],
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_S = 600;
const RATE_MAX = 5;

function cors(origin) {
  const h = { "vary": "Origin" };
  if (ALLOWED_ORIGINS.has(origin)) {
    h["access-control-allow-origin"] = origin;
    h["access-control-allow-methods"] = "POST, OPTIONS";
    h["access-control-allow-headers"] = "content-type";
    h["access-control-max-age"] = "86400";
  }
  return h;
}

const json = (value, status, origin) => new Response(JSON.stringify(value), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...cors(origin),
  },
});

// IP はそのまま保存しない。レート制限に要るのは「同じ送り手か」だけなので、日替わりの塩で
// ハッシュにする（日をまたぐと照合できない＝追跡に使えない）。
async function clientKey(req, now) {
  const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
  const day = Math.floor(now / 86400);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}|${ip}`));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function handleContact(req, env, now = Math.floor(Date.now() / 1000)) {
  const origin = req.headers.get("origin") || "";
  // ブラウザ以外（curl 等）から Origin を偽って送ることはできるが、他サイトの JS から
  // 勝手に送らせることはこれで防げる。
  if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "forbidden origin" }, 403, origin);

  const raw = await req.text();
  if (raw.length < 2 || raw.length > 40000) return json({ error: "size" }, 413, origin);
  let data;
  try { data = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400, origin); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad json" }, 400, origin);

  // 罠の欄（ページの _gotcha）。埋まっていたらボット。保存せず成功の顔をする。
  if (String(data._gotcha ?? "").trim()) return json({ ok: true }, 200, origin);

  const values = {};
  for (const [key, max] of FIELDS) {
    const v = String(data[key] ?? "").trim();
    if ([...v].length > max) return json({ error: "too long", field: key }, 400, origin);
    values[key] = v;
  }
  if (!values.message) return json({ error: "message required" }, 400, origin);
  if (values.email && !EMAIL_RE.test(values.email)) return json({ error: "email" }, 400, origin);

  const db = env.CONTACT_DB;
  const client = await clientKey(req, now);
  let id;
  try {
    const hit = await db.prepare("SELECT COUNT(*) AS n FROM contact_rate WHERE client=?1 AND at>?2")
      .bind(client, now - RATE_WINDOW_S).first();
    if ((hit?.n ?? 0) >= RATE_MAX) return json({ error: "rate" }, 429, origin);
    await db.batch([
      db.prepare("DELETE FROM contact_rate WHERE at<=?1").bind(now - RATE_WINDOW_S),
      db.prepare("INSERT INTO contact_rate(client,at) VALUES(?1,?2)").bind(client, now),
    ]);
    const ins = await db.prepare("INSERT INTO submissions(payload_json) VALUES(?1)")
      .bind(JSON.stringify(values)).run();
    id = ins.meta?.last_row_id;
  } catch {
    return json({ error: "unavailable" }, 503, origin);
  }
  return json({ ok: true, id }, 201, origin);
}

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const origin = req.headers.get("origin") || "";
    if (u.pathname !== "/contact") return json({ error: "not found" }, 404, origin);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405, origin);
    return handleContact(req, env);
  },
};
