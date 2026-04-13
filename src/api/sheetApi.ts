// ─────────────────────────────────────────────────────────
// SheetApi: Google Spreadsheet CSV 직접 연동 모듈
// ─────────────────────────────────────────────────────────

const SHEET_ID = '16CqN9V__LRz5fJYJNyGw-b7HxsaLkxkEONvLcWZbOoQ';
const GID_STUDENTS = '0'; // '아동 명렬표' 시트의 GID

/**
 * CSV 데이터를 파싱하여 JSON 배열로 변환하는 안전한 함수
 * (빈 셀이 있어도 데이터가 밀리지 않도록 정규식 개선)
 */
const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    // 💡 쉼표로 분리하되, 따옴표 안에 있는 쉼표는 무시하는 표준 CSV 파싱 정규식
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));
    
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || ''; // 빈 셀도 안전하게 빈 문자열로 매핑
    });
    return obj;
  });
  return rows;
};

/**
 * 스프레드시트에서 직접 원아 목록을 가져옵니다.
 */
export const fetchStudentsDirect = async () => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_STUDENTS}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();
    const rawRows = parseCSV(text);

    const students: Record<string, any[]> = {};
    const classes: { id: string; name: string }[] = [];
    const classSet = new Set<string>();

    rawRows.forEach(row => {
      // 💡 [핵심 수정] 구글 시트의 실제 컬럼명과 100% 일치하도록 매핑
      const name = row['아동 이름'] || row['성명'] || row['이름'] || '';
      const className = row['소속 반 ID'] || row['반'] || '미분류';
      const birthdate = row['생년월일'] || row['생일'] || '';
      
      // 혹시 데이터 싱크에 필요할 수 있으니 나머지 정보도 담아줍니다.
      const gender = row['성별'] || '';
      const status = row['재원 상태'] || row['재원여부'] || '재원';
      
      // 이름이 비어있는 빈 행은 건너뜀
      if (!name) return;

      if (!students[className]) students[className] = [];
      students[className].push({ 
        name, 
        className, 
        birthdate,
        gender,
        status,
        // 원본 데이터를 그대로 유지하기 위해 전체 row도 저장 (DataSync 파싱 로직 호환용)
        ...row 
      });

      if (!classSet.has(className)) {
        classSet.add(className);
        classes.push({ id: className, name: className });
      }
    });

    return { students, classes };
  } catch (error) {
    console.error('fetchStudentsDirect 오류:', error);
    throw error;
  }
};
