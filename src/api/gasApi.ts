// 실제 GAS 배포 URL
export const GAS_URL = 'https://script.google.com/macros/s/AKfycbzIYbFYk0pGUyjj0khfMvoGbSfAC5Z4_bj7LOYwqKTEHjZORv2yRqgE8yDQBIaSqQ10/exec';

// ─────────────────────────────────────────
// GAS에 HTTP POST 요청을 보내는 기본 함수
// ─────────────────────────────────────────
const callGAS = async (action: string, data: Record<string, any> = {}): Promise<any> => {
  try {
    // 이전 GAS 버전과 호환되게 payload를 중복 포장
    const bodyObj = {
      action,
      ...data,
      payload: { ...data, txt: data.text || '' }
    };

    // axios 대신 네이티브 fetch 사용 (React Native 환경에서 302 리다이렉트를 안전하게 처리)
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // 데이터 깨짐(한글) 및 CORS 방지
      },
      body: JSON.stringify(bodyObj)
    });

    const responseText = await response.text();

    // 서버에서 JSON 변환이 가능한 응답이 왔을 때만 파싱
    try {
      const parsed = JSON.parse(responseText);
      // 만약 GAS 내에서 명확한 오류가 났을 경우 (success:false)
      if (parsed.success === false) {
        throw new Error(parsed.error || 'Server processed false');
      }
      return parsed;
    } catch (e: any) {
      if (e.message.includes('Server processed false')) throw e;
      return responseText;
    }
  } catch (error) {
    console.error(`GAS API 호출 오류 (${action}):`, error);
    throw error;
  }
};

// ─────────────────────────────────────────
// 오늘 생일인 원아 목록
// ─────────────────────────────────────────
export const fetchBirthdaysFromGAS = async (): Promise<string[]> => {
  const result = await callGAS('getBirthdays');
  return result.birthdays || [];
};

// ─────────────────────────────────────────
// 원아 목록 (반별)
// ─────────────────────────────────────────
export const fetchStudentsFromGAS = async () => {
  return callGAS('getStudents');
};

// ─────────────────────────────────────────
// 구글 캘린더 일정
// ─────────────────────────────────────────
export const fetchCalendarFromGAS = async () => {
  return callGAS('getCalendar');
};
