import { useCallback, useEffect, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import Segmented from '../../components/ui/Segmented';

type Version = 'v4' | 'v7';
type Format = 'default' | 'upper' | 'nohyphen' | 'braces';

/** UUID v7: 앞 48비트가 밀리초 시각이라 생성 순서대로 정렬됨 (DB 키로 좋음) */
function uuidv7(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const ms = Date.now();
  b[0] = Math.floor(ms / 2 ** 40) & 0xff;
  b[1] = Math.floor(ms / 2 ** 32) & 0xff;
  b[2] = (ms >>> 24) & 0xff;
  b[3] = (ms >>> 16) & 0xff;
  b[4] = (ms >>> 8) & 0xff;
  b[5] = ms & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function format(id: string, f: Format) {
  if (f === 'upper') return id.toUpperCase();
  if (f === 'nohyphen') return id.replace(/-/g, '');
  if (f === 'braces') return `{${id.toUpperCase()}}`;
  return id;
}

export default function UuidGenerator() {
  const [version, setVersion] = useState<Version>('v4');
  const [count, setCount] = useState(5);
  const [fmt, setFmt] = useState<Format>('default');
  const [ids, setIds] = useState<string[]>([]);

  const generate = useCallback(() => {
    const n = Math.min(1000, Math.max(1, count));
    setIds(Array.from({ length: n }, () => (version === 'v4' ? crypto.randomUUID() : uuidv7())));
  }, [count, version]);

  useEffect(generate, [version]);

  const out = ids.map((id) => format(id, fmt)).join('\n');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">버전</span>
          <Segmented
            label="버전"
            value={version}
            onChange={setVersion}
            options={[
              ['v4', 'v4 (랜덤)'],
              ['v7', 'v7 (시간순)'],
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="count">개수 (최대 1000)</label>
          <input id="count" type="number" min={1} max={1000} className="input w-28" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
        </div>
        <div>
          <label className="label" htmlFor="fmt">형식</label>
          <select id="fmt" className="input w-auto" value={fmt} onChange={(e) => setFmt(e.target.value as Format)}>
            <option value="default">소문자 (기본)</option>
            <option value="upper">대문자</option>
            <option value="nohyphen">하이픈 없이</option>
            <option value="braces">{'{중괄호}'} (C#/Windows GUID)</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={generate}>새로 생성</button>
        <CopyButton text={out} label="전체 복사" />
      </div>
      <textarea readOnly value={out} spellCheck={false} className="input min-h-[50vh] bg-panel font-mono text-[13px] leading-relaxed" />
    </div>
  );
}
