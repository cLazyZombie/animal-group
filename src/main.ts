import './styles.css';
import { animalAssetUrl, SPECIES, type World } from './art';
import { AnimalGame } from './game';
import { GameAudio } from './audio';

type ScoreRecord = { score: number; world: World; at: number };

const app = document.querySelector<HTMLDivElement>('#app')!;
const audio = new GameAudio();
let game: AnimalGame | undefined;
let hintTimeout: number | undefined;

function readRecords(): ScoreRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem('animal-loop-scores') || '[]');
    return Array.isArray(value) ? value.filter(item => Number.isFinite(item.score) && (item.world === 'zoo' || item.world === 'sea')) : [];
  } catch { return []; }
}

function saveScore(score: number, world: World): { rank: number; best: number; records: ScoreRecord[]; at: number } {
  const record = { score, world, at: Date.now() };
  const sorted = [...readRecords(), record].sort((a, b) => b.score - a.score || a.at - b.at);
  const rank = sorted.filter(item => item.world === world).indexOf(record) + 1;
  const records = sorted.slice(0, 1000);
  localStorage.setItem('animal-loop-scores', JSON.stringify(records));
  const sameWorld = records.filter(item => item.world === world);
  return { rank, best: sameWorld[0]?.score || 0, records: sameWorld, at: record.at };
}

function bestScore(world: World): number {
  return readRecords().filter(item => item.world === world).reduce((best, item) => Math.max(best, item.score), 0);
}

function animalImage(id: string, className = ''): string { return `<img class="${className}" src="${animalAssetUrl(id)}" alt="" draggable="false" />`; }
function soundIcon(): string { return audio.isMuted ? '🔇' : '♫'; }

function renderLobby(): void {
  game?.destroy();
  game = undefined;
  audio.stop();
  app.innerHTML = `
    <div class="lobby-shell">
      <header class="site-header">
        <div class="brand"><span class="brand-mark">◎</span><span>동글동글 <b>동물 친구들</b></span></div>
        <div class="header-right"><span class="header-pill">함께 그리는 1분 게임</span><button id="sound-toggle" class="icon-button" aria-label="소리 켜기 또는 끄기">${soundIcon()}</button></div>
      </header>
      <main class="lobby-main">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-dot"></span> 손끝에서 시작되는 동물 친구들의 모험</div>
          <h1>동그라미 하나로<br /><em>친구들을 모아봐!</em></h1>
          <p>같은 동물을 쏙 둘러주면 더 크고 귀여운 친구로 변신!<br class="desktop-break" /> 1분 동안 신나게 모아 최고 점수에 도전해요.</p>
          <div class="how-pill"><span class="how-icon">✎</span><span>동물을 둘러 그리고 손을 떼면 합쳐져요</span></div>
        </div>
        <section class="choice-section" aria-label="놀이터 고르기">
          <div class="section-heading"><span>어디서 놀까요?</span><div class="heading-line"></div><small>놀이터를 골라 시작해요!</small></div>
          <div class="world-cards">
            <button class="world-card zoo-card" data-world="zoo" aria-label="동물원 게임 시작">
              <span class="card-glow"></span><span class="card-sun"></span><span class="hill hill-back"></span><span class="hill hill-front"></span>
              <span class="card-label">초록빛 초원</span>
              <span class="card-animals zoo-animals">${animalImage('toucan', 'card-animal toucan')}${animalImage('monkey', 'card-animal monkey')}${animalImage('redpanda', 'card-animal redpanda')}${animalImage('crocodile', 'card-animal crocodile')}</span>
              <span class="card-bottom"><span><strong>동물원</strong><small>숲속 친구들과 놀아요</small></span><span class="card-arrow">↗</span></span>
            </button>
            <button class="world-card sea-card" data-world="sea" aria-label="수족관 게임 시작">
              <span class="card-glow"></span><span class="wave wave-one"></span><span class="wave wave-two"></span><span class="card-bubbles bubble-one"></span><span class="card-bubbles bubble-two"></span>
              <span class="card-label">반짝이는 바닷속</span>
              <span class="card-animals sea-animals">${animalImage('ray', 'card-animal ray')}${animalImage('clownfish', 'card-animal clownfish')}${animalImage('whaleshark', 'card-animal whaleshark')}${animalImage('seadragon', 'card-animal seadragon')}</span>
              <span class="card-bottom"><span><strong>수족관</strong><small>바다 친구들과 놀아요</small></span><span class="card-arrow">↗</span></span>
            </button>
          </div>
        </section>
        <div class="lobby-footer"><span>👆 여러 명이 동시에 그릴 수 있어요</span><span>🏆 최고 점수는 이 기기에 저장돼요</span><span>✨ 동물은 4단계까지 커져요</span></div>
      </main>
    </div>`;
  app.querySelectorAll<HTMLButtonElement>('[data-world]').forEach(button => button.addEventListener('click', () => startGame(button.dataset.world as World)));
  app.querySelector<HTMLButtonElement>('#sound-toggle')!.addEventListener('click', toggleSound);
}

function toggleSound(): void {
  audio.toggle();
  const button = app.querySelector<HTMLButtonElement>('#sound-toggle');
  if (button) button.textContent = soundIcon();
}

