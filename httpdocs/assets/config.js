// Multiplayer server. When the game is served from GitHub Pages, api.php runs on artline-studio.de.
// Served from the artline server itself, the API is same-origin and this stays empty.
window.HEXLE_API = location.hostname.endsWith('github.io') ? 'https://hexle.artline-studio.de/' : '';
