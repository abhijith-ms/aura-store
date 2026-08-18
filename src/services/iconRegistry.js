// Brand Logo & Icon Registry for AUR packages
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/simple-icons@v14/icons';

export const KNOWN_LOGOS = {
  'spotify': { url: `${CDN_BASE}/spotify.svg`, color: '#1DB954', bg: 'rgba(29, 185, 84, 0.16)' },
  'discord': { url: `${CDN_BASE}/discord.svg`, color: '#5865F2', bg: 'rgba(88, 101, 242, 0.16)' },
  'visual-studio-code-bin': { url: `${CDN_BASE}/visualstudiocode.svg`, color: '#007ACC', bg: 'rgba(0, 122, 204, 0.16)' },
  'google-chrome': { url: `${CDN_BASE}/googlechrome.svg`, color: '#4285F4', bg: 'rgba(66, 133, 244, 0.16)' },
  'brave-bin': { url: `${CDN_BASE}/brave.svg`, color: '#FB542B', bg: 'rgba(251, 84, 43, 0.16)' },
  'zen-browser-bin': { url: 'https://raw.githubusercontent.com/zen-browser/desktop/main/src/browser/branding/official/default128.png', color: '#0A84FF', bg: 'rgba(10, 132, 255, 0.16)' },
  'telegram-desktop': { url: `${CDN_BASE}/telegram.svg`, color: '#26A5E4', bg: 'rgba(38, 165, 228, 0.16)' },
  'obs-studio-git': { url: `${CDN_BASE}/obsstudio.svg`, color: '#302E31', bg: 'rgba(255, 255, 255, 0.12)' },
  'steam': { url: `${CDN_BASE}/steam.svg`, color: '#00ADEE', bg: 'rgba(0, 173, 238, 0.16)' },
  'docker-desktop': { url: `${CDN_BASE}/docker.svg`, color: '#2496ED', bg: 'rgba(36, 150, 237, 0.16)' },
  'postman-bin': { url: `${CDN_BASE}/postman.svg`, color: '#FF6C37', bg: 'rgba(255, 108, 55, 0.16)' },
  'insomnia-bin': { url: `${CDN_BASE}/insomnia.svg`, color: '#5849BE', bg: 'rgba(88, 73, 190, 0.16)' },
  'sublime-text-4': { url: `${CDN_BASE}/sublimetext.svg`, color: '#FF9800', bg: 'rgba(255, 152, 0, 0.16)' },
  'neovim-git': { url: `${CDN_BASE}/neovim.svg`, color: '#57A143', bg: 'rgba(87, 161, 67, 0.16)' },
  'vlc-git': { url: `${CDN_BASE}/vlcmediaplayer.svg`, color: '#FF8800', bg: 'rgba(255, 136, 0, 0.16)' },
  'retroarch': { url: `${CDN_BASE}/retroarch.svg`, color: '#D83A56', bg: 'rgba(216, 58, 86, 0.16)' },
  'prismlauncher-bin': { url: `${CDN_BASE}/curseforge.svg`, color: '#26A269', bg: 'rgba(38, 162, 105, 0.16)' },
  'alacritty-git': { url: `${CDN_BASE}/alacritty.svg`, color: '#F46A25', bg: 'rgba(244, 106, 37, 0.16)' },
  'kitty-git': { url: 'https://sw.kovidgoyal.net/kitty/_static/kitty.svg', color: '#1B6685', bg: 'rgba(27, 102, 133, 0.16)' },
  'btop': { url: `${CDN_BASE}/archlinux.svg`, color: '#1793D1', bg: 'rgba(23, 147, 209, 0.16)' },
  'fastfetch-git': { url: `${CDN_BASE}/archlinux.svg`, color: '#1793D1', bg: 'rgba(23, 147, 209, 0.16)' },
  'stremio': { url: 'https://www.stremio.com/website/stremio-logo-small.png', color: '#5B44E6', bg: 'rgba(91, 68, 230, 0.16)' },
  'tor-browser-bin': { url: `${CDN_BASE}/torbrowser.svg`, color: '#7D4698', bg: 'rgba(125, 70, 152, 0.16)' },
  'vivaldi': { url: `${CDN_BASE}/vivaldi.svg`, color: '#EF3939', bg: 'rgba(239, 57, 57, 0.16)' },
  'signal-desktop': { url: `${CDN_BASE}/signal.svg`, color: '#3A76F0', bg: 'rgba(58, 118, 240, 0.16)' },
  'slack-desktop': { url: `${CDN_BASE}/slack.svg`, color: '#4A154B', bg: 'rgba(74, 21, 75, 0.2)' },
  'gimp': { url: `${CDN_BASE}/gimp.svg`, color: '#5C5543', bg: 'rgba(92, 85, 67, 0.2)' },
  'inkscape': { url: `${CDN_BASE}/inkscape.svg`, color: '#000000', bg: 'rgba(255, 255, 255, 0.12)' },
  'blender': { url: `${CDN_BASE}/blender.svg`, color: '#E87D0D', bg: 'rgba(232, 125, 13, 0.16)' },
  'audacity': { url: `${CDN_BASE}/audacity.svg`, color: '#0000EC', bg: 'rgba(0, 0, 236, 0.16)' },
  'kodi': { url: `${CDN_BASE}/kodi.svg`, color: '#17B2E7', bg: 'rgba(23, 178, 231, 0.16)' },
  'paru': { url: `${CDN_BASE}/archlinux.svg`, color: '#1793D1', bg: 'rgba(23, 147, 209, 0.16)' },
  'yay': { url: `${CDN_BASE}/archlinux.svg`, color: '#1793D1', bg: 'rgba(23, 147, 209, 0.16)' },
  'cursor-bin': { url: 'https://www.cursor.com/assets/images/logo.svg', color: '#000000', bg: 'rgba(255, 255, 255, 0.14)' },
};

