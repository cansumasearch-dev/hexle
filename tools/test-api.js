// End-to-end API test: two players, a full 2-round game, chat, reactions, replies, kick.
// usage: node test-api.js http://127.0.0.1:8789 <path-to-hexle.sqlite>
const { execFileSync } = require('child_process');
const [base, dbPath] = process.argv.slice(2);
const crypto = require('crypto');
const mk = () => ({ pid: crypto.randomBytes(16).toString('hex'), token: crypto.randomBytes(24).toString('hex') });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function call(p, a, body = {}) {
  const r = await fetch(`${base}/api.php?a=${a}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pid': p.pid, 'X-Token': p.token }, body: JSON.stringify(body) });
  return { status: r.status, ...(await r.json()) };
}
const word = code => execFileSync('php', ['-d', 'extension_dir=C:/php/ext', '-d', 'extension=pdo_sqlite', '-r',
  `$p=new PDO('sqlite:'.$argv[1]);echo $p->query("SELECT word FROM rooms WHERE code='${code}'")->fetchColumn();`, dbPath]).toString().trim();

(async () => {
  const A = mk(), B = mk(), C = mk();
  ok((await call(A, 'hello')).me, 'hello registers');
  ok((await call({ ...A, token: B.token }, 'hello')).status === 403, 'wrong token rejected');
  await call(A, 'profile', { name: '<b>Evil</b>', color: '#ff2e5b', icon: 'devil' });
  ok((await call(A, 'hello')).me.name === 'Evil', 'name sanitised');
  await call(B, 'profile', { name: 'Vedal', icon: 'crow' });
  await call(C, 'profile', { name: 'Lurker' });
  const png = 'data:image/png;base64,' + Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201d4d6e8a90000000049454e44ae426082', 'hex').toString('base64');
  ok((await call(B, 'profile', { name: 'Vedal', icon: 'crow', avatar: png })).me.av === 1, 'avatar upload');
  ok((await call(B, 'profile', { name: 'Vedal', avatar: 'data:image/png;base64,' + Buffer.from('<script>').toString('base64') })).error, 'fake image rejected');

  const { code } = await call(A, 'create', { name: 'Test crypt', settings: { len: 5, rounds: 2, guesses: 6, timer: 0, maxPlayers: 2, source: 'mixed', custom: ['zzzzz', 'Bad!', 'spook'] } });
  ok(/^[A-Z0-9]{5}$/.test(code), 'room created ' + code);
  ok((await call(B, 'join', { code })).code === code, 'B joins');
  ok((await call(C, 'join', { code })).status === 409, 'room full enforced');
  let lob = await call(C, 'lobby');
  ok(lob.rooms.some(r => r.code === code), 'room listed publicly');

  let s = await call(B, 'poll', { code });
  ok(s.players.length === 2 && s.room.settings.custom === undefined && s.room.settings.customCount === 2, 'non-host sees custom count only');
  ok((await call(B, 'start', { code })).status === 403, 'non-host cannot start');
  ok((await call(A, 'start', { code })).ok, 'host starts');

  // chat
  await call(A, 'chat', { code, text: 'hello @Vedal :pumpkin:' });
  s = await call(B, 'poll', { code });
  const m1 = s.chat.filter(m => m.kind === 'user').pop();
  await call(B, 'chat', { code, text: 'hi', reply: m1.id });
  await call(B, 'react', { code, msg: m1.id, emoji: ':heart:' });
  await call(A, 'react', { code, msg: m1.id, emoji: '💀' });
  ok((await call(A, 'react', { code, msg: m1.id, emoji: '<img>' })).error, 'bad reaction rejected');
  s = await call(A, 'poll', { code });
  const last = s.chat.filter(m => m.kind === 'user');
  ok(last[1].reply?.id === m1.id, 'reply linked');
  ok(last[0].re[':heart:']?.length === 1 && last[0].re['💀']?.length === 1, 'reactions stored');
  await call(B, 'react', { code, msg: m1.id, emoji: ':heart:' });
  s = await call(A, 'poll', { code });
  ok(!s.chat.find(m => m.id === m1.id).re[':heart:'], 'reaction toggles off');
  ok((await call(B, 'delmsg', { code, msg: m1.id })).status === 403, 'cannot delete others msg');

  // round 1: A solves in 2, B in 1 → B wins
  let w = word(code);
  ok(w.length === 5, 'round word ' + w);
  ok((await call(A, 'guess', { code, word: 'qqqqq' })).error === 'Not in word list', 'invalid word rejected');
  ok((await call(A, 'guess', { code, word: 'spook' })).marks?.length === 5 || w === 'spook', 'custom word accepted as guess');
  const etag = (await call(A, 'poll', { code })).etag;
  ok((await call(A, 'poll', { code, etag })).same, 'etag short-circuit');
  s = await call(B, 'poll', { code });
  ok(s.board.others[A.pid][0].indexOf(':') === -1, 'other players letters hidden mid-round');
  await call(B, 'guess', { code, word: w });
  if (w !== 'spook') await call(A, 'guess', { code, word: w });
  s = await call(A, 'poll', { code });
  ok(s.room.state === 'intermission', 'round ends when all done');
  ok(s.history[0].winners[0] === B.pid && s.room.scores[B.pid] === 1, 'fewest guesses wins the point');
  ok((await call(A, 'skip', { code })).ok, 'host skips break');
  w = word(code);
  s = await call(A, 'poll', { code });
  ok(s.room.state === 'playing' && s.room.round === 2, 'round 2 started');
  await call(A, 'guess', { code, word: w });
  await call(B, 'guess', { code, word: w });   // same count: tiebreak by time → A
  s = await call(A, 'poll', { code });
  ok(s.room.state === 'podium', 'podium after last round');
  ok(s.history[1].winners.length === 1 && s.history[1].winners[0] === A.pid, 'speed tiebreak');

  // settings / restart / kick
  ok((await call(A, 'settings', { code, settings: { len: 'any', rounds: 1, source: 'custom', custom: ['ab', 'witchy', 'eek'], timer: 5 } })).settings.timer === 10, 'timer clamped to >=10s');
  ok((await call(A, 'start', { code })).ok, 'rematch from podium');
  w = word(code);
  ok(['witchy', 'eek'].includes(w), 'custom-only, mixed length word: ' + w);
  ok((await call(A, 'tolobby', { code })).ok, 'back to room lobby');
  ok((await call(A, 'kick', { code, pid: B.pid })).ok, 'kick');
  ok((await call(B, 'join', { code })).status === 403, 'kicked player cannot rejoin');
  await call(A, 'leave', { code });
  ok((await fetch(`${base}/api.php?a=avatar&id=${B.pid}&v=1`)).headers.get('content-type') === 'image/png', 'avatar served as png');
  await call(A, 'chat', { code: '*', text: 'global hello' });
  lob = await call(C, 'lobby');
  ok(lob.chat.some(m => m.text === 'global hello'), 'global chat');
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
