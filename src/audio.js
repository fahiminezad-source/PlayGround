export class GameAudio {
  constructor() {
    this.ctx = null
    this.master = null
    this.enabled = true
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.enabled ? 0.16 : 0
    this.master.connect(this.ctx.destination)
  }

  setEnabled(enabled) {
    this.enabled = enabled
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(enabled ? 0.16 : 0, this.ctx.currentTime, 0.02)
    }
  }

  tone(freq, duration = 0.08, type = 'square', volume = 0.5, slide = 1, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + duration)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + duration + 0.02)
  }

  noise(duration = 0.1, volume = 0.4, cutoff = 900, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const length = Math.max(1, (this.ctx.sampleRate * duration) | 0)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(t)
  }

  move() { this.tone(240, 0.035, 'square', 0.16) }
  rotate() { this.tone(390, 0.045, 'square', 0.2) }
  hold() { this.tone(520, 0.07, 'triangle', 0.25, 1.4) }
  lock() {
    this.noise(0.08, 0.35, 700)
    this.tone(90, 0.09, 'sine', 0.5, 0.7)
  }
  hardDrop() {
    this.noise(0.13, 0.5, 500)
    this.tone(70, 0.14, 'sine', 0.6, 0.6)
  }
  clear(count = 1) {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    for (let i = 0; i < Math.min(4, count + 1); i++) {
      this.tone(notes[i], 0.13, 'triangle', 0.34, 1, i * 0.065)
    }
  }
  build() {
    this.tone(880 + Math.random() * 110, 0.06, 'triangle', 0.16, 1.03)
  }
  start() {
    const notes = [392, 523.25, 659.25, 783.99]
    notes.forEach((n, i) => this.tone(n, 0.16, 'triangle', 0.32, 1.02, i * 0.085))
  }
  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1046.5, 1318.5, 1568]
    notes.forEach((n, i) => {
      this.tone(n, 0.24, 'triangle', 0.33, 1.02, i * 0.11)
      this.tone(n / 2, 0.24, 'sine', 0.16, 1.02, i * 0.11)
    })
  }
  lose() {
    const notes = [392, 349.23, 293.66, 246.94, 196]
    notes.forEach((n, i) => this.tone(n, 0.2, 'sawtooth', 0.2, 0.96, i * 0.12))
  }
}
