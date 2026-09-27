export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicTimer?: number;
  private step = 0;
  private muted = localStorage.getItem('animal-loop-muted') === 'true';

  get isMuted(): boolean { return this.muted; }

  async start(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.16;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.musicTimer) return;
    this.playMusicStep();
    this.musicTimer = window.setInterval(() => this.playMusicStep(), 310);
  }

  stop(): void {
    if (this.musicTimer) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('animal-loop-muted', String(this.muted));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.16, this.context.currentTime, 0.05);
    return this.muted;
  }

  merge(level: number): void {
    if (!this.context || !this.master || this.muted) return;
    const now = this.context.currentTime;
    const notes = level >= 3 ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => this.tone(frequency, now + index * 0.075, 0.24, 0.21, 'sine'));
  }

  finish(): void {
    this.stop();
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    [392, 493.88, 587.33, 783.99].forEach((frequency, index) => this.tone(frequency, now + index * 0.11, 0.32, 0.17, 'sine'));
  }

  private playMusicStep(): void {
    if (!this.context || this.muted) { this.step++; return; }
    const beat = this.step++ % 16;
    const root = [261.63, 293.66, 329.63, 293.66][Math.floor(this.step / 16) % 4];
    const notes = [0, 7, 12, 7, 4, 7, 12, 7, 0, 7, 12, 7, 5, 9, 12, 9];
    const frequency = root * Math.pow(2, notes[beat] / 12);
    this.tone(frequency, this.context.currentTime, 0.2, beat % 4 === 0 ? 0.075 : 0.045, 'sine');
    if (beat % 4 === 0) this.tone(root / 2, this.context.currentTime, 0.25, 0.055, 'triangle');
  }

  private tone(frequency: number, at: number, duration: number, volume: number, shape: OscillatorType): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }
}
