/**
 * Tool manifest. See README.md for how to add a new tool.
 * - Names and descriptions live in the per-language dictionaries (tools.<slug> in src/i18n/*.ts), not here.
 * - Tools with status: 'ready' get their component wired up in src/views/ToolPage.astro.
 *   Tools with 'soon' automatically get the "coming soon" screen.
 * - Icons come from lucide-react (https://lucide.dev/icons).
 */
import { getDict, localizePath, type Dict, type Lang } from '../i18n';
import {
  ArrowRightLeft, Binary, Braces, Calculator, CalendarClock, CalendarDays, Clapperboard, Clock, Code, Diff, EyeOff, FileArchive,
  FileImage, FileText, Film, FingerprintPattern, Folder, Hash, Image, Images, KeyRound, Languages, Layers,
  Merge, Palette, PenLine, QrCode, Receipt, Ruler, Scaling, Scissors, ScreenShare, TextCursorInput, Ticket,
  Type, type LucideIcon,
} from 'lucide-react';

export type CategoryId = 'file' | 'pdf' | 'image' | 'media' | 'text' | 'dev' | 'life';

export interface Category {
  id: CategoryId;
  icon: LucideIcon;
  /** App icon tile color */
  color: string;
}

export type ToolSlug = keyof Dict['tools'];

export interface Tool {
  slug: ToolSlug;
  category: CategoryId;
  icon: LucideIcon;
  keywords: string[];
  status: 'ready' | 'soon';
  /** client: files never leave the browser / server: processed on the server and deleted immediately */
  processing: 'client' | 'server';
  /** File types this tool accepts (for smart-drop suggestions; MIME types or extensions) */
  accepts?: string[];
}

export const categories: Category[] = [
  { id: 'file', icon: Folder, color: '#0a84ff' },
  { id: 'pdf', icon: FileText, color: '#ff453a' },
  { id: 'image', icon: Image, color: '#30b158' },
  { id: 'media', icon: Clapperboard, color: '#ff375f' },
  { id: 'text', icon: PenLine, color: '#ff9f0a' },
  { id: 'dev', icon: Code, color: '#5e5ce6' },
  { id: 'life', icon: Calculator, color: '#14a8bd' },
];

/** Tile colors the user can pick for a custom (external) tool */
export const CUSTOM_COLORS = ['#8e8e93', '#0a84ff', '#30b158', '#ff9f0a', '#ff375f', '#5e5ce6', '#14a8bd', '#ac8e68'];

const t = (tool: Omit<Tool, 'processing'> & { processing?: Tool['processing'] }): Tool => ({
  processing: 'client',
  ...tool,
});

