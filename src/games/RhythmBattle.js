// 🎵 리듬 배틀 — 둘이 완전히 같은 노트 차트. PERFECT/GOOD 판정 + 콤보로 점수 경쟁.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const LANES = 4;
const TRAVEL = 1600; // 노트가 떨어지는 시간(ms)
const P_WIN = 90; // PERFECT 판정폭(±ms)
const G_WIN = 200; // GOOD 판정폭
const LANE_EMOJI = ['🔵', '🟡', '🟢', '🟣'];

function makeChart() {
  const notes = [];
  let t = 2500;
  while (t < 32000) {
    notes.push({ t, lane: Math.floor(Math.random() * LANES) });
    t += 340 + Math.random() * 360;
  }
  return notes;
}

export default function RhythmBattle({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | play | over
    chart: [],
    t0: 0,
    now: 0,
    p: { 1: null, 2: null },
    winner: 0,
    laneH: 200,
  }).current;
  const loop = useRef(null);
  useEffect(() => () => clearInterval(loop.current), []);

  const freshP = () => ({ judged: {}, score: 0, combo: 0, maxCombo: 0, judge: '', judgeAt: 0 });

  const start = () => {
    S.chart = makeChart();
    S.t0 = Date.now();
    S.p = { 1: freshP(), 2: freshP() };
    S.winner = 0;
    S.phase = 'play';
    clearInterval(loop.current);
    loop.current = setInterval(() => {
      S.now = Date.now() - S.t0;
      for (const p of [1, 2]) {
        const me = S.p[p];
        S.chart.forEach((n, i) => {
          if (!me.judged[i] && n.t < S.now - G_WIN) {
            me.judged[i] = 'MISS';
            me.combo = 0;
          }
        });
      }
      const last = S.chart[S.chart.length - 1];
      if (S.now > last.t + 900) {
        clearInterval(loop.current);
        S.phase = 'over';
        S.winner =
          S.p[1].score > S.p[2].score ? 1 : S.p[2].score > S.p[1].score ? 2 : 0;
      }
      force();
    }, 33);
  };

  const tap = (p, lane) => {
    if (S.phase !== 'play') return;
    const me = S.p[p];
    let best = -1;
    let bestDist = G_WIN + 1;
    S.chart.forEach((n, i) => {
      if (n.lane !== lane || me.judged[i]) return;
      const d = Math.abs(n.t - S.now);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best < 0) {
      me.combo = 0;
      me.judge = '...';
      me.judgeAt = S.now;
      return;
    }
    me.combo++;
    me.maxCombo = Math.max(me.maxCombo, me.combo);
    if (bestDist <= P_WIN) {
      me.judged[best] = 'PERFECT';
      me.score += 300 + me.combo * 10;
      me.judge = '✨ PERFECT';
      vib(18);
    } else {
      me.judged[best] = 'GOOD';
      me.score += 100 + me.combo * 5;
      me.judge = '👍 GOOD';
      vib(10);
    }
    me.judgeAt = S.now;
    force();
  };

  const half = (p) => {
    const me = S.p[p] || freshP();
    const h = S.laneH;
    return (
      <View style={[st.half, p === 2 && st.flip, { backgroundColor: p === 1 ? '#111828' : '#221420' }]}>
        <View style={st.head}>
          <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p}</Text>
          <Text style={st.scoreTxt}>{me.score}</Text>
          <Text style={st.combo}>{me.combo > 1 ? `${me.combo} COMBO` : ''}</Text>
        </View>
        <View
          style={st.laneArea}
          onLayout={(e) => { S.laneH = e.nativeEvent.layout.height; }}
        >
          {[...Array(LANES)].map((_, l) => (
            <View key={l} style={st.lane}>
              {S.phase === 'play' &&
                S.chart.map((n, i) => {
                  if (n.lane !== l || me.judged[i]) return null;
                  const y = ((S.now - (n.t - TRAVEL)) / TRAVEL) * h;
                  if (y < -24 || y > h + 10) return null;
                  return <View key={i} style={[st.note, { top: y - 9 }]} />;
                })}
            </View>
          ))}
          <View style={st.hitLine} />
          {me.judge !== '' && S.now - me.judgeAt < 500 && (
            <Text style={st.judgeTxt}>{me.judge}</Text>
          )}
        </View>
        <View style={st.btnRow}>
          {[...Array(LANES)].map((_, l) => (
            <TouchableOpacity key={l} style={st.padBtn} activeOpacity={0.6} onPress={() => tap(p, l)}>
              <Text style={{ fontSize: 24 }}>{LANE_EMOJI[l]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <Screen>
      {half(2)}
      <View style={st.mid} />
      {half(1)}
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🎵 리듬 배틀</Text>
          {S.phase === 'over' && (
            <>
              <Text style={st.ovWin}>
                {S.winner === 0 ? '무승부!' : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! 🏆`}
              </Text>
              <Text style={st.ovScore}>
                P1 {S.p[1].score}점 (최대 {S.p[1].maxCombo}콤보) · P2 {S.p[2].score}점 (최대 {S.p[2].maxCombo}콤보)
              </Text>
            </>
          )}
          <Text style={st.ovDesc}>
            떨어지는 노트가 판정선에 닿는 순간 해당 레인 탭!{'\n'}✨PERFECT 300+ · 👍GOOD 100+ · 콤보 보너스{'\n'}둘 다 완전히 같은 차트 — 약 30초 승부
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  half: { flex: 1, paddingHorizontal: 10, paddingTop: 6 },
  flip: { transform: [{ rotate: '180deg' }] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontWeight: '900', fontSize: 15 },
  scoreTxt: { color: C.gold, fontWeight: '900', fontSize: 16 },
  combo: { color: C.green, fontWeight: '900', fontSize: 13, minWidth: 74, textAlign: 'right' },
  laneArea: { flex: 1, flexDirection: 'row', marginTop: 4, overflow: 'hidden' },
  lane: { flex: 1, borderLeftWidth: 1, borderColor: C.line, position: 'relative' },
  note: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    height: 18,
    borderRadius: 9,
    backgroundColor: C.text,
  },
  hitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: C.gold,
  },
  judgeTxt: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 30,
    color: C.gold,
    fontWeight: '900',
    fontSize: 18,
  },
  btnRow: { flexDirection: 'row', paddingVertical: 6, gap: 6 },
  padBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  mid: { height: 8, backgroundColor: C.card },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ovTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  ovWin: { color: C.gold, fontSize: 22, fontWeight: '900', marginBottom: 8 },
  ovScore: { color: C.sub, fontSize: 13, marginBottom: 12 },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
