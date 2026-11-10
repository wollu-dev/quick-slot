/**
 * 홈 화면에서 마지막으로 고른 카테고리 필터. 툴 페이지의 "‹ 툴 목록" 이 이 값으로 돌아간다.
 * 탭을 닫으면 잊어버리도록 sessionStorage 에 둔다.
 */
const KEY = 'quickslot:home-filter';

export function readHomeFilter(): string {
  try {
    return sessionStorage.getItem(KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function saveHomeFilter(filter: string) {
  try {
    sessionStorage.setItem(KEY, filter);
  } catch {
    /* 저장소 사용 불가 */
  }
}