function startGame(world: World): void {
  game?.destroy();
  game = undefined;
  void audio.start();
  const isZoo = world === 'zoo';
  const title = isZoo ? '동물원' : '수족관';
  const themeAnimals = SPECIES.filter(item => item.world === world);
  app.innerHTML = `
    <div class="game-shell ${isZoo ? 'zoo-theme' : 'sea-theme'}">
      <header class="game-header">
        <button id="back-button" class="back-button" aria-label="처음으로 돌아가기">← <span>처음으로</span></button>
        <div class="game-title"><span class="game-title-icon">${isZoo ? '🌿' : '🫧'}</span><span>${title} 놀이터</span></div>
        <button id="sound-toggle" class="icon-button game-sound" aria-label="소리 켜기 또는 끄기">${soundIcon()}</button>
      </header>
      <main class="play-main">
        <div class="hud">
          <div class="hud-stat score-stat"><span class="stat-icon">⭐</span><span><small>내 점수</small><strong id="score-value">0</strong></span></div>
          <div class="timer-wrap"><div class="timer-ring"><div class="timer-inner"><small>남은 시간</small><strong id="time-value">60</strong></div></div></div>
          <div class="hud-stat best-stat"><span class="stat-icon">🏆</span><span><small>최고 점수</small><strong>${bestScore(world).toLocaleString()}</strong></span></div>
        </div>
        <div class="field-wrap"><div id="game-field" class="game-field"><div class="field-decoration field-decoration-one"></div><div class="field-decoration field-decoration-two"></div><div class="field-caption">${isZoo ? '🌼 친구들이 뛰노는 초원' : '🪸 반짝반짝 바닷속'}</div><div id="hint" class="hint-bubble">같은 동물 둘 이상을 동그라미로 둘러보세요!</div></div></div>
        <div class="play-bottom"><div class="species-strip">${themeAnimals.map(species => `<span title="${species.name}">${animalImage(species.id)}<small>${species.name}</small></span>`).join('')}</div><div class="rule-chip">같은 동물 2마리 이상 = 변신! <b>✦</b></div></div>
      </main>
    </div>`;
  app.querySelector<HTMLButtonElement>('#back-button')!.addEventListener('click', renderLobby);
  app.querySelector<HTMLButtonElement>('#sound-toggle')!.addEventListener('click', toggleSound);
  const field = app.querySelector<HTMLElement>('#game-field')!;
  const scoreEl = app.querySelector<HTMLElement>('#score-value')!;
  const timeEl = app.querySelector<HTMLElement>('#time-value')!;
  const timer = app.querySelector<HTMLElement>('.timer-ring')!;
  const hint = app.querySelector<HTMLElement>('#hint')!;
  game = new AnimalGame(field, world, {
    onScore(score) { scoreEl.textContent = score.toLocaleString(); scoreEl.classList.remove('score-bump'); void scoreEl.offsetWidth; scoreEl.classList.add('score-bump'); },
    onTime(seconds) { timeEl.textContent = String(seconds); timer.style.setProperty('--progress', `${seconds / 60 * 100}%`); timer.classList.toggle('urgent', seconds <= 10); },
    onFinish(score) { audio.finish(); showResult(score, world); },
    onMerge(level) { audio.merge(level); },
    onHint(message) {
      hint.textContent = message;
      hint.classList.add('visible');
      window.clearTimeout(hintTimeout);
      hintTimeout = window.setTimeout(() => hint.classList.remove('visible'), 2300);
    },
  });
  window.setTimeout(() => hint.classList.remove('visible'), 3700);
}

function showResult(score: number, world: World): void {
  game?.destroy();
  game = undefined;
  const previousBest = bestScore(world);
  const { rank, best, records, at } = saveScore(score, world);
  const isNewBest = score > previousBest;
  const title = world === 'zoo' ? '동물원' : '수족관';
  const overlay = document.createElement('div');
  overlay.className = 'result-overlay';
  overlay.innerHTML = `
    <div class="result-card" role="dialog" aria-modal="true" aria-label="게임 결과">
      <div class="result-confetti confetti-a">✦</div><div class="result-confetti confetti-b">✳</div><div class="result-confetti confetti-c">✦</div>
      <div class="result-mascot">${animalImage(world === 'zoo' ? 'redpanda' : 'clownfish')}</div>
      <div class="result-eyebrow">1분 모험 완료!</div><h2>정말 멋졌어요!</h2><p>${title} 친구들이 아주 즐거웠대요</p>
      <div class="result-score"><small>이번 점수</small><strong>${score.toLocaleString()}</strong><span>점</span></div>
      <div class="result-badges"><span>🏅 ${title} ${rank}등</span><span>${isNewBest ? '✨ 새로운 최고 기록!' : `🏆 최고 ${best.toLocaleString()}점`}</span></div>
      <div class="ranking"><div class="ranking-heading"><strong>이 기기의 ${title} 등수</strong><small>최고 점수 순</small></div>${records.slice(0, 5).map((record, index) => `<div class="ranking-row ${record.at === at && record.score === score ? 'current' : ''}"><span class="rank-num">${index + 1}</span><span>${new Date(record.at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span><strong>${record.score.toLocaleString()}점</strong></div>`).join('')}</div>
      <div class="result-actions"><button id="retry-button" class="primary-button">↻ 다시하기</button><button id="lobby-button" class="secondary-button">⌂ 처음부터</button></div>
    </div>`;
  app.append(overlay);
  overlay.querySelector<HTMLButtonElement>('#retry-button')!.addEventListener('click', () => startGame(world));
  overlay.querySelector<HTMLButtonElement>('#lobby-button')!.addEventListener('click', renderLobby);
}

renderLobby();
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
