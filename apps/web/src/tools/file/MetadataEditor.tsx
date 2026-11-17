import { useEffect, useMemo, useState } from 'react';
import { Download, MapPin, X } from 'lucide-react';
import DateTimePicker from '../../components/ui/DateTimePicker';
import DropZone from '../../components/ui/DropZone';
import NumberField from '../../components/ui/NumberField';
import Segmented from '../../components/ui/Segmented';
import { LANG_TAGS, useLang, useT } from '../../i18n';
import {
  exifDateToLocal,
  findExif,
  getGps,
  getText,
  localToExifDate,
  readTags,
  replaceExif,
  setGps,
  setText,
  shiftExifDate,
  TAG,
  writeTiff,
  type Tags,
} from '../../lib/exifEdit';
import { downloadBlob, makeZip, timestampForFilename } from '../../lib/files';
import { detectFormat } from '../../lib/metadata';

type TextKey = 'make' | 'model' | 'artist' | 'copyright' | 'description';
const TEXT_KEYS: TextKey[] = ['description', 'artist', 'copyright', 'make', 'model'];

interface Photo {
  file: File;
  bytes?: Uint8Array;
  tags?: Tags;
  notJpeg?: boolean;
}

interface Current {
  date?: string;
  gps: { lat: number; lon: number } | null;
  text: Record<TextKey, string | undefined>;
}

/** What a photo holds now (Windows' own Unicode tags win over the plain ones when both exist) */
function current(tags: Tags): Current {
  return {
    date: getText(tags, 'exif', TAG.dateOriginal) ?? getText(tags, 'ifd0', TAG.dateTime),
    gps: getGps(tags),
    text: {
      make: getText(tags, 'ifd0', TAG.make),
      model: getText(tags, 'ifd0', TAG.model),
      artist: getText(tags, 'ifd0', TAG.xpAuthor) ?? getText(tags, 'ifd0', TAG.artist),
      copyright: getText(tags, 'ifd0', TAG.copyright),
      description: getText(tags, 'ifd0', TAG.xpTitle) ?? getText(tags, 'ifd0', TAG.description),
    },
  };
}

/** "37.5665, 126.978" or "37.5665 126.978" → coordinates, if valid */
function parseLatLon(s: string): { lat: number; lon: number } | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

type DateMode = 'keep' | 'set' | 'shift';
type GpsMode = 'keep' | 'remove' | 'set';

