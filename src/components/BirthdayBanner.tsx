import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fetchBirthdaysFromGAS } from '../api/gasApi';
import { COLORS } from '../constants/theme';

export const BirthdayBanner = () => {
  const [names, setNames] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchBirthdaysFromGAS()
      .then(setNames)
      .catch(() => setNames([]))
      .finally(() => setLoaded(true));
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
