import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { LOCALES, useLang, useT, withI18n, type Lang } from '../i18n';
import { tools, toolText, toolUrl, type Tool } from '../tools/registry';
import { readSlots } from '../lib/slots';
import AppIcon from './ui/AppIcon';

/** 지금 언어의 이름·설명을 가장 높게, 다른 언어 이름과 키워드도 찾을 수 있게 */
function score(tool: Tool, q: string, lang: Lang): number {
  if (!q) return 1;
  const { name, description } = toolText(lang, tool.slug);
  const n = name.toLowerCase();
  if (n.startsWith(q)) return 100;
  if (n.includes(q)) return 80;
  if (tool.keywords.some((k) => k.toLowerCase().startsWith(q))) return 60;
  if (LOCALES.some((l) => l !== lang && toolText(l, tool.slug).name.toLowerCase().includes(q))) return 50;
  if (tool.keywords.some((k) => k.toLowerCase().includes(q))) return 40;
  if (description.toLowerCase().includes(q)) return 20;
  return 0;
}

/** 헤더의 검색 버튼 + 스포트라이트형 검색 창 + 전역 단축키 */
function CommandPalette() {
  const t = useT();
  const lang = useLang();
  const label = t.header.search;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools
      .map((tool) => ({ tool, s: score(tool, q, lang) + (tool.status === 'ready' ? 1 : 0) }))
      .filter((r) => r.s > (q ? 1 : 0))
      .sort((a, b) => b.s - a.s)
      .map((r) => r.tool);
  }, [query, lang]);

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
          location.href = toolUrl(slug, lang);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lang]);

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
    if (tool) location.href = toolUrl(tool.slug, lang);
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
        className="flex h-9 w-full items-center gap-2 rounded-full bg-panel-2 px-4 text-[14px] text-muted transition hover:bg-[color-mix(in_srgb,var(--panel-2)_100%,var(--fg)_6%)]"
      >
        <Search size={16} strokeWidth={2.2} className="shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <span className="kbd hidden bg-transparent sm:inline-flex">Ctrl K</span>
      </button>

      {/* 헤더의 backdrop-filter 가 fixed 요소의 기준이 되어버리므로 body 로 portal */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/15 px-4 pt-[14vh] backdrop-blur-md dark:bg-black/45"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="glass-strong w-full max-w-[620px] overflow-hidden rounded-[26px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]" role="dialog" aria-label={label}>
              <div className="flex items-center gap-3 px-5">
                <Search size={22} strokeWidth={2.2} className="shrink-0 text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={label}
                  className="h-16 w-full bg-transparent text-[22px] tracking-tight outline-none placeholder:text-muted/70"
                />
              </div>
              {results.length > 0 && <div className="mx-5 h-px bg-line" />}
              <ul ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
                {results.length === 0 && <li className="px-3 py-8 text-center text-[15px] text-muted">{t.palette.noResults}</li>}
                {results.map((tool, i) => {
                  const { name, description } = toolText(lang, tool.slug);
                  return (
                    <li key={tool.slug} data-idx={i}>
                      <button
                        type="button"
                        onMouseMove={() => setActive(i)}
                        onClick={() => go(tool)}
                        className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors ${i === active ? 'bg-accent text-accent-fg' : ''}`}
                      >
                        <AppIcon tool={tool} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium">{name}</span>
                          <span className={`block truncate text-[12px] ${i === active ? 'text-accent-fg/80' : 'text-muted'}`}>
                            {tool.status === 'soon' ? `${t.common.comingSoon} · ` : ''}
                            {description}
                          </span>
                        </span>
                        {i === active && <CornerDownLeft size={16} className="shrink-0 opacity-80" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default withI18n(CommandPalette);
