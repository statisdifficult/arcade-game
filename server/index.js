// 맞짱 오락실 릴레이 서버 — 방 코드 기반, 의존성은 ws 하나뿐인 단일 파일
// 기본은 순수 릴레이: {t:'msg', d} → 같은 방 전원에게 {t:'msg', from, d}
// 동시 획득 충돌이 나는 게임(점 먹기 eat / 페인트 paint)만 서버가 판정한다.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8790;
const MAX_PLAYERS = 6;

// 일반 HTTP 요청에는 200으로 응답 — 클라우드(Render 등) 헬스체크/절전 깨우기용
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🕹️ 맞짱 오락실 릴레이 서버 작동 중 — 앱의 서버 주소에 wss://이주소 를 넣으세요');
});
const wss = new WebSocketServer({ server: httpServer });
httpServer.listen(PORT, () => console.log(`🕹️  맞짱 오락실 서버 실행 중 — 포트 ${PORT}`));

let nextId = 1;
const rooms = new Map(); // code → room

function makeCode() {
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (rooms.has(code));
  return code;
}

function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function bcast(room, obj, skipId) {
  for (const p of room.players.values()) if (p.id !== skipId) send(p.ws, obj);
}
function state(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name })),
  };
}
function joinRoom(room, ws, name) {
  ws.name = String(name || '플레이어').slice(0, 12);
  room.players.set(ws.playerId, { id: ws.playerId, name: ws.name, ws });
  ws.room = room;
  send(ws, { t: 'joined', you: ws.playerId, room: state(room) });
  bcast(room, { t: 'room', room: state(room) }, ws.playerId);
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.players.delete(ws.playerId);
  ws.room = null;
  if (room.players.size === 0) { rooms.delete(room.code); return; }
  if (room.hostId === ws.playerId) room.hostId = room.players.keys().next().value;
  bcast(room, { t: 'room', room: state(room) });
  bcast(room, { t: 'msg', from: ws.playerId, d: { a: 'left' } });
}

wss.on('connection', (ws) => {
  ws.playerId = nextId++;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { t: 'hello', you: ws.playerId });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const room = ws.room;
    switch (m.t) {
      case 'create': {
        if (room) leave(ws);
        const r = { code: makeCode(), players: new Map(), hostId: ws.playerId, taken: new Set(), paint: new Map() };
        rooms.set(r.code, r);
        joinRoom(r, ws, m.name);
        break;
      }
      case 'join': {
        const r = rooms.get(String(m.code || '').trim());
        if (!r) return send(ws, { t: 'err', m: '그 코드의 방이 없어요' });
        if (r.players.size >= MAX_PLAYERS) return send(ws, { t: 'err', m: `방이 꽉 찼어요 (최대 ${MAX_PLAYERS}명)` });
        if (room) leave(ws);
        joinRoom(r, ws, m.name);
        break;
      }
      case 'leave': leave(ws); break;
      case 'start': { // 방장만 게임 시작 가능 — 전원에게 동일한 seed를 나눠준다
        if (!room || room.hostId !== ws.playerId) return;
        room.taken.clear();
        room.paint.clear();
        bcast(room, {
          t: 'start',
          game: m.game,
          seed: (Math.random() * 2 ** 31) | 0,
          players: state(room).players,
          hostId: room.hostId,
        });
        break;
      }
      case 'end': if (room) bcast(room, { t: 'end' }); break;
      case 'msg': {
        if (!room || !m.d) return;
        const d = m.d;
        if (d.a === 'eat') { // 점 먹기: 동시 탭은 먼저 도착한 사람만 인정
          if (room.taken.has(d.id)) return;
          room.taken.add(d.id);
          bcast(room, { t: 'msg', from: ws.playerId, d: { a: 'eaten', id: d.id } });
          return;
        }
        if (d.a === 'paint') { // 페인트: 서버 도착 순서가 곧 칠한 순서 (전원 동일하게 수렴)
          for (const c of d.cells || []) room.paint.set(c, ws.playerId);
          bcast(room, { t: 'msg', from: ws.playerId, d: { a: 'painted', cells: d.cells || [] } });
          return;
        }
        bcast(room, { t: 'msg', from: ws.playerId, d }, ws.playerId);
        break;
      }
    }
  });

  ws.on('close', () => leave(ws));
});

// 유휴 연결 정리 (클라우드 배포 시 idle timeout 방지 겸용)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
