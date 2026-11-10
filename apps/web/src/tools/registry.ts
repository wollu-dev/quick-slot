/**
 * 툴 매니페스트. 새 툴을 추가할 때는 여기에 항목을 넣고
 * status: 'ready' 라면 src/pages/tools/<slug>.astro 페이지를 만든다.
 * status: 'soon' 인 툴은 [slug].astro 가 "준비 중" 페이지를 자동 생성한다.
 */

export type CategoryId = 'file' | 'pdf' | 'image' | 'media' | 'text' | 'dev' | 'life';

export interface Category {
  id: CategoryId;
  name: string;
  icon: string;
  description: string;
}

export interface Tool {
  slug: string;
  name: string;
  description: string;
  category: CategoryId;
  keywords: string[];
  status: 'ready' | 'soon';
  /** client: 파일이 브라우저를 떠나지 않음 / server: 서버에서 처리 후 즉시 삭제 */
  processing: 'client' | 'server';
  /** 이 툴이 받는 파일 형식 (스마트 드롭 추천용, MIME 또는 확장자) */
  accepts?: string[];
}

export const categories: Category[] = [
  { id: 'file', name: '파일', icon: '📁', description: '이름, 확장자, 날짜, 메타데이터' },
  { id: 'pdf', name: 'PDF·문서', icon: '📄', description: '합치기, 나누기, 변환' },
  { id: 'image', name: '이미지', icon: '🖼️', description: '변환, 압축, 리사이즈, QR' },
  { id: 'media', name: '영상·오디오', icon: '🎬', description: '자르기, GIF, 포맷 변환' },
  { id: 'text', name: '텍스트', icon: '✍️', description: '글자 수, 비교, 변환' },
  { id: 'dev', name: '개발', icon: '💻', description: 'JSON, 인코딩, 생성기' },
  { id: 'life', name: '생활 계산기', icon: '🧮', description: '날짜, 단위, 금액 계산' },
];

const t = (tool: Omit<Tool, 'processing'> & { processing?: Tool['processing'] }): Tool => ({
  processing: 'client',
  ...tool,
});

