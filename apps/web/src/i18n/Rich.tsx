import { Fragment } from 'react';

/**
 * 사전 문자열의 간단한 서식: **굵게**, `코드`.
 * 번역문 안에서 강조 위치가 언어마다 달라서 문장을 조각내지 않고 이렇게 표시한다.
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
