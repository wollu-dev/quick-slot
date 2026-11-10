import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import CopyButton from '../../components/ui/CopyButton';
import Segmented from '../../components/ui/Segmented';
import TextPanel from '../../components/ui/TextPanel';
import { useT, withI18n } from '../../i18n';
import { detectDirection, engToKor, korToEng, type Direction } from '../../lib/hangulTypo';

type Mode = 'auto' | Direction;

function KoreanEnglishTypo() {
  const t = useT();
  const k = t.typo;
  const [mode, setMode] = useState<Mode>('auto');
  const [input, setInput] = useState('');

  const direction: Direction = mode === 'auto' ? detectDirection(input) : mode;
  const output = direction === 'engToKor' ? engToKor(input) : korToEng(input);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={k.direction}
          value={mode}
          onChange={setMode}
          options={[
            ['auto', k.auto],
            ['engToKor', k.engToKor],
            ['korToEng', k.korToEng],
          ]}
        />
        {mode === 'auto' && input.trim() && <span className="text-[13px] text-muted">{k.detected(direction === 'engToKor' ? k.engToKor : k.korToEng)}</span>}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <TextPanel
          label={t.common.input}
          value={input}
          onChange={setInput}
          placeholder={k.placeholder}
          actions={
            <button type="button" className="btn" onClick={() => setInput('dkssudgktpdy. ghkdlxld!')}>
              {k.sample}
            </button>
          }
        />
        <TextPanel
          label={t.common.result}
          value={output}
          actions={
            <>
              <button
                type="button"
                className="btn"
                disabled={!output}
                title={k.useResult}
                onClick={() => {
                  setInput(output);
                  setMode('auto');
                }}
              >
                <ArrowRightLeft size={15} strokeWidth={2.2} />
                <span className="hidden sm:inline">{k.useResult}</span>
              </button>
              <CopyButton text={output} />
            </>
          }
        />
      </div>
      <p className="px-1 text-[13px] text-muted">{k.note}</p>
    </div>
  );
}

export default withI18n(KoreanEnglishTypo);
