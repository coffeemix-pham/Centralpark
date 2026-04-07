import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { fetchWeatherAndDust, WeatherData } from '../utils/weather';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';

// 날씨 상태에 따른 이모지
const getWeatherEmoji = (condition: string): string => {
  if (condition.includes('맑음')) return '☀️';
  if (condition.includes('구름')) return '⛅';
  if (condition.includes('흐림')) return '☁️';
  if (condition.includes('비')) return '🌧️';
  if (condition.includes('눈')) return '❄️';
  return '🌤️';
};

export const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, []);

  const loadWeather = async () => {
    try {
      const data = await fetchWeatherAndDust();
      setWeather(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <View style={[styles.card, { alignItems: 'center', justifyContent: 'center', height: 100 }]}>
      <ActivityIndicator color={COLORS.primary} />
      <Text style={styles.loadingText}>날씨 정보 불러오는 중...</Text>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.titleEmoji}>📍</Text>
        <Text style={styles.title}>청주 실시간 환경 정보</Text>
      </View>

      <View style={styles.grid}>
        {/* 온도 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>온도</Text>
          <Text style={styles.infoValue}>{weather?.temperature ?? '--'}°C</Text>
        </View>

        {/* 습도 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>습도</Text>
          <Text style={styles.infoValue}>{weather?.humidity ?? '--'}%</Text>
        </View>

        {/* 날씨 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>날씨</Text>
          <Text style={styles.infoValue}>
            {weather?.condition ? getWeatherEmoji(weather.condition) : '🌤️'}
          </Text>
          <Text style={styles.infoSub}>{weather?.condition}</Text>
        </View>

        {/* 미세먼지 */}
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>미세먼지</Text>
          <Text style={[styles.infoValue, { color: weather?.color || COLORS.primary, fontSize: 16 }]}>
            {weather?.pm10Level ?? '보통'}
          </Text>
          <View style={[styles.dustDot, { backgroundColor: weather?.color || COLORS.warning }]} />
        </View>
      </View>

      <Text style={styles.footer}>* 환경부 기준 실시간 정보</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    margin: 12,
    padding: 16,
    ...SHADOW.small,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoBox: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  infoSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  dustDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  footer: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 12,
    textAlign: 'right',
  },
});
