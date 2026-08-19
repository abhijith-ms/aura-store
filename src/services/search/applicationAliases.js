/**
 * applicationAliases.js — High-confidence application identity registry.
 *
 * Provides curated identities, canonical AUR packages, known variants,
 * and related package prefixes for common applications.
 *
 * Rules:
 *   - High-confidence common desktop/CLI applications only.
 *   - Unambiguous aliases mapped to canonical application identities.
 *   - Generic words (e.g. "code", "browser", "editor") are NOT mapped to single apps.
 */

export const APPLICATION_IDENTITIES = [
  {
    id: 'visual-studio-code',
    canonicalName: 'Visual Studio Code',
    aliases: [
      'vscode',
      'vs code',
      'visual studio code',
      'visualstudiocode',
      'visual studio code editor',
    ],
    canonicalPackages: ['visual-studio-code-bin', 'visual-studio-code'],
    variants: [
      'visual-studio-code-insiders-bin',
      'visual-studio-code-electron-bin',
      'vscodium-bin',
    ],
    relatedPrefixes: [
      'vscode-',
      'code-',
    ],
  },
  {
    id: 'google-chrome',
    canonicalName: 'Google Chrome',
    aliases: [
      'chrome',
      'google chrome',
      'chrome browser',
      'google-chrome',
      'google chrome browser',
    ],
    canonicalPackages: ['google-chrome'],
    variants: [
      'google-chrome-beta',
      'google-chrome-dev',
      'google-chrome-unstable',
    ],
    relatedPrefixes: [
      'chrome-',
      'chromedriver',
      'chromium-',
    ],
  },
  {
    id: 'firefox',
    canonicalName: 'Firefox',
    aliases: [
      'firefox',
      'firefox browser',
      'mozilla firefox',
      'firefox web browser',
    ],
    canonicalPackages: ['firefox'],
    variants: [
      'firefox-nightly',
      'firefox-beta-bin',
      'firefox-developer-edition',
      'firefox-esr-bin',
      'firefox-esr',
    ],
    relatedPrefixes: [
      'firefox-',
    ],
  },
  {
    id: 'discord',
    canonicalName: 'Discord',
    aliases: [
      'discord',
      'discord app',
      'discord client',
      'discord voice',
    ],
    canonicalPackages: ['discord'],
    variants: [
      'discord-canary',
      'discord-ptb',
      'discord-development',
    ],
    relatedPrefixes: [
      'discord-',
    ],
  },
  {
    id: 'spotify',
    canonicalName: 'Spotify',
    aliases: [
      'spotify',
      'spotify music',
      'spotify client',
      'spotify player',
    ],
    canonicalPackages: ['spotify'],
    variants: [
      'spotify-edge',
      'spotify-dev',
    ],
    relatedPrefixes: [
      'spotify-',
      'spicetify-',
    ],
  },
  {
    id: 'postman',
    canonicalName: 'Postman',
    aliases: [
      'postman',
      'postman api',
      'postman app',
      'postman client',
    ],
    canonicalPackages: ['postman-bin', 'postman'],
    variants: [
      'postman-canary-bin',
    ],
    relatedPrefixes: [
      'postman-',
    ],
  },
  {
    id: 'sublime-text',
    canonicalName: 'Sublime Text',
    aliases: [
      'sublime',
      'sublime text',
      'sublimetext',
      'sublime text 4',
      'sublime-text',
    ],
    canonicalPackages: ['sublime-text-4', 'sublime-text'],
    variants: [
      'sublime-text-dev',
    ],
    relatedPrefixes: [
      'sublime-',
    ],
  },
  {
    id: 'cursor',
    canonicalName: 'Cursor IDE',
    aliases: [
      'cursor',
      'cursor ide',
      'cursor ai',
      'cursor editor',
    ],
    canonicalPackages: ['cursor-bin'],
    variants: [
      'cursor-nightly-bin',
    ],
    relatedPrefixes: [
      'cursor-',
    ],
  },
  {
    id: 'steam',
    canonicalName: 'Steam',
    aliases: [
      'steam',
      'steam client',
      'valve steam',
    ],
    canonicalPackages: ['steam'],
    variants: [
      'steam-native',
      'steam-beta',
    ],
    relatedPrefixes: [
      'steam-',
    ],
  },
  {
    id: 'zen-browser',
    canonicalName: 'Zen Browser',
    aliases: [
      'zen',
      'zen browser',
      'zen-browser',
      'zen web browser',
    ],
    canonicalPackages: ['zen-browser-bin'],
    variants: [
      'zen-browser-generic-bin',
      'zen-browser-avx2-bin',
    ],
    relatedPrefixes: [
      'zen-',
    ],
  },
  {
    id: 'brave',
    canonicalName: 'Brave Browser',
    aliases: [
      'brave',
      'brave browser',
      'brave-browser',
      'brave web browser',
    ],
    canonicalPackages: ['brave-bin', 'brave'],
    variants: [
      'brave-beta-bin',
      'brave-nightly-bin',
    ],
    relatedPrefixes: [
      'brave-',
    ],
  },
  {
    id: 'telegram',
    canonicalName: 'Telegram Desktop',
    aliases: [
      'telegram',
      'telegram desktop',
      'telegram app',
      'telegram client',
    ],
    canonicalPackages: ['telegram-desktop'],
    variants: [
      'telegram-desktop-bin',
      'telegram-desktop-beta-bin',
    ],
    relatedPrefixes: [
      'telegram-',
    ],
  },
  {
    id: 'obs-studio',
    canonicalName: 'OBS Studio',
    aliases: [
      'obs',
      'obs studio',
      'obs-studio',
      'open broadcaster software',
    ],
    canonicalPackages: ['obs-studio-git', 'obs-studio'],
    variants: [
      'obs-studio-tytan652',
    ],
    relatedPrefixes: [
      'obs-',
    ],
  },
];
