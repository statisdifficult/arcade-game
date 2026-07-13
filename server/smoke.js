// 서버 프로토콜 스모크 테스트 — 서버를 직접 띄우고 가짜 클라이언트 3개로 전 구간 검증
// 실행: cd server && npm test
const { spawn } = require('child_process');
const { WebSocket } = require('ws');

const PORT = 8791; // 실제 서버(8790)와 겹치지 않게
const url = `ws://localhost:${PORT}`;

function client(name) {
  const ws = new WebSocket(url);
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
  const waitFor = (pred, ms = 3000) =>
    new Promise((res, rej) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const m = inbox.find(pred);
        if (m) { clearInterval(iv); res(m); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error(`${name}: 응답 대기 시간 초과`)); }
      }, 20);
    });
  return new Promise((res, rej) => {
    ws.on('open', () => res({ ws, inbox, waitFor, send: (o) => ws.send(JSON.stringify(o)) }));
    ws.on('error', rej);
  });
}

let failed = 0;
function check(label, ok) {
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) failed++;
}

(async () => {
  const server = spawn('node', ['index.js'], { cwd: __dirname, env: { ...process.env, PORT } });
  await new Promise((res, rej) => {
    server.stdout.on('data', () => res());
    server.on('error', rej);
    setTimeout(() => rej(new Error('서버가 안 뜸')), 5000);
  });

  try {
    const a = await client('A');
    const b = await client('B');

    // 방 생성 / 코드 참가
    a.send({ t: 'create', name: '철수' });
    const joinedA = await a.waitFor((m) => m.t === 'joined');
    check('방 생성 → joined + 4자리 코드', /^\d{4}$/.test(joinedA.room.code));

    b.send({ t: 'join', code: joinedA.room.code, name: '영희' });
    const joinedB = await b.waitFor((m) => m.t === 'joined');
    check('코드로 참가', joinedB.room.players.length === 2);
    await a.waitFor((m) => m.t === 'room' && m.room.players.length === 2);
    check('기존 인원에게 room 갱신 브로드캐스트', true);

    // 없는 방 코드 거부
    const c = await client('C');
    c.send({ t: 'join', code: '0000', name: '민수' });
    await c.waitFor((m) => m.t === 'err');
    check('없는 코드 → err', true);

    // 게임 시작: 전원 동일 seed
    a.send({ t: 'start', game: 'dots' });
    const [sA, sB] = await Promise.all([
      a.waitFor((m) => m.t === 'start'),
      b.waitFor((m) => m.t === 'start'),
    ]);
    check('start 브로드캐스트 + 전원 동일 seed', sA.seed === sB.seed && sA.game === 'dots');

    // 방장 아닌 사람의 start는 무시
    b.send({ t: 'start', game: 'race' });

    // 릴레이: 상대에게만 전달 (보낸 사람 제외)
    a.send({ t: 'msg', d: { a: 'p', x: 0.5, y: 0.5 } });
    const relayed = await b.waitFor((m) => m.t === 'msg' && m.d.a === 'p');
    check('msg 릴레이 (from 포함)', relayed.from === joinedA.you);

    // 동시 획득 판정: 같은 점을 둘이 먹어도 승자는 1명, 전원에게 1번씩만
    a.send({ t: 'msg', d: { a: 'eat', id: 3 } });
    b.send({ t: 'msg', d: { a: 'eat', id: 3 } });
    const [eA, eB] = await Promise.all([
      a.waitFor((m) => m.t === 'msg' && m.d.a === 'eaten'),
      b.waitFor((m) => m.t === 'msg' && m.d.a === 'eaten'),
    ]);
    await new Promise((r) => setTimeout(r, 300));
    const nA = a.inbox.filter((m) => m.t === 'msg' && m.d.a === 'eaten').length;
    const nB = b.inbox.filter((m) => m.t === 'msg' && m.d.a === 'eaten').length;
    check('eat 선착순 판정 (승자 1명, 전원 동일)', nA === 1 && nB === 1 && eA.from === eB.from);

    // 페인트 판정 중계
    b.send({ t: 'msg', d: { a: 'paint', cells: [1, 2, 3] } });
    const painted = await a.waitFor((m) => m.t === 'msg' && m.d.a === 'painted');
    check('paint 확정 중계', painted.d.cells.length === 3 && painted.from === joinedB.you);

    // end 브로드캐스트
    b.send({ t: 'end' });
    await a.waitFor((m) => m.t === 'end');
    check('end 브로드캐스트', true);

    // 방장 이탈 → 호스트 승계
    a.ws.close();
    const after = await b.waitFor((m) => m.t === 'room' && m.room.players.length === 1);
    check('방장 이탈 시 호스트 승계', after.room.hostId === joinedB.you);

    console.log(failed === 0 ? '\n🎉 전부 통과!' : `\n💥 ${failed}개 실패`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (e) {
    console.error('💥 테스트 실패:', e.message);
    process.exitCode = 1;
  } finally {
    server.kill();
  }
})();
