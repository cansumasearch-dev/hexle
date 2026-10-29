<?php
// HEXLE multiplayer API. PHP 8.1+, pdo_sqlite. All state lives in one SQLite file
// outside the web root (../private/hexle.sqlite). Clients poll; nothing long-running.
declare(strict_types=1);

header('X-Content-Type-Options: nosniff');

// Pages that may call this API from another origin (the GitHub Pages copy of the game).
const ALLOWED_ORIGINS = ['https://cansumasearch-dev.github.io'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, ALLOWED_ORIGINS, true) || preg_match('#^http://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, X-Pid, X-Token');
  header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

const ONLINE_MS   = 20000;   // seen within → online
const DROP_MS     = 120000;  // unseen this long → removed from room
const HOST_FAIL_MS = 15000;  // host unseen this long → host passes on
const GLOBAL_ROOM = '*';
const ICON_SET = ['pumpkin','ghost','bat','skull','cat','hat','spider','cauldron','candle','moon','coffin','eye','devil','heart','web','candy','bow','grave','crow','potion'];

function now_ms(): int { return (int)floor(microtime(true) * 1000); }

function out(array $data, int $code = 200): never {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }

function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dir = dirname(__DIR__) . '/private';
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  if (!is_dir($dir) || !is_writable($dir)) {
    $dir = __DIR__ . '/data';   // fallback, protected by data/.htaccess
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
  }
  $pdo = new PDO('sqlite:' . $dir . '/hexle.sqlite', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA busy_timeout=5000');
  $pdo->exec('PRAGMA journal_mode=WAL');
  $pdo->exec('PRAGMA synchronous=NORMAL');
  $pdo->exec(<<<SQL
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY, token TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Ghost',
      color TEXT NOT NULL DEFAULT '#ff2e5b', icon TEXT NOT NULL DEFAULT 'pumpkin',
      avatar BLOB, avatar_type TEXT, avatar_ver INTEGER NOT NULL DEFAULT 0,
      seen INTEGER NOT NULL DEFAULT 0, typing INTEGER NOT NULL DEFAULT 0, typing_in TEXT,
      created INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY, name TEXT NOT NULL, host TEXT, settings TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'lobby', game INTEGER NOT NULL DEFAULT 0, round INTEGER NOT NULL DEFAULT 0,
      word TEXT, len INTEGER, started INTEGER, ends INTEGER, inter_ends INTEGER,
      participants TEXT NOT NULL DEFAULT '[]', scores TEXT NOT NULL DEFAULT '{}',
      history TEXT NOT NULL DEFAULT '[]', used TEXT NOT NULL DEFAULT '[]', kicked TEXT NOT NULL DEFAULT '[]',
      created INTEGER NOT NULL, touched INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members (
      code TEXT NOT NULL, pid TEXT NOT NULL, joined INTEGER NOT NULL, PRIMARY KEY (code, pid));
    CREATE TABLE IF NOT EXISTS guesses (
      code TEXT NOT NULL, game INTEGER NOT NULL, round INTEGER NOT NULL, pid TEXT NOT NULL,
      idx INTEGER NOT NULL, word TEXT NOT NULL, marks TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (code, game, round, pid, idx));
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, pid TEXT, kind TEXT NOT NULL DEFAULT 'user',
      text TEXT NOT NULL, reply INTEGER, at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS messages_code ON messages (code, id);
    CREATE TABLE IF NOT EXISTS reactions (
      msg INTEGER NOT NULL, pid TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (msg, pid, emoji));
    SQL);
  return $pdo;
}

function q(string $sql, array $args = []): PDOStatement { $st = db()->prepare($sql); $st->execute($args); return $st; }
function row(string $sql, array $args = []): ?array { $r = q($sql, $args)->fetch(); return $r ?: null; }

function body(): array {
  static $b = null;
  if ($b === null) { $b = json_decode(file_get_contents('php://input') ?: '[]', true); if (!is_array($b)) $b = []; }
  return $b;
}

// ---------- words ----------

function word_file(string $kind, int $len): array {
  static $cache = [];
  $k = "$kind-$len";
  if (!isset($cache[$k])) {
    $f = __DIR__ . "/words/$kind-$len.txt";
    $cache[$k] = is_file($f) ? array_values(array_filter(explode("\n", str_replace("\r", '', file_get_contents($f))))) : [];
  }
  return $cache[$k];
}
function is_valid_word(string $w): bool {
  static $sets = [];
  $n = strlen($w);
  if ($n < 4 || $n > 8) return false;
  if (!isset($sets[$n])) $sets[$n] = array_flip(word_file('valid', $n));
  return isset($sets[$n][$w]);
}

function marks(string $guess, string $answer): string {
  $n = strlen($answer); $m = array_fill(0, $n, 'a'); $left = [];
  for ($i = 0; $i < $n; $i++) {
    if ($guess[$i] === $answer[$i]) $m[$i] = 'c'; else $left[$answer[$i]] = ($left[$answer[$i]] ?? 0) + 1;
  }
  for ($i = 0; $i < $n; $i++) {
    if ($m[$i] === 'c') continue;
    $ch = $guess[$i];
    if (($left[$ch] ?? 0) > 0) { $m[$i] = 'p'; $left[$ch]--; }
  }
  return implode('', $m);
}

