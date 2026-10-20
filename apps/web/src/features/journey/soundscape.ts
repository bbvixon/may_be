export type JourneySound = "tap" | "listen" | "bloom" | "branch" | "choose" | "undo";

const STORAGE_KEY = "maybe-sound-enabled";
const CHORDS = [
  [146.83, 220, 293.66, 369.99],
  [123.47, 185, 246.94, 329.63],
  [164.81, 220, 277.18, 369.99],
  [110, 164.81, 246.94, 293.66],
];

class Soundscape {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private chordTimer = 0;
  private chordIndex = 0;
  private started = false;
  enabled = this.readPreference();

  private readPreference() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  }

  async start() {
    if (!this.enabled) return;
    if (!this.context) this.createGraph();
    if (this.context?.state === "suspended") await this.context.resume();
    if (this.started || !this.context) return;
    this.started = true;
    this.schedulePad();
    this.chordTimer = window.setInterval(() => this.schedulePad(), 8_000);
  }

  async toggle() {
    this.enabled = !this.enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, this.enabled ? "on" : "off");
    } catch {
      // Audio preference is non-essential when storage is unavailable.
    }
    if (this.enabled) {
      if (this.master && this.context) {
        this.master.gain.cancelScheduledValues(this.context.currentTime);
        this.master.gain.setTargetAtTime(0.72, this.context.currentTime, 0.35);
      }
      await this.start();
    } else if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(0.0001, this.context.currentTime, 0.18);
    }
    return this.enabled;
  }

  play(kind: JourneySound) {
    if (!this.enabled) return;
    void this.start().then(() => {
      if (!this.context || !this.effectsBus) return;
      const now = this.context.currentTime;
      const notes: Record<JourneySound, Array<[number, number, number]>> = {
        tap: [[440, 0, 0.16]],
        listen: [[293.66, 0, 0.35], [440, 0.08, 0.42]],
        bloom: [[369.99, 0, 0.55]],
        branch: [[293.66, 0, 0.65], [369.99, 0.12, 0.7], [440, 0.24, 0.8]],
        choose: [[369.99, 0, 0.3], [554.37, 0.1, 0.65]],
        undo: [[440, 0, 0.3], [293.66, 0.1, 0.55]],
      };
      notes[kind].forEach(([frequency, delay, duration], index) => {
        this.chime(frequency, now + delay, duration, index === 0 ? 0.052 : 0.038);
      });
    });
  }

  private createGraph() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.master.gain.value = 0.72;
    this.musicBus.gain.value = 0.055;
    this.effectsBus.gain.value = 0.42;
    this.musicBus.connect(this.master);
    this.effectsBus.connect(this.master);
    this.master.connect(this.context.destination);
  }

  private schedulePad() {
    if (!this.context || !this.musicBus || !this.enabled) return;
    const now = this.context.currentTime;
    const chord = CHORDS[this.chordIndex % CHORDS.length];
    this.chordIndex += 1;
    chord.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const filter = this.context!.createBiquadFilter();
      oscillator.type = index % 2 === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index % 2 === 0 ? -3 : 3;
      filter.type = "lowpass";
      filter.frequency.value = 720;
      filter.Q.value = 0.45;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.22 : 0.13, now + 2.6);
      gain.gain.setValueAtTime(index === 0 ? 0.22 : 0.13, now + 5.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 9.8);
      oscillator.connect(filter).connect(gain).connect(this.musicBus!);
      oscillator.start(now);
      oscillator.stop(now + 10);
    });
  }

  private chime(frequency: number, start: number, duration: number, volume: number) {
    if (!this.context || !this.effectsBus) return;
    const oscillator = this.context.createOscillator();
    const overtone = this.context.createOscillator();
    const gain = this.context.createGain();
    const overtoneGain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    overtone.type = "sine";
    overtone.frequency.value = frequency * 2.01;
    overtoneGain.gain.value = 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    overtone.connect(overtoneGain).connect(gain);
    gain.connect(this.effectsBus);
    oscillator.start(start);
    overtone.start(start);
    oscillator.stop(start + duration + 0.02);
    overtone.stop(start + duration + 0.02);
  }
}

export const journeySoundscape = new Soundscape();
