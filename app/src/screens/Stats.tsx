import { View } from 'react-native';
import { subjectStats } from '../logic';
import { Trend, Heatmap } from '../components/Charts';
import { Card, SectLabel, Title, Sub, SubjectBar } from '../components/ui';

export function Stats({ pal, data }: any) {
  const stats = subjectStats(data);
  return (
    <View>
      <Title pal={pal}>Stats</Title>
      <Sub pal={pal}>How you're doing this term</Sub>
      <SectLabel pal={pal}>Trend — cumulative %</SectLabel>
      <Card pal={pal} style={{ alignItems: 'center' }}><Trend pal={pal} data={data} /></Card>
      <SectLabel pal={pal}>{data.settings.termStart ? 'This term' : 'Last 6 months'}</SectLabel>
      <Card pal={pal}><Heatmap pal={pal} data={data} months={6} /></Card>
      <SectLabel pal={pal}>By subject</SectLabel>
      {stats.map((x: any) => <SubjectBar key={x.s.id} pal={pal} x={x} target={x.target} rounding={data.settings.roundingRule} />)}
    </View>
  );
}

/* ---------------- Bunk ---------------- */
