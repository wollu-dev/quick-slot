/**
 * Screen recording with the browser's own APIs: getDisplayMedia picks the screen, window or tab,
 * MediaRecorder encodes it. Nothing leaves the device.
 */

export type RecFormat = 'mp4' | 'webm';
export type RecQuality = 'small' | 'standard' | 'high';

export const BITRATE: Record<RecQuality, number> = { small: 2_500_000, standard: 5_000_000, high: 10_000_000 };

const CANDIDATES: Record<RecFormat, string[]> = {
  mp4: ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4'],
  webm: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'],
};

/** The first MIME type this browser's MediaRecorder supports for the format, if any */
export function mimeFor(format: RecFormat): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATES[format].find((m) => MediaRecorder.isTypeSupported(m));
}

export const canRecordScreen = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';

export interface Capture {
  /** What MediaRecorder records: the screen's video plus one mixed audio track */
  stream: MediaStream;
  /** Video only, for the live preview */
  preview: MediaStream;
  /** The microphone was asked for but not allowed */
  micDenied: boolean;
  stop: () => void;
}

/**
 * Asks the user for a screen, window or tab, and optionally the microphone, and mixes the audio
 * into a single track (MediaRecorder records only one audio track).
 */
export async function startCapture(o: { systemAudio: boolean; mic: boolean }): Promise<Capture> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30 } },
    audio: o.systemAudio,
    // Chrome-only hints, ignored elsewhere: offer system audio and let the user switch tabs while recording
    ...({ systemAudio: o.systemAudio ? 'include' : 'exclude', surfaceSwitching: 'include' } as object),
  });
  let mic: MediaStream | null = null;
  let micDenied = false;
  if (o.mic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      micDenied = true;
    }
  }
  const audioIn = [display, mic].filter((s): s is MediaStream => !!s && s.getAudioTracks().length > 0);
  let ctx: AudioContext | null = null;
  let audio: MediaStreamTrack[] = [];
  if (audioIn.length === 1) audio = audioIn[0].getAudioTracks();
  else if (audioIn.length > 1) {
    ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    for (const s of audioIn) ctx.createMediaStreamSource(s).connect(dest);
    audio = dest.stream.getAudioTracks();
  }
  const video = display.getVideoTracks();
  return {
    stream: new MediaStream([...video, ...audio]),
    preview: new MediaStream(video),
    micDenied,
    stop: () => {
      display.getTracks().forEach((t) => t.stop());
      mic?.getTracks().forEach((t) => t.stop());
      ctx?.close().catch(() => {});
    },
  };
}

/** WebM from MediaRecorder has no duration, which breaks seeking in many players: write it in */
export async function finishWebm(blob: Blob, ms: number): Promise<Blob> {
  // The fix reads the whole file into memory; skip it for very large recordings
  if (!blob.type.includes('webm') || blob.size > 1024 ** 3) return blob;
  const { default: fix } = await import('fix-webm-duration');
  return fix(blob, ms, { logger: false });
}

/** 83 → "1:23", 3725 → "1:02:05" */
export function clock(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}