export const tools: Tool[] = [
  // 📁 파일
  t({ slug: 'extension-changer', name: '확장자 일괄 변경', description: '여러 파일의 확장자를 한 번에 바꿔서 ZIP으로 받기', category: 'file', keywords: ['확장자', 'extension', 'ext', '변경', 'rename'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'batch-rename', name: '파일 이름 일괄 변경', description: '번호 붙이기, 찾아 바꾸기, 정규식, 대소문자 변환', category: 'file', keywords: ['이름', 'rename', '일괄', 'batch', '번호', '정규식', 'regex'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'file-date-changer', name: '파일 날짜 변경', description: '생성일·수정일을 원하는 날짜로 바꾸는 스크립트 생성', category: 'file', keywords: ['날짜', '생성일', '수정일', 'timestamp', 'date', 'touch'], status: 'ready', accepts: ['*'] }),
  t({ slug: 'metadata-remover', name: '메타데이터 제거', description: '사진의 GPS·촬영 기기 정보 등을 화질 손실 없이 제거', category: 'file', keywords: ['메타데이터', 'exif', 'gps', '위치', '개인정보', 'metadata'], status: 'ready', accepts: ['image/jpeg', 'image/png', 'image/webp'] }),
  t({ slug: 'file-hash', name: '해시·체크섬', description: 'MD5, SHA-1, SHA-256 계산 및 파일 비교', category: 'file', keywords: ['해시', 'hash', 'md5', 'sha', 'checksum'], status: 'soon', accepts: ['*'] }),
  t({ slug: 'zip', name: 'ZIP 압축·해제', description: '브라우저에서 바로 압축하고 풀기', category: 'file', keywords: ['zip', '압축'], status: 'soon', accepts: ['application/zip', '*'] }),

  // 📄 PDF
  t({ slug: 'pdf-merge', name: 'PDF 합치기', description: '여러 PDF를 하나로', category: 'pdf', keywords: ['pdf', '합치기', 'merge'], status: 'soon', accepts: ['application/pdf'] }),
  t({ slug: 'pdf-split', name: 'PDF 나누기', description: '페이지 추출, 삭제, 순서 변경', category: 'pdf', keywords: ['pdf', '나누기', 'split', '페이지'], status: 'soon', accepts: ['application/pdf'] }),
  t({ slug: 'image-to-pdf', name: '이미지 → PDF', description: '사진 여러 장을 PDF 한 개로', category: 'pdf', keywords: ['pdf', '이미지', '변환'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'office-to-pdf', name: 'Office → PDF', description: 'Word, Excel, PPT를 PDF로', category: 'pdf', keywords: ['word', 'excel', 'ppt', 'docx', 'pdf'], status: 'soon', processing: 'server' }),

  // 🖼️ 이미지
  t({ slug: 'image-convert', name: '이미지 변환·압축', description: 'PNG, JPG, WebP 변환과 용량 줄이기', category: 'image', keywords: ['이미지', '변환', '압축', 'png', 'jpg', 'webp'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'image-resize', name: '이미지 리사이즈', description: '크기 조절과 자르기, 일괄 처리', category: 'image', keywords: ['리사이즈', 'resize', '크기', '자르기', 'crop'], status: 'soon', accepts: ['image/*'] }),
  t({ slug: 'heic-to-jpg', name: 'HEIC → JPG', description: '아이폰 사진을 JPG로', category: 'image', keywords: ['heic', 'iphone', '아이폰', 'jpg'], status: 'soon', accepts: ['.heic', '.heif'] }),
  t({ slug: 'qr-code', name: 'QR 코드', description: 'QR 코드 만들기와 읽기', category: 'image', keywords: ['qr', '큐알', '코드'], status: 'soon' }),

  // 🎬 미디어
  t({ slug: 'video-to-gif', name: '영상 → GIF', description: '구간을 골라 GIF로 변환', category: 'media', keywords: ['gif', '영상', 'video', 'mp4'], status: 'soon', accepts: ['video/*'] }),
  t({ slug: 'screen-recorder', name: '화면 녹화', description: '설치 없이 브라우저로 화면 녹화', category: 'media', keywords: ['녹화', '화면', 'record', 'screen'], status: 'soon' }),

  // ✍️ 텍스트
  t({ slug: 'char-counter', name: '글자 수 세기', description: '공백 포함·제외, 바이트, 원고지 매수까지', category: 'text', keywords: ['글자수', '글자 수', '자소서', '바이트', 'count', '단어'], status: 'ready' }),
  t({ slug: 'text-diff', name: '텍스트 비교', description: '두 글의 달라진 부분 표시', category: 'text', keywords: ['비교', 'diff', '차이'], status: 'soon' }),
  t({ slug: 'korean-english-typo', name: '한영 타자 변환', description: 'dkssud → 안녕, 잘못 친 글 되돌리기', category: 'text', keywords: ['한영', '타자', '오타', '한글'], status: 'soon' }),

  // 💻 개발
  t({ slug: 'json-formatter', name: 'JSON 포매터', description: '정렬, 압축, 오류 위치 표시', category: 'dev', keywords: ['json', '포맷', 'format', 'prettify', 'minify', '검증'], status: 'ready', accepts: ['application/json', '.json'] }),
  t({ slug: 'base64', name: 'Base64 인코딩·디코딩', description: '텍스트와 파일을 Base64로', category: 'dev', keywords: ['base64', '인코딩', '디코딩', 'encode', 'decode'], status: 'ready' }),
  t({ slug: 'unix-timestamp', name: '유닉스 타임스탬프', description: '타임스탬프 ↔ 날짜 변환', category: 'dev', keywords: ['timestamp', '타임스탬프', 'unix', 'epoch', '시간'], status: 'ready' }),
  t({ slug: 'uuid-generator', name: 'UUID 생성기', description: 'UUID v4 / v7 대량 생성', category: 'dev', keywords: ['uuid', 'guid', '생성', 'id'], status: 'ready' }),
  t({ slug: 'password-generator', name: '비밀번호 생성기', description: '안전한 랜덤 비밀번호', category: 'dev', keywords: ['비밀번호', 'password', '랜덤'], status: 'soon' }),
  t({ slug: 'jwt-decoder', name: 'JWT 디코더', description: '토큰 내용과 만료 시간 확인', category: 'dev', keywords: ['jwt', 'token', '토큰'], status: 'soon' }),
  t({ slug: 'color-converter', name: '색상 변환기', description: 'HEX, RGB, HSL, Unity/Unreal 코드', category: 'dev', keywords: ['색상', 'color', 'hex', 'rgb', 'hsl', 'unity', 'unreal'], status: 'soon' }),
  t({ slug: 'normal-map-flip', name: '노멀맵 G채널 반전', description: 'DirectX ↔ OpenGL 노멀맵 변환', category: 'dev', keywords: ['노멀맵', 'normal', 'unity', 'unreal', '게임', 'texture'], status: 'soon', accepts: ['image/*'] }),

  // 🧮 생활
  t({ slug: 'date-calculator', name: '날짜 계산기', description: 'D-day, 만 나이, 날짜 사이 일수', category: 'life', keywords: ['날짜', 'dday', 'd-day', '나이', '만나이', '계산'], status: 'soon' }),
  t({ slug: 'unit-converter', name: '단위 변환', description: '길이, 무게, 넓이(평), 온도', category: 'life', keywords: ['단위', '변환', '평', '길이', '무게'], status: 'soon' }),
  t({ slug: 'dutch-pay', name: '더치페이 계산', description: '인원별 금액 나누기', category: 'life', keywords: ['더치페이', 'n빵', '정산', '나누기'], status: 'soon' }),
];

export const getTool = (slug: string) => tools.find((x) => x.slug === slug);
export const getCategory = (id: CategoryId) => categories.find((c) => c.id === id)!;
export const toolUrl = (slug: string) => `/tools/${slug}`;
