import { useRef, useState } from 'react';

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
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center transition ${
        over ? 'border-accent bg-accent/5' : 'border-line hover:border-muted'
      } ${compact ? 'px-4 py-5' : 'px-6 py-12'}`}
    >
      <span className={compact ? 'text-xl' : 'text-3xl'} aria-hidden>
        📂
      </span>
      <span className="text-sm font-medium">{compact ? '파일 더 추가하기' : '파일을 끌어다 놓거나 클릭해서 선택'}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
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
