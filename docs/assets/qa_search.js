/**
 * qa_search.js — トップの「質問して答える」欄の**純ロジック**(DOM非依存)。
 *
 * このサイトは LLM API を呼ばない(1問ごとの課金・税務での生成ミスの実害を避ける)。
 * 代わりに「質問 → 最も関連する検証済みの記事/ツールを返す」クライアントサイドの
 * マッチャーにする。答えは必ず既存の記事・ツールから返るので、嘘が出ない・無料・自律。
 *
 * 使う側:
 *   - docs/index.html のインラインモジュール(qa_index.json を fetch して search() を呼ぶ)
 *   - tests/test_qa.mjs(代表的な話し言葉の質問が期待する記事/ツールを上位に返すか検証)
 *
 * マッチの考え方(外部ライブラリなし・入力は外部に送らない):
 *   - 日本語は分かち書きが無いので、クエリを 2〜3 文字の n-gram + 英数語に分解する。
 *   - 各エントリの terms(title + answer + 同義語 + カテゴリ を小文字連結した検索文字列。
 *     同義語辞書は生成器 gen_qa_index.mjs 側で terms に織り込み済み)への substring 一致で採点。
 *   - タイトル一致は重く、3-gram 一致は 2-gram より重く。関連ツールがあるものは少し優先。
 */

// クエリに現れても意味を持たない助詞・語尾など。丸ごと一致した 2-gram をここで捨てる。
const STOP = new Set([
  "の", "は", "が", "を", "に", "で", "と", "も", "や", "へ",
  "から", "まで", "より", "など", "ので", "のに", "って", "した", "する",
  "して", "です", "ます", "ください", "とは", "こと", "もの", "ため",
  "とき", "たい", "ない", "れる", "られ", "この", "その", "どの",
  "教え", "知り", "について",
]);

