interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  label?: string;
}

/** Segmented control (pick one of several options) */
export default function Segmented<T extends string>({ value, onChange, options, label }: Props<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>
          {text}
        </button>
      ))}
    </div>
  );
}
