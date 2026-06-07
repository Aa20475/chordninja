# 🎸 CHORDNINJA 🥷
> **Become a guitar chord master through real-time audio analysis.** 
> Zero extra hardware needed—just your acoustic guitar and laptop microphone.

---

```
   _____ _                    _ _   _ _             
  / ____| |                  | | \ | (_)            
 | |    | |__   ___  _ __  __| |  \| |_ _ __  _  __ _ 
 | |    | '_ \ / _ \| '__|/ _` | . ` | | '_ \| |/ _` |
 | |____| | | | (_) | |  | (_| | |\  | | | | | | (_| |
  \_____|_| |_|\___/|_|   \__,_|_| \_|_|_| |_| |\__,_|
                                            _/ |      
                                           |__/       
```

ChordNinja is a responsive, local, offline-first web application designed for guitarists to practice chords and transition speeds. By combining real-time Digital Signal Processing (DSP) pitch-class extraction with Spaced Repetition learning mechanics, it acts as a digital sensei for your chord muscle memory.

---

## 🚀 Key Features

*   **🎙️ Real-Time Pitch Analysis**: No external pickups or cables required. Uses the Web Audio API to capture your microphone input, run a fast Fourier transform (FFT), filter out ambient noise with a hysteresis gate, and extract pitch profiles (Chromagrams).
*   **🧠 Spaced Repetition (SRS) Engine**: Uses a Leitner-system algorithm to track your chord mastery. Chords you struggle with appear more frequently, while mastered chords are pushed out in review intervals.
*   **🥋 Dojo Mode (Accuracy & Sustain)**: Focuses on clean finger placement. Strum the target chord and hold it with clean resonance for a customizable duration (1.0s to 4.0s) to advance.
*   **🕹️ Arcade Mode (Rhythm & Timing)**: Chord bubbles scroll down a timeline matching a steady visual metronome. Strum the target chord exactly when it hits the beat mark.
*   **👁️ Strict Active Recall**: Hides finger placement diagrams for chords you have already played successfully ($>20\%$ mastery), forcing your brain to retrieve the shape from muscle memory. Cheating (revealing the diagram) pauses SRS mastery progress for that clearance.
*   **🎵 Curated Song Database**: Displays iconic, recognizable songs featuring the active chord (e.g., *Wish You Were Here* for Em, *Hotel California* for Bm) directly on the card to connect training with real music.
*   **🎸 Physical Modeling Synthesizer**: Uses advanced subtractive/additive synth nodes to generate authentic acoustic guitar tones for reference samples—complete with wooden box resonance, sympathetic string bleed, and exponential sustain.
*   **⌨️ Offline/Guest Capabilities**: Supports full keyboard simulation for testing or playing without a guitar, and saves all stats in local storage.

---

## 🎛️ Keyboard Shortcuts

*   <kbd>Space</kbd> : Toggle Active Recall (hides/shows the fretboard diagram) / Blurs buttons to prevent double-clicks.
*   <kbd>1</kbd> to <kbd>6</kbd> : Simulate playing specific chords (Em, Am, G, C, D, F) for debug/offline mode.

---

## 🛠️ Installation & Local Run

ChordNinja is entirely static, zero-dependency, and offline-compatible. To run it locally, serve it using any HTTP server.

### Serve via Python (Recommended)
Run this in the project root:
```bash
python -m http.server 8000
```
Then visit: [http://localhost:8000](http://localhost:8000)

### Serve via Node.js
```bash
npx http-server -p 8000
```
Then visit: [http://localhost:8000](http://localhost:8000)

---

## 🗄️ Architecture Details

*   **[index.html](file:///c:/Users/aa204/Projects/chordninja/index.html)**: Styled responsive layout featuring the glassmorphic settings dashboard, Dojo/Arcade stage managers, and interactive 2D canvas guitar fretboard.
*   **[styles.css](file:///c:/Users/aa204/Projects/chordninja/styles.css)**: Implements visual theme guidelines (HSL Tailored gradients, custom ranges, hit-pulses, glass card overlays).
*   **[game.js](file:///c:/Users/aa204/Projects/chordninja/game.js)**: Runs the main application flow, SRS scoring, keyboard listeners, active recall gates, and song UI renderers.
*   **[audio.js](file:///c:/Users/aa204/Projects/chordninja/audio.js)**: Powers the Web Audio Analyser and Physical Modeling Synthesizer.
*   **[chords.js](file:///c:/Users/aa204/Projects/chordninja/chords.js)**: Generates 144 chords across 10 difficulty tiers and hosts the offline song example mappings.