// Returns an error string when $guess breaks hard-mode rules given earlier rows.
function hard_violation(string $guess, array $rows): ?string {
  $ord = fn(int $i) => $i . ([1 => 'st', 2 => 'nd', 3 => 'rd'][$i] ?? 'th');
  foreach ($rows as $r) {
    $need = [];
    for ($i = 0; $i < strlen($r['word']); $i++) {
      $ch = $r['word'][$i];
      if ($r['marks'][$i] === 'c' && $guess[$i] !== $ch) return $ord($i + 1) . ' letter must be ' . strtoupper($ch);
      if ($r['marks'][$i] !== 'a') $need[$ch] = ($need[$ch] ?? 0) + 1;
    }
    foreach ($need as $ch => $cnt) {
      if (substr_count($guess, (string)$ch) < $cnt) return 'Guess must contain ' . strtoupper((string)$ch);
    }
  }
  return null;
}

function clean_words($list): array {
  if (is_string($list)) $list = preg_split('/[\s,;]+/', $list);
  if (!is_array($list)) return [];
  $out = [];
  foreach ($list as $w) {
    $w = strtolower(trim((string)$w));
    if (preg_match('/^[a-z]{3,10}$/', $w)) $out[$w] = true;
    if (count($out) >= 5000) break;
  }
  return array_keys($out);
}

function clean_settings(array $s): array {
  $int = fn($v, $lo, $hi, $d) => is_numeric($v) ? max($lo, min($hi, (int)$v)) : $d;
  $source = in_array($s['source'] ?? '', ['builtin', 'mixed', 'custom'], true) ? $s['source'] : 'builtin';
  $len = ($s['len'] ?? 5) === 'any' ? 'any' : $int($s['len'] ?? 5, 3, 10, 5);
  if ($len !== 'any' && $source === 'builtin') $len = max(4, min(8, $len));
  return [
    'len'          => $len,
    'maxPlayers'   => $int($s['maxPlayers'] ?? 8, 1, 16, 8),
    'rounds'       => $int($s['rounds'] ?? 5, 1, 30, 5),
    'guesses'      => $int($s['guesses'] ?? 6, 2, 12, 6),
    'timer'        => ($t = $int($s['timer'] ?? 0, 0, 3600, 0)) > 0 ? max(10, $t) : 0,
    'intermission' => $int($s['intermission'] ?? 8, 3, 60, 8),
    'hard'         => !empty($s['hard']),
    'scoring'      => ($s['scoring'] ?? '') === 'ranked' ? 'ranked' : 'winner',
    'tiebreak'     => !array_key_exists('tiebreak', $s) || !empty($s['tiebreak']),
    'source'       => $source,
    'custom'       => $source === 'builtin' ? [] : clean_words($s['custom'] ?? []),
    'anyGuess'     => !empty($s['anyGuess']),
    'public'       => !array_key_exists('public', $s) || !empty($s['public']),
  ];
}

function pick_word(array $s, array $used): ?string {
  $pool = [];
  $lens = $s['len'] === 'any' ? range(3, 10) : [$s['len']];
  if ($s['source'] !== 'custom') foreach ($lens as $n) if ($n >= 4 && $n <= 8) $pool = array_merge($pool, word_file('answers', $n));
  if ($s['source'] !== 'builtin') foreach ($s['custom'] as $w) if (in_array(strlen($w), $lens, true)) $pool[] = $w;
  $pool = array_values(array_unique($pool));
  if (!$pool) return null;
  $fresh = array_values(array_diff($pool, $used));
  $from = $fresh ?: $pool;
  return $from[random_int(0, count($from) - 1)];
}

// ---------- players ----------

function auth(): array {
  $pid = $_SERVER['HTTP_X_PID'] ?? ''; $tok = $_SERVER['HTTP_X_TOKEN'] ?? '';
  if (!preg_match('/^[a-f0-9]{32}$/', $pid) || strlen($tok) < 32) fail('bad identity', 401);
  $p = row('SELECT id, token, name, color, icon, avatar_ver, seen FROM players WHERE id = ?', [$pid]);
  $h = hash('sha256', $tok);
  if (!$p) {
    q('INSERT INTO players (id, token, seen, created) VALUES (?, ?, ?, ?)', [$pid, $h, now_ms(), now_ms()]);
    $p = row('SELECT id, token, name, color, icon, avatar_ver, seen FROM players WHERE id = ?', [$pid]);
  } elseif (!hash_equals($p['token'], $h)) fail('identity taken', 403);
  q('UPDATE players SET seen = ? WHERE id = ?', [now_ms(), $pid]);
  return $p;
}

function clean_name(string $n): string {
  $n = trim(preg_replace('/\s+/u', ' ', strip_tags($n)) ?? '');
  $n = mb_substr($n, 0, 20);
  return $n === '' ? 'Ghost' : $n;
}

