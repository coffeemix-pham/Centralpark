// 어린이집 앱 전용 디자인 시스템 (귀여운 파스텔 테마)
export const COLORS = {
  // 주 색상 - 따뜻한 살구/코랄 계열
  primary: '#FF7F7F',
  primaryLight: '#FFB3B3',
  primaryBg: '#FFF0F0',

  // 보조 색상 - 민트/하늘
  secondary: '#5BC8AF',
  secondaryLight: '#A8E6D8',
  secondaryBg: '#F0FAFA',

  // 강조 색상 - 노랑
  accent: '#FFD166',
  accentBg: '#FFFBF0',

  // 보라/라벤더
  purple: '#B39DDB',
  purpleBg: '#F5F0FF',

  // 중성 색상
  white: '#FFFFFF',
  background: '#FFF8F8',
  cardBg: '#FFFFFF',
  border: '#FFE4E4',
  text: '#444444',
  textLight: '#888888',
  textMuted: '#AAAAAA',

  // 상태 색상
  success: '#5BC8AF',
  warning: '#FFD166',
  danger: '#FF7F7F',

  // 미세먼지 기준 (환경부)
  dustGood: '#5BC8AF',       // 좋음
  dustNormal: '#FFD166',     // 보통
  dustBad: '#FF9800',        // 나쁨
  dustVeryBad: '#FF5252',    // 매우나쁨
};

export const FONTS = {
  title: { fontSize: 22, fontWeight: '800' as const, color: COLORS.text },
  subtitle: { fontSize: 16, fontWeight: '700' as const, color: COLORS.text },
  body: { fontSize: 14, fontWeight: '400' as const, color: COLORS.text },
  caption: { fontSize: 11, fontWeight: '400' as const, color: COLORS.textLight },
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const SHADOW = {
  small: {
    shadowColor: '#FF7F7F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  medium: {
    shadowColor: '#FF7F7F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
};