export const tools: Tool[] = [
  // File
  t({ slug: 'file-converter', category: 'file', icon: ArrowRightLeft, keywords: ['변환', '형식', '확장자', 'convert', 'converter', 'format', 'extension', 'heic', 'jpg', 'png', 'webp', 'avif', 'mp3', 'mp4', 'webm', 'gif', 'json', 'yaml', 'csv', 'xml', '変換', '拡張子'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'batch-rename', category: 'file', icon: TextCursorInput, keywords: ['이름', 'rename', '일괄', 'batch', '번호', '정규식', 'regex'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'file-date-changer', category: 'file', icon: CalendarClock, keywords: ['날짜', '생성일', '수정일', 'timestamp', 'date', 'touch'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'metadata-remover', category: 'file', icon: EyeOff, keywords: ['메타데이터', 'exif', 'gps', '위치', '개인정보', 'metadata'], status: 'ready', accepts: ['image/jpeg', 'image/png', 'image/webp'] }),
  t({ slug: 'file-hash', category: 'file', icon: FingerprintPattern, keywords: ['해시', 'hash', 'md5', 'sha', 'checksum'], status: 'soon', accepts: ['*'] }),
  t({ slug: 'zip', category: 'file', icon: FileArchive, keywords: ['zip', '압축'], status: 'soon', accepts: ['application/zip', '*'] }),

  // PDF
  t({ slug: 'pdf-merge', category: 'pdf', icon: Merge, keywords: ['pdf', '합치기', 'merge'], status: 'soon', accepts: ['application/pdf'] }),
  t({ slug: 'pdf-split', category: 'pdf', icon: Scissors, keywords: ['pdf', '나누기', 'split', '페이지'], status: 'soon', accepts: ['application/pdf'] }),
  t({ slug: 'image-to-pdf', category: 'pdf', icon: FileImage, keywords: ['pdf', '이미지', '변환'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'office-to-pdf', category: 'pdf', icon: FileText, keywords: ['word', 'excel', 'ppt', 'docx', 'pdf'], status: 'soon', processing: 'server' }),

  // Image
  t({ slug: 'image-compress', category: 'image', icon: Images, keywords: ['이미지', '압축', '용량', 'compress', 'png', 'jpg', 'webp'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'image-resize', category: 'image', icon: Scaling, keywords: ['리사이즈', 'resize', '크기', '자르기', 'crop'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'qr-code', category: 'image', icon: QrCode, keywords: ['qr', '큐알', '코드'], status: 'soon' }),

  // Media
  t({ slug: 'video-to-gif', category: 'media', icon: Film, keywords: ['gif', '영상', 'video', 'mp4'], status: 'soon', accepts: ['video/*'] }),
  t({ slug: 'screen-recorder', category: 'media', icon: ScreenShare, keywords: ['녹화', '화면', 'record', 'screen'], status: 'soon' }),

  // Text
  t({ slug: 'char-counter', category: 'text', icon: Type, keywords: ['글자수', '글자 수', '자소서', '바이트', 'count', '단어'], status: 'ready' }),
  t({ slug: 'text-diff', category: 'text', icon: Diff, keywords: ['비교', 'diff', '차이'], status: 'soon' }),
  t({ slug: 'korean-english-typo', category: 'text', icon: Languages, keywords: ['한영', '타자', '오타', '한글'], status: 'soon' }),

  // Dev
  t({ slug: 'json-formatter', category: 'dev', icon: Braces, keywords: ['json', '포맷', 'format', 'prettify', 'minify', '검증'], status: 'ready', accepts: ['application/json', '.json'] }),
  t({ slug: 'base64', category: 'dev', icon: Binary, keywords: ['base64', '인코딩', '디코딩', 'encode', 'decode'], status: 'ready' }),
  t({ slug: 'unix-timestamp', category: 'dev', icon: Clock, keywords: ['timestamp', '타임스탬프', 'unix', 'epoch', '시간'], status: 'ready' }),
  t({ slug: 'uuid-generator', category: 'dev', icon: Hash, keywords: ['uuid', 'guid', '생성', 'id'], status: 'ready' }),
  t({ slug: 'password-generator', category: 'dev', icon: KeyRound, keywords: ['비밀번호', 'password', '랜덤', 'random', 'generator', 'パスワード'], status: 'ready' }),
  t({ slug: 'jwt-decoder', category: 'dev', icon: Ticket, keywords: ['jwt', 'token', '토큰', 'decode', '디코드', 'bearer', 'claims', 'トークン'], status: 'ready' }),
  t({ slug: 'color-converter', category: 'dev', icon: Palette, keywords: ['색상', '색', 'color', 'colour', 'hex', 'rgb', 'hsl', 'hsv', 'picker', 'unity', 'unreal', 'godot', 'linear', 'contrast', '대비', '色', 'カラー'], status: 'ready' }),
  t({ slug: 'normal-map-flip', category: 'dev', icon: Layers, keywords: ['노멀맵', 'normal', 'unity', 'unreal', '게임', 'texture'], status: 'soon', accepts: ['image/*'] }),

  // Everyday
  t({ slug: 'date-calculator', category: 'life', icon: CalendarDays, keywords: ['날짜', 'dday', 'd-day', '디데이', '나이', '만나이', '만 나이', '계산', '기념일', '평일', '영업일', 'date', 'days between', 'age', 'business days', '日付', '年齢'], status: 'ready' }),
  t({ slug: 'unit-converter', category: 'life', icon: Ruler, keywords: ['단위', '변환', '평', '길이', '무게', '넓이', '부피', '온도', '섭씨', '화씨', '인치', '파운드', '근', '돈', 'unit', 'convert', 'pyeong', 'inch', 'mile', 'pound', 'fahrenheit', '単位', '坪'], status: 'ready' }),
  t({ slug: 'dutch-pay', category: 'life', icon: Receipt, keywords: ['더치페이', 'n빵', '정산', '나누기'], status: 'soon' }),
];

export const getTool = (slug: string) => tools.find((x) => x.slug === slug);
export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id)!;
export const toolUrl = (slug: string, lang: Lang) => localizePath(lang, `/tools/${slug}`);

/** Tool name and description (per language) */
export const toolText = (lang: Lang, slug: ToolSlug) => getDict(lang).tools[slug];
/** Category name and description (per language) */
export const categoryText = (lang: Lang, id: CategoryId) => getDict(lang).categories[id];
