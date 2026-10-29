# HEXLE

A Halloween word game in the Evil Neuro palette: Daily Hex, Endless Night and The Coven (multiplayer).
PHP 8.1+ with `pdo_sqlite` and `mbstring`, which Plesk includes by default. There is no build step, no Node on
the server and no long-running process. Clients poll `api.php` about once a second.

## Deploy on artline-studio.de (Plesk)

1. **Websites & Domains → Add Subdomain**, e.g. `hexle.artline-studio.de`. Use PHP 8.3 (FPM) and turn on
   Let's Encrypt.
2. Upload the **contents** of `httpdocs/` into the subdomain's `httpdocs/`:
   ```
   httpdocs/index.html
   httpdocs/api.php
   httpdocs/.htaccess
   httpdocs/assets/app.css  app.js  icons.js
   httpdocs/words/answers-4..8.txt  valid-4..8.txt   (10 files)
   httpdocs/data/.htaccess  index.html               (fallback DB dir, see below)
   ```
3. Create an empty `private/` folder **next to** `httpdocs/`, not inside it:
   `/var/www/vhosts/artline-studio.de/hexle.artline-studio.de/private`
4. `chown -R <sysuser>:psacln httpdocs private` (the same system user as the subdomain).
5. Open the site. `private/hexle.sqlite` is created on the first request.

If PHP can't write to `private/`, the database falls back to `httpdocs/data/`. Apache blocks that folder with
`.htaccess`. If the subdomain runs **nginx-only**, add this to the nginx directives as well:
`location ~ ^/data/ { deny all; }`.

Don't upload `tools/`, `README.md` or any local `private/`.

## Invite links

`https://hexle.artline-studio.de/#/r/CODE`. The "Copy invite" button in a room builds this link from whatever
domain the game is served on.

## Word lists

`words/answers-N.txt` holds the possible answers: common words with no plurals or past tenses.
`words/valid-N.txt` holds every accepted guess (ENABLE dictionary, public domain).
To rebuild them: `node tools/build-words.js <dir-with-enable.txt-and-freq.txt> httpdocs/words`.
Changing `answers-5.txt` reshuffles the Daily Hex order.

Custom lists (the "Words" button in Endless and in room settings) live in the browser. A room's list is sent with
the room settings, so every player gets the same words.

## Testing locally

```
php -d extension=pdo_sqlite -d extension=mbstring -S 127.0.0.1:8790 -t httpdocs
node tools/test-api.js http://127.0.0.1:8790 private/hexle.sqlite
```