// Automatic slug resolver for any package
export function resolvePackageLogo(pkgName) {
  if (!pkgName) return null;
  const name = pkgName.toLowerCase().trim();

  // 1. Direct match
  if (KNOWN_LOGOS[name]) return KNOWN_LOGOS[name];

  // 2. Base slug match without -bin, -git, -app, -desktop suffixes
  const base = name.replace(/-(?:bin|git|desktop|electron|app|nightly|preview|stable|beta)$/, '');
  if (KNOWN_LOGOS[base]) return KNOWN_LOGOS[base];

  // 3. Keyword / Slug matchers
  if (base.includes('spotify')) return KNOWN_LOGOS['spotify'];
  if (base.includes('discord')) return KNOWN_LOGOS['discord'];
  if (base.includes('code') || base.includes('vscode')) return KNOWN_LOGOS['visual-studio-code-bin'];
  if (base.includes('chrome')) return KNOWN_LOGOS['google-chrome'];
  if (base.includes('brave')) return KNOWN_LOGOS['brave-bin'];
  if (base.includes('zen-browser')) return KNOWN_LOGOS['zen-browser-bin'];
  if (base.includes('telegram')) return KNOWN_LOGOS['telegram-desktop'];
  if (base.includes('obs-studio')) return KNOWN_LOGOS['obs-studio-git'];
  if (base.includes('steam')) return KNOWN_LOGOS['steam'];
  if (base.includes('docker')) return KNOWN_LOGOS['docker-desktop'];
  if (base.includes('postman')) return KNOWN_LOGOS['postman-bin'];
  if (base.includes('insomnia')) return KNOWN_LOGOS['insomnia-bin'];
  if (base.includes('sublime')) return KNOWN_LOGOS['sublime-text-4'];
  if (base.includes('neovim') || base.includes('nvim')) return KNOWN_LOGOS['neovim-git'];
  if (base.includes('vlc')) return KNOWN_LOGOS['vlc-git'];
  if (base.includes('signal')) return KNOWN_LOGOS['signal-desktop'];
  if (base.includes('slack')) return KNOWN_LOGOS['slack-desktop'];
  if (base.includes('gimp')) return KNOWN_LOGOS['gimp'];
  if (base.includes('blender')) return KNOWN_LOGOS['blender'];
  if (base.includes('kodi')) return KNOWN_LOGOS['kodi'];
  if (base.includes('tor-browser')) return KNOWN_LOGOS['tor-browser-bin'];
  if (base.includes('vivaldi')) return KNOWN_LOGOS['vivaldi'];
  if (base.includes('paru') || base.includes('yay')) return KNOWN_LOGOS['paru'];

  // 4. Fallback to SimpleIcons CDN candidate by sanitized base name
  const cleanSlug = base.replace(/[^a-z0-9]/g, '');
  if (cleanSlug.length >= 3) {
    return {
      url: `${CDN_BASE}/${cleanSlug}.svg`,
      color: '#818cf8',
      bg: 'rgba(255, 255, 255, 0.08)',
    };
  }

  return null;
}
