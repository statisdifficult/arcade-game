// 🔢 숫자 폭풍 (다인전) — 전원 같은 판, 같은 스왑 타이밍. 1~12 최속 클리어 랭킹전.
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, vib } from '../components/ui';
import { mulberry32 } from './net';
import { Countdown, Results, colorOf, doneTracker, secTxt, useForce } from './common';

const N = 12;
const SWAP_MS = 2000; // 2초마다 숫자들이 도망간다 (전원 동일 타이밍)
const LIMIT = 60000;

// (시드, 몇 개 클리어, 몇 번째 스왑)이 같으면 전원 완전히 같은 배치가 나온다
function layout(seed, cleared, tick) {
  const rng = mulberry32((seed ^ (cleared * 131071) ^ (tick * 7919)) | 0);
  const slots = new Array(N).fill(null);
  const idx = [...Array(N).keys()];
  for (let n = cleared + 1; n <= N; n++) {
    const k = idx.splice(Math.floor(rng() * idx.length), 1)[0];
    slots[k] = n;
  }
  return slots;
}

export default function NumberStormOnline({ net, me, players, seed, exit }) {
  const force = useForce();
  const S = useRef({
    phase: 'count',
    next: 1,
    t0: 0,
    tick: 0,
    wrong: -1,
    prog: {},
    rows: [],
  }).current;
  const loop = useRef(null);
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
      const el = Date.now() - S.t0;
      const tick = Math.floor(el / SWAP_MS);
      if (tick !== S.tick) { S.tick = tick; force(); }
      if (el > LIMIT && S.phase === 'play') finish(LIMIT);
    }, 100);
    force();
  };

  const finish = (v) => {
    S.phase = 'waiting';
    clearInterval(loop.current);
    net.msg({ a: 'done', v });
    tracker.set(me, v);
    timers.push(setTimeout(() => tracker.forceAll(), 20000));
    force();
  };

  const tap = (slotIdx) => {
    if (S.phase !== 'play') return;
    const slots = layout(seed, S.next - 1, S.tick);
    const n = slots[slotIdx];
    if (n == null) return;
    if (n === S.next) {
      vib(15);
      S.next++;
      net.msg({ a: 'prog', v: S.next - 1 });
      if (S.next > N) return finish(Date.now() - S.t0);
    } else {
      vib(60);
      S.wrong = slotIdx;
      timers.push(setTimeout(() => { S.wrong = -1; force(); }, 220));
    }
    force();
  };

  const slots = S.phase === 'play' ? layout(seed, S.next - 1, S.tick) : new Array(N).fill(null);

  return (
    <Screen>
      {S.phase === 'count' && <Countdown onDone={go} />}
      {S.phase === 'results' ? (
        <Results title="🔢 숫자 폭풍 결과" note="전원 같은 판 · 같은 스왑 타이밍" rows={S.rows} me={me} exit={exit} />
      ) : (
        <View style={{ flex: 1, padding: 12 }}>
          <View style={st.head}>
            <Text style={st.next}>다음: {S.next > N ? '완료!' : S.next}</Text>
            <View style={st.others}>
              {players.filter((p) => p.id !== me).map((p) => (
                <Text key={p.id} style={[st.otherTxt, { color: colorOf(players, p.id) }]} numberOfLines={1}>
                  {p.name} {S.prog[p.id] ?? 0}/{N}
                </Text>
              ))}
            </View>
          </View>
          {S.phase === 'waiting' ? (
            <Text style={st.waitTxt}>클리어! 다른 사람 기다리는 중...</Text>
          ) : (
            <View style={st.grid}>
              {slots.map((n, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.7}
                  style={[st.cell, S.wrong === i && st.cellWrong, n == null && { opacity: 0.2 }]}
                  onPress={() => tap(i)}
                >
                  <Text style={st.num}>{n ?? ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  next: { color: C.gold, fontWeight: '900', fontSize: 20 },
  others: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  otherTxt: { fontSize: 12, fontWeight: '800' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', height: '25%', padding: 4 },
  cellWrong: { backgroundColor: 'rgba(255,93,115,0.4)', borderRadius: 14 },
  num: {
    color: C.text,
    fontSize: 30,
    fontWeight: '900',
    backgroundColor: C.card,
    width: '100%',
    height: '100%',
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 14,
    overflow: 'hidden',
    lineHeight: 90,
  },
  waitTxt: { color: C.sub, textAlign: 'center', marginTop: 60, fontSize: 15 },
});
