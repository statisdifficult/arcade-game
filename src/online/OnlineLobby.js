// 🌐 온라인 로비 — 방 만들기/참가/게임 선택. 온라인 게임 목록: ONLINE_GAMES 배열 (한 줄 = 게임 1개)
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { C } from '../theme';
import { Screen, BigButton, Chip } from '../components/ui';
import { Net, guessServerUrl } from './net';

import TapRace from './TapRace';
import DotsArena from './DotsArena';
import TagChase from './TagChase';
import PaintArena from './PaintArena';
import MeteorDodge from './MeteorDodge';
import ZombieInfect from './ZombieInfect';
import AirHockey from './AirHockey';
import BallSoccer from './BallSoccer';
import SenseTimer from './SenseTimer';
import TargetSniper from './TargetSniper';
import TapKing from './TapKing';
import NumberStormOnline from './NumberStormOnline';
import ColorClashOnline from './ColorClashOnline';
import RhythmStorm from './RhythmStorm';

const ONLINE_GAMES = [
  // 공유 아레나형 — 한 아레나에서 실시간 대결
  { key: 'race', icon: '🏃', title: '연타 레이스', desc: '🔴 빨간불 조심', comp: TapRace, kind: '아레나' },
  { key: 'dots', icon: '🟡', title: '점 먹기 아레나', desc: '드래그 쟁탈전', comp: DotsArena, kind: '아레나' },
  { key: 'tag', icon: '👹', title: '술래잡기', desc: '술래 최장자 벌칙', comp: TagChase, kind: '아레나' },
  { key: 'paint', icon: '🎨', title: '페인트 아레나', desc: '막판 🔥피버', comp: PaintArena, kind: '아레나' },
  { key: 'meteor', icon: '☄️', title: '운석 피하기', desc: '최후의 1인', comp: MeteorDodge, kind: '아레나' },
  { key: 'zombie', icon: '🧟', title: '좀비 감염전', desc: '40초 생존', comp: ZombieInfect, kind: '아레나' },
  { key: 'hockey', icon: '🏒', title: '에어하키', desc: '1:1, 먼저 5골', comp: AirHockey, kind: '아레나' },
  { key: 'soccer', icon: '⚽', title: '공 몰이 축구', desc: '자동 팀 배정', comp: BallSoccer, kind: '아레나' },
  // 각자 화면형 — 전원 같은 문제, 기록/점수 랭킹
  { key: 'timer', icon: '⏱', title: '감각 타이머', desc: '정확히 7.00초', comp: SenseTimer, kind: '랭킹' },
  { key: 'sniper', icon: '🎯', title: '과녁 스나이퍼', desc: '15개 최속 클리어', comp: TargetSniper, kind: '랭킹' },
  { key: 'tapking', icon: '👆', title: '10초 연타왕', desc: '실시간 순위', comp: TapKing, kind: '랭킹' },
  { key: 'numstorm', icon: '🔢', title: '숫자 폭풍', desc: '같은 판 최속 클리어', comp: NumberStormOnline, kind: '랭킹' },
  { key: 'colorclash', icon: '🎨', title: '컬러 클래시', desc: '스트룹 12문제', comp: ColorClashOnline, kind: '랭킹' },
  { key: 'rhythm', icon: '🎵', title: '리듬 스톰', desc: '같은 차트 연주', comp: RhythmStorm, kind: '랭킹' },
];

