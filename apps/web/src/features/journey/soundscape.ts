export type JourneySound = "tap" | "listen" | "bloom" | "branch" | "choose" | "undo";

const STORAGE_KEY = "maybe-sound-enabled";
const CHORDS = [
  [293.66, 369.99, 440, 659.25],
  [196, 246.94, 293.66, 440],
  [220, 277.18, 329.63, 493.88],
  [293.66, 369.99, 440, 587.33],
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
        tap: [[587.33, 0, 0.12]],
        listen: [[440, 0, 0.25], [587.33, 0.1, 0.34]],
        bloom: [[659.25, 0, 0.32]],
        branch: [[587.33, 0, 0.34], [739.99, 0.12, 0.38], [880, 0.24, 0.46]],
        choose: [[739.99, 0, 0.24], [1174.66, 0.1, 0.42]],
        undo: [[880, 0, 0.2], [587.33, 0.1, 0.34]],
      };
      notes[kind].forEach(([frequency, delay, duration], index) => {
        this.chime(frequency, now + delay, duration, index === 0 ? 0.036 : 0.026);
      });
    });
  }

  private createGraph() {
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.musicBus = this.context.createGain();
    this.effectsBus = this.context.createGain();
    this.master.gain.value = 0.72;
    this.musicBus.gain.value = 0.14;
    this.effectsBus.gain.value = 0.34;
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
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      filter.type = "lowpass";
      filter.frequency.value = 1_400;
      filter.Q.value = 0.25;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.04 : 0.026, now + 2.2);
      gain.gain.setValueAtTime(index === 0 ? 0.04 : 0.026, now + 4.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 8.8);
      oscillator.connect(filter).connect(gain).connect(this.musicBus!);
      oscillator.start(now);
      oscillator.stop(now + 9);
    });
    const upperNotes = chord.map((frequency) => frequency * 2);
    this.ambientNote(upperNotes[0], now + 0.9);
    this.ambientNote(upperNotes[2], now + 3.4);
    this.ambientNote(upperNotes[1], now + 6.1);
  }

  private ambientNote(frequency: number, start: number) {
    if (!this.context || !this.musicBus) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.7);
    oscillator.connect(gain).connect(this.musicBus);
    oscillator.start(start);
    oscillator.stop(start + 1.75);
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
    overtone.frequency.value = frequency * 2;
    overtoneGain.gain.value = 0.08;
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
