import { useEffect, useMemo, useState } from 'react';

const DRAFT_KEY = 'quickslot:char-counter:draft';
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;

function countGraphemes(s: string) {
  if (!segmenter) return [...s].length;
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

function stats(text: string) {
  const withSpaces = countGraphemes(text.replace(/\r\n/g, '\n'));
  const noSpaces = countGraphemes(text.replace(/\s/g, ''));
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lines = text ? text.split(/\r\n|\n/).length : 0;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
  const utf8 = new TextEncoder().encode(text).length;
  // 한글·한자 등은 2바이트, 영문·숫자·기호는 1바이트로 세는 방식 (일부 자기소개서·문자 서비스 기준)
  let euckr = 0;
  for (const ch of text.replace(/\r\n/g, '\n')) euckr += ch.charCodeAt(0) > 0x7f ? 2 : 1;
  const manuscript = Math.ceil(withSpaces / 200);
  return { withSpaces, noSpaces, words, lines, paragraphs, utf8, euckr, manuscript };
}

export default function CharCounter() {
  const [text, setText] = useState('');
  const [limit, setLimit] = useState<number | ''>('');

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

  const s = useMemo(() => stats(text), [text]);
  const over = limit !== '' && s.withSpaces > limit;

  const cards: [string, number, string?][] = [
    ['공백 포함', s.withSpaces, '자'],
    ['공백 제외', s.noSpaces, '자'],
    ['단어', s.words, '개'],
    ['줄', s.lines, '줄'],
    ['바이트 (UTF-8)', s.utf8, 'B'],
    ['바이트 (한글 2B)', s.euckr, 'B'],
    ['문단', s.paragraphs, '개'],
    ['원고지 (200자)', s.manuscript, '매'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([label, value, unit], i) => (
          <div key={label} className="panel px-4 py-3.5">
            <div className="text-[13px] font-medium text-muted">{label}</div>
            <div className={`mt-1 text-[28px] leading-none font-semibold tracking-tight tabular-nums ${i === 0 && over ? 'text-danger' : i < 2 ? 'text-accent' : ''}`}>
              {value.toLocaleString()}
              <span className="ml-1 text-[15px] font-medium text-muted">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted">글자 수 제한</span>
          <input
            type="number"
            min={1}
            placeholder="예: 1000"
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
              {over ? `${(s.withSpaces - limit).toLocaleString()}자 초과` : `${(limit - s.withSpaces).toLocaleString()}자 남음`}
            </span>
          </div>
        )}
        <button type="button" className="btn ml-auto" onClick={() => setText('')} disabled={!text}>지우기</button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="여기에 글을 붙여넣거나 입력하세요. 쓰던 글은 이 브라우저에 자동 저장돼요."
        className="input min-h-[50vh] resize-y text-[17px]"
        autoFocus
      />
    </div>
  );
}
