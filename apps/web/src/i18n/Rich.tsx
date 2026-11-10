import { Fragment } from 'react';

/**
 * Minimal formatting for dictionary strings: **bold**, `code`.
 * Where the emphasis falls differs between languages, so it is marked inline like this instead of splitting sentences into pieces.
 */
export default function Rich({ text, codeClassName = 'kbd' }: { text: string; codeClassName?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <b key={i} className="font-semibold text-fg">
            {p.slice(2, -2)}
          </b>
        ) : p.startsWith('`') ? (
          <code key={i} className={codeClassName}>
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
