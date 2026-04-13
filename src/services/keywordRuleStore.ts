import { dbOperations, KeywordRuleRow } from '../db/database';

export type KeywordRule = { id?: number; keyword: string; time_hhmm: string; priority: number };

export async function getKeywordRules(): Promise<KeywordRule[]> {
  return dbOperations.listKeywordRules();
}

export async function saveKeywordRule(rule: KeywordRule) {
  await dbOperations.upsertKeywordRule(rule.keyword, rule.time_hhmm, rule.priority);
}

export async function removeKeywordRule(id: number) {
  await dbOperations.deleteKeywordRule(id);
}

export async function ensureDefaults() {
  await dbOperations.seedDefaultKeywordRules();
}

/** original_time 문자열을 규칙 리스트와 매칭 → HH:mm 또는 null */
export function matchKeyword(original: string, rules: KeywordRule[]): string | null {
  if (!original) return null;
  const sorted = [...rules].sort((a, b) => b.priority - a.priority || b.keyword.length - a.keyword.length);
  for (const r of sorted) {
    if (original.includes(r.keyword)) return r.time_hhmm;
  }
  // fallback 정규식 파서
  const re = /(오전|오후|AM|PM|am|pm)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/;
  const m = original.match(re);
  if (!m) return null;
  const ampm = (m[1] || '').toLowerCase();
  let h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  if (isNaN(h) || h < 0 || h > 23 || isNaN(min) || min < 0 || min > 59) return null;
  if ((ampm === '오후' || ampm === 'pm') && h < 12) h += 12;
  if ((ampm === '오전' || ampm === 'am') && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}
