import { useEffect, useMemo, useRef, useState } from 'react';
import { tools, getCategory, toolUrl, type Tool } from '../tools/registry';
import { readSlots } from '../lib/slots';

function score(tool: Tool, q: string): number {
  if (!q) return 1;
  const name = tool.name.toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 80;
  if (tool.keywords.some((k) => k.toLowerCase().startsWith(q))) return 60;
  if (tool.keywords.some((k) => k.toLowerCase().includes(q))) return 40;
  if (tool.description.toLowerCase().includes(q)) return 20;
  return 0;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools
      .map((tool) => ({ tool, s: score(tool, q) + (tool.status === 'ready' ? 1 : 0) }))
      .filter((r) => r.s > (q ? 1 : 0))
      .sort((a, b) => b.s - a.s)
      .map((r) => r.tool);
  }, [query]);

  // 전역 단축키: Ctrl/Cmd+K, '/' 로 열기, Alt+1~9 로 퀵슬롯 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setOpen(true);
      } else if (e.altKey && /^Digit[1-9]$/.test(e.code)) {
        const slug = readSlots()[Number(e.code.slice(5)) - 1];
        if (slug) {
          e.preventDefault();
          location.href = toolUrl(slug);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (tool: Tool | undefined) => {
    if (tool) location.href = toolUrl(tool.slug);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      go(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full max-w-xs items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-muted transition hover:border-muted"
      >
        <span aria-hidden>🔍</span>
        <span className="flex-1 text-left">툴 검색...</span>
        <span className="kbd hidden sm:inline">Ctrl K</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="panel w-full max-w-lg overflow-hidden shadow-2xl" role="dialog" aria-label="툴 검색">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="무엇이 필요하세요? (예: 확장자, json, 글자수)"
              className="w-full border-b border-line bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted"
            />
            <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">검색 결과가 없어요</li>}
              {results.map((tool, i) => (
                <li key={tool.slug} data-idx={i}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(tool)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? 'bg-panel-2' : ''}`}
                  >
                    <span aria-hidden className="text-lg">{getCategory(tool.category).icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {tool.name}
                        {tool.status === 'soon' && <span className="ml-2 text-xs font-normal text-muted">준비 중</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">{tool.description}</span>
                    </span>
                    {i === active && <span className="kbd">Enter</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
