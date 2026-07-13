// 온라인 게임 공용 조각들 — 카운트다운, 결과 랭킹, 색/이름 헬퍼, 완주 수집기
import React, { useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { C, PLAYER_COLORS } from '../theme';
import { BigButton } from '../components/ui';

export const useForce = () => useReducer((x) => x + 1, 0)[1];

export const colorOf = (players, id) =>
  PLAYER_COLORS[Math.max(0, players.findIndex((p) => p.id === id)) % PLAYER_COLORS.length];

export const nameOf = (players, id) => players.find((p) => p.id === id)?.name || `#${id}`;

// 3·2·1·GO 카운트다운 오버레이 — 끝나면 onDone 1회 호출
export function Countdown({ onDone }) {
  const [n, setN] = useState(3);
  const fired = useRef(false);
  useEffect(() => {
    if (n <= 0) {
      if (!fired.current) { fired.current = true; onDone && onDone(); }
      return;
    }
    const id = setTimeout(() => setN(n - 1), 800);
    return () => clearTimeout(id);
  }, [n]);
  if (n <= 0) return null;
  return (
    <View style={st.count}>
      <Text style={st.countNum}>{n}</Text>
    </View>
  );
}

// 결과 랭킹 보드 — rows는 이미 순위대로 정렬해서 전달: [{id, name, text}]
export function Results({ title, rows, me, exit, note }) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <View style={st.results}>
      <Text style={st.resTitle}>{title}</Text>
      {note ? <Text style={st.resNote}>{note}</Text> : null}
      <View style={{ width: '100%', maxWidth: 420 }}>
        {rows.map((r, i) => (
          <View key={r.id} style={[st.row, r.id === me && st.rowMe]}>
            <Text style={st.rank}>{medals[i] || `${i + 1}위`}</Text>
            <Text style={[st.rname, r.id === me && { color: C.gold }]} numberOfLines={1}>
              {r.name}{r.id === me ? ' (나)' : ''}
            </Text>
            <Text style={st.rval}>{r.text}</Text>
          </View>
        ))}
      </View>
      <BigButton label="로비로 (전원 복귀)" onPress={exit} color={C.gold} style={{ marginTop: 20, minWidth: 220 }} />
    </View>
  );
}

// 각자 화면형 게임의 완주 수집기 — 전원 완료(또는 이탈)되면 onAll 호출
export function doneTracker(players, onAll) {
  const done = {};
  const gone = new Set();
  let fired = false;
  const check = () => {
    if (fired) return;
    if (players.every((p) => done[p.id] !== undefined || gone.has(p.id))) {
      fired = true;
      onAll(done);
    }
  };
  return {
    done,
    set(id, v) { if (done[id] === undefined) { done[id] = v; check(); } },
    left(id) { gone.add(id); check(); },
    forceAll() { if (!fired) { fired = true; onAll(done); } },
  };
}

// ms → "12.34초" 표시
export const secTxt = (ms) => `${(ms / 1000).toFixed(2)}초`;

const st = StyleSheet.create({
  count: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  countNum: { color: C.gold, fontSize: 110, fontWeight: '900' },
  results: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,24,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 10,
  },
  resTitle: { color: C.text, fontSize: 24, fontWeight: '900', marginBottom: 6 },
  resNote: { color: C.sub, fontSize: 13, marginBottom: 10, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.line,
  },
  rowMe: { borderColor: C.gold },
  rank: { fontSize: 18, width: 46, color: C.text, fontWeight: '800' },
  rname: { flex: 1, color: C.text, fontSize: 16, fontWeight: '700' },
  rval: { color: C.gold, fontSize: 15, fontWeight: '900', marginLeft: 8 },
});
