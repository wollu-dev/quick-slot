import { useCallback, useEffect, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import Segmented from '../../components/ui/Segmented';
import Select from '../../components/ui/Select';
import { useT, withI18n } from '../../i18n';
import NumberField from '../../components/ui/NumberField';

type Version = 'v4' | 'v7';
type Format = 'default' | 'upper' | 'nohyphen' | 'braces';

/** UUID v7: the first 48 bits are a millisecond timestamp, so IDs sort in creation order (good for DB keys) */
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

function UuidGenerator() {
  const u = useT().uuid;
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
          <span className="label">{u.version}</span>
          <Segmented
            label={u.version}
            value={version}
            onChange={setVersion}
            options={[
              ['v4', u.v4],
              ['v7', u.v7],
            ]}
          />
        </div>
        <div>
          <label className="label" htmlFor="count">
            {u.count}
          </label>
          <NumberField id="count" min={1} max={1000} className="w-32" value={count} onChange={setCount} />
        </div>
        <div>
          <label className="label" htmlFor="fmt">
            {u.format}
          </label>
          <Select
            id="fmt"
            className="w-auto min-w-36"
            value={fmt}
            onChange={setFmt}
            options={[
              ['default', u.lower],
              ['upper', u.upper],
              ['nohyphen', u.noHyphen],
              ['braces', u.braces],
            ]}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={generate}>
          {u.generate}
        </button>
        <CopyButton text={out} label={u.copyAll} />
      </div>
      <textarea readOnly value={out} spellCheck={false} className="input min-h-[50vh] bg-panel font-mono text-[13px] leading-relaxed" />
    </div>
  );
}

export default withI18n(UuidGenerator);
