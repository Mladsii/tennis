import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Line,
  Circle,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import {reportsApi, ProgressReport, RankingItem} from '../../api/reports';
import {matchesApi} from '../../api/matches';
import {EloPoint} from '../../types/match';
import {useAuthStore} from '../../store/authStore';
import {COLORS, FONT_SIZE, SPACING} from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - SPACING.md * 2 - SPACING.md * 2; // card padding
const CHART_H = 140;
const PAD_LEFT = 36;
const PAD_RIGHT = 12;
const PAD_TOP = 12;
const PAD_BOT = 24;

const PERIODS = [
  {label: '7 дней', value: 7},
  {label: '30 дней', value: 30},
  {label: '90 дней', value: 90},
];

function EloChart({points}: {points: EloPoint[]}) {
  if (points.length < 2) {
    return (
      <View style={chartStyles.empty}>
        <Text style={chartStyles.emptyText}>
          Нужно минимум 2 подтверждённых матча для графика
        </Text>
      </View>
    );
  }

  const plotW = CHART_W - PAD_LEFT - PAD_RIGHT;
  const plotH = CHART_H - PAD_TOP - PAD_BOT;

  const eloValues = points.map(p => p.elo);
  const minElo = Math.min(...eloValues);
  const maxElo = Math.max(...eloValues);
  const eloRange = maxElo - minElo || 10;

  const toX = (i: number) => PAD_LEFT + (i / (points.length - 1)) * plotW;
  const toY = (elo: number) => PAD_TOP + plotH - ((elo - minElo) / eloRange) * plotH;

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.elo).toFixed(1)}`)
    .join(' ');

  // Fill area (gradient)
  const fillPath =
    linePath +
    ` L ${toX(points.length - 1).toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)}` +
    ` L ${PAD_LEFT.toFixed(1)} ${(PAD_TOP + plotH).toFixed(1)} Z`;

  // Y axis labels
  const yLabels = [minElo, Math.round((minElo + maxElo) / 2), maxElo];

  // X axis: first and last date
  const firstDate = points[0].date.slice(5);   // MM-DD
  const lastDate = points[points.length - 1].date.slice(5);

  // Trend color
  const trend = points[points.length - 1].elo - points[0].elo;
  const lineColor = trend >= 0 ? COLORS.success : COLORS.error;
  const gradientId = 'eloGrad';

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={lineColor} stopOpacity={0.25} />
          <Stop offset="1" stopColor={lineColor} stopOpacity={0.0} />
        </LinearGradient>
      </Defs>

      {/* Y grid lines + labels */}
      {yLabels.map((val, i) => {
        const y = toY(val);
        return (
          <React.Fragment key={i}>
            <Line
              x1={PAD_LEFT} y1={y} x2={CHART_W - PAD_RIGHT} y2={y}
              stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3,3"
            />
            <SvgText
              x={PAD_LEFT - 4} y={y + 4}
              textAnchor="end" fontSize={9} fill={COLORS.textSecondary}>
              {val}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* Gradient fill */}
      <Path d={fillPath} fill={`url(#${gradientId})`} />

      {/* Line */}
      <Path d={linePath} stroke={lineColor} strokeWidth={2} fill="none" strokeLinejoin="round" />

      {/* Dots: only first, last, min, max */}
      {points.map((p, i) => {
        const isFirst = i === 0;
        const isLast = i === points.length - 1;
        const isMin = p.elo === minElo;
        const isMax = p.elo === maxElo;
        if (!isFirst && !isLast && !isMin && !isMax) return null;
        return (
          <Circle
            key={i}
            cx={toX(i)} cy={toY(p.elo)}
            r={4} fill={lineColor} stroke="#fff" strokeWidth={1.5}
          />
        );
      })}

      {/* X axis date labels */}
      <SvgText
        x={PAD_LEFT} y={CHART_H - 4}
        textAnchor="start" fontSize={9} fill={COLORS.textSecondary}>
        {firstDate}
      </SvgText>
      <SvgText
        x={CHART_W - PAD_RIGHT} y={CHART_H - 4}
        textAnchor="end" fontSize={9} fill={COLORS.textSecondary}>
        {lastDate}
      </SvgText>
    </Svg>
  );
}

const chartStyles = StyleSheet.create({
  empty: {height: 80, justifyContent: 'center', alignItems: 'center'},
  emptyText: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, textAlign: 'center'},
});

