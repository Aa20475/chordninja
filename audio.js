// Web Audio API DSP Engine for ChordNinja
import { CHORDS, calculateChordSimilarity } from './chords.js';

export class AudioEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.stream = null;
    this.isInitialized = false;
    this.fftSize = 4096; // 4096 bins gives ~10.7Hz resolution at 44.1kHz (good for guitar registers)
    
    // Sensitivity thresholds
    this.rmsThreshold = 0.015; // Minimum volume level to register guitar playing (1.5% amplitude)
    this.chromaThreshold = 0.05; // Minimum peak strength in chroma to count

    // Detection lockout when playing reference audio sample
    this.isSamplePlaying = false;
    this.samplePlayTimeout = null;
  }

  async init() {
    if (this.isInitialized) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.6; // Moderate smoothing to stabilize detection

      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("Error initializing Audio Engine:", error);
      throw error;
    }
  }

  setSensitivity(thresholdPercent) {
    // Expects value between 0 and 100
    // Maps to RMS range of 0.005 to 0.1
    this.rmsThreshold = 0.005 + (thresholdPercent / 100) * 0.095;
  }

  getAudioState(activeChordKeys = null, wasActive = false) {
    if (!this.isInitialized || !this.analyser) {
      return {
        active: false,
        rms: 0,
        chroma: new Array(12).fill(0),
        detectedChord: null,
        confidence: 0,
        frequencies: []
      };
    }

    const bufferLength = this.analyser.frequencyBinCount;
    const freqData = new Float32Array(bufferLength);
    const timeData = new Float32Array(this.analyser.fftSize);

    this.analyser.getFloatFrequencyData(freqData);
    this.analyser.getFloatTimeDomainData(timeData);

    // 1. Calculate RMS volume
    let sumSquares = 0;
    for (let i = 0; i < timeData.length; i++) {
      sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / timeData.length);

    const chroma = new Array(12).fill(0);
    const sampleRate = this.audioContext.sampleRate;

    // Hysteresis noise gate: lower threshold if already matching to allow decay sustain
    const gateThreshold = wasActive ? (this.rmsThreshold * 0.55) : this.rmsThreshold;

    // If signal is below noise threshold or a reference sample is playing, return silent state
    if (rms < gateThreshold || this.isSamplePlaying) {
      return {
        active: true,
        rms,
        chroma,
        detectedChord: null,
        confidence: 0
      };
    }

    // 2. Compute 12-bin Pitch Class Profile (Chromagram)
    // Guitar range of interest: E2 (82.4Hz) to E5 (659Hz) + some harmonics up to ~1200Hz
    const minFreq = 70;
    const maxFreq = 1200;

    for (let i = 0; i < bufferLength; i++) {
      const freq = (i * sampleRate) / this.fftSize;
      if (freq < minFreq || freq > maxFreq) continue;

      // Convert frequency to MIDI note number
      // Note number 69 is A4 (440Hz)
      const noteNum = 12 * Math.log2(freq / 440) + 69;
      const roundedNote = Math.round(noteNum);
      const pitchClass = ((roundedNote % 12) + 12) % 12; // Ensure positive modulo

      const centerFreq = 440 * Math.pow(2, (roundedNote - 69) / 12);
      const freqDiff = Math.abs(freq - centerFreq);
      const bandwidthLimit = Math.max(12, centerFreq * 0.015); // Ensure we don't drop below FFT bin resolution at low registers

      // If frequency is clean/close to a tuning center, accumulate it
      if (freqDiff < bandwidthLimit) {
        // Convert dB to raw amplitude
        const db = freqData[i];
        if (db > -75) { // Reject very faint background bins
          const magnitude = Math.pow(10, db / 20);
          const weight = 1.0 - (freqDiff / bandwidthLimit); // Closer to center = higher weight
          chroma[pitchClass] += magnitude * weight;
        }
      }
    }

    // Normalize Chromagram (L2 Norm or Peak Normalization)
    let maxVal = 0;
    for (let i = 0; i < 12; i++) {
      if (chroma[i] > maxVal) maxVal = chroma[i];
    }

    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] = chroma[i] / maxVal;
      }
    }

    // 3. Match against active chords list and find highest similarity
    let detectedChord = null;
    let maxSimilarity = 0;

    let searchSpace = CHORDS;
    if (activeChordKeys && activeChordKeys.length > 0) {
      searchSpace = {};
      activeChordKeys.forEach(key => {
        if (CHORDS[key]) searchSpace[key] = CHORDS[key];
      });
    }

    for (const key in searchSpace) {
      const chord = searchSpace[key];
      const similarity = calculateChordSimilarity(chroma, chord.chroma);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        detectedChord = key;
      }
    }

    // We consider it a solid match if similarity score is above 0.78
    const confidence = maxSimilarity;
    const hasMatch = confidence > 0.78;

    return {
      active: true,
      rms,
      chroma,
      detectedChord: hasMatch ? detectedChord : null,
      confidence: hasMatch ? confidence : 0
    };
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }

  async playChordSample(chordKey) {
    const chord = CHORDS[chordKey];
    if (!chord) return;

    console.log("Play Sample - Chord Key:", chordKey, "Frets:", chord.frets);

    // Disable chord detection during sample playback to avoid self-detection
    this.isSamplePlaying = true;
    if (this.samplePlayTimeout) clearTimeout(this.samplePlayTimeout);

    // Ensure audio context exists (even if microphone is not allowed/ready)
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const baseFreqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]; // Low E to High E
    const strumTime = this.audioContext.currentTime;
    let delay = 0;

    // Guitar wood body resonator filter (peaking around 220Hz for box warmth)
    const bodyFilter = this.audioContext.createBiquadFilter();
    bodyFilter.type = 'peaking';
    bodyFilter.Q.value = 1.2;
    bodyFilter.frequency.value = 220;
    bodyFilter.gain.value = 5.0; // Boost warm body resonance
    bodyFilter.connect(this.audioContext.destination);

    // Gently roll off harsh high harmonics above 2800Hz
    const lowPass = this.audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(2800, strumTime);
    lowPass.connect(bodyFilter);

    chord.frets.forEach((fret, index) => {
      // Sympathetic mechanical bleed: muted strings (-1) vibrate open (fret 0) at 8% volume
      const isMuted = (fret === -1);
      const actualFret = isMuted ? 0 : fret;
      const baseGain = isMuted ? 0.012 : 0.14; 

      const freq = baseFreqs[index] * Math.pow(2, actualFret / 12);
      const noteTime = strumTime + delay;

      // 1. Add woody Fundamental (Triangle wave)
      this.createOvertone(freq, noteTime, baseGain, 'triangle', lowPass);

      // Add harmonic overtones for active strings
      if (!isMuted) {
        // 2nd Harmonic (Sine, octave)
        this.createOvertone(freq * 2, noteTime, baseGain * 0.45, 'sine', lowPass);
        // 3rd Harmonic (Sine, octave + fifth)
        this.createOvertone(freq * 3, noteTime, baseGain * 0.20, 'sine', lowPass);
        // 4th Harmonic (Sine, two octaves)
        this.createOvertone(freq * 4, noteTime, baseGain * 0.08, 'sine', lowPass);
      }

      // Strum delay: only advance if the string was actively played
      if (!isMuted) {
        delay += 0.065; // 65ms strum offset
      }
    });

    // Reset detection lockout after sample strum and decay completes (~2.5s total)
    const lockoutMs = (delay + 2.5) * 1000;
    this.samplePlayTimeout = setTimeout(() => {
      this.isSamplePlaying = false;
    }, lockoutMs);
  }

  createOvertone(freq, noteTime, peakGain, type, destination) {
    const oscNode = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    // Natural detuning chorus (+/- 2.5 cents) to mimic physical strings
    const detuneCents = (Math.random() - 0.5) * 5.0;
    oscNode.detune.setValueAtTime(detuneCents, noteTime);

    oscNode.type = type;
    oscNode.frequency.value = freq;
    
    // Smooth exponential decay envelope extending sustain to 3.0 seconds
    gainNode.gain.setValueAtTime(0, noteTime);
    gainNode.gain.linearRampToValueAtTime(peakGain, noteTime + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, noteTime + 2.8);

    oscNode.connect(gainNode);
    gainNode.connect(destination);

    oscNode.start(noteTime);
    oscNode.stop(noteTime + 3.0);
  }
}
