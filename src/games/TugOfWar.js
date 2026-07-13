// 🪢 화면 줄다리기 — 연타로 영역 밀어붙이기. ⚡골든타임(3배) / 🧊얼음(한쪽 마비) 이벤트.
import React, { useEffect, useReducer, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, vib } from '../components/ui';

const TIME = 30;
const POWER = 0.012;

export default function TugOfWar({ onExit }) {
  const [, force] = useReducer((x) => x + 1, 0);
  const S = useRef({
    phase: 'ready', // ready | play | over
    pos: 0.5, // 아래(P1) 영역 비율
    left: TIME,
    event: null, // {type:'golden'} | {type:'ice', target}
    eventLeft: 0,
    nextEvent: 0,
    winner: 0, // 0=무승부
  }).current;
  const loop = useRef(null);
  useEffect(() => () => clearInterval(loop.current), []);

  const start = () => {
    S.phase = 'play';
    S.pos = 0.5;
    S.left = TIME;
    S.event = null;
    S.nextEvent = 4 + Math.random() * 4;
    S.winner = 0;
    force();
    clearInterval(loop.current);
    loop.current = setInterval(() => {
      S.left -= 0.1;
      if (S.event) {
        S.eventLeft -= 0.1;
        if (S.eventLeft <= 0) S.event = null;
      } else if (TIME - S.left >= S.nextEvent) {
        S.event =
          Math.random() < 0.5
            ? { type: 'golden' }
            : { type: 'ice', target: Math.random() < 0.5 ? 1 : 2 };
        S.eventLeft = 3;
        S.nextEvent = TIME - S.left + 5 + Math.random() * 4;
        vib(60);
      }
      if (S.left <= 0) finish(S.pos > 0.5 ? 1 : S.pos < 0.5 ? 2 : 0);
      force();
    }, 100);
  };

  const finish = (winner) => {
    S.phase = 'over';
    S.winner = winner;
    clearInterval(loop.current);
    force();
  };

  const tap = (p) => {
    if (S.phase !== 'play') return;
    if (S.event?.type === 'ice' && S.event.target === p) {
      vib(15);
      return; // 얼어서 안 밀림
    }
    const mult = S.event?.type === 'golden' ? 3 : 1;
    S.pos += (p === 1 ? 1 : -1) * POWER * mult;
    if (S.pos >= 0.95) return finish(1);
    if (S.pos <= 0.05) return finish(2);
    force();
  };

  const banner =
    S.event?.type === 'golden'
      ? '⚡ 골든타임! 3배!'
      : S.event?.type === 'ice'
      ? `🧊 ${S.event.target === 1 ? '🔵P1' : '🔴P2'} 얼음!`
      : `${Math.max(0, Math.ceil(S.left))}초`;

  return (
    <Screen>
      <TouchableOpacity
        activeOpacity={0.95}
        style={[st.zone, { flex: 1 - S.pos, backgroundColor: '#2b1626' }, st.flip]}
        onPress={() => tap(2)}
      >
        <Text style={[st.zoneLabel, { color: C.p2 }]}>🔴 P2 — 연타!!</Text>
        {S.event?.type === 'ice' && S.event.target === 2 && <Text style={st.ice}>🧊</Text>}
      </TouchableOpacity>

      <View style={[st.rope, S.event?.type === 'golden' && { backgroundColor: C.gold }]}>
        <Text style={st.ropeText}>🪢 {banner}</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.95}
        style={[st.zone, { flex: S.pos, backgroundColor: '#14203a' }]}
        onPress={() => tap(1)}
      >
        <Text style={[st.zoneLabel, { color: C.p1 }]}>🔵 P1 — 연타!!</Text>
        {S.event?.type === 'ice' && S.event.target === 1 && <Text style={st.ice}>🧊</Text>}
      </TouchableOpacity>

      {(S.phase === 'ready' || S.phase === 'over') && (
        <View style={st.overlay}>
          <Text style={st.ovTitle}>🪢 화면 줄다리기</Text>
          {S.phase === 'over' && (
            <Text style={st.ovWin}>
              {S.winner === 0 ? '무승부!' : `${S.winner === 1 ? '🔵 P1' : '🔴 P2'} 승리! 🏆`}
            </Text>
          )}
          <Text style={st.ovDesc}>
            내 영역을 연타해서 상대 쪽으로 밀어붙이기!{'\n'}⚡골든타임엔 한 방이 3배{'\n'}🧊얼음이 뜬 쪽은 잠깐 마비 — {TIME}초 승부
          </Text>
          <BigButton label={S.phase === 'over' ? '다시하기' : '시작!'} onPress={start} color={C.gold} style={{ minWidth: 200 }} />
          <BigButton label="나가기" onPress={onExit} color={C.card} small style={{ marginTop: 10 }} />
        </View>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  zone: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  flip: { transform: [{ rotate: '180deg' }] },
  zoneLabel: { fontSize: 22, fontWeight: '900' },
  ice: { fontSize: 60, position: 'absolute' },
  rope: { height: 40, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  ropeText: { color: C.text, fontWeight: '900', fontSize: 15 },
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
