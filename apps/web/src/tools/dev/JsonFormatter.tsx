import { useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import Select from '../../components/ui/Select';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n, type Dict } from '../../i18n';
import { downloadBlob } from '../../lib/files';

type Indent = '2' | '4' | 'tab';
type HintCode = keyof Dict['json']['hints'];

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}

/**
 * Minimal JSON validator that locates errors itself.
 * JSON.parse error messages differ between browsers (Chrome doesn't report the position), so we compute it ourselves.
 * The cause is returned as a code (HintCode) and the UI turns it into localized text.
 */
function findErrorAt(src: string): { pos: number; hint?: HintCode } {
  let i = 0;
  const fail = (hint: HintCode): never => {
    throw { pos: i, hint };
  };
  const ws = () => {
    while (i < src.length && ' \t\n\r'.includes(src[i])) i++;
  };
  const value = (): void => {
    ws();
    const c = src[i];
    if (c === '{') {
      i++;
      ws();
      if (src[i] === '}') return void i++;
      for (;;) {
        ws();
        if (src[i] === '}') fail('trailingComma');
        if (src[i] === "'") fail('keySingleQuote');
        if (src[i] !== '"') fail('keyNotString');
        string();
        ws();
        if (src[i] !== ':') fail('missingColon');
        i++;
        value();
        ws();
        if (src[i] === ',') {
          i++;
          continue;
        }
        if (src[i] === '}') return void i++;
        fail('objectSeparator');
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (src[i] === ']') return void i++;
      for (;;) {
        ws();
        if (src[i] === ']') fail('trailingComma');
        value();
        ws();
        if (src[i] === ',') {
          i++;
          continue;
        }
        if (src[i] === ']') return void i++;
        fail('arraySeparator');
      }
    }
    if (c === '"') return string();
    if (c === "'") fail('stringSingleQuote');
    const lit = src.slice(i).match(/^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?)/);
    if (lit) return void (i += lit[0].length);
    if (i >= src.length) fail('unexpectedEnd');
    fail('unknownValue');
  };
  const string = () => {
    i++;
    while (i < src.length && src[i] !== '"') {
      if (src[i] === '\\') i++;
      else if (src[i] === '\n') fail('newlineInString');
      i++;
    }
    if (i >= src.length) fail('unterminatedString');
    i++;
  };
  try {
    value();
    ws();
    if (i < src.length) fail('trailingContent');
  } catch (e) {
    if (e && typeof e === 'object' && 'pos' in e) return e as { pos: number; hint: HintCode };
    throw e;
  }
  return { pos: -1 };
}

function describeError(src: string, e: Error): { message: string; hint?: HintCode; line?: number; col?: number } {
  const { pos, hint } = findErrorAt(src);
  if (pos < 0) return { message: e.message };
  const before = src.slice(0, pos);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  return { message: e.message, hint, line, col };
}

function JsonFormatter() {
  const t = useT();
  const j = t.json;
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState<Indent>('2');
  const [sorted, setSorted] = useState(false);
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null);

  const run = (mode: 'pretty' | 'minify') => {
    if (!input.trim()) return;
    try {
      let v = JSON.parse(input);
      if (sorted) v = sortKeys(v);
      const space = mode === 'minify' ? undefined : indent === 'tab' ? '\t' : Number(indent);
      setOutput(JSON.stringify(v, null, space));
      setError(null);
    } catch (e) {
      setError(describeError(input, e as Error));
      setOutput('');
    }
  };

  const errorLine = error?.line ? input.split('\n')[error.line - 1] : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => run('pretty')} disabled={!input.trim()}>
          {j.format}
        </button>
        <button type="button" className="btn" onClick={() => run('minify')} disabled={!input.trim()}>
          {j.minify}
        </button>
        <Select
          id="indent"
          label={j.indent}
          className="w-auto min-w-28"
          value={indent}
          onChange={setIndent}
          options={[
            ['2', j.spaces(2)],
            ['4', j.spaces(4)],
            ['tab', j.tab],
          ]}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} /> {j.sortKeys}
        </label>
        <span className="ml-auto text-xs text-muted">
          <span className="kbd">Ctrl Enter</span> {j.shortcut}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">
          <p className="font-medium">
            {j.errorTitle}
            {error.line && error.col && j.errorAt(error.line, error.col)}
          </p>
          {error.hint && <p className="mt-0.5">{j.hints[error.hint]}</p>}
          <p className="mt-0.5 text-xs opacity-60">{error.message}</p>
          {errorLine !== undefined && error.col && (
            <pre className="mt-2 overflow-x-auto font-mono text-xs text-fg">
              {errorLine}
              {'\n'}
              <span className="text-danger">{' '.repeat(Math.max(0, error.col - 1))}^</span>
            </pre>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPanel
          label={t.common.input}
          value={input}
          onChange={setInput}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run('pretty');
          }}
          placeholder={j.placeholder}
          minHeight="min-h-[60vh]"
        />
        <TextPanel
          label={t.common.result}
          value={output}
          minHeight="min-h-[60vh]"
          actions={
            output && (
              <>
                <CopyButton text={output} />
                <button type="button" className="btn" onClick={() => downloadBlob(new Blob([output], { type: 'application/json' }), 'formatted.json')}>
                  {t.common.save}
                </button>
              </>
            )
          }
        />
      </div>
    </div>
  );
}

export default withI18n(JsonFormatter);
