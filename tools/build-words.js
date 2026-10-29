// Builds httpdocs/words/{answers,valid}-N.txt from two source lists:
//   enable.txt  public-domain ENABLE dictionary (one word per line)
//   freq.txt    "word count" frequency list (most common first)
// usage: node build-words.js <srcdir> <outdir>
const fs = require('fs');
const path = require('path');
const [src, out] = process.argv.slice(2);

const enable = new Set(fs.readFileSync(path.join(src, 'enable.txt'), 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(w => /^[a-z]+$/.test(w)));
const rank = new Map();
fs.readFileSync(path.join(src, 'freq.txt'), 'utf8').split(/\r?\n/).forEach((l, i) => { const w = l.split(' ')[0]; if (w && !rank.has(w)) rank.set(w, i); });

const BLOCK = new Set('fuck fucks fucked fucker shit shits shitty cunt cunts bitch bitches whore whores slut sluts dick dicks cock cocks pussy penis vagina nigga nigger faggot fag fags rape raped rapist anal anus porn porno horny sexy semen dildo boobs tits titty bastard retard retards nazi nazis kike spic chink twat wank wanker'.split(' '));
const MAXRANK = { 4: 9000, 5: 16000, 6: 20000, 7: 24000, 8: 28000 };

fs.mkdirSync(out, { recursive: true });
for (let n = 4; n <= 8; n++) {
  const valid = [...enable].filter(w => w.length === n).sort();
  const answers = valid.filter(w => {
    const r = rank.get(w);
    if (r === undefined || r > MAXRANK[n] || BLOCK.has(w)) return false;
    if (/s$/.test(w) && !/ss$/.test(w)) return false;   // plurals
    if (n >= 5 && /ed$/.test(w)) return false;           // past tense
    return true;
  });
  fs.writeFileSync(path.join(out, `valid-${n}.txt`), valid.join('\n'));
  fs.writeFileSync(path.join(out, `answers-${n}.txt`), answers.join('\n'));
  console.log(n, 'valid', valid.length, 'answers', answers.length);
}
