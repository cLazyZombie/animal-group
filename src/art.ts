export type World = 'zoo' | 'sea' | 'sky' | 'numbers';

export interface Species {
  id: string;
  name: string;
  world: World;
  color: string;
  accent: string;
}

export const SPECIES: Species[] = [
  { id: 'toucan', name: '토코투칸', world: 'zoo', color: '#313744', accent: '#ffc940' },
  { id: 'monkey', name: '원숭이', world: 'zoo', color: '#a96b46', accent: '#f0bd86' },
  { id: 'anteater', name: '개미핥기', world: 'zoo', color: '#9b8875', accent: '#e5c9a9' },
  { id: 'redpanda', name: '레서팬더', world: 'zoo', color: '#cc7549', accent: '#fff0d1' },
  { id: 'crocodile', name: '악어', world: 'zoo', color: '#6eac6d', accent: '#b4d682' },
  { id: 'ray', name: '가오리', world: 'sea', color: '#6579af', accent: '#b9d3e9' },
  { id: 'clownfish', name: '크라운피시', world: 'sea', color: '#ff9052', accent: '#fff0cf' },
  { id: 'sunfish', name: '개복치', world: 'sea', color: '#879cae', accent: '#c6d8df' },
  { id: 'whaleshark', name: '고래상어', world: 'sea', color: '#668ca4', accent: '#d7e9eb' },
  { id: 'seadragon', name: '해룡', world: 'sea', color: '#d5a65a', accent: '#f3db91' },
  { id: 'crowned-crane', name: '관학', world: 'sky', color: '#bd9b66', accent: '#f4d99b' },
  { id: 'eagle', name: '독수리', world: 'sky', color: '#74513b', accent: '#f8dda3' },
  { id: 'gull', name: '갈매기', world: 'sky', color: '#e5e5dc', accent: '#f9ecab' },
  { id: 'sky-toucan', name: '큰부리새', world: 'sky', color: '#303644', accent: '#ffc85b' },
  { id: 'macaw', name: '빨간 마코앵무', world: 'sky', color: '#e7473d', accent: '#ffd064' },
  ...['#ef787e', '#f2a65a', '#f0cf65', '#72bba3', '#65b5d6', '#888ad6', '#b784ca', '#d889ab', '#81b66e', '#e89971'].map((color, digit) => ({
    id: `digit-${digit}`, name: String(digit), world: 'numbers' as const, color, accent: color,
  })),
];

const digitAssets = new Map<string, string>();

export function animalAssetUrl(id: string): string {
  if (id.startsWith('digit-')) {
    const cached = digitAssets.get(id);
    if (cached) return cached;
    const digit = Number(id.slice(6));
    const color = SPECIES.find(species => species.id === id)?.color || '#ef787e';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "900 390px 'Arial Rounded MT Bold', 'Nunito', sans-serif";
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#50647255';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 14;
    ctx.lineWidth = 52;
    ctx.strokeStyle = '#fff8e9';
    ctx.strokeText(String(digit), 256, 265);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = ctx.shadowOffsetY = 0;
    ctx.lineWidth = 28;
    ctx.strokeStyle = '#ffffffaa';
    ctx.strokeText(String(digit), 256, 265);
    const fill = ctx.createLinearGradient(80, 80, 420, 450);
    fill.addColorStop(0, '#ffffff99');
    fill.addColorStop(0.2, color);
    fill.addColorStop(1, color);
    ctx.fillStyle = fill;
    ctx.fillText(String(digit), 256, 265);
    let seed = digit + 1;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 1800; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 512;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = seed % 512;
      ctx.fillStyle = i % 3 ? '#ffffff25' : '#473c4020';
      ctx.fillRect(x, y, i % 5 ? 2 : 4, 1);
    }
    ctx.restore();
    const url = canvas.toDataURL('image/png');
    digitAssets.set(id, url);
    return url;
  }
  return `${import.meta.env.BASE_URL}animals/${id}.png`;
}
