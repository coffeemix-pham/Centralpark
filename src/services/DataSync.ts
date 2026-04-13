// ─────────────────────────────────────────────────────────
// DataSync: 외부(GAS) 데이터에 대한 Cache-First 동기화 레이어
// ─────────────────────────────────────────────────────────
// 원칙:
//  1) 화면은 SQLite 캐시에서 즉시 데이터를 읽는다 (초기 로딩 최소화).
//  2) 백그라운드에서 GAS를 호출하여 캐시를 갱신한다.
//  3) 캐시 갱신 시 구독자(화면)에게 알림을 보내 자동 재렌더링한다.
//  4) 생일 정보는 원아 데이터에서 로컬로 파생한다(별도 API 호출 X).
// ─────────────────────────────────────────────────────────

import { InteractionManager } from 'react-native';
import { dbOperations } from '../db/database';
import { fetchStudentsFromGAS, fetchCalendarFromGAS } from '../api/gasApi';
// import { fetchStudentsDirect } from '../api/sheetApi'; // 직접 연동은 사용 안 함

// ─── 캐시 키 ─────────────────────────────────────────────
export const CACHE_KEY = {
  STUDENTS: 'students_v1',
  CALENDAR: 'calendar_v1',
} as const;

// ─── 타입 ────────────────────────────────────────────────
export interface StudentsPayload {
  students: Record<string, any[]> | any[]; // 배열로 올 가능성 방어
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
  return () => { listeners[key]?.delete(fn); };
};

const notify = (key: string) => {
  listeners[key]?.forEach(fn => {
    try { fn(); } catch { /* ignore */ }
  });
};

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
  if (!payload || !payload.students) return [];

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDate = now.getDate();
  const names: string[] = [];

  const groups = Array.isArray(payload.students)
    ? [payload.students]
    : Object.values(payload.students);

  groups.forEach(arr => {
    if (!Array.isArray(arr)) return;

    arr.forEach((s: any) => {
      const b = s?.birthdate;
      const name = s?.name;

      if (!b || !name) return;

      // 💡 [핵심] 마침표(.)나 슬래시(/)가 섞여 있어도 전부 하이픈(-)으로 통일시킵니다.
      const cleanDate = String(b).replace(/[\.\/]/g, '-').trim();
      const parts = cleanDate.split('-');

      if (parts.length >= 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);

        if (m === currentMonth && d === currentDate) {
          names.push(name);
        }
      }
    });
  });

  return names;
};

// ─── 백그라운드 동기화 ────────────────────────────────────
let studentsSyncing = false;
let calendarSyncing = false;

export const syncStudents = async (): Promise<StudentsPayload | null> => {
  if (studentsSyncing) return null;
  studentsSyncing = true; // 블록 밖으로 이동하여 동시성 레이스 컨디션 방지

  try {
    const data = await fetchStudentsFromGAS();
    if (data) {
      // GAS가 { students: [], classes: [] } 형태가 아닌 순수 배열을 보낼 경우 정규화
      const normalizedData = (data && data.students) 
        ? data 
        : { students: data, classes: [] };

      await dbOperations.setCache(CACHE_KEY.STUDENTS, normalizedData);
      notify(CACHE_KEY.STUDENTS);
      return normalizedData as StudentsPayload;
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
    const data = await fetchCalendarFromGAS(); // fetch 시 ?type=calendar 파라미터 확인 필수
    if (data && (data.list || Array.isArray(data))) {
      const rawList = Array.isArray(data) ? data : data.list;
      
      const now = new Date();
      const days = ['일', '월', '화', '수', '목', '금', '토'];

      // 1) 데이터 정규화 (UI가 기대하는 필드들을 미리 생성)
      const formattedList = rawList.map((event: any) => {
        const eventDate = new Date(event.date);
        const m = eventDate.getMonth() + 1;
        const d = eventDate.getDate();
        const dy = days[eventDate.getDay()];

        return {
          ...event,
          date: event.date, // "2026-04-10"
          dateStr: `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}(${dy})`,
          month: `${String(m).padStart(2, '0')}월`,
          day: String(d).padStart(2, '0'),
          dayName: dy,
          startTime: event.startTime || '시간미정',
          title: event.title || '일정명 없음',
          desc: event.desc || '',
        };
      });

      // 2) 향후 7일간 일정 필터링 (위젯용: 오늘 ~ 오늘+7일)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // 오늘 00시 00분

      const next7Days = new Date();
      next7Days.setDate(today.getDate() + 7);
      next7Days.setHours(23, 59, 59, 999); // 7일 뒤 23시 59분

      const rollingEvents = formattedList
        .filter((event: any) => {
          const eventDate = new Date(event.date);
          // 오늘 이후이고, 7일 이내인 일정만 포함
          return eventDate >= today && eventDate <= next7Days;
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); // 날짜 오름차순 정렬

      const normalizedData: CalendarPayload = {
        widget: rollingEvents, // 향후 7일간의 정렬된 일정
        list: formattedList    // 전체 일정
      };

      await dbOperations.setCache(CACHE_KEY.CALENDAR, normalizedData);
      notify(CACHE_KEY.CALENDAR);
      return normalizedData;
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
let syncInterval: any = null;

export const kickoffBackgroundSync = () => {
  // 앱 시작 직후의 UI 버벅임을 막기 위해 네트워크 호출 자체를 약간 지연
  setTimeout(() => {
    syncStudents();
    syncCalendar();
  }, 1000);

  if (!syncInterval) {
    syncInterval = setInterval(() => {
      syncStudents();
      syncCalendar();
    }, 1 * 60 * 1000); 
  }
};

/**
 * 동기화 중지 (필요시 호출)
 */
export const stopBackgroundSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
};