export default function ReportsScreen() {
  const me = useAuthStore(s => s.user);
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [eloHistory, setEloHistory] = useState<EloPoint[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (d: number) => {
    try {
      const [p, r, elo] = await Promise.all([
        reportsApi.myProgress(d),
        reportsApi.preferredRankings(),
        matchesApi.eloHistory(50),
      ]);
      setProgress(p.data);
      setRankings(r.data);
      setEloHistory(elo.data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(days);
  };

  if (loading) {
    return <ActivityIndicator style={styles.center} size="large" color={COLORS.primary} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.title}>Мой прогресс</Text>

      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, days === p.value && styles.periodBtnActive]}
            onPress={() => setDays(p.value)}>
            <Text style={[styles.periodText, days === p.value && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {progress && (
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{progress.matches_total}</Text>
              <Text style={styles.statLabel}>Матчей</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: COLORS.success}]}>{progress.wins}</Text>
              <Text style={styles.statLabel}>Побед</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: COLORS.error}]}>{progress.losses}</Text>
              <Text style={styles.statLabel}>Поражений</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{progress.win_rate}%</Text>
              <Text style={styles.statLabel}>Винрейт</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{progress.elo_now}</Text>
              <Text style={styles.statLabel}>Текущий Elo</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, {color: progress.elo_change >= 0 ? COLORS.success : COLORS.error}]}>
                {progress.elo_change >= 0 ? '+' : ''}{progress.elo_change}
              </Text>
              <Text style={styles.statLabel}>Δ Elo</Text>
            </View>
          </View>
        </View>
      )}

      {/* Elo dynamics chart */}
      <Text style={styles.title}>Динамика Elo</Text>
      <View style={styles.chartCard}>
        {eloHistory.length > 0 && (
          <View style={styles.chartLegend}>
            <Text style={styles.chartLegendText}>
              {eloHistory[0].elo} → {eloHistory[eloHistory.length - 1].elo}
              {'  '}
              <Text style={{color: eloHistory[eloHistory.length - 1].elo >= eloHistory[0].elo ? COLORS.success : COLORS.error}}>
                {eloHistory[eloHistory.length - 1].elo >= eloHistory[0].elo ? '▲' : '▼'}
                {' '}{Math.abs(eloHistory[eloHistory.length - 1].elo - eloHistory[0].elo)}
              </Text>
              {'  ·  '}{eloHistory.length} матчей
            </Text>
          </View>
        )}
        <EloChart points={eloHistory} />
      </View>

      <Text style={styles.title}>Рейтинг друзей</Text>
      <View style={styles.rankingsCard}>
        {rankings.map(r => {
          const isMe = r.user_id === me?.id;
          return (
            <View key={r.user_id} style={[styles.rankRow, isMe && styles.rankRowMe]}>
              <Text style={styles.rankNum}>#{r.rank}</Text>
              <View style={{flex: 1}}>
                <Text style={[styles.rankName, isMe && styles.rankNameMe]}>
                  {r.last_name} {r.first_name}{isMe ? ' (вы)' : ''}
                </Text>
                <Text style={styles.rankMeta}>СТМ {r.stm_level}</Text>
              </View>
              <Text style={styles.rankElo}>{r.elo_rating}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {padding: SPACING.md},
  center: {flex: 1},
  title: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  periodRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm},
  periodBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  periodBtnActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  periodText: {fontSize: FONT_SIZE.sm, color: COLORS.text, fontWeight: '600'},
  periodTextActive: {color: COLORS.textLight},
  statsCard: {backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.md},
  statRow: {flexDirection: 'row', justifyContent: 'space-around'},
  statItem: {alignItems: 'center', flex: 1},
  statValue: {fontSize: 28, fontWeight: '800', color: COLORS.text},
  statLabel: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, marginTop: 4},
  divider: {height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md},
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  chartLegend: {width: '100%', marginBottom: SPACING.xs},
  chartLegendText: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary, fontWeight: '600'},
  rankingsCard: {backgroundColor: COLORS.surface, borderRadius: 12, padding: SPACING.sm},
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  rankRowMe: {backgroundColor: COLORS.background, borderRadius: 8},
  rankNum: {fontSize: FONT_SIZE.md, fontWeight: '700', color: COLORS.primary, minWidth: 32},
  rankName: {fontSize: FONT_SIZE.md, fontWeight: '600', color: COLORS.text},
  rankNameMe: {color: COLORS.primary},
  rankMeta: {fontSize: FONT_SIZE.xs, color: COLORS.textSecondary},
  rankElo: {fontSize: FONT_SIZE.lg, fontWeight: '800', color: COLORS.text},
});
