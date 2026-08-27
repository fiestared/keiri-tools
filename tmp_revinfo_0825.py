#!/usr/bin/env python3
"""出典に書くリビジョンIDと字数を、取得済みJSONから読む（記憶で書かない）。"""
import json, pathlib

src = json.loads(pathlib.Path("/tmp/egov_sozoku_0825.json").read_text(encoding="utf-8"))
for name, d in src.items():
    ri = d.get("revision_info", {})
    txt = json.dumps(d.get("law_full_text", {}), ensure_ascii=False)
    # 可視の条文文字数（タグ・キーを除いた概算ではなく、テキストノードだけ数える）
    out = []

    def walk(n):
        if isinstance(n, str):
            s = n.strip()
            if s:
                out.append(s)
        elif isinstance(n, list):
            for x in n:
                walk(x)
        elif isinstance(n, dict):
            if "children" in n:
                walk(n["children"])
            else:
                for v in n.values():
                    walk(v)

    walk(d.get("law_full_text"))
    body = "".join(out)
    print(f"\n=== {name} ===")
    for k in ("law_revision_id", "law_num", "law_title", "amendment_enforcement_date",
              "amendment_law_title", "amendment_law_num"):
        if ri.get(k):
            print(f"  {k}: {ri[k]}")
    print(f"  条文テキスト字数: {len(body):,}字")
    for w in ("相続の放棄", "熟慮期間", "限定承認"):
        print(f"    「{w}」出現 {body.count(w)}回")
