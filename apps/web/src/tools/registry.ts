/**
 * 툴 매니페스트. 새 툴을 추가하는 방법은 README.md 참고.
 * - 이름·설명은 여기 두지 않고 언어별 사전(src/i18n/*.ts 의 tools.<slug>)에 둔다.
 * - status: 'ready' 인 툴은 src/views/ToolPage.astro 에 컴포넌트를 연결한다.
 *   'soon' 인 툴은 자동으로 "준비 중" 화면이 된다.
 * - 아이콘은 lucide-react 에서 고른다 (https://lucide.dev/icons).
 */
import { getDict, localizePath, type Dict, type Lang } from '../i18n';
import {
  Binary, Braces, Calculator, CalendarClock, CalendarDays, Clapperboard, Clock, Code, Diff, EyeOff, FileArchive,
  FileImage, FileText, FileType, Film, FingerprintPattern, Folder, Hash, Image, Images, KeyRound, Languages, Layers,
  Merge, Palette, PenLine, QrCode, Receipt, Ruler, Scaling, Scissors, ScreenShare, Smartphone, TextCursorInput, Ticket,
  Type, type LucideIcon,
} from 'lucide-react';

export type CategoryId = 'file' | 'pdf' | 'image' | 'media' | 'text' | 'dev' | 'life';

export interface Category {
  id: CategoryId;
  icon: LucideIcon;
  /** 앱 아이콘 타일 색 */
  color: string;
}

export type ToolSlug = keyof Dict['tools'];

export interface Tool {
  slug: ToolSlug;
  category: CategoryId;
  icon: LucideIcon;
  keywords: string[];
  status: 'ready' | 'soon';
  /** client: 파일이 브라우저를 떠나지 않음 / server: 서버에서 처리 후 즉시 삭제 */
  processing: 'client' | 'server';
  /** 이 툴이 받는 파일 형식 (스마트 드롭 추천용, MIME 또는 확장자) */
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

const t = (tool: Omit<Tool, 'processing'> & { processing?: Tool['processing'] }): Tool => ({
  processing: 'client',
  ...tool,
});

export const tools: Tool[] = [
  // 파일
  t({ slug: 'extension-changer', category: 'file', icon: FileType, keywords: ['확장자', 'extension', 'ext', '변경', 'rename'], status: 'ready', accepts: ['*'] }),
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

  // 이미지
  t({ slug: 'image-convert', category: 'image', icon: Images, keywords: ['이미지', '변환', '압축', 'png', 'jpg', 'webp'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'image-resize', category: 'image', icon: Scaling, keywords: ['리사이즈', 'resize', '크기', '자르기', 'crop'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'heic-to-jpg', category: 'image', icon: Smartphone, keywords: ['heic', 'iphone', '아이폰', 'jpg'], status: 'soon', accepts: ['.heic', '.heif'] }),
  t({ slug: 'qr-code', category: 'image', icon: QrCode, keywords: ['qr', '큐알', '코드'], status: 'soon' }),

  // 미디어
  t({ slug: 'video-to-gif', category: 'media', icon: Film, keywords: ['gif', '영상', 'video', 'mp4'], status: 'soon', accepts: ['video/*'] }),
  t({ slug: 'screen-recorder', category: 'media', icon: ScreenShare, keywords: ['녹화', '화면', 'record', 'screen'], status: 'soon' }),

  // 텍스트
  t({ slug: 'char-counter', category: 'text', icon: Type, keywords: ['글자수', '글자 수', '자소서', '바이트', 'count', '단어'], status: 'ready' }),
  t({ slug: 'text-diff', category: 'text', icon: Diff, keywords: ['비교', 'diff', '차이'], status: 'soon' }),
  t({ slug: 'korean-english-typo', category: 'text', icon: Languages, keywords: ['한영', '타자', '오타', '한글'], status: 'soon' }),

  // 개발
  t({ slug: 'json-formatter', category: 'dev', icon: Braces, keywords: ['json', '포맷', 'format', 'prettify', 'minify', '검증'], status: 'ready', accepts: ['application/json', '.json'] }),
  t({ slug: 'base64', category: 'dev', icon: Binary, keywords: ['base64', '인코딩', '디코딩', 'encode', 'decode'], status: 'ready' }),
  t({ slug: 'unix-timestamp', category: 'dev', icon: Clock, keywords: ['timestamp', '타임스탬프', 'unix', 'epoch', '시간'], status: 'ready' }),
  t({ slug: 'uuid-generator', category: 'dev', icon: Hash, keywords: ['uuid', 'guid', '생성', 'id'], status: 'ready' }),
  t({ slug: 'password-generator', category: 'dev', icon: KeyRound, keywords: ['비밀번호', 'password', '랜덤'], status: 'soon' }),
  t({ slug: 'jwt-decoder', category: 'dev', icon: Ticket, keywords: ['jwt', 'token', '토큰'], status: 'soon' }),
  t({ slug: 'color-converter', category: 'dev', icon: Palette, keywords: ['색상', 'color', 'hex', 'rgb', 'hsl', 'unity', 'unreal'], status: 'soon' }),
  t({ slug: 'normal-map-flip', category: 'dev', icon: Layers, keywords: ['노멀맵', 'normal', 'unity', 'unreal', '게임', 'texture'], status: 'soon', accepts: ['image/*'] }),

  // 생활
  t({ slug: 'date-calculator', category: 'life', icon: CalendarDays, keywords: ['날짜', 'dday', 'd-day', '나이', '만나이', '계산'], status: 'soon' }),
  t({ slug: 'unit-converter', category: 'life', icon: Ruler, keywords: ['단위', '변환', '평', '길이', '무게'], status: 'soon' }),
  t({ slug: 'dutch-pay', category: 'life', icon: Receipt, keywords: ['더치페이', 'n빵', '정산', '나누기'], status: 'soon' }),
];

export const getTool = (slug: string) => tools.find((x) => x.slug === slug);
export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id)!;
export const toolUrl = (slug: string, lang: Lang) => localizePath(lang, `/tools/${slug}`);

/** 툴 이름·설명 (언어별) */
export const toolText = (lang: Lang, slug: ToolSlug) => getDict(lang).tools[slug];
/** 카테고리 이름·설명 (언어별) */
export const categoryText = (lang: Lang, id: CategoryId) => getDict(lang).categories[id];
