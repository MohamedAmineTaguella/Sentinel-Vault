export function checkStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (!password) return { score: 0, label: 'Empty' };
  if (password.length >= 6) score += 10;
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 15;
  if (password.length >= 28) score += 10;
  if (/[a-z]/.test(password)) score += 8;
  if (/[A-Z]/.test(password)) score += 8;
  if (/\d/.test(password)) score += 8;
  if (/[^a-zA-Z0-9]/.test(password)) score += 12;
  if (/(.)\1\1/.test(password)) score -= 10;
  if (/^(123|abc|qwe|pass|admin|letmein)/i.test(password)) score -= 25;
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? 'Very Strong' : score >= 60 ? 'Strong' : score >= 40 ? 'Fair' : score >= 20 ? 'Weak' : 'Very Weak';
  return { score, label };
}

export function strengthLabel(score: number): string {
  if (score >= 80) return 'Very Strong';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Weak';
  return 'Very Weak';
}

export function strengthColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-lime-500';
  if (score >= 40) return 'bg-amber-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-rose-500';
}

export function strengthShadow(score: number): string {
  if (score >= 80) return 'shadow-emerald-500/30';
  if (score >= 60) return 'shadow-lime-500/30';
  if (score >= 40) return 'shadow-amber-500/30';
  if (score >= 20) return 'shadow-orange-500/30';
  return 'shadow-rose-500/30';
}

/* Top 200 most common breached passwords (curated) — for offline breach hint */
const TOP_BREACHED = new Set<string>([
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon',
  '123123', 'baseball', 'abc123', 'football', 'monkey', 'letmein', 'shadow', 'master', '666666', 'qwertyuiop',
  '123321', 'mustang', '1234567890', 'michael', '654321', 'superman', '1qaz2wsx', '7777777', 'fuckyou', '121212',
  '000000', 'qazwsx', '123qwe', 'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbnm', 'asdfgh', 'hunter',
  'buster', 'soccer', 'harley', 'batman', 'andrew', 'tigger', 'sunshine', 'iloveyou', '2000', 'charlie',
  'robert', 'thomas', 'hockey', 'ranger', 'daniel', 'starwars', 'klaster', '112233', 'george', 'computer',
  'michelle', 'jessica', 'pepper', '1111', 'zxcvbn', '555555', '11111111', '131313', 'freedom', '777777',
  'pass', 'maggie', '159753', 'aaaaaa', 'ginger', 'princess', 'joshua', 'cheese', 'amanda', 'summer',
  'love', 'ashley', 'nicole', 'chelsea', 'biteme', 'matthew', 'access', 'yankees', '987654321', 'dallas',
  'austin', 'thunder', 'taylor', 'matrix', 'mobilemail', 'mom', 'monitor', 'monitoring', 'montana', 'moon',
  'moscow', 'william', 'corvette', 'hello', 'martin', 'heather', 'secret', 'fucker', 'merlin', 'diamond',
  '1234qwer', 'gfhjkm', 'hammer', 'silver', '222222', '88888888', 'anthony', 'justin', 'test', 'bailey',
  'q1w2e3r4t5', 'patrick', 'internet', 'scooter', 'orange', '11111', 'golfer', 'cookie', 'richard', 'samantha',
  'bigdog', 'guitar', 'jackson', 'whatever', 'mickey', 'chicken', 'sparky', 'snoopy', 'maverick', 'phoenix',
  'camaro', 'sexy', 'peanut', 'morgan', 'welcome', 'falcon', 'cowboy', 'ferrari', 'samsung', 'andrea',
  'smokey', 'steelers', 'joseph', 'mercedes', 'dakota', 'arsenal', 'eagles', 'melissa', 'boomer', 'booboo',
  'tigers', 'purple', 'murphy', 'james', 'patricia', 'linda', 'barbara', 'elizabeth', 'roger',
]);

export function isBreached(password: string): boolean {
  if (!password || password.length < 4) return false;
  return TOP_BREACHED.has(password.toLowerCase());
}

/* Generate a memorable passphrase (diceware-like offline list) */
const WORDS = [
  'apple', 'banana', 'cherry', 'delta', 'ember', 'forest', 'galaxy', 'harbor', 'iceberg', 'jungle',
  'koala', 'lemon', 'mango', 'nectar', 'ocean', 'panda', 'quartz', 'river', 'sapphire', 'tiger',
  'umbra', 'vortex', 'willow', 'xenon', 'yacht', 'zebra', 'amber', 'bronze', 'crystal', 'diamond',
  'echo', 'falcon', 'glacier', 'horizon', 'island', 'jasmine', 'kestrel', 'lunar', 'mountain', 'nebula',
  'orbit', 'phoenix', 'quasar', 'rainbow', 'silver', 'tempest', 'unicorn', 'volcano', 'wisdom', 'zenith',
  'anchor', 'beacon', 'canyon', 'drift', 'engine', 'falcon', 'galaxy', 'harvest', 'ignite', 'jasper',
  'kindle', 'lantern', 'meadow', 'nova', 'oracle', 'palace', 'quest', 'ridge', 'summit', 'tide',
  'uplift', 'vivid', 'whisper', 'yearn', 'zealot', 'arctic', 'blaze', 'compass', 'dawn', 'everest',
  'fern', 'grove', 'helix', 'indigo', 'jewel', 'knight', 'lighthouse', 'monsoon', 'nimbus', 'oasis',
  'pillar', 'quill', 'ripple', 'sapling', 'tide', 'under', 'voyage', 'wave', 'yonder', 'zephyr',
];

export function generatePassphrase(wordCount = 5): string {
  const buf = new Uint32Array(wordCount);
  crypto.getRandomValues(buf);
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) words.push(WORDS[buf[i] % WORDS.length]);
  const sep = '-';
  const combined = words.join(sep);
  const buf2 = new Uint32Array(2);
  crypto.getRandomValues(buf2);
  const num = buf2[0] % 100;
  const sym = '!@#$%&*?+='[buf2[1] % 9];
  return combined + sep + num + sym;
}

export function estimateCrackTime(password: string): string {
  if (!password) return '—';
  const charset = (() => {
    let s = 0;
    if (/[a-z]/.test(password)) s += 26;
    if (/[A-Z]/.test(password)) s += 26;
    if (/\d/.test(password)) s += 10;
    if (/[^a-zA-Z0-9]/.test(password)) s += 32;
    if (s === 0) return 1;
    return s;
  })();
  const combos = Math.pow(charset, password.length);
  const guessesPerSec = 1e10;
  const seconds = combos / guessesPerSec / 2;
  if (seconds < 1) return 'Instantly';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 31536000) return `${Math.round(seconds / 86400)}d`;
  if (seconds < 31536000 * 100) return `${Math.round(seconds / 31536000)}y`;
  if (seconds < 31536000 * 1e6) return `${Math.round(seconds / 31536000 / 1000)}K years`;
  if (seconds < 31536000 * 1e9) return `${Math.round(seconds / 31536000 / 1e6)}M years`;
  if (seconds < 31536000 * 1e12) return `${Math.round(seconds / 31536000 / 1e9)}B years`;
  return 'Centuries+';
}
