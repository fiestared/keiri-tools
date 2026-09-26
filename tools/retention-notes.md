# Retention v1 (G-027, 2026-09-26)

All new persistence is optional. Monthly checks contain only YYYY-MM and fixed task IDs. Favorites contain only the four allowed tool IDs. No values, names, labels, dates or search strings are added to GA4 payloads. Existing AdSense, sponsored placements and navigation experiments are outside this change.

## Storage and deletion

- `shiharai_conditions_v1`: existing array of `{label, cond}` preserved. Corrupt data is reported instead of silently overwritten; calculation still works; explicit bulk removal recovers it.
- `yukyu_memo_v1`: existing memo schema and legacy `tool_save` / `tool_revisit` retained. The legacy revisit fires on page entry with older saved data; it does **not** prove an actual restore.
- `keiri_monthly_checks_v1`: `{version:1, months:{"YYYY-MM":[task IDs]}}`. No completion carries across months. Unchecking opt-in removes stored checks. Temporary checks remain until reload.
- `keiri_favorites_v1`: allowed tool IDs only. Bulk clear removes the box and its usage flags.
- `keiri_retention_usage_v1`: last operation date in JST per enumerated feature/tool, separately from conditions. Used only to deduplicate a different-day-use signal. Corresponding clear operations remove it.
- `keiri_favorite_entry_v1`: sessionStorage tool ID, consumed after a successful calculation reached from the toolbox. An entry click alone is not a calculation.

## GA4 semantics (retention_version=1)

Every new event has only `feature`, `tool`, `action`, `retention_version`. `trackRetention` rejects unknown vocabulary.

- `retention_save`: successful persistent save, not a click on an unsuccessful save button.
- `retention_restore`: condition restore plus successful recalculation; for monthly checks, successful restoration for display, not proof of active use.
- `retention_reuse`: explicit successful use on a day after the previous operation; at most once per feature/tool/day. Storage denial or removal limits this measurement. It is not a cross-device or cohort-retention measurement.
- `retention_check`: an explicit check/uncheck, including temporary use.
- `retention_favorite_add`: successful site-toolbox addition. It does not mean a browser bookmark was made.
- `retention_open`: link entry from the toolbox/monthly list.
- `retention_use`: successful calculator result after toolbox entry in the same tab.
- `retention_bookmark_hint`: the user opened the fixed-URL browser-bookmark instructions. Browser registration cannot be confirmed.
- `retention_ics_export`: the download was initiated; not proof of calendar import or a reminder being delivered.
- `retention_clear`: successful explicit bulk clearing.

New retention controls have `data-retention-control` so their buttons/checkboxes do not inflate legacy `tool_input`. Existing PR events and navigation wiring remain intact.

## Change records and generators

Edit `docs/assets/retention_updates.json` only for a substantive, officially supported change. `effectiveDate` is distinct from the fixed site record timestamp `recordedAt`. Record IDs are RSS GUIDs: never change one merely to resurface an old notice. Then run `node tools/gen_retention_updates.mjs`. `--check` validates deterministic notices and `docs/updates.xml`.

The 2027 withholding notice is a future-year notice; the calculator still uses the 2026 table. Updating that calculator requires a separate data/calculation review. Daily builds must not change RSS timestamps.

Commit HTML before the index/sitemap generators so lastmod can use committed content history. The current date generator updates JSON-LD but can leave existing `<time>`-wrapped visible dates unchanged. This change aligns the edited pages with the generated dates, and tests that agreement, without globally rewriting unrelated articles.

## Browser regression checks

`tests/test_retention_core.mjs`, `tests/test_retention_pages.mjs`, `tests/test_uiux_retention.mjs`. The browser tests reuse `tools/uiux-0926/browser.mjs`, whose local HTTP server blocks external requests (analytics/ads are not sent). Set `RETENTION_ARTIFACTS` to a directory outside docs for screenshots.

`BrowserContext.newPage()` ignores viewport options; call `page.setViewportSize()` and assert `innerWidth`. This was corrected in the previous UI regression test too. Chromium can tab into an overflowing result region at 390px before the copy button: test that useful keyboard stop, then the copy button.

`RETENTION_MUTATION=month|favorite|restore|stale|ics|layout` with the retention page test, or `enter|search|kana|it` with the UI test, must fail. Mutations replace HTTP responses in memory, never source files.

The exact official 2027 tax-table anchor is a documented historical/future-source exception in `test_year_staleness.mjs`; calculator input/result year declarations remain checked. Do not exempt the whole notice or page. Flex-row restore controls must retain readable width, not merely avoid page overflow.
