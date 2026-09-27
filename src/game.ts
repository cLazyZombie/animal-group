import * as THREE from 'three';
import { animalAssetUrl, SPECIES, type Species, type World } from './art';

type Point = { x: number; y: number };
type Unit = { id: number; species: Species; level: number; u: number; v: number; vx: number; vy: number; turn: number; mergePulse: number; sprite: THREE.Sprite };
type Stroke = { points: Point[]; color: string };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; radius: number; star: boolean };
type Ripple = { x: number; y: number; life: number; maxLife: number; radius: number; color: string };
type Pop = { x: number; y: number; label: string; life: number; color: string };

export interface GameEvents {
  onScore: (score: number, gained: number) => void;
  onTime: (seconds: number) => void;
  onFinish: (score: number) => void;
  onMerge: (level: number) => void;
  onHint: (message: string) => void;
}

export const GAME_DURATION_SECONDS = 90;
const MAX_LEVEL = 5;
const POINTS = [30, 75, 180, 400, 850, 1700];
const PLAYER_COLORS = ['#ef75a7', '#7f72ec', '#f7a743', '#41bfc0', '#e97865', '#76ac61'];

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
function random(min: number, max: number): number { return min + Math.random() * (max - min); }
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function contains(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function discCoverage(poly: Point[], x: number, y: number, radius: number): number {
  let hits = contains(poly, x, y) ? 1 : 0;
  let total = 1;
  for (const ring of [0.45, 0.85]) {
    const n = ring === 0.45 ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const a = i * Math.PI * 2 / n;
      if (contains(poly, x + Math.cos(a) * radius * ring, y + Math.sin(a) * radius * ring)) hits++;
      total++;
    }
  }
  return hits / total;
}

