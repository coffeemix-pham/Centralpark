import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_MY_CLASS_ID = 'teacher_class_id';
const KEY_MY_CLASS_NAME = 'teacher_class_name';
const KEY_TEACHER_NAME = 'teacher_name';

export interface TeacherProfile {
  classId: string;       // 'ALL' = 전체 보기
  className: string;     // 반 이름 표시용
  teacherName: string;   // 선생님 이름
}

// 저장
export const saveTeacherProfile = async (profile: TeacherProfile): Promise<void> => {
  await AsyncStorage.multiSet([
    [KEY_MY_CLASS_ID, profile.classId],
    [KEY_MY_CLASS_NAME, profile.className],
    [KEY_TEACHER_NAME, profile.teacherName],
  ]);
};

// 불러오기
export const loadTeacherProfile = async (): Promise<TeacherProfile> => {
  const values = await AsyncStorage.multiGet([
    KEY_MY_CLASS_ID, KEY_MY_CLASS_NAME, KEY_TEACHER_NAME,
  ]);
  return {
    classId: values[0][1] ?? 'ALL',
    className: values[1][1] ?? '전체 반',
    teacherName: values[2][1] ?? '',
  };
};
