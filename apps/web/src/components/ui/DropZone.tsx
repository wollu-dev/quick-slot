import { useRef, useState } from 'react';
import { ArrowUp, Plus } from 'lucide-react';

interface Props {
  onFiles: (files: File[]) => void;
  /** <input accept> 값 (예: "image/jpeg,image/png") */
  accept?: string;
  multiple?: boolean;
  hint?: string;
  compact?: boolean;
}

/** 드래그 앤 드롭 + 클릭해서 파일 선택. 폴더를 떨어뜨리면 안의 파일을 모두 읽는다. */
export default function DropZone({ onFiles, accept, multiple = true, hint, compact }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const items = [...e.dataTransfer.items];
    const entries = items.map((it) => it.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[];
    const files = entries.length ? (await Promise.all(entries.map(readEntry))).flat() : [...e.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`glass flex cursor-pointer flex-col items-center justify-center text-center transition duration-300 outline-none focus-visible:ring-4 focus-visible:ring-accent/25 ${
        over ? 'scale-[1.01] !border-accent ring-4 ring-accent/20' : 'hover:-translate-y-0.5'
      } ${compact ? 'flex-row gap-3 rounded-[18px] px-4 py-3.5' : 'gap-2 rounded-[26px] px-6 py-16'}`}
    >
      <span
        className={`grid place-items-center rounded-full bg-accent/12 text-accent transition ${over ? 'scale-110' : ''} ${compact ? 'size-9' : 'mb-2 size-16'}`}
        aria-hidden
      >
        {compact ? <Plus size={18} strokeWidth={2.4} /> : <ArrowUp size={28} strokeWidth={2.2} />}
      </span>
      <span className={compact ? 'text-[14px] font-medium' : 'text-[17px] font-semibold'}>
        {compact ? '파일 더 추가하기' : '파일을 여기로 끌어다 놓으세요'}
      </span>
      {!compact && <span className="text-[14px] text-accent">또는 클릭해서 선택</span>}
      {hint && !compact && <span className="mt-1 text-[13px] text-muted">{hint}</span>}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((res) => (entry as FileSystemFileEntry).file((f) => res([f]), () => res([])));
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: FileSystemEntry[] = [];
    // readEntries 는 한 번에 최대 100개씩만 돌려주므로 빈 배열이 나올 때까지 반복
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res) => reader.readEntries(res, () => res([])));
      if (!batch.length) break;
      all.push(...batch);
    }
    return (await Promise.all(all.map(readEntry))).flat();
  }
  return [];
}