function sys_msg(string $code, string $text): void {
  q('INSERT INTO messages (code, kind, text, at) VALUES (?, ?, ?, ?)', [$code, 'system', $text, now_ms()]);
}

// ---------- rooms ----------

function room(string $code): ?array {
  $r = row('SELECT * FROM rooms WHERE code = ?', [$code]);
  if (!$r) return null;
  foreach (['settings', 'participants', 'scores', 'history', 'used', 'kicked'] as $k) $r[$k] = json_decode($r[$k], true) ?: [];
  return $r;
}
function save_room(array $r): void {
  $r['touched'] = now_ms();
  $cols = ['name', 'host', 'settings', 'state', 'game', 'round', 'word', 'len', 'started', 'ends', 'inter_ends', 'participants', 'scores', 'history', 'used', 'kicked', 'touched'];
  $vals = [];
  foreach ($cols as $c) $vals[] = is_array($r[$c]) ? json_encode($r[$c], JSON_UNESCAPED_UNICODE) : $r[$c];
  $vals[] = $r['code'];
  q('UPDATE rooms SET ' . implode(', ', array_map(fn($c) => "$c = ?", $cols)) . ' WHERE code = ?', $vals);
}

function members(string $code): array {
  return q('SELECT m.pid, m.joined, p.name, p.color, p.icon, p.avatar_ver, p.seen, p.typing, p.typing_in
            FROM members m JOIN players p ON p.id = m.pid WHERE m.code = ? ORDER BY m.joined', [$code])->fetchAll();
}

function remove_member(array &$r, string $pid, string $why = 'left'): void {
  $p = row('SELECT name FROM players WHERE id = ?', [$pid]);
  q('DELETE FROM members WHERE code = ? AND pid = ?', [$r['code'], $pid]);
  sys_msg($r['code'], ($p['name'] ?? 'Someone') . ($why === 'kicked' ? ' was kicked' : ($why === 'dropped' ? ' disconnected' : ' left')));
  if ($r['host'] === $pid) {
    $next = row('SELECT m.pid, p.name FROM members m JOIN players p ON p.id = m.pid WHERE m.code = ? ORDER BY p.seen > ? DESC, m.joined LIMIT 1', [$r['code'], now_ms() - ONLINE_MS]);
    $r['host'] = $next['pid'] ?? null;
    if ($next) sys_msg($r['code'], $next['name'] . ' is now the host');
  }
}

function player_done(array $r, string $pid): array {
  $rows = q('SELECT marks, at FROM guesses WHERE code = ? AND game = ? AND round = ? AND pid = ? ORDER BY idx', [$r['code'], $r['game'], $r['round'], $pid])->fetchAll();
  $solved = false; $at = null;
  foreach ($rows as $g) if (!str_contains($g['marks'], 'a') && !str_contains($g['marks'], 'p')) { $solved = true; $at = (int)$g['at']; }
  return ['n' => count($rows), 'solved' => $solved, 'done' => $solved || count($rows) >= $r['settings']['guesses'], 'ms' => $at ? $at - (int)$r['started'] : null];
}

function start_round(array &$r): ?string {
  $w = pick_word($r['settings'], $r['used']);
  if (!$w) return 'No words match these settings — check the word length or your custom list';
  $r['round']++;
  $r['word'] = $w; $r['len'] = strlen($w); $r['used'][] = $w;
  $r['started'] = now_ms();
  $r['ends'] = $r['settings']['timer'] ? $r['started'] + $r['settings']['timer'] * 1000 : null;
  $r['inter_ends'] = null;
  $r['state'] = 'playing';
  $on = now_ms() - ONLINE_MS;
  $r['participants'] = array_values(array_map(fn($m) => $m['pid'], array_filter(members($r['code']), fn($m) => $m['seen'] > $on)));
  return null;
}

function finish_round(array &$r): void {
  $res = [];
  foreach ($r['participants'] as $pid) $res[$pid] = player_done($r, $pid);
  $solvers = array_filter($res, fn($x) => $x['solved']);
  uasort($solvers, fn($a, $b) => [$a['n'], $r['settings']['tiebreak'] ? $a['ms'] : 0] <=> [$b['n'], $r['settings']['tiebreak'] ? $b['ms'] : 0]);
  $winners = []; $points = [];
  if ($solvers) {
    $key = fn($x) => [$x['n'], $r['settings']['tiebreak'] ? $x['ms'] : 0];
    $best = $key(reset($solvers));
    foreach ($solvers as $pid => $x) if ($key($x) === $best) $winners[] = $pid;
    if ($r['settings']['scoring'] === 'ranked') {
      $place = 0; $prev = null; $i = 0;
      foreach ($solvers as $pid => $x) { $i++; if ($key($x) !== $prev) { $place = $i; $prev = $key($x); } $points[$pid] = max(0, 4 - $place); }
    } else foreach ($winners as $pid) $points[$pid] = 1;
  }
  foreach ($points as $pid => $pt) $r['scores'][$pid] = ($r['scores'][$pid] ?? 0) + $pt;
  foreach ($res as $pid => $x) $r['scores'][$pid] = $r['scores'][$pid] ?? 0;
  $r['history'][] = ['round' => $r['round'], 'word' => $r['word'], 'results' => $res, 'winners' => $winners, 'points' => $points];

  $names = [];
  foreach ($winners as $pid) $names[] = row('SELECT name FROM players WHERE id = ?', [$pid])['name'] ?? '?';
  $w = strtoupper($r['word']);
  sys_msg($r['code'], $winners
    ? "Round {$r['round']}: " . implode(' & ', $names) . ' won in ' . $res[$winners[0]]['n'] . " — the word was $w"
    : "Round {$r['round']}: nobody solved it — the word was $w");

  $r['state'] = $r['round'] >= $r['settings']['rounds'] ? 'podium' : 'intermission';
  $r['inter_ends'] = $r['state'] === 'intermission' ? now_ms() + $r['settings']['intermission'] * 1000 : null;
  $r['ends'] = null;
}

// Lazy state machine: called on every room request.
function tick(array &$r): void {
  $now = now_ms(); $changed = false;
  foreach (members($r['code']) as $m) {
    if ($m['seen'] < $now - DROP_MS) { remove_member($r, $m['pid'], 'dropped'); $changed = true; }
  }
  if ($r['host']) {
    $h = row('SELECT p.seen FROM members m JOIN players p ON p.id = m.pid WHERE m.code = ? AND m.pid = ?', [$r['code'], $r['host']]);
    if (!$h || $h['seen'] < $now - HOST_FAIL_MS) {
      $next = row('SELECT m.pid, p.name FROM members m JOIN players p ON p.id = m.pid WHERE m.code = ? AND p.seen > ? ORDER BY m.joined LIMIT 1', [$r['code'], $now - ONLINE_MS]);
      if ($next && $next['pid'] !== $r['host']) { $r['host'] = $next['pid']; sys_msg($r['code'], $next['name'] . ' is now the host'); $changed = true; }
    }
  }
  if ($r['state'] === 'playing') {
    $live = array_column(members($r['code']), 'seen', 'pid');
    $allDone = true;
    foreach ($r['participants'] as $pid) {
      if (!isset($live[$pid]) || $live[$pid] < $now - ONLINE_MS) continue;
      if (!player_done($r, $pid)['done']) { $allDone = false; break; }
    }
    if ($allDone || ($r['ends'] && $now >= $r['ends'])) { finish_round($r); $changed = true; }
  } elseif ($r['state'] === 'intermission' && $now >= $r['inter_ends']) {
    if ($err = start_round($r)) { $r['state'] = 'podium'; sys_msg($r['code'], $err); }
    $changed = true;
  }
  if ($changed) save_room($r);
}

function require_room(array $me, bool $host = false): array {
  $code = strtoupper((string)(body()['code'] ?? $_GET['code'] ?? ''));
  $r = $code ? room($code) : null;
  if (!$r) fail('Room not found', 404);
  if (!row('SELECT 1 FROM members WHERE code = ? AND pid = ?', [$code, $me['id']])) fail('You are not in this room', 403);
  if ($host && $r['host'] !== $me['id']) fail('Only the host can do that', 403);
  return $r;
}

function chat_rows(string $code, int $limit = 120): array {
  $rows = array_reverse(q('SELECT id, pid, kind, text, reply, at, deleted FROM messages WHERE code = ? ORDER BY id DESC LIMIT ' . $limit, [$code])->fetchAll());
  if (!$rows) return [];
  $ids = array_column($rows, 'id');
  $re = [];
  foreach (q('SELECT msg, pid, emoji FROM reactions WHERE msg IN (' . implode(',', array_map('intval', $ids)) . ') ORDER BY rowid')->fetchAll() as $x) $re[$x['msg']][$x['emoji']][] = $x['pid'];
  $byId = array_column($rows, null, 'id');
  return array_map(function ($m) use ($re, $byId) {
    $o = ['id' => (int)$m['id'], 'pid' => $m['pid'], 'kind' => $m['kind'], 'text' => $m['deleted'] ? '' : $m['text'], 'at' => (int)$m['at'], 'del' => (bool)$m['deleted'], 're' => $re[$m['id']] ?? (object)[]];
    if ($m['reply']) {
      $p = $byId[$m['reply']] ?? row('SELECT id, pid, text, deleted FROM messages WHERE id = ?', [$m['reply']]);
      if ($p) $o['reply'] = ['id' => (int)$p['id'], 'pid' => $p['pid'], 'text' => $p['deleted'] ? '' : mb_substr($p['text'], 0, 120)];
    }
    return $o;
  }, $rows);
}

function people(array $rows, int $now, string $code): array {
  return array_map(fn($m) => [
    'id' => $m['pid'], 'name' => $m['name'], 'color' => $m['color'], 'icon' => $m['icon'], 'av' => (int)$m['avatar_ver'],
    'online' => $m['seen'] > $now - ONLINE_MS, 'typing' => $m['typing'] > $now && $m['typing_in'] === $code,
  ], $rows);
}

function snapshot(array $r, array $me): array {
  $now = now_ms();
  $mem = members($r['code']);
  $s = $r['settings'];
  $isHost = $r['host'] === $me['id'];
  $pub = $s; unset($pub['custom']);
  $pub['customCount'] = count($s['custom']);
  if ($isHost) $pub['custom'] = $s['custom'];
  $snap = [
    'room' => [
      'code' => $r['code'], 'name' => $r['name'], 'host' => $r['host'], 'state' => $r['state'], 'game' => (int)$r['game'],
      'round' => (int)$r['round'], 'len' => (int)$r['len'], 'started' => $r['started'] ? (int)$r['started'] : null,
      'ends' => $r['ends'] ? (int)$r['ends'] : null, 'interEnds' => $r['inter_ends'] ? (int)$r['inter_ends'] : null,
      'settings' => $pub, 'scores' => (object)$r['scores'], 'participants' => $r['participants'],
    ],
    'players' => people($mem, $now, $r['code']),
    'chat' => chat_rows($r['code']),
  ];
  // Former players still matter for scoreboards / chat names.
  $known = array_column($mem, 'pid');
  $extra = array_diff(array_unique(array_merge(array_keys($r['scores']), array_filter(array_column($snap['chat'], 'pid')))), $known);
  if ($extra) {
    $snap['ghosts'] = q('SELECT id, name, color, icon, avatar_ver AS av FROM players WHERE id IN (' . implode(',', array_fill(0, count($extra), '?')) . ')', array_values($extra))->fetchAll();
  }
  if ($r['state'] !== 'lobby' && $r['round'] > 0) {
    $board = ['mine' => [], 'others' => [], 'status' => []];
    foreach (q('SELECT pid, word, marks FROM guesses WHERE code = ? AND game = ? AND round = ? ORDER BY idx', [$r['code'], $r['game'], $r['round']])->fetchAll() as $g) {
      if ($g['pid'] === $me['id']) $board['mine'][] = ['w' => $g['word'], 'm' => $g['marks']];
      $board['others'][$g['pid']][] = $r['state'] === 'playing' ? $g['marks'] : $g['marks'] . ':' . $g['word'];
    }
    foreach ($r['participants'] as $pid) $board['status'][$pid] = player_done($r, $pid);
    $snap['board'] = $board;
    $snap['history'] = $r['history'];
  }
  return $snap;
}

function room_public(array $r, int $count): array {
  $host = $r['host'] ? row('SELECT name, color, icon, avatar_ver FROM players WHERE id = ?', [$r['host']]) : null;
  $s = $r['settings'];
  return ['code' => $r['code'], 'name' => $r['name'], 'state' => $r['state'], 'players' => $count, 'max' => $s['maxPlayers'],
    'len' => $s['len'], 'rounds' => $s['rounds'], 'round' => (int)$r['round'], 'timer' => $s['timer'], 'hard' => $s['hard'],
    'source' => $s['source'], 'host' => $host ? ['id' => $r['host'], 'name' => $host['name'], 'color' => $host['color'], 'icon' => $host['icon'], 'av' => (int)$host['avatar_ver']] : null];
}

function cleanup(): void {
  if (random_int(1, 25) !== 1) return;
  $old = now_ms() - 30 * 60 * 1000;
  $dead = q('SELECT code FROM rooms WHERE touched < ? AND code NOT IN (SELECT code FROM members) AND code != ?', [$old, GLOBAL_ROOM])->fetchAll(PDO::FETCH_COLUMN);
  foreach ($dead as $c) {
    q('DELETE FROM reactions WHERE msg IN (SELECT id FROM messages WHERE code = ?)', [$c]);
    foreach (['messages', 'guesses', 'rooms'] as $t) q("DELETE FROM $t WHERE code = ?", [$c]);
  }
  // keep the global chat bounded
  $cut = row('SELECT id FROM messages WHERE code = ? ORDER BY id DESC LIMIT 1 OFFSET 400', [GLOBAL_ROOM]);
  if ($cut) q('DELETE FROM messages WHERE code = ? AND id <= ?', [GLOBAL_ROOM, $cut['id']]);
}

function in_chat(array $me, string $code): void {
  if ($code === GLOBAL_ROOM) return;
  if (!row('SELECT 1 FROM members WHERE code = ? AND pid = ?', [$code, $me['id']])) fail('You are not in this room', 403);
}
function chat_code(): string {
  $c = (string)(body()['code'] ?? '');
  return $c === GLOBAL_ROOM ? GLOBAL_ROOM : strtoupper($c);
}

// ---------- routes ----------

$a = $_GET['a'] ?? '';

// Public, unauthenticated: avatar images.
if ($a === 'avatar') {
  $p = row('SELECT avatar, avatar_type FROM players WHERE id = ?', [(string)($_GET['id'] ?? '')]);
  if (!$p || !$p['avatar']) { http_response_code(404); exit; }
  header('Content-Type: ' . $p['avatar_type']);
  header('Cache-Control: public, max-age=31536000, immutable');
  header("Content-Security-Policy: default-src 'none'");
  echo $p['avatar'];
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST only', 405);
$me = auth();
cleanup();

if ($a === 'hello') {
  $p = row('SELECT name, color, icon, avatar_ver FROM players WHERE id = ?', [$me['id']]);
  $room = row('SELECT m.code FROM members m JOIN rooms r ON r.code = m.code WHERE m.pid = ? ORDER BY m.joined DESC LIMIT 1', [$me['id']]);
  out(['now' => now_ms(), 'me' => ['id' => $me['id'], 'name' => $p['name'], 'color' => $p['color'], 'icon' => $p['icon'], 'av' => (int)$p['avatar_ver']], 'room' => $room['code'] ?? null, 'icons' => ICON_SET]);
}

if ($a === 'profile') {
  $b = body();
  $name = clean_name((string)($b['name'] ?? 'Ghost'));
  $color = preg_match('/^#[0-9a-fA-F]{6}$/', (string)($b['color'] ?? '')) ? strtolower($b['color']) : '#ff2e5b';
  $icon = in_array($b['icon'] ?? '', ICON_SET, true) ? $b['icon'] : 'pumpkin';
  q('UPDATE players SET name = ?, color = ?, icon = ? WHERE id = ?', [$name, $color, $icon, $me['id']]);
  if (array_key_exists('avatar', $b)) {
    if ($b['avatar'] === null) {
      q('UPDATE players SET avatar = NULL, avatar_type = NULL, avatar_ver = 0 WHERE id = ?', [$me['id']]);
    } else {
      if (!preg_match('#^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$#', (string)$b['avatar'], $mm)) fail('Unsupported image');
      $bin = base64_decode($mm[2], true);
      if ($bin === false || strlen($bin) > 300000) fail('Image too large (max 300 KB after resizing)');
      $magic = [
        'image/png'  => "\x89PNG", 'image/jpeg' => "\xFF\xD8\xFF", 'image/gif' => 'GIF8',
      ];
      $type = null;
      foreach ($magic as $t => $sig) if (str_starts_with($bin, $sig)) $type = $t;
      if (!$type && substr($bin, 0, 4) === 'RIFF' && substr($bin, 8, 4) === 'WEBP') $type = 'image/webp';
      if (!$type) fail('That file is not an image');
      $ver = max(1, (int)$me['avatar_ver'] + 1);
      $st = db()->prepare('UPDATE players SET avatar = ?, avatar_type = ?, avatar_ver = ? WHERE id = ?');
      $st->bindValue(1, $bin, PDO::PARAM_LOB); $st->bindValue(2, $type); $st->bindValue(3, $ver); $st->bindValue(4, $me['id']);
      $st->execute();
    }
  }
  $p = row('SELECT name, color, icon, avatar_ver FROM players WHERE id = ?', [$me['id']]);
  out(['me' => ['id' => $me['id'], 'name' => $p['name'], 'color' => $p['color'], 'icon' => $p['icon'], 'av' => (int)$p['avatar_ver']]]);
}

if ($a === 'lobby') {   // dashboard: public rooms + global chat
  $now = now_ms();
  $rooms = [];
  foreach (q('SELECT r.code, COUNT(m.pid) AS n FROM rooms r JOIN members m ON m.code = r.code JOIN players p ON p.id = m.pid AND p.seen > ? WHERE r.code != ? GROUP BY r.code ORDER BY r.created DESC LIMIT 60', [$now - ONLINE_MS, GLOBAL_ROOM])->fetchAll() as $x) {
    $r = room($x['code']);
    if ($r && $r['settings']['public']) $rooms[] = room_public($r, (int)$x['n']);
  }
  $online = q('SELECT id AS pid, name, color, icon, avatar_ver, seen, typing, typing_in, 0 AS joined FROM players WHERE seen > ? ORDER BY seen DESC LIMIT 50', [$now - ONLINE_MS])->fetchAll();
  $chat = chat_rows(GLOBAL_ROOM, 80);
  $ids = array_diff(array_unique(array_filter(array_column($chat, 'pid'))), array_column($online, 'pid'));
  $ghosts = $ids ? q('SELECT id, name, color, icon, avatar_ver AS av FROM players WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')', array_values($ids))->fetchAll() : [];
  $data = ['rooms' => $rooms, 'online' => people($online, $now, GLOBAL_ROOM), 'chat' => $chat, 'ghosts' => $ghosts];
  $etag = md5(json_encode($data));
  if ((body()['etag'] ?? '') === $etag) out(['same' => true, 'now' => $now]);
  out($data + ['etag' => $etag, 'now' => $now]);
}

if ($a === 'create') {
  $b = body();
  $s = clean_settings((array)($b['settings'] ?? []));
  $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  do { $code = ''; for ($i = 0; $i < 5; $i++) $code .= $chars[random_int(0, strlen($chars) - 1)]; } while (row('SELECT 1 FROM rooms WHERE code = ?', [$code]));
  $name = mb_substr(trim(strip_tags((string)($b['name'] ?? ''))), 0, 32) ?: (row('SELECT name FROM players WHERE id = ?', [$me['id']])['name'] . "'s crypt");
  foreach (q('SELECT code FROM members WHERE pid = ?', [$me['id']])->fetchAll(PDO::FETCH_COLUMN) as $c) { $old = room($c); if ($old) { remove_member($old, $me['id']); save_room($old); } }
  q('INSERT INTO rooms (code, name, host, settings, created, touched) VALUES (?, ?, ?, ?, ?, ?)', [$code, $name, $me['id'], json_encode($s), now_ms(), now_ms()]);
  q('INSERT INTO members (code, pid, joined) VALUES (?, ?, ?)', [$code, $me['id'], now_ms()]);
  sys_msg($code, 'Room summoned. Share the invite link to bring friends.');
  out(['code' => $code]);
}

if ($a === 'join') {
  $code = strtoupper((string)(body()['code'] ?? ''));
  $r = room($code);
  if (!$r || $code === GLOBAL_ROOM) fail('That room does not exist (anymore)', 404);
  if (in_array($me['id'], $r['kicked'], true)) fail('You were kicked from this room', 403);
  if (!row('SELECT 1 FROM members WHERE code = ? AND pid = ?', [$code, $me['id']])) {
    tick($r);
    $n = (int)row('SELECT COUNT(*) AS n FROM members WHERE code = ?', [$code])['n'];
    if ($n >= $r['settings']['maxPlayers']) fail('Room is full', 409);
    foreach (q('SELECT code FROM members WHERE pid = ?', [$me['id']])->fetchAll(PDO::FETCH_COLUMN) as $c) { $old = room($c); if ($old) { remove_member($old, $me['id']); save_room($old); } }
    q('INSERT INTO members (code, pid, joined) VALUES (?, ?, ?)', [$code, $me['id'], now_ms()]);
    if (!$r['host']) { $r['host'] = $me['id']; save_room($r); }
    sys_msg($code, row('SELECT name FROM players WHERE id = ?', [$me['id']])['name'] . ' joined');
  }
  out(['code' => $code]);
}

if ($a === 'leave') {
  $r = require_room($me);
  remove_member($r, $me['id']);
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'poll') {
  $r = require_room($me);
  tick($r);
  $r = room($r['code']);
  $snap = snapshot($r, $me);
  $etag = md5(json_encode($snap));
  if ((body()['etag'] ?? '') === $etag) out(['same' => true, 'now' => now_ms()]);
  out($snap + ['etag' => $etag, 'now' => now_ms()]);
}

if ($a === 'settings') {
  $r = require_room($me, true);
  if (!in_array($r['state'], ['lobby', 'podium'], true)) fail('Settings are locked while a game is running');
  $r['settings'] = clean_settings((array)(body()['settings'] ?? []));
  if (isset(body()['name'])) $r['name'] = mb_substr(trim(strip_tags((string)body()['name'])), 0, 32) ?: $r['name'];
  save_room($r);
  out(['ok' => true, 'settings' => $r['settings']]);
}

if ($a === 'start') {
  $r = require_room($me, true);
  if (!in_array($r['state'], ['lobby', 'podium'], true)) fail('A game is already running');
  $r['game']++; $r['round'] = 0; $r['scores'] = []; $r['history'] = []; $r['used'] = [];
  if ($err = start_round($r)) fail($err);
  sys_msg($r['code'], 'Game on! ' . $r['settings']['rounds'] . ' round' . ($r['settings']['rounds'] > 1 ? 's' : '') . ' — fewest guesses takes the point.');
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'skip') {   // host: end the round now / skip the break
  $r = require_room($me, true);
  if ($r['state'] === 'playing') finish_round($r);
  elseif ($r['state'] === 'intermission') { if ($err = start_round($r)) fail($err); }
  else fail('Nothing to skip');
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'tolobby') {   // host: podium → room lobby (settings screen)
  $r = require_room($me, true);
  if ($r['state'] === 'playing' || $r['state'] === 'intermission') { $r['history'] = []; $r['scores'] = []; }
  $r['state'] = 'lobby'; $r['ends'] = null; $r['inter_ends'] = null;
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'guess') {
  $r = require_room($me);
  tick($r);
  if ($r['state'] !== 'playing') fail('The round is over');
  if (!in_array($me['id'], $r['participants'], true)) fail('You joined mid-round — you play from the next one');
  $w = strtolower(trim((string)(body()['word'] ?? '')));
  if (strlen($w) !== (int)$r['len'] || !preg_match('/^[a-z]+$/', $w)) fail('Not enough letters');
  $st = player_done($r, $me['id']);
  if ($st['done']) fail('You are done this round');
  $s = $r['settings'];
  if (!$s['anyGuess'] && $w !== $r['word'] && !is_valid_word($w) && !in_array($w, $s['custom'], true)) fail('Not in word list');
  $prev = q('SELECT word, marks FROM guesses WHERE code = ? AND game = ? AND round = ? AND pid = ? ORDER BY idx', [$r['code'], $r['game'], $r['round'], $me['id']])->fetchAll();
  if ($s['hard'] && ($v = hard_violation($w, $prev))) fail($v);
  $m = marks($w, $r['word']);
  q('INSERT INTO guesses (code, game, round, pid, idx, word, marks, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [$r['code'], $r['game'], $r['round'], $me['id'], count($prev), $w, $m, now_ms()]);
  $after = player_done($r, $me['id']);
  tick($r);
  out(['marks' => $m, 'solved' => $after['solved'], 'done' => $after['done']]);
}

if ($a === 'kick') {
  $r = require_room($me, true);
  $pid = (string)(body()['pid'] ?? '');
  if ($pid === $me['id']) fail('You cannot kick yourself');
  if (!row('SELECT 1 FROM members WHERE code = ? AND pid = ?', [$r['code'], $pid])) fail('Not in room');
  $r['kicked'][] = $pid;
  remove_member($r, $pid, 'kicked');
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'promote') {
  $r = require_room($me, true);
  $pid = (string)(body()['pid'] ?? '');
  $p = row('SELECT p.name FROM members m JOIN players p ON p.id = m.pid WHERE m.code = ? AND m.pid = ?', [$r['code'], $pid]);
  if (!$p) fail('Not in room');
  $r['host'] = $pid;
  sys_msg($r['code'], $p['name'] . ' is now the host');
  save_room($r);
  out(['ok' => true]);
}

if ($a === 'chat') {
  $code = chat_code(); in_chat($me, $code);
  $b = body();
  $text = trim(str_replace("\r", '', (string)($b['text'] ?? '')));
  $text = preg_replace("/\n{3,}/", "\n\n", $text);
  if ($text === '') fail('Empty message');
  if (mb_strlen($text) > 500) fail('Message too long (500 max)');
  $recent = (int)row('SELECT COUNT(*) AS n FROM messages WHERE pid = ? AND at > ?', [$me['id'], now_ms() - 5000])['n'];
  if ($recent >= 6) fail('Slow down a little', 429);
  $reply = isset($b['reply']) ? (int)$b['reply'] : null;
  if ($reply && !row('SELECT 1 FROM messages WHERE id = ? AND code = ?', [$reply, $code])) $reply = null;
  q('INSERT INTO messages (code, pid, kind, text, reply, at) VALUES (?, ?, ?, ?, ?, ?)', [$code, $me['id'], 'user', $text, $reply, now_ms()]);
  q('UPDATE players SET typing = 0 WHERE id = ?', [$me['id']]);
  out(['ok' => true]);
}

if ($a === 'react') {
  $code = chat_code(); in_chat($me, $code);
  $id = (int)(body()['msg'] ?? 0);
  $e = (string)(body()['emoji'] ?? '');
  if (!row('SELECT 1 FROM messages WHERE id = ? AND code = ? AND deleted = 0', [$id, $code])) fail('Message not found');
  $ok = preg_match('/^:([a-z]+):$/', $e, $mm) ? in_array($mm[1], ICON_SET, true) : ($e !== '' && strlen($e) <= 32 && !preg_match('/[\x00-\x7F]/', $e));
  if (!$ok) fail('Unsupported reaction');
  if (row('SELECT 1 FROM reactions WHERE msg = ? AND pid = ? AND emoji = ?', [$id, $me['id'], $e])) {
    q('DELETE FROM reactions WHERE msg = ? AND pid = ? AND emoji = ?', [$id, $me['id'], $e]);
  } else {
    if ((int)row('SELECT COUNT(DISTINCT emoji) AS n FROM reactions WHERE msg = ?', [$id])['n'] >= 20) fail('Too many reactions');
    q('INSERT INTO reactions (msg, pid, emoji) VALUES (?, ?, ?)', [$id, $me['id'], $e]);
  }
  out(['ok' => true]);
}

if ($a === 'delmsg') {
  $code = chat_code(); in_chat($me, $code);
  $id = (int)(body()['msg'] ?? 0);
  $m = row('SELECT pid FROM messages WHERE id = ? AND code = ?', [$id, $code]);
  $r = $code !== GLOBAL_ROOM ? room($code) : null;
  if (!$m || ($m['pid'] !== $me['id'] && (!$r || $r['host'] !== $me['id']))) fail('Not allowed', 403);
  q('UPDATE messages SET deleted = 1 WHERE id = ?', [$id]);
  q('DELETE FROM reactions WHERE msg = ?', [$id]);
  out(['ok' => true]);
}

if ($a === 'typing') {
  $code = chat_code(); in_chat($me, $code);
  q('UPDATE players SET typing = ?, typing_in = ? WHERE id = ?', [now_ms() + 4000, $code, $me['id']]);
  out(['ok' => true]);
}

fail('Unknown action', 404);