function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export class AnimalGame {
  readonly element: HTMLElement;
  private world: World;
  private events: GameEvents;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera();
  private renderer: THREE.WebGLRenderer;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textures = new Map<string, THREE.Texture>();
  private units: Unit[] = [];
  private decor: THREE.Object3D[] = [];
  private strokes = new Map<number, Stroke>();
  private sparks: Spark[] = [];
  private ripples: Ripple[] = [];
  private pops: Pop[] = [];
  private nextUnitId = 1;
  private width = 1;
  private height = 1;
  private score = 0;
  private remaining = GAME_DURATION_SECONDS;
  private endsAt = 0;
  private running = false;
  private lastFrame = performance.now();
  private lastSpawn = 0;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(container: HTMLElement, world: World, events: GameEvents) {
    this.element = container;
    this.world = world;
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.domElement.className = 'world-canvas';
    this.element.append(this.renderer.domElement);
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'draw-canvas';
    this.element.append(this.overlay);
    const ctx = this.overlay.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.overlay.addEventListener('pointerdown', this.pointerDown);
    this.overlay.addEventListener('pointermove', this.pointerMove);
    this.overlay.addEventListener('pointerup', this.pointerUp);
    this.overlay.addEventListener('pointercancel', this.pointerCancel);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.element);
    this.resize();
    this.loadTextures();
    this.makeDecor();
    this.seedUnits();
    this.running = true;
    this.lastFrame = performance.now();
    this.endsAt = this.lastFrame + GAME_DURATION_SECONDS * 1000;
    this.events.onTime(GAME_DURATION_SECONDS);
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.overlay.removeEventListener('pointerdown', this.pointerDown);
    this.overlay.removeEventListener('pointermove', this.pointerMove);
    this.overlay.removeEventListener('pointerup', this.pointerUp);
    this.overlay.removeEventListener('pointercancel', this.pointerCancel);
    for (const item of this.decor) this.disposeObject(item);
    for (const unit of this.units) this.scene.remove(unit.sprite);
    this.textures.forEach(texture => texture.dispose());
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }

  private disposeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
      else object.material.dispose();
    }
  }

  private loadTextures(): void {
    SPECIES.filter(species => species.world === this.world).forEach(species => {
      const rightCanvas = document.createElement('canvas');
      rightCanvas.width = 512;
      rightCanvas.height = 512;
      const rightTexture = new THREE.CanvasTexture(rightCanvas);
      rightTexture.colorSpace = THREE.SRGBColorSpace;
      this.textures.set(`${species.id}:right`, rightTexture);
      const leftCanvas = this.world === 'sea' ? document.createElement('canvas') : undefined;
      const leftTexture = leftCanvas ? new THREE.CanvasTexture(leftCanvas) : undefined;
      if (leftCanvas && leftTexture) {
        leftCanvas.width = 512;
        leftCanvas.height = 512;
        leftTexture.colorSpace = THREE.SRGBColorSpace;
        this.textures.set(`${species.id}:left`, leftTexture);
      }
      const image = new Image();
      image.onload = () => {
        rightCanvas.getContext('2d')?.drawImage(image, 0, 0, 512, 512);
        rightTexture.needsUpdate = true;
        if (leftCanvas && leftTexture) {
          const context = leftCanvas.getContext('2d');
          context?.translate(512, 0);
          context?.scale(-1, 1);
          context?.drawImage(image, 0, 0, 512, 512);
          leftTexture.needsUpdate = true;
        }
      };
      image.src = animalAssetUrl(species.id);
    });
  }

  private resize(): void {
    const rect = this.element.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(this.width * dpr);
    this.overlay.height = Math.round(this.height * dpr);
    this.overlay.style.width = `${this.width}px`;
    this.overlay.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.camera.left = 0;
    this.camera.right = this.width;
    this.camera.top = this.height;
    this.camera.bottom = 0;
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.updateDecorPositions();
  }

  private makeDecor(): void {
    const isSea = this.world === 'sea';
    const palette = isSea ? [0xffffff, 0x91d4dc, 0xb8e0dd] : [0xffffff, 0xf7d98a, 0xa3d88e];
    for (let i = 0; i < 34; i++) {
      const material = new THREE.MeshBasicMaterial({ color: palette[i % palette.length], transparent: true, opacity: isSea ? random(0.12, 0.35) : random(0.22, 0.48), depthWrite: false });
      const geometry = new THREE.CircleGeometry(isSea ? random(3, 12) : random(2, 5), isSea ? 20 : 7);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { u: Math.random(), v: Math.random(), phase: Math.random() * 7, speed: random(0.006, 0.022), size: random(0.7, 1.6) };
      mesh.position.z = -5;
      this.scene.add(mesh);
      this.decor.push(mesh);
      if (!isSea && i < 15) {
        const flower = new THREE.Group();
        const x = Math.random(), y = Math.random();
        for (let p = 0; p < 5; p++) {
          const petal = new THREE.Mesh(new THREE.CircleGeometry(5.5, 12), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xffd9e6, transparent: true, opacity: 0.8 }));
          const a = p * Math.PI * 2 / 5;
          petal.position.set(Math.cos(a) * 6, Math.sin(a) * 6, 0);
          flower.add(petal);
        }
        flower.add(new THREE.Mesh(new THREE.CircleGeometry(4, 12), new THREE.MeshBasicMaterial({ color: 0xf4d477 })));
        flower.userData = { u: x, v: y, phase: random(0, 7) };
        flower.position.z = -4;
        this.scene.add(flower);
        this.decor.push(flower);
      }
    }
    if (isSea) {
      for (let i = 0; i < 10; i++) {
        const stalk = new THREE.Mesh(new THREE.PlaneGeometry(random(7, 14), random(45, 95)), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x75bdb0 : 0x4faea6, transparent: true, opacity: 0.38, side: THREE.DoubleSide }));
        stalk.userData = { u: (i + 0.5) / 10, v: 0.92, phase: i * 1.3 };
        stalk.position.z = -3;
        this.scene.add(stalk);
        this.decor.push(stalk);
      }
    }
    this.updateDecorPositions();
  }

  private updateDecorPositions(): void {
    for (const object of this.decor) object.position.set(object.userData.u * this.width, (1 - object.userData.v) * this.height, object.position.z);
  }

  private seedUnits(): void {
    const kinds = SPECIES.filter(species => species.world === this.world);
    const perKind = this.width < 550 ? 3 : this.width > 1500 ? 6 : 4;
    const roster = shuffle(kinds.flatMap(species => Array<Species>(perKind).fill(species)));
    const columns = this.width < 550 ? 3 : 5;
    const rows = Math.ceil(roster.length / columns);
    const cells: Point[] = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        cells.push({
          x: clamp((column + 0.5 + random(-0.22, 0.22)) / columns, 0.08, 0.92),
          y: clamp((row + 0.5 + random(-0.22, 0.22)) / rows, 0.1, 0.9),
        });
      }
    }
    for (const species of roster) {
      const same = this.units.filter(unit => unit.species.id === species.id);
      const index = same.length ? cells.reduce((best, cell, current) => {
        const distance = Math.min(...same.map(unit => Math.hypot((cell.x - unit.u) * this.width, (cell.y - unit.v) * this.height)));
        const bestCell = cells[best];
        const bestDistance = Math.min(...same.map(unit => Math.hypot((bestCell.x - unit.u) * this.width, (bestCell.y - unit.v) * this.height)));
        return distance > bestDistance ? current : best;
      }, 0) : Math.floor(Math.random() * cells.length);
      const [cell] = cells.splice(index, 1);
      this.addUnit(species, 0, cell.x, cell.y);
    }
  }

  private addUnit(species: Species, level: number, u: number, v: number): Unit {
    const angle = random(0, Math.PI * 2);
    const speed = this.travelSpeed(level);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const texture = this.textures.get(`${species.id}:${this.world === 'sea' && vx < 0 ? 'left' : 'right'}`);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }));
    sprite.position.z = 2 + level;
    this.scene.add(sprite);
    const unit = { id: this.nextUnitId++, species, level, u, v, vx, vy, turn: random(0, 7), mergePulse: 0, sprite };
    this.units.push(unit);
    return unit;
  }

  private travelSpeed(level: number): number {
    const mobile = this.width < 550;
    return random(mobile ? 75 : 95, mobile ? 120 : 150) / (1 + Math.min(level, 4) * 0.12);
  }

  private openPosition(): Point {
    let best = { x: random(0.1, 0.9), y: random(0.12, 0.88) };
    let bestDistance = -1;
    for (let i = 0; i < 24; i++) {
      const point = { x: random(0.1, 0.9), y: random(0.12, 0.88) };
      const nearest = Math.min(...this.units.map(unit => Math.hypot((point.x - unit.u) * this.width, (point.y - unit.v) * this.height)));
      if (nearest > bestDistance) { best = point; bestDistance = nearest; }
    }
    return best;
  }

  private unitSize(level: number): number {
    const base = clamp(Math.min(this.width, this.height) * 0.108, 44, 90);
    return Math.min(base * (1 + level * 0.35), Math.min(this.width, this.height) * 0.36, 230);
  }

  private positionFromEvent(event: PointerEvent): Point {
    const rect = this.overlay.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private pointerDown = (event: PointerEvent): void => {
    if (!this.running) return;
    event.preventDefault();
    this.overlay.setPointerCapture(event.pointerId);
    const color = PLAYER_COLORS[Math.abs(event.pointerId) % PLAYER_COLORS.length];
    this.strokes.set(event.pointerId, { points: [this.positionFromEvent(event)], color });
  };

  private pointerMove = (event: PointerEvent): void => {
    const stroke = this.strokes.get(event.pointerId);
    if (!stroke) return;
    event.preventDefault();
    const point = this.positionFromEvent(event);
    const last = stroke.points[stroke.points.length - 1];
    if (Math.hypot(point.x - last.x, point.y - last.y) > 3) stroke.points.push(point);
  };

  private pointerUp = (event: PointerEvent): void => {
    const stroke = this.strokes.get(event.pointerId);
    if (!stroke) return;
    event.preventDefault();
    stroke.points.push(this.positionFromEvent(event));
    this.strokes.delete(event.pointerId);
    if (stroke.points.length > 7 && polygonArea(stroke.points) > 600) this.resolveLoop(stroke);
  };

  private pointerCancel = (event: PointerEvent): void => { this.strokes.delete(event.pointerId); };

  private resolveLoop(stroke: Stroke): void {
    const coverage = this.units.map(unit => {
      const radius = this.unitSize(unit.level) * 0.37;
      return { unit, fraction: discCoverage(stroke.points, unit.u * this.width, unit.v * this.height, radius) };
    });
    const eligible = coverage.filter(item => item.fraction >= 0.03);
    const bySpecies = new Map<string, Unit[]>();
    for (const item of eligible) {
      const list = bySpecies.get(item.unit.species.id) || [];
      list.push(item.unit);
      bySpecies.set(item.unit.species.id, list);
    }
    const candidates = [...bySpecies.entries()].filter(([, units]) => units.length >= 2);
    if (!candidates.length) {
      this.events.onHint('같은 동물 둘 이상을 동그라미 안에 넣어봐!');
      return;
    }
    const [speciesId] = candidates.sort((a, b) => b[1].length - a[1].length)[0];
    const blockers = coverage.filter(item => item.unit.species.id !== speciesId && item.fraction >= 0.5);
    const center = stroke.points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
    center.x /= stroke.points.length;
    center.y /= stroke.points.length;
    if (blockers.length) {
      this.addPop(center.x, center.y, '다른 동물이 있어요!', '#e86876');
      this.events.onHint('다른 동물이 절반 이상 들어오지 않게 둘러봐!');
      return;
    }
    const selected = bySpecies.get(speciesId) || [];
    const highest = selected.reduce((best, unit) => unit.level > best.level ? unit : best);
    const resultLevel = Math.min(MAX_LEVEL, highest.level + Math.floor(Math.log2(selected.length)));
    const growthBonus = resultLevel > highest.level
      ? POINTS[resultLevel - 1] * (selected.length - 1)
      : selected.filter(unit => unit !== highest && unit.level === MAX_LEVEL).length * POINTS[MAX_LEVEL];
    const gained = selected.reduce((sum, unit) => sum + (unit === highest ? 0 : POINTS[unit.level]), growthBonus);
    const x = selected.reduce((sum, unit) => sum + unit.u, 0) / selected.length;
    const y = selected.reduce((sum, unit) => sum + unit.v, 0) / selected.length;
    for (const unit of selected) this.removeUnit(unit);
    const merged = this.addUnit(highest.species, resultLevel, x, y);
    merged.mergePulse = this.reducedMotion ? 0 : 0.62;
    this.score += gained;
    this.events.onScore(this.score, gained);
    this.events.onMerge(resultLevel);
    this.burst(x * this.width, y * this.height, highest.species.accent, resultLevel, selected.length);
    this.addPop(x * this.width, y * this.height, `+${gained}`, stroke.color);
  }

  private removeUnit(unit: Unit): void {
    this.scene.remove(unit.sprite);
    this.units.splice(this.units.indexOf(unit), 1);
    (unit.sprite.material as THREE.SpriteMaterial).dispose();
  }

  private addPop(x: number, y: number, label: string, color: string): void { this.pops.push({ x, y, label, color, life: 1.1 }); }

  private burst(x: number, y: number, color: string, level: number, mergedCount: number): void {
    const count = this.reducedMotion ? 8 : Math.min(38, 18 + level * 4 + mergedCount * 2);
    const colors = [color, '#fffdf1', '#ffd54d'];
    const startRadius = this.unitSize(level) * 0.52;
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 2 * i / count + random(-0.16, 0.16);
      const speed = random(80, 155 + Math.min(level, 4) * 18);
      const life = random(0.42, 0.75);
      this.sparks.push({ x: x + Math.cos(a) * startRadius, y: y + Math.sin(a) * startRadius, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, color: colors[i % colors.length], radius: random(3, 6.5), star: i % 3 === 0 });
    }
    if (!this.reducedMotion) {
      this.ripples.push({ x, y, life: 0.44, maxLife: 0.44, radius: 60 + Math.min(level, 4) * 13, color: '#fffdf1' });
      this.ripples.push({ x, y, life: 0.58, maxLife: 0.58, radius: 88 + Math.min(level, 4) * 17, color });
    }
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    const previousSeconds = Math.ceil(this.remaining);
    this.remaining = Math.max(0, (this.endsAt - now) / 1000);
    const seconds = Math.ceil(this.remaining);
    if (seconds !== previousSeconds) this.events.onTime(seconds);
    this.updateUnits(dt, now);
    this.updateDecor(dt, now);
    this.drawOverlay(dt);
    this.renderer.render(this.scene, this.camera);
    this.lastSpawn += dt;
    const target = this.width < 550 ? 15 : this.width > 1500 ? 30 : 20;
    const cap = this.width < 550 ? 19 : this.width > 1500 ? 36 : 27;
    if (this.lastSpawn > 1.3 && this.units.length < target && this.units.length < cap) {
      this.lastSpawn = 0;
      const species = SPECIES.filter(item => item.world === this.world);
      const chosen = species[Math.floor(Math.random() * species.length)];
      const point = this.openPosition();
      this.addUnit(chosen, 0, point.x, point.y);
    }
    if (this.remaining <= 0) {
      this.running = false;
      this.events.onFinish(this.score);
      return;
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private updateUnits(dt: number, now: number): void {
    for (const unit of this.units) {
      const angle = Math.sin(now * 0.002 + unit.turn) * dt * 0.36;
      const vx = unit.vx * Math.cos(angle) - unit.vy * Math.sin(angle);
      unit.vy = unit.vx * Math.sin(angle) + unit.vy * Math.cos(angle);
      unit.vx = vx;
      unit.u += unit.vx * dt / this.width;
      unit.v += unit.vy * dt / this.height;
      const marginX = this.unitSize(unit.level) * 0.42 / this.width;
      const marginY = this.unitSize(unit.level) * 0.42 / this.height;
      let bounced = false;
      if (unit.u < marginX || unit.u > 1 - marginX) { unit.vx *= -1; unit.u = clamp(unit.u, marginX, 1 - marginX); bounced = true; }
      if (unit.v < marginY || unit.v > 1 - marginY) { unit.vy *= -1; unit.v = clamp(unit.v, marginY, 1 - marginY); bounced = true; }
      if (bounced) {
        const oldSpeed = Math.hypot(unit.vx, unit.vy);
        const nextSpeed = this.travelSpeed(unit.level);
        unit.vx = unit.vx / oldSpeed * nextSpeed;
        unit.vy = unit.vy / oldSpeed * nextSpeed;
      }
      const bob = Math.sin(now * 0.003 + unit.turn) * (this.world === 'sea' ? 3 : 1.5);
      unit.sprite.position.set(unit.u * this.width, (1 - unit.v) * this.height - bob, 2 + unit.level);
      const size = this.unitSize(unit.level);
      let scaleX = size;
      let scaleY = size;
      if (unit.mergePulse > 0) {
        unit.mergePulse = Math.max(0, unit.mergePulse - dt);
        const progress = 1 - unit.mergePulse / 0.62;
        const bounce = 0.42 * Math.exp(-4 * progress) * Math.sin(3 * Math.PI * progress);
        const wobble = 0.08 * Math.exp(-5 * progress) * Math.sin(5 * Math.PI * progress);
        scaleX *= 1 + bounce + wobble;
        scaleY *= 1 + bounce - wobble;
      }
      unit.sprite.scale.set(scaleX, scaleY, 1);
      const heading = Math.atan2(-unit.vy, unit.vx);
      const material = unit.sprite.material as THREE.SpriteMaterial;
      if (this.world === 'sea') {
        const facingLeft = unit.vx < 0;
        material.map = this.textures.get(`${unit.species.id}:${facingLeft ? 'left' : 'right'}`) || null;
        material.rotation = heading - (facingLeft ? Math.PI : 0);
      } else {
        material.rotation = heading - Math.PI / 2;
      }
    }
  }

  private updateDecor(dt: number, now: number): void {
    for (const object of this.decor) {
      const data = object.userData;
      if (this.world === 'sea' && object instanceof THREE.Mesh && object.geometry instanceof THREE.CircleGeometry) {
        data.v -= data.speed * dt;
        if (data.v < -0.04) data.v = 1.04;
        object.position.y = (1 - data.v) * this.height;
      }
      object.rotation.z = Math.sin(now * 0.001 + data.phase) * (this.world === 'sea' ? 0.08 : 0.04);
    }
  }

  private drawOverlay(dt: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    for (const stroke of this.strokes.values()) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (const point of stroke.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
      const first = stroke.points[0];
      ctx.beginPath();
      ctx.arc(first.x, first.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    this.ripples = this.ripples.filter(ripple => ripple.life > 0);
    for (const ripple of this.ripples) {
      ripple.life -= dt;
      const progress = 1 - Math.max(0, ripple.life) / ripple.maxLife;
      ctx.globalAlpha = (1 - progress) * 0.82;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, 12 + ripple.radius * progress, 0, Math.PI * 2);
      ctx.strokeStyle = ripple.color;
      ctx.lineWidth = 6 * (1 - progress) + 1;
      ctx.shadowColor = ripple.color;
      ctx.shadowBlur = 12;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    this.sparks = this.sparks.filter(spark => spark.life > 0);
    for (const spark of this.sparks) {
      spark.life -= dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      spark.vx *= 1 - dt * 2;
      spark.vy *= 1 - dt * 2;
      ctx.globalAlpha = clamp(spark.life / spark.maxLife, 0, 1);
      ctx.beginPath();
      if (spark.star) {
        const r = spark.radius * 1.4;
        ctx.moveTo(spark.x, spark.y - r);
        ctx.lineTo(spark.x + r * 0.25, spark.y - r * 0.25);
        ctx.lineTo(spark.x + r, spark.y);
        ctx.lineTo(spark.x + r * 0.25, spark.y + r * 0.25);
        ctx.lineTo(spark.x, spark.y + r);
        ctx.lineTo(spark.x - r * 0.25, spark.y + r * 0.25);
        ctx.lineTo(spark.x - r, spark.y);
        ctx.lineTo(spark.x - r * 0.25, spark.y - r * 0.25);
        ctx.closePath();
      } else {
        ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
      }
      ctx.fillStyle = spark.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.pops = this.pops.filter(pop => pop.life > 0);
    for (const pop of this.pops) {
      pop.life -= dt;
      pop.y -= dt * 33;
      ctx.globalAlpha = clamp(pop.life / 0.6, 0, 1);
      ctx.font = `900 ${pop.label.startsWith('+') ? 30 : 17}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(pop.label, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.label, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }
}
