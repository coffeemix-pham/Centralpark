// 실제 GAS 배포 URL (type 파라미터 기반 전용)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz_hmVyOXLV5PBVl9prvQxWLB-frMXTPA9pQgIg7uM_Tn2AojjYDRaC0tp5J4LcYmL3/exec';

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
