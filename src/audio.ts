export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private musicTimer?: number;
  private step = 0;
  private muted = localStorage.getItem('animal-loop-muted') === 'true';

  get isMuted(): boolean { return this.muted; }

  async start(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.24;
      this.master.connect(this.context.destination);
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = 0.42;
      this.musicBus.connect(this.master);
      this.effectsBus = this.context.createGain();
      this.effectsBus.gain.value = 0.9;
      this.effectsBus.connect(this.master);
    }
    await this.context.resume();
    if (this.musicTimer) return;
    this.playMusicStep();
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 280);
  }

  stop(): void {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.step = 0;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('animal-loop-muted', String(this.muted));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.24, this.context.currentTime, 0.05);
    return this.muted;
  }

  merge(level: number): void {
    if (!this.context || !this.effectsBus || this.muted) return;
    const now = this.context.currentTime;
    this.pop(now);
    const notes = level >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => this.tone(frequency, now + 0.05 + index * 0.065, 0.2, 0.18, 'sine', this.effectsBus!));
  }

  finish(): void {
    this.stop();
    if (!this.context || !this.effectsBus || this.muted) return;
    const now = this.context.currentTime;
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => this.tone(frequency, now + index * 0.11, 0.32, 0.15, 'sine', this.effectsBus!));
  }

  private playMusicStep(): void {
    if (!this.context || !this.musicBus || this.muted) { this.step++; return; }
    const beat = this.step++ % 32;
    const melody: Array<number | null> = [0, null, 4, 7, null, 4, 2, null, 5, null, 9, 7, null, 5, 4, null, 7, null, 11, 12, null, 9, 7, null, 4, null, 7, 5, null, 2, 0, null];
    const note = melody[beat];
    const now = this.context.currentTime;
    if (note !== null) this.tone(261.63 * Math.pow(2, note / 12), now, 0.21, beat % 8 === 0 ? 0.12 : 0.095, 'triangle', this.musicBus);
    if (beat % 8 === 0) this.tone([130.81, 174.61, 196, 130.81][beat / 8], now, 0.5, 0.075, 'sine', this.musicBus);
  }

  private pop(at: number): void {
    if (!this.context || !this.effectsBus) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(330, at);
    oscillator.frequency.exponentialRampToValueAtTime(660, at + 0.11);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.17, at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    oscillator.connect(gain);
    gain.connect(this.effectsBus);
    oscillator.start(at);
    oscillator.stop(at + 0.17);
  }

  private tone(frequency: number, at: number, duration: number, volume: number, shape: OscillatorType, destination: GainNode): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), at + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }
}
