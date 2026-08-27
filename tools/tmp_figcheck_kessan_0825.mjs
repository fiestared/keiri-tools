// 図だけを抜き出した確認用HTMLを作る。
// ★docs/ 配下には置かない（権限層で rm できず、必ず残って本番に混ざる。申し送り1457）。
import fs from "fs";

const src = fs.readFileSync("docs/column/kessan-kokoku/index.html", "utf8");
const css = fs.readFileSync("docs/assets/style.css", "utf8");

const figs = src.match(/<figure class="figure">[\s\S]*?<\/figure>/g) || [];
console.log("抜き出した図:", figs.length);

const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<style>${css}</style>
<style>body{padding:20px;max-width:820px;margin:0 auto}</style>
</head><body>${figs.join("\n<hr>\n")}</body></html>`;

fs.writeFileSync("tools/tmp_figcheck_kessan_0825.html", html);
console.log("書き出し: tools/tmp_figcheck_kessan_0825.html");
