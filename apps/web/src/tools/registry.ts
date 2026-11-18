/**
 * Tool manifest. See README.md for how to add a new tool.
 * - Names and descriptions live in the per-language dictionaries (tools.<slug> in src/i18n/*.ts), not here.
 * - Tools with status: 'ready' get their component wired up in src/views/ToolPage.astro.
 *   Tools with 'soon' automatically get the "coming soon" screen.
 * - Icons come from lucide-react (https://lucide.dev/icons).
 */
import { getDict, localizePath, type Dict, type Lang } from '../i18n';
import {
  ArrowRightLeft, Binary, Braces, Calculator, CalendarClock, CalendarDays, Clapperboard, Clock, Code, Combine, Diff, Dices, Download, EyeOff, FileArchive,
  FileImage, FileText, Film, FingerprintPattern, Folder, Hash, Image, Images, KeyRound, Languages, Layers,
  Merge, Palette, PenLine, QrCode, Receipt, Ruler, Scaling, Scissors, ScreenShare, TextCursorInput, Ticket,
  Timer, Type, WandSparkles, type LucideIcon,
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

const allCategories: Category[] = [
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

const allTools: Tool[] = [
  // File
  t({ slug: 'file-converter', category: 'file', icon: ArrowRightLeft, keywords: ['변환', '형식', '확장자', 'convert', 'converter', 'format', 'extension', 'heic', 'jpg', 'png', 'webp', 'avif', 'mp3', 'mp4', 'webm', 'gif', 'json', 'yaml', 'csv', 'xml', '変換', '拡張子'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'file-refinery', category: 'file', icon: WandSparkles, keywords: ['정제', '정리', '일괄', '올인원', '한번에', '파일 정리', '변환', '이름', '날짜', '메타데이터', '해시', 'nfc', 'all in one', 'batch', 'refine', 'cleanup', 'workflow', '一括', '整理'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'unicode-normalize', category: 'file', icon: Combine, keywords: ['자모', '자모 분리', '한글 깨짐', '맥', 'mac', 'nfd', 'nfc', '정규화', 'normalize', 'unicode', '파일 이름', 'ㅎㅏㄴㄱㅡㄹ', 'jamo', '濁点', '分離'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'batch-rename', category: 'file', icon: TextCursorInput, keywords: ['이름', 'rename', '일괄', 'batch', '번호', '정규식', 'regex'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'file-date-changer', category: 'file', icon: CalendarClock, keywords: ['날짜', '생성일', '수정일', 'timestamp', 'date', 'touch'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'metadata-remover', category: 'file', icon: EyeOff, keywords: ['메타데이터 수정', 'exif 수정', '촬영 날짜', '날짜 변경', '위치 변경', 'gps 수정', '작성자', 'edit exif', 'exif editor', '撮影日時', '메타데이터', 'exif', 'gps', '위치', '개인정보', 'metadata'], status: 'ready', accepts: ['image/jpeg', 'image/png', 'image/webp'] }),
  t({ slug: 'file-hash', category: 'file', icon: FingerprintPattern, keywords: ['해시', 'hash', 'md5', 'sha', 'sha256', 'crc32', 'checksum', '체크섬', '무결성', '검증', '파일 비교', 'ハッシュ', 'チェックサム'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'zip', category: 'file', icon: FileArchive, keywords: ['zip', '압축', '압축 풀기', '해제', '압축 해제', 'unzip', 'compress', 'extract', 'archive', '한글 깨짐', '圧縮', '解凍'], status: 'ready', accepts: ['application/zip', '*'] }),

  // PDF
  t({ slug: 'pdf-merge', category: 'pdf', icon: Merge, keywords: ['pdf', '합치기', 'pdf 합치기', '병합', '합병', 'merge', 'combine', 'join', '結合', 'PDF結合'], status: 'ready', accepts: ['application/pdf'] }),
  t({ slug: 'pdf-split', category: 'pdf', icon: Scissors, keywords: ['pdf', '나누기', '분할', 'split', '페이지', '추출', '삭제', '회전', '순서', 'extract', 'rotate', 'delete pages', '分割', '抽出'], status: 'ready', accepts: ['application/pdf'] }),
  t({ slug: 'image-to-pdf', category: 'pdf', icon: FileImage, keywords: ['pdf', '이미지', '사진', '변환', '이미지 pdf', 'jpg to pdf', 'png to pdf', '스캔', 'image to pdf', 'photo', 'scan', '画像', 'PDF変換'], status: 'ready', accepts: ['image/*'] }),
  t({ slug: 'office-to-pdf', category: 'pdf', icon: FileText, keywords: ['word', 'excel', 'ppt', 'docx', 'pdf'], status: 'soon', processing: 'server' }),

  // Image
  t({ slug: 'image-compress', category: 'image', icon: Images, keywords: ['이미지', '압축', '용량', '사진 용량 줄이기', '이미지 최적화', 'compress', 'optimize', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'mozjpeg', 'tinypng', '画像圧縮', '容量'], status: 'ready', accepts: ['image/*'] }),
  t({ slug: 'image-resize', category: 'image', icon: Scaling, keywords: ['리사이즈', 'resize', '크기', '크기 조절', '사이즈', '자르기', '크롭', 'crop', '썸네일', '프로필 사진', 'thumbnail', 'scale', 'リサイズ', 'トリミング'], status: 'ready', accepts: ['image/*'] }),
  t({ slug: 'qr-code', category: 'image', icon: QrCode, keywords: ['qr', '큐알', '코드', 'qr코드', 'qr 생성', 'qr 읽기', '와이파이', 'wifi', 'barcode', 'scan', 'QRコード'], status: 'ready' }),

  // Media
  t({ slug: 'video-to-gif', category: 'media', icon: Film, keywords: ['gif', '움짤', '영상', '동영상', 'video', 'mp4', 'webm', 'mov', 'animated gif', 'clip', '動画', 'GIF変換'], status: 'ready', accepts: ['video/*'] }),
  t({ slug: 'screen-recorder', category: 'media', icon: ScreenShare, keywords: ['녹화', '화면', '화면 녹화', '캡처', 'record', 'screen', 'screen recorder', 'capture', '画面録画', '録画'], status: 'ready' }),
  t({ slug: 'video-downloader', category: 'media', icon: Download, keywords: ['다운로드', '영상 다운로드', '동영상 저장', '유튜브', 'mp3 추출', '음원 추출', 'download', 'video download', 'youtube', 'mp4', 'mp3', 'yt-dlp', 'ダウンロード', '動画保存'], status: 'ready', processing: 'server' }),

  // Text
  t({ slug: 'char-counter', category: 'text', icon: Type, keywords: ['글자수', '글자 수', '자소서', '바이트', 'count', '단어'], status: 'ready' }),
  t({ slug: 'text-diff', category: 'text', icon: Diff, keywords: ['비교', 'diff', '차이', '다른 점', '텍스트 비교', 'compare', 'difference', 'patch', '比較', '差分'], status: 'ready' }),
  t({ slug: 'korean-english-typo', category: 'text', icon: Languages, keywords: ['한영', '한영키', '타자', '오타', '한글', '영타', '두벌식', 'korean', 'keyboard', 'typo', 'hangul', 'ハングル'], status: 'ready' }),

  // Dev
  t({ slug: 'json-formatter', category: 'dev', icon: Braces, keywords: ['json', '포맷', 'format', 'prettify', 'minify', '검증'], status: 'ready', accepts: ['application/json', '.json'] }),
  t({ slug: 'base64', category: 'dev', icon: Binary, keywords: ['base64', '인코딩', '디코딩', 'encode', 'decode'], status: 'ready' }),
  t({ slug: 'unix-timestamp', category: 'dev', icon: Clock, keywords: ['timestamp', '타임스탬프', 'unix', 'epoch', '시간'], status: 'ready' }),
  t({ slug: 'uuid-generator', category: 'dev', icon: Hash, keywords: ['uuid', 'guid', '생성', 'id'], status: 'ready' }),
  t({ slug: 'password-generator', category: 'dev', icon: KeyRound, keywords: ['비밀번호', 'password', '랜덤', 'random', 'generator', 'パスワード'], status: 'ready' }),
  t({ slug: 'jwt-decoder', category: 'dev', icon: Ticket, keywords: ['jwt', 'token', '토큰', 'decode', '디코드', 'bearer', 'claims', 'トークン'], status: 'ready' }),
  t({ slug: 'color-converter', category: 'dev', icon: Palette, keywords: ['색상', '색', 'color', 'colour', 'hex', 'rgb', 'hsl', 'hsv', 'picker', 'unity', 'unreal', 'godot', 'linear', 'contrast', '대비', '色', 'カラー'], status: 'ready' }),
  t({ slug: 'number-base', category: 'dev', icon: Binary, keywords: ['진수', '진법', '2진수', '16진수', '8진수', '변환', 'binary', 'hex', 'octal', 'decimal', 'radix', 'base', '보수', 'two\'s complement', 'bit', '進数', '16進'], status: 'ready' }),
  t({ slug: 'normal-map-flip', category: 'dev', icon: Layers, keywords: ['노멀맵', '노말맵', 'normal', 'normal map', 'unity', 'unreal', 'directx', 'opengl', 'g채널', 'green', '게임', 'texture', '텍스처', 'tga', 'ノーマルマップ'], status: 'ready', accepts: ['image/*'] }),

  // Everyday
  t({ slug: 'date-calculator', category: 'life', icon: CalendarDays, keywords: ['날짜', 'dday', 'd-day', '디데이', '나이', '만나이', '만 나이', '계산', '기념일', '평일', '영업일', 'date', 'days between', 'age', 'business days', '日付', '年齢'], status: 'ready' }),
  t({ slug: 'server-time', category: 'life', icon: Timer, keywords: ['서버 시간', '서버시간', '네이비즘', '수강신청', '티켓팅', '예매', '선착순', '정각', '시계', 'server time', 'clock', 'ticketing', 'sugang', 'サーバー時刻', 'チケット'], status: 'ready', processing: 'server' }),
  t({ slug: 'unit-converter', category: 'life', icon: Ruler, keywords: ['단위', '변환', '평', '길이', '무게', '넓이', '부피', '온도', '섭씨', '화씨', '인치', '파운드', '근', '돈', 'unit', 'convert', 'pyeong', 'inch', 'mile', 'pound', 'fahrenheit', '単位', '坪'], status: 'ready' }),
  t({ slug: 'draw-games', category: 'life', icon: Dices, keywords: ['뽑기', '룰렛', '돌림판', '사다리', '사다리타기', '핀볼', '추첨', '제비뽑기', '랜덤', '당첨', 'roulette', 'ladder', 'pinball', 'random', 'draw', 'picker', 'lottery', 'ルーレット', 'あみだ', '抽選'], status: 'ready' }),
  t({ slug: 'dutch-pay', category: 'life', icon: Receipt, keywords: ['더치페이', 'n빵', '엔빵', '정산', '나누기', '회비', '총무', 'split', 'bill', 'dutch', 'share', '割り勘', '精算'], status: 'ready' }),
];

/**
 * Which tools this build shows, from the HIDE_TOOLS and SHOW_TOOLS environment variables (comma-separated
 * tool slugs or category ids), read at build time in astro.config.mjs. Hidden tools get no page and don't
 * appear in the list, search or Quick Slots; categories left empty are dropped too.
 */
declare const __TOOL_FILTER__: { hide: string[]; show: string[] } | undefined;
const filter = typeof __TOOL_FILTER__ === 'undefined' ? { hide: [], show: [] } : __TOOL_FILTER__;
const named = (tool: Tool, names: string[]) => names.includes(tool.slug) || names.includes(tool.category);

export const tools: Tool[] = allTools.filter((x) => (!filter.show.length || named(x, filter.show)) && !named(x, filter.hide));
export const categories: Category[] = allCategories.filter((c) => tools.some((x) => x.category === c.id));

if (import.meta.env.SSR) {
  const known = new Set<string>([...allTools.map((x) => x.slug), ...allCategories.map((c) => c.id)]);
  const unknown = [...filter.hide, ...filter.show].filter((n) => !known.has(n));
  if (unknown.length) console.warn(`[quickslot] HIDE_TOOLS / SHOW_TOOLS name unknown tools or categories: ${unknown.join(', ')}`);
}

export const getTool = (slug: string) => tools.find((x) => x.slug === slug);
export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id)!;
export const toolUrl = (slug: string, lang: Lang) => localizePath(lang, `/tools/${slug}`);

/** Tool name and description (per language) */
export const toolText = (lang: Lang, slug: ToolSlug) => getDict(lang).tools[slug];
/** Category name and description (per language) */
export const categoryText = (lang: Lang, id: CategoryId) => getDict(lang).categories[id];
