// 🎵 리듬 스톰 — 전원 같은 노트 차트를 연주. 점수+콤보 랭킹전.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, doneTracker, useForce } from './common';

const LANES = 4;
const TRAVEL = 1600;
const P_WIN = 90;
const G_WIN = 200;
const LANE_EMOJI = ['🔵', '🟡', '🟢', '🟣'];

function makeChart(seed) {
  const rng = mulberry32(seed);
  const notes = [];
  let t = 2500;
  while (t < 32000) {
    notes.push({ t, lane: Math.floor(rng() * LANES) });
    t += 340 + rng() * 360;
  }
  return notes;
}

export default function RhythmStorm({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count',
    chart: makeChart(seed),
    t0: 0,
    now: 0,
    judged: {},
    score: 0,
    combo: 0,
    maxCombo: 0,
    judge: '',
    judgeAt: 0,
    laneH: 300,
    prog: {},
    lastSend: 0,
    rows: [],
  }).current;
  const loop = useRef(null);
  const timers = useRef([]).current;

  const tracker = useRef(
    doneTracker(players, (done) => {
      S.rows = [...players]
        .map((p) => ({ p, v: done[p.id] }))
        .sort((a, b) => (b.v?.s ?? -1) - (a.v?.s ?? -1))
        .map(({ p, v }) => ({
          id: p.id,
          name: p.name,
          text: v ? `${v.s}점 · ${v.c}콤보` : '미도착',
        }));
      S.phase = 'results';
      clearInterval(loop.current);
      force();
    })
  ).current;

  useEffect(() => {
    const off = net.on((m) => {
      if (m.t !== 'msg') return;
      if (m.d.a === 'prog') { S.prog[m.from] = m.d.v; force(); }
      if (m.d.a === 'done') { tracker.set(m.from, m.d.v); force(); }
      if (m.d.a === 'left') tracker.left(m.from);
    });
    return () => { off(); clearInterval(loop.current); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    loop.current = setInterval(() => {
      S.now = Date.now() - S.t0;
      S.chart.forEach((n, i) => {
        if (!S.judged[i] && n.t < S.now - G_WIN) {
          S.judged[i] = 'MISS';
          S.combo = 0;
        }
      });
      if (Date.now() - S.lastSend > 500) {
        S.lastSend = Date.now();
        net.msg({ a: 'prog', v: S.score });
      }
      const last = S.chart[S.chart.length - 1];
      if (S.now > last.t + 900 && S.phase === 'play') {
        S.phase = 'waiting';
        clearInterval(loop.current);
        const v = { s: S.score, c: S.maxCombo };
        net.msg({ a: 'done', v });
        tracker.set(me, v);
        timers.push(setTimeout(() => tracker.forceAll(), 15000));
      }
      force();
    }, 33);
    force();
  };

  const tap = (lane) => {
    if (S.phase !== 'play') return;
    let best = -1;
    let bestDist = G_WIN + 1;
    S.chart.forEach((n, i) => {
      if (n.lane !== lane || S.judged[i]) return;
      const d = Math.abs(n.t - S.now);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (best < 0) { S.combo = 0; S.judge = '...'; S.judgeAt = S.now; return; }
    S.combo++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    if (bestDist <= P_WIN) {
      S.judged[best] = 'P';
      S.score += 300 + S.combo * 10;
      S.judge = '✨ PERFECT';
      vib(18);
    } else {
      S.judged[best] = 'G';
      S.score += 100 + S.combo * 5;
      S.judge = '👍 GOOD';
      vib(10);
    }
    S.judgeAt = S.now;
    force();
  };

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="🎵 리듬 스톰 결과" rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <View style={st.head}>
            <Text style={st.score}>{S.score}</Text>
            <Text style={st.combo}>{S.combo > 1 ? `${S.combo} COMBO` : ''}</Text>
            <View style={st.others}>
              {players.filter((p) => p.id !== me).map((p) => (
                <Text key={p.id} style={[st.otherTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {S.prog[p.id] ?? 0}
                </Text>
              ))}
            </View>
          </View>
          <View style={st.laneArea} onLayout={(e) => { S.laneH = e.nativeEvent.layout.height; }}>
            {[...Array(LANES)].map((_, l) => (
              <View key={l} style={st.lane}>
                {S.phase === 'play' &&
                  S.chart.map((n, i) => {
                    if (n.lane !== l || S.judged[i]) return null;
                    const y = ((S.now - (n.t - TRAVEL)) / TRAVEL) * S.laneH;
                    if (y < -30 || y > S.laneH + 10) return null;
                    return <View key={i} style={[st.note, { top: y - 11 }]} />;
                  })}
              </View>
            ))}
            <View style={st.hitLine} />
            {S.judge !== '' && S.now - S.judgeAt < 500 && <Text style={st.judgeTxt}>{S.judge}</Text>}
            {S.phase === 'waiting' && <Text style={st.waitTxt}>연주 끝! 집계 중...</Text>}
          </View>
          <View style={st.btnRow}>
            {[...Array(LANES)].map((_, l) => (
              <TouchableOpacity key={l} style={st.padBtn} activeOpacity={0.6} onPress={() => tap(l)}>
                <Text style={{ fontSize: 30 }}>{LANE_EMOJI[l]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  score: { color: C.gold, fontWeight: '900', fontSize: 22 },
  combo: { color: C.green, fontWeight: '900', fontSize: 14 },
  others: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  otherTxt: { fontSize: 11, fontWeight: '800' },
  laneArea: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  lane: { flex: 1, borderLeftWidth: 1, borderColor: C.line },
  note: { position: 'absolute', left: '10%', right: '10%', height: 22, borderRadius: 11, backgroundColor: C.text },
  hitLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: C.gold },
  judgeTxt: { position: 'absolute', alignSelf: 'center', bottom: 40, color: C.gold, fontWeight: '900', fontSize: 20 },
  waitTxt: { position: 'absolute', alignSelf: 'center', top: 60, color: C.sub, fontSize: 15 },
  btnRow: { flexDirection: 'row', paddingVertical: 10, gap: 8 },
  padBtn: { flex: 1, backgroundColor: C.card, borderRadius: 14, alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: C.line },
});
