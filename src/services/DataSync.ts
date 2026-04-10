// ─────────────────────────────────────────────────────────
// DataSync: 외부(GAS) 데이터에 대한 Cache-First 동기화 레이어
// ─────────────────────────────────────────────────────────
// 원칙:
//  1) 화면은 SQLite 캐시에서 즉시 데이터를 읽는다 (초기 로딩 최소화).
//  2) 백그라운드에서 GAS를 호출하여 캐시를 갱신한다.
//  3) 캐시 갱신 시 구독자(화면)에게 알림을 보내 자동 재렌더링한다.
//  4) 생일 정보는 원아 데이터에서 로컬로 파생한다(별도 API 호출 X).
// ─────────────────────────────────────────────────────────

import { dbOperations } from '../db/database';
import { fetchStudentsFromGAS, fetchCalendarFromGAS } from '../api/gasApi';

// ─── 캐시 키 ─────────────────────────────────────────────
export const CACHE_KEY = {
  STUDENTS: 'students_v1',
  CALENDAR: 'calendar_v1',
} as const;

// ─── 타입 ────────────────────────────────────────────────
export interface StudentsPayload {
  students: Record<string, any[]>;
  classes: { id: string; name: string }[];
}
export interface CalendarPayload {
  widget: any[];
  list: any[];
}

// ─── Pub/Sub: 캐시 갱신 알림 ─────────────────────────────
type Listener = () => void;
const listeners: Record<string, Set<Listener>> = {};

export const subscribeCache = (key: string, fn: Listener) => {
  if (!listeners[key]) listeners[key] = new Set();
  listeners[key].add(fn);
  return () => listeners[key]?.delete(fn);
};

const notify = (key: string) => {
  listeners[key]?.forEach(fn => {
    try { fn(); } catch { /* ignore */ }
  });
};

// ─── 캐시 읽기 ────────────────────────────────────────────
export const readStudentsCache = async (): Promise<StudentsPayload | null> => {
  const c = await dbOperations.getCache<StudentsPayload>(CACHE_KEY.STUDENTS);
  return c?.value ?? null;
};

export const readCalendarCache = async (): Promise<CalendarPayload | null> => {
  const c = await dbOperations.getCache<CalendarPayload>(CACHE_KEY.CALENDAR);
  return c?.value ?? null;
};

// ─── 오늘 생일인 원아 추출 (로컬 파생) ────────────────────
export const deriveTodayBirthdays = (payload: StudentsPayload | null): string[] => {
  if (!payload) return [];
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${mm}-${dd}`;
  const names: string[] = [];
  Object.values(payload.students || {}).forEach(arr => {
    (arr || []).forEach((s: any) => {
      const b = s?.birthdate || s?.birthday || s?.birth || '';
      if (!b) return;
      // 지원 포맷: YYYY-MM-DD, MM-DD, YYYY.MM.DD, MM/DD 등
      const digits = String(b).replace(/[^0-9]/g, '');
      let m = '', d = '';
      if (digits.length >= 8) { // YYYYMMDD
        m = digits.substring(4, 6);
        d = digits.substring(6, 8);
      } else if (digits.length === 4) { // MMDD
        m = digits.substring(0, 2);
        d = digits.substring(2, 4);
      } else if (digits.length === 6) { // YYMMDD
        m = digits.substring(2, 4);
        d = digits.substring(4, 6);
      }
      if (`${m}-${d}` === today && s?.name) names.push(s.name);
    });
  });
  return names;
};

// ─── 백그라운드 동기화 ────────────────────────────────────
let studentsSyncing = false;
let calendarSyncing = false;

export const syncStudents = async (): Promise<StudentsPayload | null> => {
  if (studentsSyncing) return null;
  studentsSyncing = true;
  try {
    const data = await fetchStudentsFromGAS();
    if (data && data.students) {
      await dbOperations.setCache(CACHE_KEY.STUDENTS, data);
      notify(CACHE_KEY.STUDENTS);
      return data as StudentsPayload;
    }
    return null;
  } catch (err) {
    console.warn('syncStudents error:', err);
    return null;
  } finally {
    studentsSyncing = false;
  }
};

export const syncCalendar = async (): Promise<CalendarPayload | null> => {
  if (calendarSyncing) return null;
  calendarSyncing = true;
  try {
    const data = await fetchCalendarFromGAS();
    if (data) {
      await dbOperations.setCache(CACHE_KEY.CALENDAR, data);
      notify(CACHE_KEY.CALENDAR);
      return data as CalendarPayload;
    }
    return null;
  } catch (err) {
    console.warn('syncCalendar error:', err);
    return null;
  } finally {
    calendarSyncing = false;
  }
};

// ─── 앱 시작 시 호출: 백그라운드 전체 동기화 ─────────────
export const kickoffBackgroundSync = () => {
  // await 하지 않음 — UI를 블록하지 않는다
  syncStudents();
  syncCalendar();
};
