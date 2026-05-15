import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';

import { radius } from '@/theme/tokens';

interface Props {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, rounded = radius.md, style }: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: rounded,
          backgroundColor: '#e5e7eb',
          opacity,
        },
        style,
      ]}
    >
      <View />
    </Animated.View>
  );
}
