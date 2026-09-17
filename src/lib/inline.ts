/**
 * `**bold**` inline syntax.
 *
 * The A4 preview (React) and the headless HTML renderer (used by `measure` and
 * by the PDF export) must agree on this syntax down to the character, so both
 * consume `splitInlineSegments` instead of each running their own regex.
 */

export interface InlineSegment {
  text: string;
  bold: boolean;
}

const BOLD_SOURCE = /\*\*(.+?)\*\*/gu;

/** Split `**bold**` runs into plain/bold segments. Returns `[]` only for `''`. */
export const splitInlineSegments = (value: string): InlineSegment[] => {
  // A fresh regex per call: a shared `g` regex carries `lastIndex` between calls.
  const pattern = new RegExp(BOLD_SOURCE.source, BOLD_SOURCE.flags);
  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: value.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), bold: false });
  }

  return segments;
};

export const hasInlineMarkup = (value: string): boolean => /\*\*(.+?)\*\*/u.test(value);

/**
 * 转义后返回。参数在类型上是 `string`，但标记是从 `localStorage` / 云端 / 文件读回来的，
 * 运行时可能是数字等其它类型——直接 `.replace` 会抛 `value.replace is not a function`。
 * 这里显式转字符串，让排版层不会因为一个字段类型不对就白屏。
 */
export const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');

/** Render `**bold**` text as an HTML fragment. Plain text is escaped, not passed through. */
export const renderInlineHtml = (value: string): string => {
  if (!hasInlineMarkup(value)) return escapeHtml(value);
  return splitInlineSegments(value)
    .map((segment) => (segment.bold ? `<strong>${escapeHtml(segment.text)}</strong>` : escapeHtml(segment.text)))
    .join('');
};
