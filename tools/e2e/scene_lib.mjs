// scene_lib.mjs — E2E シーンの期待値で共有する部品（Node の e2e.mjs と、ブラウザの harness.html の両方から読む）。
// ★DOM にも Node の API にも触らない純関数だけを置く（両側で import されるため）。

/**
 * 空欄押下のエラーシーン（ux_field_error_*）の期待値。harness の fieldErrorScene が返す状態を見る。
 * 型: gbrain implementation/keiri-ux-tools-fixes-2026-09-30（空欄で始める・入力例は説明に・欄に結び付いたエラー）
 * @param {object} [o]
 * @param {boolean} [o.skipFrame] 枠の色の比較を外す（埋め込み版。成功もエラーも灰色の枠で、エラーは赤字）
 */
export const uxFieldErrorExpect = ({ skipFrame = false } = {}) => (s) =>
  s.initialEmpty && s.noPlaceholder && s.hasExample && s.focused && s.describedByError &&
  s.errorVisible && s.errorNearField && s.resultWarnLinked && s.fieldInView && s.cleared &&
  // エラーを成功と同じ枠で出さない・エラーのあいだは「結果をコピー」を出さない
  (skipFrame || s.errorFrameDiffers) && !s.copyOnError;
