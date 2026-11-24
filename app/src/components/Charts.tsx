import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Polyline, Polygon, Circle, Text as SvgText } from 'react-native-svg';
import { Palette } from '../theme';
import { AppData, Rec, DayKind, currentPct, dayKind, isoDate, parseISO, TODAY } from '../logic';
import type { SetData } from './ui';
import { DaySheet } from './DaySheet';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* Cumulative-attendance trend line — responsive (fills its card), with the
   target reference, y-axis %, date range, and a since-start delta. */
const shortDate = (iso: string) => { try { return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return iso; } };
export function Trend({ pal, data }: { pal: Palette; data: AppData }) {
  const [w, setW] = React.useState(0);
  const T = data.settings.target;
  const dates = [...new Set(data.records.filter(r => r.status === 'present' || r.status === 'absent').map(r => r.date))].sort();
  if (dates.length < 2) {
    return <Text style={{ color: pal.textSecondary, textAlign: 'center', paddingVertical: 20 }}>Your trend line appears once you've logged a few days.</Text>;
  }
  let a = 0, h = 0;
  const pts: number[] = [];
  for (const d of dates) {
    for (const r of data.records.filter(r => r.date === d)) { if (r.status === 'present') { a++; h++; } else if (r.status === 'absent') h++; }
    pts.push(currentPct(a, h));
  }
  const first = pts[0], last = pts[pts.length - 1], delta = Math.round(last - first);
  const up = delta >= 0, blue = pal.info;

  const H = 168, padL = 30, padR = 14, padT = 12, padB = 26;
  const W = Math.max(w, 220);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const minY = Math.max(0, Math.floor(Math.min(...pts, T, 60) / 10) * 10), maxY = 100;
  const xs = (i: number) => padL + (i * plotW) / (pts.length - 1);
  const ys = (v: number) => padT + (1 - (v - minY) / (maxY - minY)) * plotH;
  const linePts = pts.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const endX = xs(pts.length - 1), yBase = ys(minY);
  const ticks = [maxY, T, minY].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch', width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 }}>
        <View>
          <Text style={{ color: pal.textMuted, fontSize: 11.5, fontWeight: '600' }}>Now</Text>
          <Text style={{ color: pal.text, fontSize: 27, fontWeight: '800', letterSpacing: -0.6 }}>{Math.round(last)}%</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: up ? pal.brandSubtle : pal.dangerBg, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
            <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={up ? pal.brand : pal.danger} />
            <Text style={{ color: up ? pal.brand : pal.danger, fontSize: 12, fontWeight: '700' }}>{Math.abs(delta)} pts</Text>
          </View>
          <Text style={{ color: pal.textMuted, fontSize: 11, marginTop: 4 }}>since {shortDate(dates[0])}</Text>
        </View>
      </View>
      <Svg width={W} height={H}>
        {ticks.map(v => <Line key={`g${v}`} x1={padL} y1={ys(v)} x2={W - padR} y2={ys(v)} stroke={v === T ? blue : pal.hair} strokeWidth={v === T ? 1.5 : 1} strokeDasharray={v === T ? '5 4' : undefined} opacity={v === T ? 0.7 : 0.5} />)}
        {ticks.map(v => <SvgText key={`y${v}`} x={padL - 6} y={ys(v) + 3.5} fontSize={9.5} fill={v === T ? blue : pal.textMuted} textAnchor="end" fontFamily={v === T ? 'SFBold' : 'SFRegular'}>{v}</SvgText>)}
        <Polygon points={`${xs(0)},${yBase} ${linePts} ${endX},${yBase}`} fill={blue} opacity={0.1} />
        <Polyline points={linePts} fill="none" stroke={blue} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={endX} cy={ys(last)} r={4.5} fill={blue} />
        <SvgText x={padL} y={H - 7} fontSize={9.5} fill={pal.textMuted} textAnchor="start" fontFamily="SFRegular">{shortDate(dates[0])}</SvgText>
        <SvgText x={W - padR} y={H - 7} fontSize={9.5} fill={pal.textMuted} textAnchor="end" fontFamily="SFRegular">Today</SvgText>
      </Svg>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 2 }}>
        <View style={{ width: 16, height: 0, borderTopWidth: 1.5, borderTopColor: blue, borderStyle: 'dashed' }} />
        <Text style={{ color: pal.textMuted, fontSize: 11.5 }}>dashed line = your {T}% target</Text>
      </View>
    </View>
  );
}