export default function OnlineLobby({ onExit }) {
  const net = useRef(new Net()).current;
  const [phase, setPhase] = useState('menu'); // menu | room | game
  const [name, setName] = useState(() => `용사${Math.floor(10 + Math.random() * 90)}`);
  const [server, setServer] = useState(guessServerUrl());
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [me, setMe] = useState(0);
  const [room, setRoom] = useState(null); // {code, hostId, players}
  const [game, setGame] = useState(null); // {key, seed, players, hostId}

  useEffect(() => {
    const off = net.on((m) => {
      switch (m.t) {
        case 'joined':
          setMe(m.you);
          setRoom(m.room);
          setPhase('room');
          setErr('');
          break;
        case 'room':
          setRoom(m.room);
          break;
        case 'err':
          setErr(m.m);
          break;
        case 'start':
          setGame({ key: m.game, seed: m.seed, players: m.players, hostId: m.hostId });
          setPhase('game');
          break;
        case 'end':
          setGame(null);
          setPhase('room');
          break;
        case 'closed':
          setGame(null);
          setRoom(null);
          setPhase('menu');
          setErr('서버 연결이 끊겼어요 😢');
          break;
      }
    });
    return () => {
      off();
      net.close();
    };
  }, []);

  const go = async (action) => {
    setErr('');
    setBusy(true);
    try {
      if (!net.connected) await net.connect(server.trim());
      if (action === 'create') net.send({ t: 'create', name: name.trim() || '플레이어' });
      else net.send({ t: 'join', code: codeInput.trim(), name: name.trim() || '플레이어' });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  // ─── 게임 화면 ───
  if (phase === 'game' && game) {
    const def = ONLINE_GAMES.find((g) => g.key === game.key);
    if (def) {
      const Comp = def.comp;
      return (
        <Comp
          net={net}
          me={me}
          players={game.players}
          hostId={game.hostId}
          seed={game.seed}
          exit={() => net.send({ t: 'end' })}
        />
      );
    }
  }

  // ─── 방(대기실) 화면 ───
  if (phase === 'room' && room) {
    const isHost = room.hostId === me;
    return (
      <Screen>
        <ScrollView contentContainerStyle={st.wrap}>
          <View style={st.topRow}>
            <TouchableOpacity onPress={() => { net.send({ t: 'leave' }); net.close(); setPhase('menu'); setRoom(null); }}>
              <Text style={st.back}>‹ 나가기</Text>
            </TouchableOpacity>
          </View>
          <Text style={st.codeLabel}>방 코드</Text>
          <Text style={st.code}>{room.code}</Text>
          <Text style={st.sub}>친구들이 이 코드로 참가하면 돼요 (최대 6명)</Text>

          <View style={st.playerBox}>
            {room.players.map((p) => (
              <Chip
                key={p.id}
                label={`${p.id === room.hostId ? '👑 ' : ''}${p.name}${p.id === me ? ' (나)' : ''}`}
                active={p.id === me}
                style={{ margin: 4 }}
              />
            ))}
          </View>

          {isHost ? (
            <>
              <Text style={st.section}>게임을 고르면 바로 시작! 🚀</Text>
              <View style={st.gameGrid}>
                {ONLINE_GAMES.map((g) => (
                  <TouchableOpacity
                    key={g.key}
                    style={st.gameCard}
                    activeOpacity={0.8}
                    onPress={() => net.send({ t: 'start', game: g.key })}
                  >
                    <Text style={{ fontSize: 26 }}>{g.icon}</Text>
                    <Text style={st.gameTitle}>{g.title}</Text>
                    <Text style={st.gameDesc}>{g.kind} · {g.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <Text style={st.waiting}>👑 방장이 게임을 고르는 중...</Text>
          )}
        </ScrollView>
      </Screen>
    );
  }

  // ─── 접속 메뉴 화면 ───
  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
          <View style={st.topRow}>
            <TouchableOpacity onPress={onExit}>
              <Text style={st.back}>‹ 홈으로</Text>
            </TouchableOpacity>
          </View>
          <Text style={st.title}>🌐 온라인 대전</Text>
          <Text style={st.sub}>같은 와이파이면 서버 주소가 자동으로 잡혀요</Text>

          <Text style={st.label}>닉네임</Text>
          <TextInput style={st.input} value={name} onChangeText={setName} maxLength={12} placeholder="닉네임" placeholderTextColor={C.sub} />

          <BigButton label={busy ? '연결 중...' : '방 만들기 👑'} onPress={() => go('create')} disabled={busy} color={C.gold} style={{ marginTop: 16 }} />

          <Text style={[st.label, { marginTop: 22 }]}>친구 방에 참가</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[st.input, { flex: 1, letterSpacing: 6, textAlign: 'center', fontSize: 20 }]}
              value={codeInput}
              onChangeText={setCodeInput}
              maxLength={4}
              keyboardType="number-pad"
              placeholder="0000"
              placeholderTextColor={C.sub}
            />
            <BigButton label="참가" onPress={() => go('join')} disabled={busy || codeInput.trim().length !== 4} color={C.p1} />
          </View>

          <Text style={[st.label, { marginTop: 22 }]}>서버 주소</Text>
          <TextInput style={st.input} value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} placeholder="ws://192.168.0.10:8790" placeholderTextColor={C.sub} />
          <Text style={st.hint}>PC에서 `cd server && npm start` 후 접속 · 인터넷 배포 시 wss://주소 입력</Text>

          {err ? <Text style={st.err}>⚠️ {err}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { padding: 18, paddingBottom: 40 },
  topRow: { flexDirection: 'row', marginBottom: 8 },
  back: { color: C.sub, fontSize: 16, fontWeight: '700' },
  title: { color: C.text, fontSize: 26, fontWeight: '900', marginTop: 4 },
  sub: { color: C.sub, fontSize: 13, marginTop: 6, marginBottom: 14 },
  label: { color: C.text, fontWeight: '800', fontSize: 14, marginBottom: 6 },
  input: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  hint: { color: C.sub, fontSize: 11, marginTop: 6, lineHeight: 16 },
  err: { color: C.danger, marginTop: 16, fontWeight: '700', textAlign: 'center' },
  codeLabel: { color: C.sub, fontSize: 13, textAlign: 'center', marginTop: 6 },
  code: { color: C.gold, fontSize: 56, fontWeight: '900', textAlign: 'center', letterSpacing: 10 },
  playerBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 14,
  },
  section: { color: C.text, fontWeight: '800', fontSize: 16, textAlign: 'center', marginBottom: 10 },
  gameGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gameCard: {
    width: '48.5%',
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  gameTitle: { color: C.text, fontWeight: '800', fontSize: 14, marginTop: 6 },
  gameDesc: { color: C.sub, fontSize: 11, marginTop: 3 },
  waiting: { color: C.sub, textAlign: 'center', marginTop: 30, fontSize: 15 },
});
