import Svg, { Defs, LinearGradient, Stop, Path } from 'react-native-svg';

/** Streak flame with a fire gradient: red tip, orange body, glowing yellow core.
    Drawn with SVG because icon fonts can only be one colour. */
export function FlameIcon({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="flameBody" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FF2D2D" />
          <Stop offset="0.45" stopColor="#FF6A00" />
          <Stop offset="1" stopColor="#FFB300" />
        </LinearGradient>
        <LinearGradient id="flameCore" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FFD54A" />
          <Stop offset="1" stopColor="#FFF6C2" />
        </LinearGradient>
      </Defs>
      {/* outer flame with a side lick */}
      <Path
        fill="url(#flameBody)"
        d="M12 1.6c.7 3.3-.9 5.3-2.6 7.2C7.7 10.7 5.8 12.8 5.8 15.8 5.8 19.5 8.6 22.4 12 22.4s6.2-2.9 6.2-6.6c0-2.4-1.1-4.2-2.4-5.7-.2 1.4-.9 2.5-1.9 3.1.4-3.8-.8-8.8-1.9-11.6z"
      />
      {/* inner core */}
      <Path
        fill="url(#flameCore)"
        d="M12 12.6c-1.8 1.6-2.9 2.9-2.9 4.6 0 1.8 1.3 3.2 2.9 3.2s2.9-1.4 2.9-3.2c0-1.7-1.1-3-2.9-4.6z"
      />
    </Svg>
  );
}