/* GitHub-style heatmap: 7 rows (Mon–Sun) × N week-columns, covering `months`. */
export function Heatmap({ pal, data, months }: { pal: Palette; data: AppData; months: number }) {
  const byDate: Record<string, Rec[]> = {};
  for (const r of data.records) (byDate[r.date] = byDate[r.date] || []).push(r);
  const today = parseISO(TODAY);
  // Span the current term if set, otherwise fall back to the last `months` months.
  const ts = data.settings.termStart;
  const startD = ts && parseISO(ts) < today ? parseISO(ts) : (() => { const d = new Date(today); d.setDate(d.getDate() - months * 30); return d; })();
  const cur = new Date(startD);
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // snap back to Monday
  const cols: string[][] = [];
  while (cur <= today) {
    const col: string[] = [];
    for (let i = 0; i < 7; i++) { col.push(isoDate(new Date(cur))); cur.setDate(cur.getDate() + 1); }
    cols.push(col);
  }
  const cellColor = (d: string): string => {
    if (parseISO(d) > today) return 'transparent';
    const recs = byDate[d];
    if (!recs || recs.length === 0) return pal.surfaceAlt;
    const present = recs.filter(r => r.status === 'present').length;
    const absent = recs.filter(r => r.status === 'absent').length;
    const held = present + absent;
    if (held === 0) return pal.neutralBg;
    if (absent === 0) return pal.safe;
    if (present === 0) return pal.danger;
    return pal.warn;
  };
  const size = 13, gap = 3, cell = size + gap, LEFTW = 28;
  const scrollRef = React.useRef<ScrollViewInstance>(null);
  // A month label sits above the first week-column that falls in a new month (GitHub-style).
  const monthOf = (col: string[]) => parseISO(col[0]).getMonth();
  const monthLabels = cols.map((col, ci) => (ci === 0 || monthOf(col) !== monthOf(cols[ci - 1]) ? MONTHS[monthOf(col)].slice(0, 3) : ''));
  const WD = ['Mon', '', 'Wed', '', 'Fri', '', ''];   // weekday labels down the left (Mon-first rows)
  const MONTH_ROW_H = 19;                              // month-labels row height (15) + its marginBottom (4)
  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* fixed weekday labels (don't scroll) */}
        <View style={{ width: LEFTW }}>
          <View style={{ height: MONTH_ROW_H }} />
          <View style={{ gap }}>
            {WD.map((w, ri) => (
              <View key={ri} style={{ height: size, justifyContent: 'center' }}>
                {w ? <Text style={{ fontSize: 9, color: pal.textMuted }}>{w}</Text> : null}
              </View>
            ))}
          </View>
        </View>
        {/* scrollable month labels + grid */}
        <ScrollView horizontal ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })} showsHorizontalScrollIndicator={false}>
          <View>
            <View style={{ flexDirection: 'row', height: 15, marginBottom: 4 }}>
              {cols.map((_, ci) => (
                <View key={ci} style={{ width: cell }}>
                  {monthLabels[ci] ? <Text style={{ position: 'absolute', left: 0, top: 0, width: 34, fontSize: 10, color: pal.textMuted, fontWeight: '600' }}>{monthLabels[ci]}</Text> : null}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap }}>
              {cols.map((col, ci) => (
                <View key={ci} style={{ gap }}>
                  {col.map((d, ri) => <View key={ri} style={{ width: size, height: size, borderRadius: 3, backgroundColor: cellColor(d) }} />)}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 14, flexWrap: 'wrap' }}>
        <LegendDot pal={pal} color={pal.safe} label="Present" />
        <LegendDot pal={pal} color={pal.danger} label="Absent" />
        <LegendDot pal={pal} color={pal.warn} label="Partial" />
        <LegendDot pal={pal} color={pal.surfaceAlt} label="No class" />
      </View>
    </View>
  );
}
function LegendDot({ pal, color, label }: { pal: Palette; color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ color: pal.textSecondary, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}

/* A real month calendar where each day is heat-mapped by attendance status. */
/* Month calendar. Each week is its own row of 7 flex cells, so dates always line up
   under the right weekday (percentage widths wrapped after 6 cells on Android).
   Tap a date to open that day's classes. */
export function CalendarHeatmap({ pal, data, setData }: { pal: Palette; data: AppData; setData?: SetData }) {
  const [off, setOff] = React.useState(0);
  const [openDay, setOpenDay] = React.useState<string | null>(null);
  const today = parseISO(TODAY);
  const view = new Date(today.getFullYear(), today.getMonth() + off, 1);
  const year = view.getFullYear(), month = view.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isoOf = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const byDate: Record<string, Rec[]> = {};
  for (const r of data.records) (byDate[r.date] = byDate[r.date] || []).push(r);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const style = (kind: DayKind) => {
    switch (kind) {
      case 'present': return { bg: pal.safe, fg: '#fff', ring: undefined };
      case 'absent': return { bg: pal.danger, fg: '#fff', ring: undefined };
      case 'partial': return { bg: pal.warn, fg: '#fff', ring: undefined };
      case 'off': return { bg: pal.neutralBg, fg: pal.neutralText, ring: undefined };
      case 'pending': return { bg: pal.surfaceAlt, fg: pal.textSecondary, ring: pal.warn };
      default: return { bg: pal.surfaceAlt, fg: pal.textSecondary, ring: undefined };
    }
  };

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Pressable onPress={() => setOff(off - 1)} hitSlop={12} accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={20} color={pal.brand} /></Pressable>
        <Pressable onPress={() => setOff(0)} disabled={off === 0} style={{ alignItems: 'center' }}>
          <Text style={{ color: pal.text, fontWeight: '700', fontSize: 15 }}>{MONTHS[month]} {year}</Text>
          {off !== 0 && <Text style={{ color: pal.brand, fontSize: 11.5, fontWeight: '600', marginTop: 1 }}>Back to today</Text>}
        </Pressable>
        <Pressable onPress={() => setOff(off + 1)} hitSlop={12} accessibilityLabel="Next month"><Ionicons name="chevron-forward" size={20} color={pal.brand} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WD.map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: pal.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 6 }}>{w}</Text>)}
      </View>
      {weeks.map((wk, wi) => (
        <View key={wi} style={{ flexDirection: 'row' }}>
          {wk.map((d, i) => {
            if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1 }} />;
            const iso = isoOf(d);
            const st = style(dayKind(byDate[iso] || []));
            const isToday = iso === TODAY;
            return (
              <Pressable key={i} onPress={() => setOpenDay(iso)} disabled={!setData} style={({ pressed }) => ({ flex: 1, aspectRatio: 1, padding: 2.5, opacity: pressed ? 0.6 : 1 })}
                accessibilityLabel={`${d} ${MONTHS[month]}`}>
                <View style={{ flex: 1, borderRadius: 8, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center', borderWidth: isToday || st.ring ? 2 : 0, borderColor: isToday ? pal.brand : st.ring }}>
                  <Text style={{ color: st.fg, fontSize: 13, fontWeight: isToday ? '800' : '500' }}>{d}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', columnGap: 14, rowGap: 6, marginTop: 14, flexWrap: 'wrap' }}>
        <LegendDot pal={pal} color={pal.safe} label="Present" />
        <LegendDot pal={pal} color={pal.danger} label="Absent" />
        <LegendDot pal={pal} color={pal.warn} label="Partial" />
        <LegendDot pal={pal} color={pal.neutralBg} label="Holiday / not held" />
        <LegendDot pal={pal} color={pal.surfaceAlt} label="No class" />
      </View>
      {setData && <Text style={{ color: pal.textMuted, fontSize: 11.5, marginTop: 10 }}>Tap a date to mark or change that day's classes.</Text>}
      {openDay && setData && <DaySheet pal={pal} data={data} setData={setData} iso={openDay} onClose={() => setOpenDay(null)} />}
    </View>
  );
}
