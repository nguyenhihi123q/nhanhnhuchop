// Quản lý âm thanh bằng Web Audio API — không dùng asset ngoài.
// Chỉ một vòng nhạc nền chạy tại một thời điểm; có fade và duck khi có hiệu ứng.
import type { Prefs } from '../prefs';

type Voice = { stop: (when?: number) => void };

export type SoundName =
  | 'countdown'
  | 'start'
  | 'correct'
  | 'wrong'
  | 'lastSeconds'
  | 'timeUp'
  | 'win';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicVoices: Voice[] = [];
  private musicTimer: number | null = null;
  private prefs: Prefs;
  private lastTickSecond = -1;
  private blockedNotified = false;
  private onBlocked?: () => void;

  constructor(prefs: Prefs) {
    this.prefs = prefs;
  }

  setPrefs(prefs: Prefs): void {
    this.prefs = prefs;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.effectiveMusicVolume(), this.ctx.currentTime, 0.05);
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.effectiveSfxVolume(), this.ctx.currentTime, 0.02);
    }
    if (!this.hasMusicEnabled() && this.musicVoices.length > 0) this.stopMusic();
  }

  onAutoplayBlocked(cb: () => void): void {
    this.onBlocked = cb;
  }

  private hasMusicEnabled(): boolean {
    return this.prefs.soundEnabled && this.prefs.musicEnabled;
  }

  private hasSfxEnabled(): boolean {
    return this.prefs.soundEnabled;
  }

  private effectiveMusicVolume(): number {
    return this.prefs.musicVolume;
  }

  private effectiveSfxVolume(): number {
    return this.prefs.sfxVolume;
  }

  /** Khởi tạo AudioContext từ hành động người dùng. */
  async ensureContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') return null;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 1;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.effectiveMusicVolume();
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.effectiveSfxVolume();
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        this.notifyBlocked();
      }
    }
    return this.ctx;
  }

  private notifyBlocked(): void {
    if (!this.blockedNotified && this.onBlocked) {
      this.blockedNotified = true;
      this.onBlocked();
    }
  }

  private tone(
    freq: number,
    startOffset: number,
    duration: number,
    gain: number,
    type: OscillatorType,
    target: GainNode,
    ctx: AudioContext,
  ): Voice {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
    const start = ctx.currentTime + startOffset;
    const end = start + duration;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g);
    g.connect(target);
    osc.start(start);
    osc.stop(end + 0.02);
    return {
      stop: (when?: number) => {
        try {
          g.gain.cancelScheduledValues(ctx.currentTime);
          g.gain.setValueAtTime(0.0001, when ?? ctx.currentTime);
          osc.stop((when ?? ctx.currentTime) + 0.03);
        } catch {
          // Bỏ qua nếu đã dừng.
        }
      },
    };
  }

  async play(name: SoundName): Promise<void> {
    if (!this.hasSfxEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const g = this.sfxGain;
    switch (name) {
      case 'countdown':
        this.tone(600, 0, 0.18, 0.5, 'triangle', g, ctx);
        break;
      case 'start':
        this.tone(880, 0, 0.18, 0.5, 'square', g, ctx);
        break;
      case 'correct':
        this.tone(660, 0, 0.16, 0.5, 'sine', g, ctx);
        this.tone(990, 0.12, 0.22, 0.5, 'sine', g, ctx);
        this.duckMusic();
        break;
      case 'wrong':
        this.tone(220, 0, 0.32, 0.4, 'sine', g, ctx);
        this.duckMusic();
        break;
      case 'lastSeconds':
        this.tone(1046, 0, 0.08, 0.35, 'triangle', g, ctx);
        break;
      case 'timeUp':
        this.tone(440, 0, 0.2, 0.5, 'sawtooth', g, ctx);
        this.tone(330, 0.18, 0.3, 0.5, 'sawtooth', g, ctx);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => {
          this.tone(f, i * 0.16, 0.32, 0.5, 'triangle', g, ctx);
        });
        break;
    }
  }

  /** Nhạc nền nhịp vừa, âm lượng thấp; tự lặp và fade khi dừng. */
  async startMusic(): Promise<void> {
    if (!this.hasMusicEnabled()) return;
    const ctx = await this.ensureContext();
    if (!ctx || !this.musicGain) return;
    if (this.musicVoices.length > 0) return;
    const melody = [392, 523, 466, 587, 392, 523, 440, 587];
    const schedulePattern = () => {
      if (!this.ctx || !this.musicGain) return;
      this.musicVoices = melody.map((freq, i) =>
        this.tone(freq, i * 0.4, 0.36, 0.28, 'triangle', this.musicGain!, this.ctx!),
      );
    };
    schedulePattern();
    this.musicTimer = window.setInterval(schedulePattern, melody.length * 400);
  }

  stopMusic(): void {
    if (this.musicTimer != null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    const voices = this.musicVoices;
    this.musicVoices = [];
    for (const v of voices) v.stop();
  }

  /** Giảm nhạc tạm thời khi có hiệu ứng để không chồng âm. */
  duckMusic(): void {
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(
      this.effectiveMusicVolume() * 0.35,
      this.ctx.currentTime,
      0.03,
    );
    window.setTimeout(() => {
      if (this.ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(this.effectiveMusicVolume(), this.ctx.currentTime, 0.2);
      }
    }, 260);
  }

  /** Tick cho 10 giây cuối; gọi với số giây còn lại (tránh lặp cùng giây). */
  tick(remainingSecond: number): void {
    if (remainingSecond === this.lastTickSecond) return;
    this.lastTickSecond = remainingSecond;
    void this.play('lastSeconds');
  }

  resetTicks(): void {
    this.lastTickSecond = -1;
  }

  dispose(): void {
    this.stopMusic();
    this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }
}

