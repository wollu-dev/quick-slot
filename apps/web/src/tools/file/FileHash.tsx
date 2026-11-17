import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy as CopyIcon, X, XCircle } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';
import Rich from '../../i18n/Rich';
import { formatBytes } from '../../lib/files';
import { ALGOS, algoForLength, algoLabel, hashData, HashCancelled, normalizeHash, type Algo } from '../../lib/hash';

type Mode = 'files' | 'text';
type Digests = Partial<Record<Algo, string>>;

interface Entry {
  id: number;
  file: File;
  digests: Digests;
  /** 0..1 while hashing */
  progress?: number;
  error?: boolean;
}

let nextId = 1;

function FileHash() {
  const t = useT();
  const h = t.hash;
  const [mode, setMode] = useState<Mode>('files');
  const [algos, setAlgos] = useState<Algo[]>(['md5', 'sha1', 'sha256']);
  const [upper, setUpper] = useState(false);
  const [expected, setExpected] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [textDigests, setTextDigests] = useState<Digests>({});

  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const busy = useRef(false);
  const [tick, setTick] = useState(0);

  const update = (id: number, patch: Partial<Entry>) => setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  // Hash one file at a time, computing only the algorithms it doesn't have yet
  useEffect(() => {
    if (busy.current) return;
    const next = entries.find((e) => !e.error && algos.some((a) => !(a in e.digests)));
    if (!next) return;
    busy.current = true;
    const missing = algos.filter((a) => !(a in next.digests));
    const alive = () => entriesRef.current.some((e) => e.id === next.id);
    update(next.id, { progress: 0 });
    hashData(next.file, missing, (p) => update(next.id, { progress: p }), alive)
      .then((d) => setEntries((list) => list.map((e) => (e.id === next.id ? { ...e, digests: { ...e.digests, ...d }, progress: undefined } : e))))
      .catch((err) => !(err instanceof HashCancelled) && update(next.id, { error: true, progress: undefined }))
      .finally(() => {
        busy.current = false;
        setTick((n) => n + 1);
      });
  }, [entries, algos, tick]);

  useEffect(() => {
    let cancelled = false;
    hashData(text, algos).then((d) => !cancelled && setTextDigests(d));
    return () => {
      cancelled = true;
    };
  }, [text, algos]);

  const want = normalizeHash(expected);
  const wantAlgo = want ? algoForLength(want.length) : undefined;
  // Turn on the algorithm that a pasted hash belongs to, so it can be checked
  useEffect(() => {
    if (wantAlgo && !algos.includes(wantAlgo)) setAlgos((list) => ALGOS.map((a) => a.id).filter((a) => list.includes(a) || a === wantAlgo));
  }, [wantAlgo]);

  const toggle = (a: Algo, on: boolean) => setAlgos((list) => ALGOS.map((x) => x.id).filter((x) => (x === a ? on : list.includes(x))));

  const sources = mode === 'files' ? entries.map((e) => ({ name: e.file.name, digests: e.digests })) : text ? [{ name: h.text, digests: textDigests }] : [];
  const matches = want ? sources.flatMap((s) => algos.filter((a) => s.digests[a] === want).map((a) => `${s.name} · ${algoLabel(a)}`)) : [];
  const pending = mode === 'files' && entries.some((e) => e.progress !== undefined || (!e.error && algos.some((a) => !(a in e.digests))));

  /** Files whose digests are all equal share a group; a group of 2+ means identical content */
  const groups = useMemo(() => {
    const map = new Map<string, number[]>();
    if (!algos.length) return map;
    for (const e of entries) {
      if (algos.some((a) => !e.digests[a])) continue;
      const key = `${e.file.size}:${algos.map((a) => e.digests[a]).join(':')}`;
      map.set(key, [...(map.get(key) ?? []), e.id]);
    }
    return map;
  }, [entries, algos]);
  const sameAs = (e: Entry) => {
    for (const ids of groups.values()) if (ids.length > 1 && ids.includes(e.id)) return ids.filter((id) => id !== e.id).map((id) => entries.find((x) => x.id === id)!.file.name);
    return [];
  };
  const doneCount = entries.filter((e) => algos.every((a) => e.digests[a])).length;
  const allSame = entries.length > 1 && doneCount === entries.length && [...groups.values()].some((ids) => ids.length === entries.length);

  const show = (v: string) => (upper ? v.toUpperCase() : v);
  const copyAll = entries
    .filter((e) => algos.every((a) => e.digests[a]))
    .flatMap((e) => algos.map((a) => `${algoLabel(a)}  ${show(e.digests[a]!)}  ${e.file.name}`))
    .join('\n');

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <Segmented
          label={h.mode}
          value={mode}
          onChange={setMode}
          options={[
            ['files', h.files],
            ['text', h.text],
          ]}
        />

        <fieldset className="space-y-2">
          <legend className="label mb-2">{h.algorithms}</legend>
          {ALGOS.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={algos.includes(a.id)} onChange={(e) => toggle(a.id, e.target.checked)} />
              {a.label}
            </label>
          ))}
          <p className="text-xs text-muted">{h.weakNote}</p>
        </fieldset>

        <label className="flex items-center gap-2 border-t border-line pt-4 text-sm">
          <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
          {h.uppercase}
        </label>

        <div className="space-y-2 border-t border-line pt-4">
          <label className="label" htmlFor="hash-expected">
            {h.verify}
          </label>
          <input
            id="hash-expected"
            className="input w-full font-mono text-[13px] placeholder:font-sans"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder={h.verifyPlaceholder}
            spellCheck={false}
            autoComplete="off"
          />
          {!expected.trim() ? (
            <p className="text-xs text-muted">{h.verifyNote}</p>
          ) : !want ? (
            <p className="text-xs text-danger">{h.notHex}</p>
          ) : matches.length ? (
            <ul className="space-y-1 text-sm text-ok" aria-live="polite">
              {matches.map((m) => (
                <li key={m} className="flex items-start gap-1.5 break-all">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{h.match(m)}</span>
                </li>
              ))}
            </ul>
          ) : pending ? (
            <p className="text-xs text-muted">{h.checking}</p>
          ) : sources.length ? (
            <p className="flex items-center gap-1.5 text-sm text-danger" aria-live="polite">
              <XCircle size={16} className="shrink-0" />
              {h.noMatch}
            </p>
          ) : null}
        </div>

        {mode === 'files' && entries.length > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            {allSame && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-ok">
                <CheckCircle2 size={16} className="shrink-0" />
                {h.allSame(entries.length)}
              </p>
            )}
            <CopyButton text={copyAll} label={h.copyAll} className="w-full" />
            <button type="button" className="btn w-full" onClick={() => setEntries([])}>
              {t.common.reset}
            </button>
          </div>
        )}
      </aside>

      {mode === 'files' ? (
        <section className="min-w-0 space-y-3">
          {entries.length === 0 ? (
            <>
              <DropZone onFiles={(f) => setEntries(f.map((file) => ({ id: nextId++, file, digests: {} })))} hint={h.dropHint} />
              <p className="text-sm text-muted">
                <Rich text={h.intro} />
              </p>
            </>
          ) : (
            <DropZone onFiles={(f) => setEntries((list) => [...list, ...f.map((file) => ({ id: nextId++, file, digests: {} }))])} compact />
          )}
          {entries.map((e) => {
            const same = sameAs(e);
            return (
              <article key={e.id} className="panel p-4">
                <header className="mb-3 flex items-center gap-2">
                  <h3 className="min-w-0 truncate font-mono text-sm" title={e.file.name}>
                    {e.file.name}
                  </h3>
                  <span className="shrink-0 text-xs text-muted">{formatBytes(e.file.size)}</span>
                  <button
                    type="button"
                    className="btn ml-auto size-9 shrink-0 justify-center px-0"
                    title={t.common.removeFromList}
                    aria-label={t.common.removeFromList}
                    onClick={() => setEntries((list) => list.filter((x) => x.id !== e.id))}
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </header>
                {e.error ? (
                  <p className="text-sm text-danger">{h.readError}</p>
                ) : (
                  <>
                    {e.progress !== undefined && (
                      <div className="mb-3 flex items-center gap-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(e.progress * 100)}>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${e.progress * 100}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-muted">{Math.floor(e.progress * 100)}%</span>
                      </div>
                    )}
                    <DigestList digests={e.digests} algos={algos} want={want} show={show} />
                    {same.length > 0 && (
                      <p className="mt-3 flex items-start gap-1.5 text-sm text-ok">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 break-all">{h.sameAs(same.join(', '))}</span>
                      </p>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="min-w-0 space-y-3">
          <TextPanel label={t.common.input} value={text} onChange={setText} placeholder={h.textPlaceholder} minHeight="min-h-[24vh]" />
          <article className="panel p-4" aria-label={t.common.result}>
            <DigestList digests={textDigests} algos={algos} want={want} show={show} />
            <p className="mt-3 text-xs text-muted">{h.textNote}</p>
          </article>
        </section>
      )}
    </div>
  );
}

function DigestList({ digests, algos, want, show }: { digests: Digests; algos: Algo[]; want: string; show: (v: string) => string }) {
  const t = useT();
  if (!algos.length) return <p className="text-sm text-muted">{t.hash.pickAlgo}</p>;
  return (
    <dl className="space-y-2">
      {algos.map((a) => {
        const v = digests[a];
        const hit = !!want && v === want;
        return (
          <div key={a} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${hit ? 'bg-ok/12 ring-1 ring-ok/40' : 'bg-panel-2'}`}>
            <dt className={`w-16 shrink-0 text-xs font-medium ${hit ? 'text-ok' : 'text-muted'}`}>{algoLabel(a)}</dt>
            <dd className="min-w-0 flex-1 font-mono text-[13px] break-all">{v ? show(v) : <span className="text-muted">…</span>}</dd>
            {v && <CopyDigest text={show(v)} />}
          </div>
        );
      })}
    </dl>
  );
}

/** Icon-only copy button so long digests keep their room */
function CopyDigest({ text }: { text: string }) {
  const t = useT();
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel hover:text-fg"
      title={t.common.copy}
      aria-label={t.common.copy}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* clipboard blocked: nothing to show */
        }
      }}
    >
      {ok ? <CheckCircle2 size={15} className="text-ok" /> : <CopyIcon size={14} strokeWidth={2.2} />}
    </button>
  );
}

export default withI18n(FileHash);
