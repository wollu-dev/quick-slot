/**
 * Fixes text typed with the wrong keyboard layout, using the standard Korean 2-set (dubeolsik) layout:
 * "dkssud" → "안녕" (typed in English mode by mistake) and "ㅗ디ㅣㅐ" → "hello" (the other way).
 */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

/** Key → jamo. Shift only matters for the double consonants and ㅒ ㅖ */
const KEY_TO_JAMO: Record<string, string> = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
};
const JAMO_TO_KEY: Record<string, string> = Object.fromEntries(Object.entries(KEY_TO_JAMO).map(([k, j]) => [j, k]));

/** Vowels and finals typed as two keys */
const VOWEL_PAIRS: Record<string, string> = { ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ' };
const FINAL_PAIRS: Record<string, string> = { ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ' };
const SPLIT: Record<string, string> = Object.fromEntries([...Object.entries(VOWEL_PAIRS), ...Object.entries(FINAL_PAIRS)].map(([pair, one]) => [one, pair]));

const isVowel = (j: string) => JUNG.includes(j);
const isConsonant = (j: string) => CHO.includes(j) || JONG.includes(j);
const syllable = (cho: string, jung: string, jong = '') => String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));

/** Composes a run of jamo into syllables the way a Korean IME does */
export function composeJamo(jamo: string[]): string {
  let out = '';
  let cho = '';
  let jung = '';
  let jong = '';
  const flush = () => {
    if (cho && jung) out += syllable(cho, jung, jong);
    else out += cho + jung + jong;
    cho = jung = jong = '';
  };
  for (const j of jamo) {
    if (isVowel(j)) {
      if (jong) {
        // The final consonant moves to start the next syllable: 안 + ㅕ → 아녀
        const pair = SPLIT[jong];
        const [keep, move] = pair ? [pair[0], pair[1]] : ['', jong];
        jong = keep;
        flush();
        cho = move;
        jung = j;
      } else if (cho && !jung) {
        jung = j;
      } else if (jung && VOWEL_PAIRS[jung + j] && !jong) {
        jung = VOWEL_PAIRS[jung + j];
      } else {
        flush();
        jung = j; // a vowel on its own (no initial consonant)
      }
    } else {
      if (cho && jung && !jong && JONG.includes(j)) jong = j;
      else if (cho && jung && jong && FINAL_PAIRS[jong + j]) jong = FINAL_PAIRS[jong + j];
      else {
        flush();
        cho = j;
      }
    }
  }
  flush();
  return out;
}

/** English-mode typing → Hangul. Only letters are converted; everything else is kept. */
export function engToKor(text: string): string {
  let out = '';
  let run: string[] = [];
  for (const ch of text) {
    // Caps Lock: uppercase letters without a shifted jamo count as lowercase
    const jamo = KEY_TO_JAMO[ch] ?? KEY_TO_JAMO[ch.toLowerCase()];
    if (jamo && /[a-z]/i.test(ch)) run.push(jamo);
    else {
      out += composeJamo(run) + ch;
      run = [];
    }
  }
  return out + composeJamo(run);
}

/** Hangul (syllables or loose jamo) → the keys that type it in English mode */
export function korToEng(text: string): string {
  let out = '';
  const keys = (j: string) => (SPLIT[j] ? [...SPLIT[j]] : [j]).map((x) => JAMO_TO_KEY[x] ?? x).join('');
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) {
      const jong = code % 28;
      const jung = Math.floor(code / 28) % 21;
      const cho = Math.floor(code / 28 / 21);
      out += keys(CHO[cho]) + keys(JUNG[jung]) + (jong ? keys(JONG[jong]) : '');
    } else if (isVowel(ch) || isConsonant(ch)) {
      out += keys(ch);
    } else {
      out += ch;
    }
  }
  return out;
}

export type Direction = 'engToKor' | 'korToEng';

/** Text with any Hangul is assumed to be Korean typed in the wrong mode, otherwise English */
export const detectDirection = (text: string): Direction => (/[ㄱ-ㆎ가-힣]/.test(text) ? 'korToEng' : 'engToKor');
