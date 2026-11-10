import { useEffect, useMemo, useState } from 'react';
import { LANG_TAGS, useLang, useT, withI18n, type Dict } from '../../i18n';

const DRAFT_KEY = 'quickslot:char-counter:draft';

function countGraphemes(segmenter: Intl.Segmenter | null, s: string) {
  if (!segmenter) return [...s].length;
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

function stats(text: string, segmenter: Intl.Segmenter | null, extraMode: Dict['charCounter']['extraMode']) {
  const withSpaces = countGraphemes(segmenter, text.replace(/\r\n/g, '\n'));
  const noSpaces = countGraphemes(segmenter, text.replace(/\s/g, ''));
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split(/\r\n|\n/).length : 0;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
  const utf8 = new TextEncoder().encode(text).length;
  // 한글·한자·가나 등은 2바이트, 영문·숫자·기호는 1바이트로 세는 방식 (EUC-KR / Shift_JIS 기준 서비스용)
  let dbcs = 0;
  for (const ch of text.replace(/\r\n/g, '\n')) dbcs += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  // 여덟 번째 카드: 원고지 매수(한국어 200자, 일본어 400자) 또는 읽는 시간(영어, 분)
  const extra = extraMode.kind === 'manuscript' ? Math.ceil(withSpaces / extraMode.per) : Math.ceil(words / extraMode.wpm);
  return { withSpaces, noSpaces, words, lines, paragraphs, utf8, dbcs, extra };
}

function CharCounter() {
  const t = useT();
  const c = t.charCounter;
  const lang = useLang();
  const [text, setText] = useState('');
  const [limit, setLimit] = useState<number | ''>('');

  const segmenter = useMemo(
    () => (typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(LANG_TAGS[lang], { granularity: 'grapheme' }) : null),
    [lang],
  );
  const num = (n: number) => n.toLocaleString(LANG_TAGS[lang]);

  useEffect(() => {
    try {
      setText(localStorage.getItem(DRAFT_KEY) ?? '');
    } catch {
      /* 저장소 사용 불가 */
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, text);
      } catch {
        /* 저장소 사용 불가 */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [text]);

  const s = useMemo(() => stats(text, segmenter, c.extraMode), [text, segmenter, c.extraMode]);
  const over = limit !== '' && s.withSpaces > limit;

  const cards: [string, number, string][] = [
    [c.withSpaces, s.withSpaces, c.unitChars],
    [c.noSpaces, s.noSpaces, c.unitChars],
    [c.words, s.words, c.unitCount],
    [c.lines, s.lines, c.unitLines],
    [c.utf8, s.utf8, 'B'],
    [c.dbcs, s.dbcs, 'B'],
    [c.paragraphs, s.paragraphs, c.unitCount],
    [c.extra, s.extra, c.unitExtra],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([label, value, unit], i) => (
          <div key={label} className="panel px-4 py-3.5">
            <div className="text-[13px] font-medium text-muted">{label}</div>
            <div className={`mt-1 text-[28px] leading-none font-semibold tracking-tight tabular-nums ${i === 0 && over ? 'text-danger' : i < 2 ? 'text-accent' : ''}`}>
              {num(value)}
              {unit && <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">{c.limit}</span>
          <input
            type="number"
            min={1}
            placeholder={c.limitPlaceholder}
            className="input w-28"
            value={limit}
            onChange={(e) => setLimit(e.target.value ? Math.max(1, Number(e.target.value)) : '')}
          />
        </label>
        {limit !== '' && (
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
              <div className={`h-full transition-all ${over ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${Math.min(100, (s.withSpaces / limit) * 100)}%` }} />
            </div>
            <span className={`text-[13px] font-medium tabular-nums ${over ? 'text-danger' : 'text-muted'}`}>
              {over ? c.over(num(s.withSpaces - limit)) : c.left(num(limit - s.withSpaces))}
            </span>
          </div>
        )}
        <button type="button" className="btn ml-auto" onClick={() => setText('')} disabled={!text}>
          {c.clear}
        </button>
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={c.placeholder} className="input min-h-[50vh] resize-y text-[17px]" autoFocus />
    </div>
  );
}

export default withI18n(CharCounter);
