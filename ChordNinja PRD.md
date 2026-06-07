# **Product Requirements Document (PRD): Project ChordNinja**

## **1\. Objective & Vision**

A lightweight, local web-based desktop application designed to teach absolute beginner guitar chords from scratch. The application gamifies chord transitions by turning practice into a responsive, cadence-driven arcade game. The app requires zero external hardware, relying entirely on a standard room microphone to process acoustic guitar audio in real time.

## **2\. Tech Stack & Architecture**

* **Platform:** Local Web Application (Desktop Browser). Served via a simple local HTTP server.  
* **Core Logic:** Vanilla HTML5, CSS, and JavaScript.  
* **Audio Pipeline:** Native **Web Audio API**. Bypasses native audio driver compilation while maintaining low-latency, client-side hardware access.  
* **Modularity:** The pitch-detection engine must be abstracted behind a clean interface. Phase 1 relies on traditional DSP math. The architecture must allow easy swapping to a local machine learning inference model later, taking full advantage of high-end local CPU/GPU compute power (e.g., utilizing your i9/RTX 4070 setup) without rewriting the frontend UI.

## **3\. Pillar 1: Audio Processing (V1 DSP Engine)**

* **Input:** Real-time mono audio stream from the default system microphone (44.1kHz or 48kHz).  
* **Analysis:** Utilize the Web Audio API AnalyserNode to perform a windowed Fast Fourier Transform (FFT).  
* **Detection Logic:** Extract dominant frequency peaks into a 12-bin pitch class profile (chromagram). Compare the captured profile against a hardcoded mathematical dictionary of target open chords (Em, Am, C, G, D).

## **4\. Pillar 2: The Core Gameplay Loop**

The gameplay is split into two distinct, gated phases:

* **Mode A: The Dojo (Learn Mode)**  
  * **Pacing:** The metronome pauses. The user faces zero time pressure.  
  * **Visuals:** Displays a clear 2D guitar fretboard diagram showing exact numbered finger placements.  
  * **Mechanic:** The app listens continuously. Once the DSP engine matches the target chord and detects sustained, clean resonance for 1.5 seconds, the UI flashes a success state and advances to the next chord.  
* **Mode B: The Arcade (Rhythm Mode)**  
  * **Pacing:** Activates a steady, relentless metronome cadence (e.g., 60 BPM).  
  * **Visuals:** Chords appear as targets traveling along a timeline toward a fixed hit-window.  
  * **Mechanic:** The player must transition to and strum the correct chord precisely on the beat. Successful DSP matches inside the timing window trigger instant slicing/scoring feedback.

## **5\. Pillar 3: Progression & Active Recall**

* **Gated Skill Tree:** Chords are locked behind a linear progression system to prevent beginner frustration.  
  * *Tier 1 (The Training Wheels):* Two-finger transitions (Em \-\> Am).  
  * *Tier 2 (The Stretch):* Three-finger open shapes (G \-\> C \-\> D).  
  * *Tier 3 (The Boss Fight):* The Barre Chord milestone (F Major).  
* **Active Recall UI Toggle:** A core mechanic to build muscle memory, allowing the user to instantly switch display modes via a hotkey or button:  
  * *Diagram View:* Shows strings, frets, and numbered finger dots.  
  * *Flashcard View:* Completely hides the fretboard. Displays only the raw text name of the chord (e.g., **"G Major"**), forcing the player to retrieve the shape from memory under pressure.

## **6\. User Interface Requirements**

* **Layout:** Static, clean layout optimized for a desktop monitor. Highly functional; no distracting 3D camera movements.  
* **Top Bar:** Current Score, Streak Multiplier, Active Tier Level.  
* **Center Stage:** The Chord Target Zone (Arcade Mode timeline).  
* **Bottom Panel:** The interactive 2D Fretboard / Flashcard module containing the Active Recall View Toggle.  
* **System Status:** A persistent color-coded indicator showing raw microphone input levels and confirming active string vibration/tuning.

## **7\. Out of Scope for V1**

* Complex hardware routing (ASIO drivers, Direct-In electric guitar support, MIDI interfaces).  
* Polyphonic accuracy for complex jazz extensions or altered tunings.  
* Cloud databases, user accounts, multiplayer, or global leaderboards.