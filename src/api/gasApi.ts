// 실제 GAS 배포 URL (type 파라미터 기반 전용)
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbz_hmVyOXLV5PBVl9prvQxWLB-frMXTPA9pQgIg7uM_Tn2AojjYDRaC0tp5J4LcYmL3/exec';

// ─────────────────────────────────────────────
// 키즈노트 투약의뢰서 타입
// ─────────────────────────────────────────────
export interface KidsnoteMedicationItem {
  medicine_type: string;
  dosage: string;
  medication_time: string;
  symptoms: string | null;       // [NEW] 증상
  storage_method: string | null; // [NEW] 보관방법
  dose_count: number | null;     // [NEW] 횟수
  special_note: string | null;
}

export interface KidsnoteMedication {
  child_name: string;
  date_medicated: string;        // YYYY-MM-DD
  belong_to_class: number | null;
  class_name: string;
  items: KidsnoteMedicationItem[];
}

/**
 * GAS 미들웨어(doPost)로 키즈노트 투약의뢰서를 요청한다.
 */
export async function fetchMedicationsFromGAS(
  username: string,
  password: string
): Promise<KidsnoteMedication[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    const body = await res.json();
    if (body?.results && body.results.length > 0) {
      console.log("🕵️‍♂️ [RAW DATA DUMP]:", JSON.stringify(body.results[0], null, 2));
    }
    if (!body || body.ok !== true) {
      const err = `${body?.error ?? 'unknown'}${body?.detail ? ':' + body.detail : ''}`;
      throw new Error(`GAS error: ${err}`);
    }
    return (body.results || []) as KidsnoteMedication[];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GAS에서 원아 정보를 가져옵니다. (?type=students)
 */
export const fetchStudentsFromGAS = async () => {
  try {
    const response = await fetch(`${GAS_URL}?type=students`);
    if (!response.ok) throw new Error('Students Fetch Error');
    return await response.json();
  } catch (error) {
    console.error('fetchStudents error:', error);
    return null;
  }
};

/**
 * GAS에서 캘린더 일정을 가져옵니다. (?type=calendar)
 */
export const fetchCalendarFromGAS = async () => {
  try {
    const response = await fetch(`${GAS_URL}?type=calendar`);
    if (!response.ok) throw new Error('Calendar Fetch Error');
    return await response.json();
  } catch (error) {
    console.error('fetchCalendar error:', error);
    return null;
  }
};
