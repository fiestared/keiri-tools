// tools/contact-worker/worker.mjs（問い合わせの受け口）の振る舞いを、偽の D1 で確かめる。
//   node tests/test_contact_worker.mjs
// 見ること: 他サイトの Origin を断る／罠の欄は保存しない／保存するのは決めた5項目だけ／
// 本文が空なら断る／同じ送り手は600秒に5回まで／IP をそのまま保存しない。
import assert from "node:assert/strict";
import worker from "../tools/contact-worker/worker.mjs";

function fakeDb() {
  const db = { submissions: [], rate: [] };
  const stmt = (sql) => ({
    args: [],
    bind(...a) { this.args = a; return this; },
    async first() {
      if (sql.startsWith("SELECT COUNT(*)")) {
        const [client, after] = this.args;
        return { n: db.rate.filter((r) => r.client === client && r.at > after).length };
      }
      throw new Error("unexpected " + sql);
    },
    async run() {
      if (sql.startsWith("DELETE FROM contact_rate")) { db.rate = db.rate.filter((r) => r.at > this.args[0]); return {}; }
      if (sql.startsWith("INSERT INTO contact_rate")) { db.rate.push({ client: this.args[0], at: this.args[1] }); return {}; }
      if (sql.startsWith("INSERT INTO submissions")) {
        db.submissions.push(this.args[0]);
        return { meta: { last_row_id: db.submissions.length } };
      }
      throw new Error("unexpected " + sql);
    },
  });
  return { db, binding: { prepare: stmt, async batch(list) { for (const s of list) await s.run(); } } };
}

const URL_ = "https://keiri-contact.example.workers.dev/contact";
const req = (body, { origin = "https://keiri-tools.com", ip = "203.0.113.7", method = "POST", path = "/contact" } = {}) =>
  new Request(URL_.replace("/contact", path), {
    method,
    headers: { origin, "cf-connecting-ip": ip, "content-type": "text/plain;charset=UTF-8" },
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

const ok = { category: "その他", name: "山田", email: "a@example.com", page: "p", message: "【テスト】本文", extra: "保存しない" };

{ // 正常: 201 と受付番号。保存されるのは5項目だけ。IP は保存されない。
  const { db, binding } = fakeDb();
  const r = await worker.fetch(req(ok), { CONTACT_DB: binding });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://keiri-tools.com");
  assert.deepEqual(await r.json(), { ok: true, id: 1 });
  assert.deepEqual(Object.keys(JSON.parse(db.submissions[0])), ["category", "name", "email", "page", "message"]);
  assert.ok(!db.rate[0].client.includes("203.0.113.7"), "IP をそのまま保存しない");
}
{ // 他サイトの Origin は 403・保存しない
  const { db, binding } = fakeDb();
  const r = await worker.fetch(req(ok, { origin: "https://evil.example" }), { CONTACT_DB: binding });
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
  assert.equal(db.submissions.length, 0);
}
{ // 罠の欄が埋まっていたら 200 で成功の顔をするが保存しない
  const { db, binding } = fakeDb();
  const r = await worker.fetch(req({ ...ok, _gotcha: "bot" }), { CONTACT_DB: binding });
  assert.equal(r.status, 200);
  assert.equal(db.submissions.length, 0);
}
{ // 本文が空・壊れたJSON・メール形式違反は 400
  const { db, binding } = fakeDb();
  assert.equal((await worker.fetch(req({ ...ok, message: "  " }), { CONTACT_DB: binding })).status, 400);
  assert.equal((await worker.fetch(req("{not json"), { CONTACT_DB: binding })).status, 400);
  assert.equal((await worker.fetch(req({ ...ok, email: "no-at" }), { CONTACT_DB: binding })).status, 400);
  assert.equal(db.submissions.length, 0);
}
{ // 同じ送り手は5回まで。6回目は 429。別の送り手は通る
  const { db, binding } = fakeDb();
  for (let i = 0; i < 5; i++) assert.equal((await worker.fetch(req(ok), { CONTACT_DB: binding })).status, 201);
  assert.equal((await worker.fetch(req(ok), { CONTACT_DB: binding })).status, 429);
  assert.equal((await worker.fetch(req(ok, { ip: "198.51.100.1" }), { CONTACT_DB: binding })).status, 201);
  assert.equal(db.submissions.length, 6);
}
{ // OPTIONS は 204＋CORS、GET は 405、別パスは 404
  const { binding } = fakeDb();
  const pre = await worker.fetch(req(null, { method: "OPTIONS" }), { CONTACT_DB: binding });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), "https://keiri-tools.com");
  assert.equal((await worker.fetch(req(null, { method: "GET" }), { CONTACT_DB: binding })).status, 405);
  assert.equal((await worker.fetch(req(ok, { path: "/" }), { CONTACT_DB: binding })).status, 404);
}
{ // D1 が落ちたら 503（ページは Formspree 側が受けていれば「送信しました」と出す）
  const r = await worker.fetch(req(ok), { CONTACT_DB: { prepare() { throw new Error("down"); } } });
  assert.equal(r.status, 503);
}
console.log("✅ test_contact_worker: 全項目OK");
