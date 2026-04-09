import axios from 'axios';

// 오창읍 오창공원로 96 인근 좌표
const OCHANG_LAT = 36.7210;
const OCHANG_LON = 127.4330;

export interface WeatherData {
  temperature: number;   // 정수 온도
  humidity: number;      // 습도 (%)
  condition: string;     // 날씨 상태
  pm10: number;
  pm25: number;
  pm10Level: '좋음' | '보통' | '나쁨' | '매우나쁨';
  pm25Level: '좋음' | '보통' | '나쁨' | '매우나쁨';
  color: string;
}

// 한국 환경부 미세먼지 기준
const getPM10Level = (value: number): WeatherData['pm10Level'] => {
  if (value <= 30) return '좋음';
  if (value <= 80) return '보통';
  if (value <= 150) return '나쁨';
  return '매우나쁨';
};

const getPM25Level = (value: number): WeatherData['pm25Level'] => {
  if (value <= 15) return '좋음';
  if (value <= 35) return '보통';
  if (value <= 75) return '나쁨';
  return '매우나쁨';
};

// 환경부 기준 색상
const getStatusColor = (pm10: number, pm25: number): string => {
  const p10 = getPM10Level(pm10);
  const p25 = getPM25Level(pm25);
  if (p10 === '매우나쁨' || p25 === '매우나쁨') return '#FF5252'; // 빨강
  if (p10 === '나쁨' || p25 === '나쁨') return '#FF9800';          // 주황
  if (p10 === '보통' || p25 === '보통') return '#FFD166';          // 노랑
  return '#5BC8AF';                                                  // 좋음 (민트)
};

const getWeatherCondition = (code: number): string => {
  if (code === 0) return '맑음';
  if (code <= 2) return '구름조금';
  if (code === 3) return '흐림';
  if (code >= 51 && code <= 67) return '비';
  if (code >= 71 && code <= 77) return '눈';
  if (code >= 80 && code <= 82) return '소나기';
  if (code >= 95) return '뇌우';
  return '구름많음';
};

export const fetchWeatherAndDust = async (): Promise<WeatherData> => {
  // Open-Meteo API - current에 relative_humidity_2m 추가, 온도 정수 처리
  const response = await axios.get(
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${OCHANG_LAT}&longitude=${OCHANG_LON}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code` +
    `&hourly=pm10,pm2_5` +
    `&timezone=Asia%2FSeoul`
  );

  const current = response.data.current;
  const hourly = response.data.hourly;

  // 현재 시각 인덱스 계산 (hourly 배열에서 현재와 가장 가까운 시간)
  const currentTime = response.data.current.time;
  const hourlyTimes: string[] = hourly.time;
  let closestIdx = 0;
  for (let i = 0; i < hourlyTimes.length; i++) {
    if (hourlyTimes[i] <= currentTime) closestIdx = i;
    else break;
  }

  const pm10 = Math.round(hourly.pm10[closestIdx] || 0);
  const pm25 = Math.round(hourly.pm2_5[closestIdx] || 0);

  return {
    temperature: Math.round(current.temperature_2m),       // ✅ 정수 변환
    humidity: Math.round(current.relative_humidity_2m),    // ✅ 습도 추가
    condition: getWeatherCondition(current.weather_code),
    pm10,
    pm25,
    pm10Level: getPM10Level(pm10),
    pm25Level: getPM25Level(pm25),
    color: getStatusColor(pm10, pm25),
  };
};
