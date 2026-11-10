import { useState } from 'react';
import CopyButton from '../../components/ui/CopyButton';
import Select from '../../components/ui/Select';
import { downloadBlob } from '../../lib/files';

type Indent = '2' | '4' | 'tab';

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}

/**
 * 오류 위치를 직접 찾는 최소 JSON 검사기.
 * 브라우저마다 JSON.parse 오류 메시지 형식이 달라서(Chrome 은 위치를 안 알려줌) 직접 계산한다.
 */
function findErrorAt(src: string): { pos: number; hint: string } {
  let i = 0;
  const fail = (hint: string): never => {
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
        if (src[i] === '}') fail('마지막 항목 뒤에 쉼표(,)가 있어요');
        if (src[i] === "'") fail('키는 큰따옴표(")로 감싸야 해요');
        if (src[i] !== '"') fail('키는 큰따옴표로 감싼 문자열이어야 해요');
        string();
        ws();
        if (src[i] !== ':') fail('키 뒤에 콜론(:)이 필요해요');
        i++;
        value();
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') return void i++;
        fail('쉼표(,) 또는 닫는 괄호(})가 필요해요');
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (src[i] === ']') return void i++;
      for (;;) {
        ws();
        if (src[i] === ']') fail('마지막 항목 뒤에 쉼표(,)가 있어요');
        value();
        ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') return void i++;
        fail('쉼표(,) 또는 닫는 괄호(])가 필요해요');
      }
    }
    if (c === '"') return string();
    if (c === "'") fail('문자열은 큰따옴표(")로 감싸야 해요');
    const lit = src.slice(i).match(/^(true|false|null|-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?)/);
    if (lit) return void (i += lit[0].length);
    if (i >= src.length) fail('내용이 중간에 끝났어요 (괄호가 닫히지 않음)');
    fail('알 수 없는 값이에요');
  };
  const string = () => {
    i++;
    while (i < src.length && src[i] !== '"') {
      if (src[i] === '\\') i++;
      else if (src[i] === '\n') fail('문자열 안에 줄바꿈이 있어요 (\\n 으로 쓰세요)');
      i++;
    }
    if (i >= src.length) fail('문자열의 닫는 따옴표가 없어요');
    i++;
  };
  try {
    value();
    ws();
    if (i < src.length) fail('JSON 값 뒤에 불필요한 내용이 있어요');
  } catch (e) {
    if (e && typeof e === 'object' && 'pos' in e) return e as { pos: number; hint: string };
    throw e;
  }
  return { pos: -1, hint: '' };
}

function describeError(src: string, e: Error): { message: string; hint?: string; line?: number; col?: number } {
  const { pos, hint } = findErrorAt(src);
  if (pos < 0) return { message: e.message };
  const before = src.slice(0, pos);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  return { message: e.message, hint, line, col };
}

export default function JsonFormatter() {
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
        <button type="button" className="btn btn-primary" onClick={() => run('pretty')} disabled={!input.trim()}>정렬하기</button>
        <button type="button" className="btn" onClick={() => run('minify')} disabled={!input.trim()}>한 줄로 압축</button>
        <Select
          id="indent"
          label="들여쓰기"
          className="w-auto min-w-28"
          value={indent}
          onChange={setIndent}
          options={[
            ['2', '공백 2칸'],
            ['4', '공백 4칸'],
            ['tab', '탭'],
          ]}
        />
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={sorted} onChange={(e) => setSorted(e.target.checked)} /> 키 이름순 정렬
        </label>
        <span className="ml-auto text-xs text-muted"><span className="kbd">Ctrl Enter</span> 정렬</span>
      </div>

      {error && (
        <div className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">
          <p className="font-medium">
            JSON 오류{error.line && ` — ${error.line}번째 줄, ${error.col}번째 칸`}
          </p>
          {error.hint && <p className="mt-0.5">{error.hint}</p>}
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

      <div className="grid gap-3 lg:grid-cols-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run('pretty');
          }}
          spellCheck={false}
          placeholder='{"여기에": "JSON을 붙여넣으세요"}'
          className="input min-h-[60vh] resize-y font-mono text-[13px]"
        />
        <div className="relative">
          <textarea readOnly value={output} spellCheck={false} placeholder="결과" className="input min-h-[60vh] resize-y bg-panel font-mono text-[13px]" />
          {output && (
            <div className="absolute right-3 top-3 flex gap-2">
              <CopyButton text={output} />
              <button type="button" className="btn" onClick={() => downloadBlob(new Blob([output], { type: 'application/json' }), 'formatted.json')}>저장</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
