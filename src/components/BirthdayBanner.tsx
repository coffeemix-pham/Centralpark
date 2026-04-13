import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CACHE_KEY, readStudentsCache, subscribeCache, deriveTodayBirthdays,
} from '../services/DataSync';
import { COLORS } from '../constants/theme';

export const BirthdayBanner = () => {
  const [names, setNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const apply = useCallback(async () => {
    const cached = await readStudentsCache();
    setNames(deriveTodayBirthdays(cached));
    setLoaded(true);
  }, []);

  useEffect(() => {
    apply();
    // 데이터가 백그라운드에서 동기화될 때마다 화면을 자동으로 다시 그립니다.
    const unsub = subscribeCache(CACHE_KEY.STUDENTS, apply);
    return () => { unsub(); };
  }, [apply]);

  // 1. 로딩 중
  if (!loaded) return (
    <View style={[styles.banner, { backgroundColor: COLORS.primary }]}>
      <Text style={styles.text}>💝 생일 정보 확인 중...</Text>
    </View>
  );

  // 2. 생일자 없음
  if (names.length === 0) return (
    <View style={[styles.banner, { backgroundColor: COLORS.primary }]}>
      <Text style={styles.text}>💝 오늘 생일인 원아는 없습니다.</Text>
    </View>
  );

  // 3. 생일자 있음 (가독성을 위한 어두운 텍스트 및 강조 스타일 적용)
  return (
    <View style={[styles.banner, { backgroundColor: '#FFD166' }]}>
      <Text style={[styles.text, styles.birthdayText]}>
        🎂 오늘은 {names.join(', ')} 어린이의 생일입니다! 🎉
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    // 프리미엄 느낌을 주는 그림자 효과 반영
    elevation: 3, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF', // 기본 텍스트 색상 (어두운 배경용)
    textAlign: 'center',
  },
  birthdayText: {
    color: '#333333', // 생일일 때 밝은 노란색 배경에 어울리는 어두운 텍스트
    fontSize: 15,     // 생일일 때는 글자 크기를 살짝 키워 시각적으로 강조
  },
});
