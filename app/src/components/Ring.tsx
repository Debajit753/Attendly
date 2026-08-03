import React from 'react';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { Palette } from '../theme';
import { currentPct, statusOf, roundP, RoundingRule } from '../logic';

export function Ring({ a, h, target, size = 150, pal, rounding }: { a: number; h: number; target: number; size?: number; pal: Palette; rounding?: RoundingRule }) {
  const p = currentPct(a, h);
  const zone = statusOf(a, h, target);
  const stroke = 14, r = (size - stroke) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  const col = zone === 'danger' ? pal.danger : zone === 'warn' ? pal.warn : zone === 'building' ? pal.neutral : pal.safe;
  const dash = (Math.min(Math.max(p, 0), 100) / 100) * circ;
  const ang = ((-90 + (target / 100) * 360) * Math.PI) / 180;
  // Target tick: a clear marker that spans the ring band and pokes slightly
  // outward (like a gauge tick), so "the 75% line" reads at a glance.
  const ni = r - stroke / 2 - 1, no = r + stroke / 2 + 4;          // inner band edge → just past the outer edge
  const nx1 = cx + ni * Math.cos(ang), ny1 = cy + ni * Math.sin(ang);
  const nx2 = cx + no * Math.cos(ang), ny2 = cy + no * Math.sin(ang);
  const label = h <= 0 ? '—' : `${roundP(p, rounding)}%`;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={pal.surfaceAlt} strokeWidth={stroke} />
      <Circle
        cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* soft halo so the tick is visible on any ring colour, then the tick itself */}
      <Line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke={pal.surface} strokeWidth={6} strokeLinecap="round" />
      <Line x1={nx1} y1={ny1} x2={nx2} y2={ny2} stroke={pal.text} strokeWidth={3} strokeLinecap="round" />
      <SvgText x={cx} y={cy} dy={5} fontSize={40} fontFamily="SFHeavy" fill={pal.text} textAnchor="middle">{label}</SvgText>
      <SvgText x={cx} y={cy + 26} fontSize={12} fontFamily="SFSemibold" fill={pal.textMuted} textAnchor="middle">target {target}%</SvgText>
    </Svg>
  );
}