/** 全角英数→半角、英字→小文字、記号・空白を単一スペースへ。日本語はそのまま。 */
export function normalize(s) {
  return (s || "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
    .replace(/[、。，．・…‥！？!?()（）「」『』【】\[\]{}<>"'`~|｜/\\:;=+*#@¥$%&＆・\-_—–\s]+/g, " ")
    .trim();
}

// 語の切れ目になりやすい連体・格助詞。ここで区切ると「旅行"の"予約」→ 行の のような
// 語をまたぐ雑音 n-gram が消える(誤ヒットの主因だった)。「と」「に」等は content 語の中に
// 現れる(ふるさ"と"納税)ので**区切りに使わない** — 巻き込むと本物の語を割ってしまう。
const CUT = /[のをはがも]/;
// 片仮名の連なりを別扱いにするための判定(「レー」等の短い外来語断片の誤一致を避ける)。
const KATA = /^[ァ-ヴー]+$/;

// 片仮名/非片仮名の連なりに分ける(「ボーナス保険料」→「ボーナス」「保険料」)。
const SCRIPTS = /[ァ-ヴー]+|[^ァ-ヴー]+/g;

/**
 * 文字列をトークン集合へ。精度と再現の両立のため 2 系統で作る:
 * - **3-gram と連語まるごと**は「助詞で区切らない」連なりから。
 *   → 「年収の壁」のような助詞を含む連語をそのまま拾える(再現)。
 * - **2-gram と短語**は「助詞で区切った」断片から。
 *   → 「旅行"の"予約」→ 行の のような、語をまたぐ一般的な 2-gram 雑音を出さない(精度)。
 * 片仮名断片は 2-gram を出さない(「シミュレーション」に「レー」が刺さる外来語断片一致を防ぐ)。
 * 助詞だけの弱いトークン(STOP)や 1 文字は落とす。
 */
export function tokenize(s) {
  const tokens = new Set();
  const add = (t) => { if (t.length >= 2 && !STOP.has(t)) tokens.add(t); };
  for (const seg of normalize(s).split(" ")) {
    if (!seg) continue;
    for (const w of seg.match(/[a-z0-9]+/g) || []) {
      if (w.length >= 2 || /[0-9]/.test(w)) tokens.add(w);
    }
    for (const jp of seg.split(/[a-z0-9]+/)) {
      if (!jp) continue;
      // (A) 助詞で区切らない連なりから 3-gram と短い連語まるごと。
      for (const run of jp.match(SCRIPTS) || []) {
        if (run.length >= 3 && run.length <= 6) add(run); // 連語まるごと(特徴が強い)
        for (let i = 0; i + 3 <= run.length; i++) add(run.slice(i, i + 3));
      }
      // (B) 助詞で区切った断片から 2-gram と短語。
      for (const chunk of jp.split(CUT)) {
        for (const sub of chunk.match(SCRIPTS) || []) {
          if (sub.length < 2) continue;
          if (sub.length <= 5) add(sub);
          if (!KATA.test(sub)) for (let i = 0; i + 2 <= sub.length; i++) add(sub.slice(i, i + 2));
        }
      }
    }
  }
  return tokens;
}

/**
 * このスコア以上を「関連する答えが見つかった(matched)」とみなす閾値。
 * この機能の肝は「答えられない質問を matched:false で記録し、需要の実データにする」こと。
 * 本物の経理の質問を取りこぼす(=助けられる人に「記事なし」と返す)方が、
 * 無関係な質問をたまに拾ってしまう(=記録し損ねる)より痛い。よって**再現率寄り**に低めに置く。
 *
 * ★4.5 は「一般語1つ(方法 等)がタイトルにも載ったときの上限(約4.5)」の紙一重上だったため、
 *   文書を1件足すだけで IDF がわずかに動いて無関係クエリが閾値を跨いだ(86件目で実際に起きた)。
 *   正例の最弱は 5.8(「産休 手当」)なので、両側にマージンを取って 5.0 に置く。
 * ★★ その 5.0 も 106件目で跨がれた(2026-08-01・再就職手当ツールの追加)。
 *   「宇宙旅行の予約方法」が 5.007 で matched になり、内訳は**「方法」ただ1語**(df=12)だった。
 *   閾値を上げるのは同じ穴の先送りにしかならない ── **文書が増えるたびに IDF が動く**ので、
 *   紙一重で立っている閾値は原理的に、いつかまた跨がれる。
 *   → 数を動かすのをやめ、**質の門**を足した(下の isGeneric / matched の条件)。
 */
export const MATCH_MIN = 5.0;

/**
 * 一般語の判定。索引の 5% を超えるエントリに出る語は「その語だけでは答えを特定できない」。
 * 割合で持つのは、**件数で持つと索引が育つたびに意味が変わる**ため
 * (df=12 は 106件なら一般語だが、1,000件なら十分に特徴的)。
 */
const GENERIC_DF_RATIO = 0.05;

/**
 * 「クエリの大半が索引に無く、当たったのは一般語1語だけ」なら、
 * スコアが閾値を超えていても matched にしない。
 *
 * ★これは精度のための足切りではなく、**再現率を落とさずに穴だけを塞ぐ門**。
 *   見ているのは「1語しか当たっていない」ことではなく、
 *   **クエリが多くのトークンに分かれたのに、そのうち1語(しかも一般語)しか当たらなかった**こと。
 *   「宇宙旅行の予約方法」は 15 トークンに分かれて当たったのは「方法」だけ ＝ 中身は何も無い。
 *
 * ★ MIN_QTOKENS を置かずに「1語だけなら弱い」と書くと、**短い本物の質問を殺す**。
 *   「扶養」はトークンが「扶養」1つしかなく、1/1 が当たっている(＝完全に理解できている)のに
 *   一般語判定だけで落ちた ── 実際にこの実装で踏んだ。**分母を見ないと精度と再現を取り違える。**
 */
const MIN_QTOKENS = 3;
function isWeakMatch(matchedTokens, qtokens, df, N) {
  if (qtokens.length < MIN_QTOKENS) return false; // 短いクエリは分母が無い＝この門の適用外
  if (matchedTokens.length !== 1) return false;
  return df.get(matchedTokens[0]) > N * GENERIC_DF_RATIO;
}

/**
 * ★**質問のうち、どれだけを実際に理解できたか**(内容文字の被覆)。
 *
 * 上の isWeakMatch は「**1語だけ**当たった場合」しか止めないので、
 * **一般語や文法の断片が2語当たると素通りする**。2026-08-02 に無関係な質問21問で実測したところ
 * **12問が答えを返していた**(「カレーの作り方の方法」→ 電帳法の検索要件 など)。
 *
 * 原因は df ではない。犯人は **`の方法` `り方` `え方` `的な` のような、語の切れ目をまたいだ n-gram**で、
 * これらは索引に1件しか出ない(df=1)ため **IDF が「きわめて特徴的な語」として最大の重みを与える**。
 * df を見る門は、この「珍しいが意味の無い断片」を原理的に見分けられない。
 *
 * → 見るものを変える。**当たった語が、質問の何割を覆っているか**を見る。
 *   「カレーの作り方の方法」で覆えたのは `方法` の2文字だけ＝**質問の中身は何も分かっていない**。
 *
 * ★**分母はひらがなを除いた「内容文字」(漢字・カタカナ・英数)にする。**
 *   生の文字数を分母にすると「〜を教えてください」「〜のでしょうか」のような**丁寧語の尻尾が
 *   分母を膨らませ、本物の質問を殺す**(実測: 「残業代の正しい計算のしかたを教えてください」は
 *   生の文字被覆だと 29% まで落ちる。内容文字なら 71%)。
 *
 * ★**被覆に数えない語がある(2026-08-08 追加)。** 生成器 gen_qa_index.mjs は口語の同義語を
 *   terms に足す(「アルバイト」の記事に「バイト」など)。これは**届かせる**ために要るので
 *   被覆にも数える。しかし `いくら どのくらい いくらぐらい 金額 目安` の行だけは
 *   「計算」を含む全ページに付くため、実測で **114件中80件が「目安」を持つ**(本文にあるのは3件)。
 *   これを「理解できた」と数えると、**中身が1語も合っていない質問が門を通る**
 *   (実測: 「資格の勉強時間の目安」→ /santei/ が被覆67%で通った。当たったのは
 *   `資格`(資格取得の意味)と、生成器が撒いた`目安`だけ)。
 *   → **本文(title+answer)に無く、かつ索引の大半に出る語**を被覆の分子から外す。
 *   条件を2つ重ねるのが要点。★df だけで切ると「計算」まで落ちて
 *   「手取り 計算」「固定資産税の計算方法を教えてください」が答えなくなる(2026-08-08 実測)。
 *   「計算」は df が高くても**本文に書いてある内容語**なので①で残り、
 *   話題を特定する同義語(バイト/ボーナス/失業保険)は df が小さいので②で残る。
 *
 * ★**閾値 0.6 の根拠(2026-08-02 実測)**: 本物の質問66問の最小が **60%**、
 *   無関係な質問の最大が **50%**(「おすすめの映画の見方」)。両側に10ポイントの余裕。
 *   MATCH_MIN と違い**この値は索引が増えても勝手に動かない** — 被覆は質問の側の量なので、
 *   跨がれるとしたら「新しい記事が本当にその質問の語を大半含んでいた」ときだけ(＝妥当な一致)。
 */
const MIN_CONTENT_COVERAGE = 0.6;
/** ★被覆の分子から外す語の df 割合。索引の4割超に出る語は話題を特定しない(実測: 目安 70%)。 */
const COVERAGE_STOPWORD_DF_RATIO = 0.4;
const HIRAGANA = /[ぁ-ゖ]/;

/** 正規化済みクエリのうち、内容文字(ひらがな以外)の位置。空なら分母が無い＝この門は適用外。 */
function contentPositions(nq) {
  const idx = [];
  for (let i = 0; i < nq.length; i++) if (!HIRAGANA.test(nq[i])) idx.push(i);
  return idx;
}

/** entry が当たった語で、内容文字のうち何割を覆えたか。分母が無いときは 1(素通し)。 */
function contentCoverage(entry, qtokens, nq, contentIdx, df, N) {
  if (contentIdx.length === 0) return 1;
  const terms = entry.terms || "";
  // ★エントリ自身が書いている文。生成器が足した同義語は入らない。
  const honbun = (entry.title || "") + " " + (entry.answer || "");
  const covered = new Set();
  for (const t of qtokens) {
    if (!terms.includes(t)) continue;
    // ★生成器が撒いた汎用語を「理解できた」と数えない。
    //   条件は2つとも満たしたときだけ外す:
    //     ① そのエントリ自身の本文(title+answer)に無い ＝ 同義語として足された語
    //     ② 索引の大半に出る          ＝ 話題を特定しない
    //   「計算」のように本文にある語は①で残る(df が高くても内容語なので数える)。
    //   「バイト」のような話題を特定する同義語は②で残る(df が小さい)。
    if (df && N && !honbun.includes(t) && df.get(t) > N * COVERAGE_STOPWORD_DF_RATIO) continue;
    let i = nq.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length; k++) covered.add(k);
      i = nq.indexOf(t, i + 1);
    }
  }
  let hit = 0;
  for (const i of contentIdx) if (covered.has(i)) hit++;
  return hit / contentIdx.length;
}

/**
 * 1エントリの採点。df(そのトークンを含むエントリ数)から IDF 重みを掛ける。
 * 「方法」「計算」のように多くのエントリに出る一般語は軽く、「産休」「離職票」のように
 * 少数にしか出ない語は重く効く ── これで一般語だけの誤ヒット(例: 宇宙旅行の"方法")を抑える。
 */
function scoreEntry(entry, qtokens, df, N) {
  const terms = entry.terms || "";
  if (entry._tl === undefined) entry._tl = (entry.title || "").toLowerCase();
  const title = entry._tl;
  let s = 0;
  for (const t of qtokens) {
    if (!terms.includes(t)) continue;
    const idf = Math.log((N + 1) / (df.get(t) + 0.5)); // 平滑化。常に正
    let w = t.length >= 3 ? 1.6 : 1; // 3-gram 一致は 2-gram より強い
    // ★ただし2-gramでも df が極端に小さい語は「実務の略語」(月変・消込・年調・任継…)であって
    //   ノイズではない。2-gram を一律 w=1 にすると idf の上限が約4.3で、単独では MATCH_MIN(5.0)に
    //   構造的に届かず、**正解を1位に並べたまま「ありません」と答える**(実測: 「月変になる？」
    //   → 随時改定が1位で best=4.54 → matched:false)。稀少な2-gramは3-gram同格に扱う。
    //   一般的な2-gram(「いくら」「方法」等)は df が大きいのでこの枝に入らない。
    if (t.length === 2 && df.get(t) <= 2) w = 1.6;
    if (title.includes(t)) w += t.length >= 3 ? 1.8 : 1.2; // タイトル一致は重く
    s += w * idf;
  }
  if (entry.tool) s *= 1.06; // 関連ツールがあるものを優先的に見せる
  return s;
}

/**
 * index(qa_index.json の配列)を query で検索し、上位 limit 件を返す。
 * @returns {{ results: object[], best: number, matched: boolean, scores: number[] }}
 */
export function search(index, query, limit = 3) {
  const qtokens = [...tokenize(query)];
  if (qtokens.length === 0) return { results: [], best: 0, matched: false, scores: [] };
  const N = index.length;
  // 各クエリ・トークンの df(そのトークンを含むエントリ数)を索引から数える。
  const df = new Map();
  for (const t of qtokens) {
    let c = 0;
    for (const e of index) if ((e.terms || "").includes(t)) c++;
    df.set(t, c);
  }
  // ★被覆は「最後の門」ではなく**候補の絞り込み**に使う。matched を落とすだけだと、
  //   助詞・丁寧語だけで釣れたエントリが**上位に居座ったまま**になり、その下にいる
  //   正しい記事が押し出される(実測: 「育休はいくらもらえるの？」が再就職手当を返していた)。
  //   先に外せば、正しい記事が繰り上がって matched のまま返せる。
  const nq = normalize(query).replace(/ /g, "");
  const contentIdx = contentPositions(nq);
  const scored = index
    .map((e) => ({ e, s: scoreEntry(e, qtokens, df, N) }))
    .filter((x) => x.s > 0 && contentCoverage(x.e, qtokens, nq, contentIdx, df, N) >= MIN_CONTENT_COVERAGE)
    .sort((a, b) => b.s - a.s || (b.e.tool ? 1 : 0) - (a.e.tool ? 1 : 0));
  const top = scored.slice(0, limit);
  const best = scored.length ? scored[0].s : 0;
  // 最上位のエントリが、クエリのどのトークンで当たったか(質の門に使う)
  const bestTokens = scored.length
    ? qtokens.filter((t) => (scored[0].e.terms || "").includes(t))
    : [];
  return {
    results: top.map((x) => x.e),
    best,
    matched: best >= MATCH_MIN && !isWeakMatch(bestTokens, qtokens, df, N),
    scores: top.map((x) => Math.round(x.s * 100) / 100),
  };
}
