/**
 * Retro Synth Sound Effects Controller using the Web Audio API.
 * Synthesizes retro sounds in real-time without external assets.
 */
const AudioController = {
  ctx: null,
  enabled: false,
  engineOsc: null,
  engineGain: null,
  alarmInterval: null,
  alarmOsc1: null,
  alarmOsc2: null,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  },

  toggleSound() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = !this.enabled;
    return this.enabled;
  },

  // Helper to create basic synth envelopes
  createOscillator(type, freq, duration, gainStart = 0.2) {
    if (!this.enabled || !this.ctx) return null;
    
    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
    
    return { osc, gainNode };
  },

  // Standard UI Beep (Click or Select)
  playBeep(type = 'click') {
    if (!this.enabled || !this.ctx) return;
    
    if (type === 'click') {
      this.createOscillator('triangle', 600, 0.08, 0.15);
    } else if (type === 'hover') {
      this.createOscillator('sine', 800, 0.04, 0.08);
    } else if (type === 'error') {
      const synth = this.createOscillator('sawtooth', 120, 0.25, 0.25);
      if (synth) {
        synth.osc.frequency.linearRampToValueAtTime(80, this.ctx.currentTime + 0.25);
      }
    } else if (type === 'success') {
      this.createOscillator('sine', 523.25, 0.1, 0.15); // C5
      setTimeout(() => {
        this.createOscillator('sine', 659.25, 0.1, 0.15); // E5
      }, 80);
      setTimeout(() => {
        this.createOscillator('sine', 783.99, 0.18, 0.15); // G5
      }, 160);
    } else if (type === 'powerup') {
      // Reward flourish for salvage, artefact recovery, tech installs, beacon
      // rescues and warp displacement. There was no 'powerup' branch at all, so
      // all nine call sites fell through this chain and played SILENCE - the
      // game's most rewarding moments were the only ones with no sound.
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const synth = this.createOscillator('triangle', freq, i === 3 ? 0.32 : 0.12, 0.16);
          if (synth && i === 3) {
            // Final note blooms upward to land the "reward" feeling
            synth.osc.frequency.linearRampToValueAtTime(freq * 1.02, this.ctx.currentTime + 0.3);
          }
        }, i * 70);
      });
    }
  },

  // Scanning sound (pitch sweep)
  playScan() {
    if (!this.enabled || !this.ctx) return;
    const duration = 0.6;
    const synth = this.createOscillator('sine', 1200, duration, 0.2);
    if (synth) {
      // Sweeps from 1200Hz down to 200Hz
      synth.osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + duration);
    }
  },

  // Standard Blaster Weapon sound (Laser)
  playLaser() {
    if (!this.enabled || !this.ctx) return;
    const duration = 0.22;
    // Classic pitch slide down
    const synth = this.createOscillator('sawtooth', 900, duration, 0.2);
    if (synth) {
      synth.osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);
    }
  },

  // Missile Launch (sweeping noise)
  playMissile() {
    if (!this.enabled || !this.ctx) return;
    try {
      const duration = 0.7;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Fill buffer with white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      const filterNode = this.ctx.createBiquadFilter();
      filterNode.type = 'bandpass';
      // Sweep filter frequency upwards
      filterNode.frequency.setValueAtTime(150, this.ctx.currentTime);
      filterNode.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + duration);
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      
      noiseNode.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      noiseNode.start();
    } catch (e) {
      // Fallback if buffer creation fails
      const synth = this.createOscillator('sawtooth', 150, 0.5, 0.3);
      if (synth) {
        synth.osc.frequency.exponentialRampToValueAtTime(1500, this.ctx.currentTime + 0.5);
      }
    }
  },

  // Explosion sound (filtered noise)
  playExplosion() {
    if (!this.enabled || !this.ctx) return;
    try {
      const duration = 1.2;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = buffer;
      
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(400, this.ctx.currentTime);
      lowpass.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);
      
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      
      noiseSource.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(this.ctx.destination);
      
      noiseSource.start();
    } catch (e) {
      // Fallback
      const synth = this.createOscillator('sawtooth', 120, 0.8, 0.4);
      if (synth) {
        synth.osc.frequency.linearRampToValueAtTime(20, this.ctx.currentTime + 0.8);
      }
    }
  },

  // Continuous engine hum for space navigation
  startEngine() {
    if (!this.enabled || !this.ctx || this.engineOsc) return;

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
    } catch (e) {
      console.warn("Failed to start engine hum", e);
    }
  },

  updateEnginePitch(speedRatio) {
    if (!this.enabled || !this.ctx || !this.engineOsc || this.ctx.state === 'suspended') return;
    // Map speed ratio to engine frequency (55Hz - 110Hz) and gain
    const freq = 55 + (speedRatio * 55);
    const volume = 0.02 + (speedRatio * 0.05);
    
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.1);
  },

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    this.engineGain = null;
  },

  // Alarm siren (e.g. low shield alert)
  startAlarm() {
    if (!this.enabled || !this.ctx || this.alarmInterval) return;

    let toggle = false;
    this.alarmInterval = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      
      const pitch = toggle ? 440 : 330;
      this.createOscillator('sawtooth', pitch, 0.25, 0.1);
      toggle = !toggle;
    }, 300);
  },

  playAlarm() {
    this.startAlarm();
  },

  stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  },

  // Small victory fanfare
  playVictory() {
    if (!this.enabled || !this.ctx) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, index) => {
      setTimeout(() => {
        this.createOscillator('sine', freq, 0.22, 0.15);
      }, index * 120);
    });
  },

  // Game over/defeat theme
  playDefeat() {
    if (!this.enabled || !this.ctx) return;
    const notes = [392.00, 369.99, 349.23, 293.66, 220.00]; // G4, F#4, F4, D4, A3
    notes.forEach((freq, index) => {
      setTimeout(() => {
        const synth = this.createOscillator('sawtooth', freq, 0.5, 0.25);
        if (synth) {
          synth.osc.frequency.linearRampToValueAtTime(freq - 40, this.ctx.currentTime + 0.5);
        }
      }, index * 300);
    });
  }
};
window.AudioController = AudioController;
