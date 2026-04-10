import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  CACHE_KEY, readStudentsCache, subscribeCache, deriveTodayBirthdays,
} from '../services/DataSync';
import { COLORS } from '../constants/theme';

export const BirthdayBanner = () => {
  const [names, setNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = async () => {
      const cached = await readStudentsCache();
      if (cancelled) return;
      setNames(deriveTodayBirthdays(cached));
      setLoaded(true);
    };

    // 1) 캐시에서 즉시 파생
    apply();

    // 2) 캐시 갱신 구독 — syncStudents 완료 시 자동 업데이트
    const unsub = subscribeCache(CACHE_KEY.STUDENTS, apply);

    return () => { cancelled = true; unsub(); };
  }, []);

  if (!loaded) return (
    <View style={[styles.banner, { backgroundColor: COLORS.primary }]}>
      <Text style={styles.text}>💝 생일 정보 확인 중...</Text>
    </View>
  );

  if (names.length === 0) return (
    <View style={[styles.banner, { backgroundColor: COLORS.primary }]}>
      <Text style={styles.text}>💝 오늘 생일인 원아는 없습니다.</Text>
    </View>
  );

  return (
    <View style={[styles.banner, { backgroundColor: '#FFD166' }]}>
      <Text style={styles.text}>
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
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
