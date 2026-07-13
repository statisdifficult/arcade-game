// 🎨 컬러 클래시 (다인전) — 전원 같은 스트룹 12문제, 최속 클리어. 틀리면 +1.5초 페널티!
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C, STROOP_COLORS } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, doneTracker, secTxt, useForce } from './common';

const N = 12;
const PENALTY = 1500;
const LIMIT = 60000;

function makeQuestions(seed) {
  const rng = mulberry32(seed);
  return [...Array(N)].map(() => {
    const word = STROOP_COLORS[Math.floor(rng() * STROOP_COLORS.length)];
    const match = rng() < 0.5;
    const others = STROOP_COLORS.filter((c) => c.name !== word.name);
    const ink = match ? word : others[Math.floor(rng() * others.length)];
    return { word, ink, match: word.name === ink.name };
  });
}

export default function ColorClashOnline({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count',
    qs: makeQuestions(seed),
    i: 0,
    t0: 0,
    penalty: 0,
    lockUntil: 0,
    flash: false,
    prog: {},
    rows: [],
  }).current;
  const timers = useRef([]).current;

  const tracker = useRef(
    doneTracker(players, (done) => {
      S.rows = [...players]
        .map((p) => ({ p, v: done[p.id] }))
        .sort((a, b) => (a.v ?? 1e9) - (b.v ?? 1e9))
        .map(({ p, v }) => ({
          id: p.id,
          name: p.name,
          text: v == null ? '미도착' : v >= LIMIT ? 'DNF' : secTxt(v),
        }));
      S.phase = 'results';
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
    return () => { off(); timers.forEach(clearTimeout); };
  }, []);

  const go = () => {
    S.phase = 'play';
    S.t0 = Date.now();
    timers.push(setTimeout(() => { if (S.phase === 'play') finish(LIMIT); }, LIMIT));
    force();
  };

  const finish = (v) => {
    S.phase = 'waiting';
    net.msg({ a: 'done', v });
    tracker.set(me, v);
    timers.push(setTimeout(() => tracker.forceAll(), 20000));
    force();
  };

  const answer = (saidMatch) => {
    if (S.phase !== 'play' || Date.now() < S.lockUntil) return;
    const q = S.qs[S.i];
    if (saidMatch === q.match) {
      vib(12);
      S.i++;
      net.msg({ a: 'prog', v: S.i });
      if (S.i >= N) return finish(Date.now() - S.t0 + S.penalty);
    } else {
      vib(80);
      S.penalty += PENALTY;
      S.lockUntil = Date.now() + 500;
      S.flash = true;
      timers.push(setTimeout(() => { S.flash = false; force(); }, 500));
    }
    force();
  };

  const q = S.qs[S.i];

  return (
    <Screen style={S.flash ? { backgroundColor: '#2a1220' } : null}>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="🎨 컬러 클래시 결과" note={`스트룹 ${N}문제 · 오답은 +${PENALTY / 1000}초`} rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={st.head}>
            <Text style={st.progTxt}>{S.i}/{N}{S.penalty > 0 ? `  (+${S.penalty / 1000}s)` : ''}</Text>
            <View style={st.others}>
              {players.filter((p) => p.id !== me).map((p) => (
                <Text key={p.id} style={[st.otherTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {S.prog[p.id] ?? 0}
                </Text>
              ))}
            </View>
          </View>
          {S.phase === 'waiting' ? (
            <Text style={st.waitTxt}>클리어! 다른 사람 기다리는 중...</Text>
          ) : (
            <>
              <View style={st.cardBox}>
                {q && <Text style={[st.word, { color: q.ink.hex }]}>{q.word.name}</Text>}
                <Text style={st.q}>글자의 "뜻"과 "색"이 같다?</Text>
              </View>
              <View style={st.btnRow}>
                <TouchableOpacity style={[st.oxBtn, { backgroundColor: '#1b3320' }]} onPress={() => answer(true)}>
                  <Text style={st.oxTxt}>⭕ 같다</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.oxBtn, { backgroundColor: '#33261a' }]} onPress={() => answer(false)}>
                  <Text style={st.oxTxt}>❌ 다르다</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  progTxt: { color: C.gold, fontWeight: '900', fontSize: 18 },
  others: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  otherTxt: { fontSize: 12, fontWeight: '800' },
  cardBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  word: { fontSize: 62, fontWeight: '900' },
  q: { color: C.sub, fontSize: 14, marginTop: 12 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  oxBtn: { flex: 1, paddingVertical: 22, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  oxTxt: { color: C.text, fontSize: 20, fontWeight: '900' },
  waitTxt: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