export default function MetadataEditor({ files, setFiles }: { files: File[]; setFiles: React.Dispatch<React.SetStateAction<File[]>> }) {
  const t = useT();
  const e = t.metaEdit;
  const lang = useLang();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dateMode, setDateMode] = useState<DateMode>('keep');
  const [dateValue, setDateValue] = useState('');
  const [shiftH, setShiftH] = useState(0);
  const [shiftM, setShiftM] = useState(0);
  const [gpsMode, setGpsMode] = useState<GpsMode>('keep');
  const [gpsText, setGpsText] = useState('');
  /** Text fields the user has touched, with their new value ('' removes the tag) */
  const [edits, setEdits] = useState<Partial<Record<TextKey, string>>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      files.map(async (file): Promise<Photo> => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (detectFormat(bytes) !== 'jpeg') return { file, notJpeg: true };
        return { file, bytes, tags: readTags(findExif(bytes)) };
      }),
    ).then((p) => !cancelled && setPhotos(p));
    return () => {
      cancelled = true;
    };
  }, [files]);

  const jpegs = photos.filter((p) => p.tags);
  const now = useMemo(() => jpegs.map((p) => current(p.tags!)), [photos]);

  // Start the date picker at the first photo's date
  useEffect(() => {
    if (!dateValue && now[0]?.date) setDateValue(exifDateToLocal(now[0].date) ?? '');
  }, [now]);

  /** The value shared by every photo, or undefined when they differ */
  const shared = (k: TextKey) => (now.length && now.every((c) => c.text[k] === now[0].text[k]) ? (now[0].text[k] ?? '') : undefined);
  const gpsTarget = gpsMode === 'set' ? parseLatLon(gpsText) : null;
  const shiftMinutes = shiftH * 60 + shiftM;
  const invalid = (gpsMode === 'set' && !gpsTarget) || (dateMode === 'set' && !dateValue);
  const changes = dateMode !== 'keep' || gpsMode !== 'keep' || Object.keys(edits).length > 0;

  const fmtDate = (exif?: string) => {
    const l = exifDateToLocal(exif);
    if (!l) return e.none;
    return new Date(l).toLocaleString(LANG_TAGS[lang], { dateStyle: 'medium', timeStyle: 'short' });
  };
  const newDate = (c: Current) => (dateMode === 'set' ? localToExifDate(dateValue) : dateMode === 'shift' && c.date ? shiftExifDate(c.date, shiftMinutes) : c.date);

  const apply = (p: Photo): Uint8Array => {
    const tags = readTags(findExif(p.bytes!));
    if (dateMode !== 'keep') {
      for (const [ifd, tag] of [
        ['ifd0', TAG.dateTime],
        ['exif', TAG.dateOriginal],
        ['exif', TAG.dateDigitized],
      ] as const) {
        const old = getText(tags, ifd, tag);
        if (dateMode === 'set') setText(tags, ifd, tag, localToExifDate(dateValue));
        else if (old) setText(tags, ifd, tag, shiftExifDate(old, shiftMinutes));
      }
    }
    if (gpsMode === 'remove') setGps(tags, null);
    if (gpsMode === 'set' && gpsTarget) setGps(tags, gpsTarget);
    for (const [k, v] of Object.entries(edits) as [TextKey, string][]) {
      const value = v.trim();
      if (k === 'artist') {
        setText(tags, 'ifd0', TAG.artist, value);
        setText(tags, 'ifd0', TAG.xpAuthor, value);
      } else if (k === 'description') {
        setText(tags, 'ifd0', TAG.description, value);
        setText(tags, 'ifd0', TAG.xpTitle, value);
      } else setText(tags, 'ifd0', TAG[k], value);
    }
    return replaceExif(p.bytes!, writeTiff(tags));
  };

  const save = () => {
    setFailed(false);
    try {
      if (jpegs.length === 1) downloadBlob(new Blob([apply(jpegs[0]) as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }), jpegs[0].file.name);
      else downloadBlob(makeZip(jpegs.map((p) => ({ name: p.file.name, data: apply(p) }))), `quickslot-edited-${timestampForFilename()}.zip`);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="panel min-w-0 space-y-4 self-start p-4">
        <div className="space-y-2">
          <span className="label block">{e.date}</span>
          <Segmented
            label={e.date}
            value={dateMode}
            onChange={setDateMode}
            options={[
              ['keep', e.keep],
              ['set', e.dateSet],
              ['shift', e.dateShift],
            ]}
          />
          {dateMode === 'set' && <DateTimePicker id="me-date" label={e.date} value={dateValue} onChange={setDateValue} />}
          {dateMode === 'shift' && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <NumberField id="me-shift-h" value={shiftH} onChange={setShiftH} min={-48} max={48} className="min-w-0 flex-1" />
                  <span className="shrink-0 text-muted">{e.hours}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <NumberField id="me-shift-m" value={shiftM} onChange={setShiftM} min={-59} max={59} step={5} className="min-w-0 flex-1" />
                  <span className="shrink-0 text-muted">{e.minutes}</span>
                </label>
              </div>
              <p className="text-xs text-muted">{e.shiftNote}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <span className="label block">{e.location}</span>
          <Segmented
            label={e.location}
            value={gpsMode}
            onChange={setGpsMode}
            options={[
              ['keep', e.keep],
              ['remove', e.remove],
              ['set', e.gpsSet],
            ]}
          />
          {gpsMode === 'set' && (
            <div className="space-y-1">
              <input
                className={`input w-full font-mono text-[13px] ${gpsText && !gpsTarget ? 'ring-2 ring-danger/50' : ''}`}
                value={gpsText}
                onChange={(ev) => setGpsText(ev.target.value)}
                placeholder="37.5665, 126.9780"
                aria-label={e.location}
                spellCheck={false}
              />
              <p className={`text-xs ${gpsText && !gpsTarget ? 'text-danger' : 'text-muted'}`}>{gpsText && !gpsTarget ? e.gpsInvalid : e.gpsNote}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          {TEXT_KEYS.map((k) => {
            const s = shared(k);
            const value = edits[k] ?? s ?? '';
            return (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="label" htmlFor={`me-${k}`}>
                    {e.fields[k]}
                  </label>
                  {k in edits && (
                    <button
                      type="button"
                      className="text-xs text-accent"
                      onClick={() =>
                        setEdits((x) => {
                          const next = { ...x };
                          delete next[k];
                          return next;
                        })
                      }
                    >
                      {e.undo}
                    </button>
                  )}
                </div>
                <input
                  id={`me-${k}`}
                  className={`input w-full ${k in edits ? 'ring-2 ring-accent/40' : ''}`}
                  value={value}
                  placeholder={s === undefined ? e.differs : e.none}
                  onChange={(ev) => setEdits((x) => ({ ...x, [k]: ev.target.value }))}
                />
              </div>
            );
          })}
          <p className="text-xs text-muted">{e.textNote}</p>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <button type="button" className="btn btn-primary w-full" disabled={!jpegs.length || !changes || invalid} onClick={save}>
            <Download size={15} strokeWidth={2.2} />
            {jpegs.length > 1 ? t.common.zipDownload(jpegs.length) : e.save}
          </button>
          {failed && <p className="text-sm text-danger">{e.failed}</p>}
          <button type="button" className="btn w-full" onClick={() => setFiles([])}>
            {t.common.reset}
          </button>
          <p className="text-xs text-muted">{e.lossless}</p>
        </div>
      </aside>

      <section className="min-w-0 space-y-3">
        <DropZone onFiles={(f) => setFiles((list) => [...list, ...f])} accept="image/jpeg,image/png,image/webp" compact />
        <ul className="panel divide-y divide-line">
          {photos.map((p, i) => {
            const c = p.tags ? current(p.tags) : null;
            const nd = c && newDate(c);
            const gpsAfter = c && (gpsMode === 'remove' ? null : gpsMode === 'set' ? gpsTarget : c.gps);
            return (
              <li key={i} className="flex items-start gap-3 py-2.5 pr-1.5 pl-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium" title={p.file.name}>
                    {p.file.name}
                  </p>
                  {p.notJpeg ? (
                    <p className="text-xs text-danger">{e.jpegOnly}</p>
                  ) : c ? (
                    <>
                      <p className="text-xs text-muted">
                        {e.date}: {fmtDate(c.date)}
                        {nd !== c.date && <span className="font-medium text-accent"> → {fmtDate(nd ?? undefined)}</span>}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted">
                        <MapPin size={12} className={c.gps ? 'text-danger' : ''} />
                        {c.gps ? `${c.gps.lat.toFixed(5)}, ${c.gps.lon.toFixed(5)}` : e.none}
                        {gpsMode !== 'keep' && (
                          <span className="font-medium text-accent">→ {gpsAfter ? `${gpsAfter.lat.toFixed(5)}, ${gpsAfter.lon.toFixed(5)}` : e.removed}</span>
                        )}
                      </p>
                      {(c.text.make || c.text.model) && <p className="truncate text-xs text-muted">{[c.text.make, c.text.model].filter(Boolean).join(' ')}</p>}
                    </>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-fg"
                  title={t.common.removeFromList}
                  aria-label={t.common.removeFromList}
                  onClick={() => setFiles((list) => list.filter((f) => f !== p.file))}
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
