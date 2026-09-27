export type World = 'zoo' | 'sea';

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
];

export function animalAssetUrl(id: string): string {
  return `${import.meta.env.BASE_URL}animals/${id}.png`;
}
