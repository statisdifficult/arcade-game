// 🥊 타이밍 펀치 — 왕복하는 게이지를 노란 존에 멈추면 상대에게 펀치! 라운드마다 빨라진다.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const HP = 100;

export default function TimingPunch({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | round | result | over
    round: 1,
    roundId: 0,
    hp: { 1: HP, 2: HP },
    locked: { 1: null, 2: null }, // 멈춘 위치 (0~100)
    t0: 0,
    winner: 0,
    note: { 1: '', 2: '' },
  }).current;
  const loop = useRef(null);
  const timers = useRef([]).current;
  useEffect(() => () => { clearInterval(loop.current); timers.forEach(clearTimeout); }, []);

  const speed = () => 90 + S.round * 28; // 초당 이동량 — 라운드마다 빨라짐
  const zoneHalf = () => Math.max(7, 17 - S.round * 1.2); // 노란 존 반폭 — 점점 좁아짐

  // 왕복 삼각파: 0→100→0
  const markerPos = () => {
    const el = ((Date.now() - S.t0) / 1000) * speed();
    const m = el % 200;
    return m <= 100 ? m : 200 - m;
  };

  const startRound = () => {
    S.phase = 'round';
    S.roundId++;
    S.locked = { 1: null, 2: null };
    S.note = { 1: '', 2: '' };
    S.t0 = Date.now();
    force();
    clearInterval(loop.current);
    loop.current = setInterval(force, 33);
    const rid = S.roundId; // 이전 라운드의 타임아웃이 새 라운드를 건드리지 않게
    timers.push(setTimeout(() => { // 4.5초 안에 못 멈추면 자동 미스
      if (S.phase === 'round' && S.roundId === rid) {
        if (S.locked[1] == null) S.locked[1] = -1;
        if (S.locked[2] == null) S.locked[2] = -1;
        resolve();
      }
    }, 4500));
  };

  const start = () => {
    S.round = 1;
    S.hp = { 1: HP, 2: HP };
    S.winner = 0;
    startRound();
  };

  const tap = (p) => {
    if (S.phase !== 'round' || S.locked[p] != null) return;
    S.locked[p] = markerPos();
    vib(20);
    if (S.locked[1] != null && S.locked[2] != null) resolve();
    else force();
  };

  const dmgOf = (pos) => {
    if (pos < 0) return 0;
    const dist = Math.abs(pos - 50);
    if (dist > zoneHalf()) return 0;
    return Math.round(10 + (1 - dist / zoneHalf()) * 15); // 정중앙일수록 아프다
  };

  const resolve = () => {
    S.phase = 'result';
    clearInterval(loop.current);
    const d1 = dmgOf(S.locked[1]); // P1이 P2에게
    const d2 = dmgOf(S.locked[2]);
    S.hp[2] = Math.max(0, S.hp[2] - d1);
    S.hp[1] = Math.max(0, S.hp[1] - d2);
    S.note[1] = d1 > 0 ? `💥 ${d1} 데미지!` : '휘익... 빗나감';
    S.note[2] = d2 > 0 ? `💥 ${d2} 데미지!` : '휘익... 빗나감';
    if (d1 > 0 || d2 > 0) vib(120);
    force();
    timers.push(setTimeout(() => {
      if (S.hp[1] <= 0 || S.hp[2] <= 0) {
        S.phase = 'over';
        S.winner = S.hp[1] === S.hp[2] ? 0 : S.hp[1] > S.hp[2] ? 1 : 2;
      } else {
        S.round++;
        startRound();
        return;
      }
      force();
    }, 1400));
  };

  const gauge = (p) => {
    const pos = S.locked[p] != null && S.locked[p] >= 0 ? S.locked[p] : S.phase === 'round' && S.locked[p] == null ? markerPos() : null;
    const zh = zoneHalf();
    return (
      <View style={st.gauge}>
        <View style={[st.zone, { left: `${50 - zh}%`, width: `${zh * 2}%` }]} />
        {pos != null && <View style={[st.marker, { left: `${pos}%` }]} />}
      </View>
    );
  };

  const half = (p) => (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[st.half, p === 2 && st.flip, { backgroundColor: p === 1 ? '#131a2e' : '#251523' }]}
      onPress={() => tap(p)}
    >
      <View style={st.head}>
        <Text style={[st.label, { color: p === 1 ? C.p1 : C.p2 }]}>P{p} 🥊</Text>
        <Text style={st.roundTxt}>R{S.round}</Text>
      </View>
      <View style={st.hpBar}>
        <View style={[st.hpFill, { width: `${S.hp[p]}%`, backgroundColor: S.hp[p] > 30 ? C.green : C.danger }]} />
        <Text style={st.hpTxt}>{S.hp[p]}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {gauge(p)}
        <Text style={st.hint}>
          {S.phase === 'result'
            ? S.note[p]
            : S.locked[p] != null
            ? '멈춤! 상대 기다리는 중...'
            : '노란 존에서 탭!'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen>
      {half(2)}
      <View style={st.mid} />
      {half(1)}
      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🥊 타이밍 펀치</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>{S.winner === 0 ? '더블 KO! 무승부' : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! 🏆`}</Text>
          )}
          <Text style={st.ovDesc}>
            움직이는 게이지를 노란 존 안에서 탭!{'\n'}정중앙일수록 펀치가 세다 (최대 25){'\n'}라운드마다 빨라지고 존이 좁아짐 — HP {HP} 소진 시 KO
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  half: { flex: 1, padding: 14 },
  flip: { transform: [{ rotate: '180deg' }] },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontWeight: '900', fontSize: 16 },
  roundTxt: { color: C.sub, fontWeight: '800' },
  hpBar: { height: 18, backgroundColor: C.card, borderRadius: 9, marginTop: 8, overflow: 'hidden', justifyContent: 'center' },
  hpFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9 },
  hpTxt: { color: '#0b0e1a', fontWeight: '900', fontSize: 11, textAlign: 'center' },
  gauge: { height: 46, backgroundColor: C.card, borderRadius: 12, overflow: 'hidden', justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: C.gold, opacity: 0.85 },
  marker: { position: 'absolute', top: 2, bottom: 2, width: 5, marginLeft: -2, backgroundColor: C.text, borderRadius: 2 },
  hint: { color: C.sub, textAlign: 'center', marginTop: 12, fontWeight: '700', fontSize: 15 },
  mid: { height: 8, backgroundColor: C.card },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.93)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  ovTitle: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 12 },
  ovWin: { color: C.gold, fontSize: 22, fontWeight: '900', marginBottom: 12 },
  ovDesc: { color: C.sub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
