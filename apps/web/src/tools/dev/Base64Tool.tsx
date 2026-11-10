import { useMemo, useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import DropZone from '../../components/ui/DropZone';
import Segmented from '../../components/ui/Segmented';
import { useT, withI18n } from '../../i18n';
import { formatBytes } from '../../lib/files';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  let s = b64.trim().replace(/^data:[^,]*,/, '').replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const toUrlSafe = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function Base64Tool() {
  const t = useT();
  const b = t.base64;
  const [tab, setTab] = useState<'text' | 'file'>('text');
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [text, setText] = useState('');
  const [urlSafe, setUrlSafe] = useState(false);
  const [fileOut, setFileOut] = useState<{ name: string; size: number; b64: string; mime: string } | null>(null);
  const [asDataUrl, setAsDataUrl] = useState(false);

  const result = useMemo(() => {
    if (!text) return { value: '' };
    try {
      if (direction === 'encode') {
        const enc = bytesToBase64(new TextEncoder().encode(text));
        return { value: urlSafe ? toUrlSafe(enc) : enc };
      }
      return { value: new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(text)) };
    } catch {
      return { value: '', error: direction === 'decode' ? b.decodeError : b.encodeError };
    }
  }, [text, direction, urlSafe, b]);

  const fileValue = fileOut ? (asDataUrl ? `data:${fileOut.mime || 'application/octet-stream'};base64,${fileOut.b64}` : urlSafe ? toUrlSafe(fileOut.b64) : fileOut.b64) : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={b.inputKind}
          value={tab}
          onChange={setTab}
          options={[
            ['text', b.text],
            ['file', b.file],
          ]}
        />
        {tab === 'text' && (
          <Segmented
            label={b.direction}
            value={direction}
            onChange={setDirection}
            options={[
              ['encode', b.encode],
              ['decode', b.decode],
            ]}
          />
        )}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={urlSafe} onChange={(e) => setUrlSafe(e.target.checked)} /> {b.urlSafe}
        </label>
        {tab === 'file' && (
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={asDataUrl} onChange={(e) => setAsDataUrl(e.target.checked)} /> {b.dataUrl}
          </label>
        )}
      </div>

      {tab === 'text' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={direction === 'encode' ? b.encodePlaceholder : b.decodePlaceholder}
            className="input min-h-[40vh] resize-y font-mono text-[13px]"
          />
          <div className="relative">
            <textarea readOnly value={result.value} spellCheck={false} placeholder={t.common.result} className="input min-h-[40vh] resize-y bg-panel font-mono text-[13px]" />
            {result.error && <p className="mt-1 text-sm text-danger">{result.error}</p>}
            {result.value && <CopyButton text={result.value} className="absolute top-3 right-3" />}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <DropZone
            multiple={false}
            compact={!!fileOut}
            hint={b.fileHint}
            onFiles={async ([f]) => {
              const b64 = bytesToBase64(new Uint8Array(await f.arrayBuffer()));
              setFileOut({ name: f.name, size: f.size, b64, mime: f.type });
            }}
          />
          {fileOut && (
            <div className="panel space-y-2 p-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-mono">{fileOut.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {formatBytes(fileOut.size)} → {formatBytes(fileValue.length)}
                </span>
                <CopyButton text={fileValue} />
              </div>
              <textarea readOnly value={fileValue} className="input h-48 font-mono text-[11px]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default withI18n(Base64Tool);
