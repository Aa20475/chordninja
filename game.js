import { CHORDS, TIERS, getSongExamples } from './chords.js?v=4';
import { AudioEngine } from './audio.js?v=4';

const GOOGLE_CLIENT_ID = "1057903077535-e3jpaoq9pqdo5sn8972lo8r68pvkq04a.apps.googleusercontent.com";

class GameController {
  constructor() {
    this.engine = new AudioEngine();
    
    // Game States
    this.currentMode = 'dojo'; // 'dojo' or 'arcade'
    this.currentTierIndex = 0;
    this.currentChordKey = 'Em';
    this.recallMode = 'diagram'; // 'diagram' or 'flashcard'
    this.score = 0;
    this.streak = 1;
    this.activeRecallUnlocked = true;
    this.isChordActiveInGame = false;

    // Dojo Specifics
    this.dojoMatchStart = null;
    const savedHoldTime = localStorage.getItem('chordninja_hold_time');
    this.dojoResonanceTime = savedHoldTime ? parseFloat(savedHoldTime) * 1000 : 1500; // default 1.5 seconds target
    this.currentResonancePct = 0;
    this.dojoHelped = false;
    this.recentClearedChords = [];
    
    // Arcade Specifics
    this.bpm = 60;
    this.isPlayingArcade = false;
    this.arcadeTargets = [];
    this.lastSpawnTime = 0;
    this.metronomeInterval = null;
    this.beatCount = 0;
    this.pixelsPerMs = 0.25; // Speed of targets moving left
    this.hitZoneX = 100; // Target hit coordinate in timeline
    this.hitToleranceMs = 200; // +/- 200ms timing window

    // Google Drive Sync States
    this.accessToken = localStorage.getItem('chordninja_gapi_token') || null;
    this.gapiFileId = localStorage.getItem('chordninja_gapi_file_id') || null;
    this.gapiClientId = GOOGLE_CLIENT_ID || '';
    this.tokenExpiry = null;
    this.tokenClient = null;

    // Key simulated chords (for test/offline capability)
    this.simulatedChord = null;

    // Canvas properties
    this.canvas = document.getElementById('fretboard-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.initDOM();
    this.initEvents();
    this.initSRS();
    this.renderSkillTree();
    this.setTargetChord('Em');
    this.checkAutoStartMic();
    this.initGoogleDriveState();
    this.startGameLoop();
  }

  initDOM() {
    this.onboardingOverlay = document.getElementById('onboarding-overlay');
    this.btnRequestMic = document.getElementById('btn-request-mic');
    this.micTestArea = document.getElementById('mic-test-area');
    this.micLevelBar = document.getElementById('mic-level-bar');
    this.btnStartGame = document.getElementById('btn-start-game');

    this.tabDojo = document.getElementById('tab-dojo');
    this.tabArcade = document.getElementById('tab-arcade');
    this.scoreDisplay = document.getElementById('score-display');
    this.streakDisplay = document.getElementById('streak-display');
    this.currentTierDisplay = document.getElementById('current-tier-display');

    this.sliderSensitivity = document.getElementById('slider-sensitivity');
    this.valSensitivity = document.getElementById('val-sensitivity');
    this.sliderHoldTime = document.getElementById('slider-hold-time');
    this.valHoldTime = document.getElementById('val-hold-time');
    this.sliderBpm = document.getElementById('slider-bpm');
    this.valBpm = document.getElementById('val-bpm');
    this.audioInputStatus = document.getElementById('audio-input-status');
    this.rmsBar = document.getElementById('rms-bar');

    this.dojoStage = document.getElementById('dojo-stage');
    this.arcadeStage = document.getElementById('arcade-stage');
    this.dojoTargetChord = document.getElementById('dojo-target-chord');
    this.dojoTargetChordName = document.getElementById('dojo-target-chord-name');
    this.resonancePct = document.getElementById('resonance-pct');
    this.resonanceProgressBar = document.getElementById('resonance-progress-bar');
    this.strumPrompt = document.getElementById('strum-prompt');

    this.scrollingTrack = document.getElementById('scrolling-track');
    this.metronomeVisual = document.getElementById('metronome-visual');
    this.hitIndicator = document.getElementById('hit-indicator');

    this.toggleRecall = document.getElementById('toggle-recall');
    this.recallTitle = document.getElementById('recall-title');
    this.fretboardView = document.getElementById('fretboard-view-container');
    this.flashcardView = document.getElementById('flashcard-view-container');
    this.flashcardChordName = document.getElementById('flashcard-chord-name');
    this.songsList = document.getElementById('songs-list');

    this.detectedChordDisplay = document.getElementById('detected-chord-display');
    this.similarityScoreDisplay = document.getElementById('similarity-score-display');
    this.btnPlaySample = document.getElementById('btn-play-sample');

    // Google Auth DOM
    this.inputClientId = document.getElementById('input-client-id');
    this.btnGoogleAuth = document.getElementById('btn-google-auth');
    this.syncStatusBadge = document.getElementById('sync-status');

    // Populate initial UI value for hold time
    if (this.sliderHoldTime && this.valHoldTime) {
      const seconds = this.dojoResonanceTime / 1000;
      this.sliderHoldTime.value = seconds;
      this.valHoldTime.textContent = `${seconds.toFixed(1)}s`;
    }
  }

  initEvents() {
    // Play Chord Sample Audio
    this.btnPlaySample.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.engine.playChordSample(this.currentChordKey);
    });

    // Microphone onboarding
    this.btnRequestMic.addEventListener('click', async (e) => {
      e.currentTarget.blur();
      try {
        const success = await this.engine.init();
        if (success) {
          localStorage.setItem('chordninja_mic_granted', 'true');
          this.btnRequestMic.classList.add('hidden');
          this.micTestArea.classList.remove('hidden');
          this.audioInputStatus.textContent = 'Active';
          this.audioInputStatus.className = 'status-badge connected';
          
          // Poll mic levels for calibration test
          const calibrationPoll = setInterval(() => {
            const state = this.engine.getAudioState();
            const volumePercent = Math.min(100, state.rms * 500); // Scale for visual feedback
            this.micLevelBar.style.width = `${volumePercent}%`;
            
            if (state.rms > 0.005) {
              this.btnStartGame.classList.remove('hidden');
            }
          }, 50);

          this.btnStartGame.addEventListener('click', (ev) => {
            ev.currentTarget.blur();
            clearInterval(calibrationPoll);
            this.onboardingOverlay.classList.add('hidden');
          });
        }
      } catch (err) {
        alert("Microphone access is required for ChordNinja. Please grant permissions.");
      }
    });

    // Tab Switches
    this.tabDojo.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.switchMode('dojo');
    });
    this.tabArcade.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.switchMode('arcade');
    });

    // Sensitivity slider
    this.sliderSensitivity.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.valSensitivity.textContent = `${val}%`;
      this.engine.setSensitivity(val);
    });

    // Hold Time slider
    if (this.sliderHoldTime) {
      this.sliderHoldTime.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.valHoldTime.textContent = `${val.toFixed(1)}s`;
        this.dojoResonanceTime = val * 1000;
        localStorage.setItem('chordninja_hold_time', val);
      });
    }

    // BPM Slider
    this.sliderBpm.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      this.valBpm.textContent = `${val} BPM`;
      this.bpm = val;
      if (this.isPlayingArcade) {
        this.restartMetronome();
      }
    });

    // View Toggle Control
    this.toggleRecall.addEventListener('click', (e) => {
      e.currentTarget.blur();
      this.toggleActiveRecall();
    });

    // Keyboard controls (Space to toggle recall, keys E, A, G, C, D, F for simulated guitar play)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        // Blur current focused element if it's an interactive element to prevent double action
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        this.toggleActiveRecall();
      }
      
      // Simulated guitar notes/chords (e.g. Shift + key to simulate playing)
      const keyMap = {
        'Digit1': 'Em',
        'Digit2': 'Am',
        'Digit3': 'G',
        'Digit4': 'C',
        'Digit5': 'D',
        'Digit6': 'F'
      };
      if (keyMap[e.code]) {
        this.simulatedChord = keyMap[e.code];
        // clear simulation after 1 second
        setTimeout(() => {
          if (this.simulatedChord === keyMap[e.code]) {
            this.simulatedChord = null;
          }
        }, 1200);
      }
    });



    // Google Auth manual Link button trigger
    if (this.btnGoogleAuth) {
      this.btnGoogleAuth.addEventListener('click', (e) => {
        e.currentTarget.blur();
        if (this.accessToken) {
          this.unlinkGoogleDrive();
        } else {
          this.authenticateGoogle();
        }
      });
    }

    const btnCopyDebug = document.getElementById('btn-copy-debug');
    if (btnCopyDebug) {
      btnCopyDebug.addEventListener('click', (e) => {
        e.currentTarget.blur();
        const textarea = document.getElementById('debug-log-output');
        if (textarea && textarea.value) {
          navigator.clipboard.writeText(textarea.value);
          btnCopyDebug.textContent = 'Copied!';
          setTimeout(() => { btnCopyDebug.textContent = 'Copy Log'; }, 1500);
        }
      });
    }
  }

  activateActiveRecall(forceFlashcard) {
    if (forceFlashcard) {
      this.recallMode = 'flashcard';
      this.recallTitle.textContent = 'Active Recall Flashcard';
      this.fretboardView.classList.remove('active');
      this.fretboardView.classList.add('hidden');
      this.flashcardView.classList.remove('hidden');
      this.flashcardView.classList.add('active');
      this.toggleRecall.querySelector('.view-btn-text').textContent = 'Switch to Diagram';
    } else {
      this.recallMode = 'diagram';
      this.recallTitle.textContent = 'Fretboard Diagram';
      this.flashcardView.classList.remove('active');
      this.flashcardView.classList.add('hidden');
      this.fretboardView.classList.remove('hidden');
      this.fretboardView.classList.add('active');
      this.toggleRecall.querySelector('.view-btn-text').textContent = 'Switch to Flashcard';
      this.drawFretboard();
    }
  }

  toggleActiveRecall() {
    if (this.recallMode === 'diagram') {
      this.activateActiveRecall(true);
    } else {
      // User revealed the diagram - flag as helped (disables SRS progress on this attempt)
      this.dojoHelped = true;
      this.activateActiveRecall(false);
      this.showPopupNotification("Diagram revealed. SRS mastery progress paused!");
    }
  }

  switchMode(mode) {
    if (mode === this.currentMode) return;
    this.currentMode = mode;

    if (mode === 'dojo') {
      this.tabDojo.classList.add('active');
      this.tabArcade.classList.remove('active');
      this.dojoStage.classList.remove('hidden');
      this.arcadeStage.classList.add('hidden');
      document.querySelector('.arcade-only').classList.add('hidden');
      
      this.stopArcade();
    } else {
      this.tabArcade.classList.add('active');
      this.tabDojo.classList.remove('active');
      this.arcadeStage.classList.remove('hidden');
      this.dojoStage.classList.add('hidden');
      document.querySelector('.arcade-only').classList.remove('hidden');
      
      this.startArcade();
    }
  }

  setTargetChord(chordKey) {
    if (!CHORDS[chordKey]) return;
    this.currentChordKey = chordKey;
    this.dojoHelped = false; // Reset helped status for the new chord
    
    // Update labels
    this.dojoTargetChord.textContent = chordKey;
    this.dojoTargetChordName.textContent = CHORDS[chordKey].name;
    this.flashcardChordName.textContent = chordKey;

    // Update chord selection visual status
    document.querySelectorAll('.chord-pill').forEach(pill => {
      pill.classList.remove('current');
      if (pill.getAttribute('data-chord') === chordKey) {
        pill.classList.add('current');
      }
    });

    // Reset Dojo timer
    this.dojoMatchStart = null;
    this.dojoLastMatchTime = null;
    this.currentResonancePct = 0;
    this.resonanceProgressBar.style.width = '0%';
    this.resonancePct.textContent = '0%';

    // Strict Active Recall Gate: If mastery is above 20%, force Flashcard (hidden diagram) mode
    const srs = this.srsData[chordKey];
    if (srs && srs.mastery > 20) {
      this.activateActiveRecall(true);
    } else {
      this.activateActiveRecall(false);
    }

    // Render song examples
    if (this.songsList) {
      const songs = getSongExamples(chordKey);
      this.songsList.innerHTML = '';
      songs.forEach(song => {
        const badge = document.createElement('span');
        badge.className = 'song-badge';
        badge.textContent = `${song.title} - ${song.artist}`;
        this.songsList.appendChild(badge);
      });
    }
  }

  // Draw Interactive 2D Guitar Fretboard Canvas
  drawFretboard() {
    const chord = CHORDS[this.currentChordKey];
    if (!chord) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);

    // Padding parameters
    const padLeft = 80;
    const padRight = 40;
    const padTop = 30;
    const padBottom = 30;
    const neckWidth = width - padLeft - padRight;
    const neckHeight = height - padTop - padBottom;

    const numStrings = 6;
    const numFrets = 5;
    const stringSpacing = neckHeight / (numStrings - 1);
    const fretSpacing = neckWidth / numFrets;

    // Draw wood background gradient
    const neckGrad = this.ctx.createLinearGradient(padLeft, 0, width - padRight, 0);
    neckGrad.addColorStop(0, '#221915');
    neckGrad.addColorStop(1, '#15100d');
    this.ctx.fillStyle = neckGrad;
    this.ctx.fillRect(padLeft, padTop, neckWidth, neckHeight);

    // Draw frets (vertical lines)
    this.ctx.strokeStyle = '#c4c8d4';
    this.ctx.lineWidth = 2;
    for (let f = 0; f <= numFrets; f++) {
      const x = padLeft + f * fretSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(x, padTop);
      this.ctx.lineTo(x, padTop + neckHeight);
      this.ctx.stroke();

      // Make the nut thicker
      if (f === 0) {
        this.ctx.lineWidth = 6;
        this.ctx.stroke();
        this.ctx.lineWidth = 2;
      }
    }

    // Fret position dot markers (fret 3)
    this.ctx.fillStyle = '#616e88';
    this.ctx.beginPath();
    this.ctx.arc(padLeft + 2.5 * fretSpacing, padTop + neckHeight / 2, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw strings (horizontal lines)
    // String indices: 0 is Low E (bottom), 5 is High E (top)
    // Canvas: Y=padTop is string 1 (high), Y=padTop+neckHeight is string 6 (low)
    const stringThicknesses = [1, 1.5, 2, 2.5, 3.5, 4.5]; // Thicker at the bottom (low strings)
    for (let s = 0; s < numStrings; s++) {
      const y = padTop + s * stringSpacing;
      this.ctx.strokeStyle = '#9ca9c0';
      this.ctx.lineWidth = stringThicknesses[s];
      this.ctx.beginPath();
      this.ctx.moveTo(padLeft, y);
      this.ctx.lineTo(width - padRight, y);
      this.ctx.stroke();

      // String note letters at left of nut
      const standardTuning = ["e", "B", "G", "D", "A", "E"]; // high to low
      this.ctx.fillStyle = '#8d98af';
      this.ctx.font = 'bold 14px Outfit';
      this.ctx.textAlign = 'right';
      this.ctx.fillText(standardTuning[s], padLeft - 45, y + 5);
    }

    // Draw fingering dots and markers
    // chord.frets: array indices corresponding to: 0 is Low E (bottom), 5 is High E (top)
    // So index mapping: Low E (string 6) is index 0 -> canvas index 5 (bottom)
    for (let i = 0; i < 6; i++) {
      const fret = chord.frets[i];
      const finger = chord.fingers[i];
      const noteName = chord.notes[i];
      
      const stringIdx = 5 - i; // reverse index so 0 corresponds to low E (bottom)
      const y = padTop + stringIdx * stringSpacing;

      if (fret === -1) {
        // Muted string (X)
        this.ctx.strokeStyle = '#ff3366';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(padLeft - 22, y - 6);
        this.ctx.lineTo(padLeft - 10, y + 6);
        this.ctx.moveTo(padLeft - 10, y - 6);
        this.ctx.lineTo(padLeft - 22, y + 6);
        this.ctx.stroke();
      } else if (fret === 0) {
        // Open string (O)
        this.ctx.strokeStyle = '#00ffc4';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(padLeft - 16, y, 6, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (fret > 0) {
        // Fretted string (colored dot on specific fret)
        const x = padLeft + (fret - 0.5) * fretSpacing;
        
        // Draw glow
        this.ctx.fillStyle = 'rgba(0, 255, 196, 0.4)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 18, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw note dot
        this.ctx.fillStyle = '#00ffc4';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 13, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw finger number inside dot
        this.ctx.fillStyle = '#080a0f';
        this.ctx.font = 'bold 12px Space Mono';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(finger.toString(), x, y);

        // Note labels above/below dots to help learn theory
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '10px Space Mono';
        this.ctx.fillText(noteName, x, y - 22);
      }
    }
  }

  getUnlockedChords() {
    const unlocked = [];
    TIERS.forEach((tier, index) => {
      if (this.isTierUnlocked(index)) {
        unlocked.push(...tier.chords);
      }
    });
    return unlocked;
  }

  initSRS() {
    const saved = localStorage.getItem('chordninja_srs');
    this.srsData = saved ? JSON.parse(saved) : {};
    
    // Populate any missing chords in the dynamic database
    for (const key in CHORDS) {
      if (!this.srsData[key]) {
        this.srsData[key] = {
          box: 1,
          lastPlayed: 0,
          intervalMs: 15000, // 15 seconds review interval initially
          mastery: 0
        };
      }
    }
  }

  saveSRS() {
    localStorage.setItem('chordninja_srs', JSON.stringify(this.srsData));
    localStorage.setItem('chordninja_srs_timestamp', Date.now().toString());
    this.saveToCloud();
  }

  recordSRSSuccess(chordKey) {
    const data = this.srsData[chordKey];
    if (!data) return;

    data.lastPlayed = Date.now();

    // Interleaving Gate: Check if chord has been cleared too recently to progress Box level
    if (this.recentClearedChords.includes(chordKey)) {
      // Don't advance the box, but save lastPlayed time to keep state fresh
      this.saveSRS();
      this.renderSkillTree();
      return;
    }

    // Add to recent clears queue (limit length to 2)
    this.recentClearedChords.push(chordKey);
    if (this.recentClearedChords.length > 2) {
      this.recentClearedChords.shift();
    }

    data.box = Math.min(5, data.box + 1);
    
    // Intervals: Box 1=15s, Box 2=45s, Box 3=3m, Box 4=12m, Box 5=45m
    const intervals = [15000, 45000, 180000, 720000, 2700000];
    data.intervalMs = intervals[data.box - 1];
    data.mastery = Math.round((data.box / 5) * 100);

    this.saveSRS();
    this.renderSkillTree();
  }

  recordSRSFail(chordKey) {
    const data = this.srsData[chordKey];
    if (!data) return;

    data.lastPlayed = Date.now();
    data.box = 1;
    data.intervalMs = 15000;
    data.mastery = 20;

    this.saveSRS();
    this.renderSkillTree();
  }

  getNextSRSChord() {
    const unlocked = this.getUnlockedChords();
    if (unlocked.length === 0) return 'Em';

    const now = Date.now();
    let bestChord = unlocked[0];
    let maxDueScore = -Infinity;

    unlocked.forEach(chordKey => {
      const data = this.srsData[chordKey];
      if (!data) return;

      const elapsed = now - data.lastPlayed;
      const dueScore = elapsed / data.intervalMs;

      // Add small random noise factor to keep targets dynamic
      const noise = Math.random() * 0.15;
      const finalScore = dueScore + noise;

      if (finalScore > maxDueScore) {
        maxDueScore = finalScore;
        bestChord = chordKey;
      }
    });

    return bestChord;
  }

  async checkAutoStartMic() {
    const isGranted = localStorage.getItem('chordninja_mic_granted') === 'true';
    let permissionsGranted = false;

    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      if (result.state === 'granted') {
        permissionsGranted = true;
      }
    } catch (e) {
      permissionsGranted = isGranted;
    }

    if (permissionsGranted) {
      try {
        const success = await this.engine.init();
        if (success) {
          this.audioInputStatus.textContent = 'Active';
          this.audioInputStatus.className = 'status-badge connected';
          this.onboardingOverlay.classList.add('hidden');
          localStorage.setItem('chordninja_mic_granted', 'true');
        }
      } catch (err) {
        console.warn("Failed to auto-start microphone:", err);
      }
    }
  }

  isTierUnlocked(index) {
    if (index === 0) return true;
    
    // Lock progression behind previous tier mastery (all chords in previous tier must have >= 80% mastery)
    const prevTier = TIERS[index - 1];
    return prevTier.chords.every(chord => {
      const data = this.srsData[chord];
      return data && data.mastery >= 80;
    });
  }

  renderSkillTree() {
    const treeContainer = document.querySelector('.skill-tree');
    if (!treeContainer) return;
    treeContainer.innerHTML = '';

    TIERS.forEach((tier, index) => {
      const isUnlocked = this.isTierUnlocked(index);
      
      const node = document.createElement('div');
      node.className = `tree-node ${isUnlocked ? 'active' : 'locked'}`;
      node.id = `node-tier-${tier.id}`;

      const header = document.createElement('div');
      header.className = 'node-header';
      header.innerHTML = `
        <span class="node-status">${isUnlocked ? '🟢' : '🔒'}</span>
        <span class="node-title">${tier.name}</span>
      `;

      const chordsDiv = document.createElement('div');
      chordsDiv.className = 'node-chords';
      chordsDiv.style.flexWrap = 'wrap';
      chordsDiv.style.gap = '6px';
      chordsDiv.style.display = 'flex';
      chordsDiv.style.marginTop = '6px';
      
      tier.chords.forEach(chord => {
        const pill = document.createElement('span');
        pill.className = `chord-pill ${isUnlocked ? 'active' : ''} ${this.currentChordKey === chord ? 'current' : ''}`;
        pill.setAttribute('data-chord', chord);
        
        // Show mastery percentage on the pill if unlocked
        const masteryVal = isUnlocked && this.srsData[chord] ? this.srsData[chord].mastery : 0;
        pill.innerHTML = isUnlocked ? `${chord} <span style="font-size: 0.6rem; opacity: 0.65; margin-left: 4px;">${masteryVal}%</span>` : chord;

        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isUnlocked) {
            this.setTargetChord(chord);
          }
        });
        
        chordsDiv.appendChild(pill);
      });

      node.appendChild(header);
      node.appendChild(chordsDiv);
      treeContainer.appendChild(node);
    });
  }

  // Manage Tiers and gated progression unlock
  checkProgressionUnlock() {
    const scoreThresholds = [0, 200, 400, 600, 800, 1000, 1200, 1500, 1800, 2100];
    let unlockedNew = false;
    
    TIERS.forEach((tier, index) => {
      if (index === 0) return;
      
      const threshold = scoreThresholds[index];
      const isUnlockedCurrently = this.isTierUnlocked(index);
      const node = document.getElementById(`node-tier-${tier.id}`);
      
      if (isUnlockedCurrently && node && node.classList.contains('locked')) {
        unlockedNew = true;
        this.showPopupNotification(`Unlocked: ${tier.name}!`);
      }
    });

    if (unlockedNew) {
      this.renderSkillTree();
    }
  }

  showPopupNotification(msg) {
    const notifyDiv = document.createElement('div');
    notifyDiv.style.position = 'fixed';
    notifyDiv.style.top = '100px';
    notifyDiv.style.left = '50%';
    notifyDiv.style.transform = 'translateX(-50%)';
    notifyDiv.style.background = 'linear-gradient(135deg, #c07cf7, #00ffc4)';
    notifyDiv.style.color = '#080a0f';
    notifyDiv.style.padding = '12px 24px';
    notifyDiv.style.borderRadius = '30px';
    notifyDiv.style.fontWeight = 'bold';
    notifyDiv.style.boxShadow = '0 0 20px rgba(0,255,196,0.6)';
    notifyDiv.style.zIndex = '9999';
    notifyDiv.style.fontFamily = 'var(--font-main)';
    notifyDiv.style.animation = 'fadeIn 0.3s ease-out';
    notifyDiv.textContent = msg;

    document.body.appendChild(notifyDiv);
    setTimeout(() => {
      notifyDiv.style.opacity = '0';
      notifyDiv.style.transition = 'opacity 0.5s';
      setTimeout(() => notifyDiv.remove(), 500);
    }, 3000);
  }

  // --- GAME LOOPS & RENDERING ---

  startGameLoop() {
    const loop = (timestamp) => {
      this.update(timestamp);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(timestamp) {
    // 1. Fetch live audio states from DSP Engine, restricted to active/unlocked chords.
    // Pass whether we were active in the previous frame to trigger hysteresis noise gate.
    const audioState = this.engine.getAudioState(this.getUnlockedChords(), this.isChordActiveInGame);
    
    // Keep track for next frame hysteresis
    this.isChordActiveInGame = !!audioState.detectedChord;

    // Inject Keyboard Simulation if active
    if (this.simulatedChord) {
      audioState.active = true;
      audioState.rms = 0.08;
      audioState.detectedChord = this.simulatedChord;
      audioState.confidence = 0.95;
      
      // fill fake chroma values for visualizer
      const targetChroma = CHORDS[this.simulatedChord].chroma;
      for (let i = 0; i < 12; i++) {
        audioState.chroma[i] = targetChroma[i];
      }
    }

    // 2. Update real-time volume & detected chord UI
    if (audioState.active) {
      // Update RMS level visualizer
      const rmsPct = Math.min(100, audioState.rms * 500);
      this.rmsBar.style.width = `${rmsPct}%`;

      // Update Pitch Profile bars (12 channels)
      for (let i = 0; i < 12; i++) {
        const bar = document.getElementById(`chroma-bin-${i}`);
        if (bar) {
          bar.style.height = `${audioState.chroma[i] * 100}%`;
        }
      }

      // Update main reading panel
      if (audioState.detectedChord) {
        this.detectedChordDisplay.textContent = audioState.detectedChord;
        this.similarityScoreDisplay.textContent = `Confidence: ${audioState.confidence.toFixed(2)}`;
      } else {
        this.detectedChordDisplay.textContent = '---';
        this.similarityScoreDisplay.textContent = 'Confidence: 0.00';
      }

      this.updateDebugLog(audioState);
    }

    // 3. Logic based on mode
    if (this.currentMode === 'dojo') {
      this.updateDojo(timestamp, audioState);
    } else {
      this.updateArcade(timestamp, audioState);
    }
  }

  updateDebugLog(audioState) {
    if (!audioState.active || audioState.rms < this.engine.rmsThreshold) return;
    
    // Throttle logging to once every 700ms
    const now = Date.now();
    if (this.lastDebugLogTime && now - this.lastDebugLogTime < 700) return;
    this.lastDebugLogTime = now;

    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const chromaStr = audioState.chroma.map((val, idx) => `${notes[idx]}:${val.toFixed(2)}`).join(' ');
    
    const logText = `[${new Date().toLocaleTimeString()}]
Target: ${this.currentChordKey}
Detected: ${audioState.detectedChord || 'None'} (Conf: ${audioState.confidence.toFixed(2)})
Volume (RMS): ${audioState.rms.toFixed(4)}
Chroma: ${chromaStr}
--------------------------------`;

    const textarea = document.getElementById('debug-log-output');
    if (textarea) {
      // Append new log at the bottom in chronological order
      textarea.value = textarea.value ? (textarea.value + "\n" + logText) : logText;
      
      // Limit history length to prevent memory leaks
      if (textarea.value.length > 5000) {
        textarea.value = textarea.value.substring(textarea.value.length - 5000);
      }
      
      // Auto-scroll to snap to the latest entry at the bottom
      textarea.scrollTop = textarea.scrollHeight;
    }
  }

  updateDojo(timestamp, audioState) {
    const isMatching = audioState.detectedChord === this.currentChordKey;

    if (isMatching) {
      if (!this.dojoMatchStart) {
        this.dojoMatchStart = timestamp;
      }
      this.dojoLastMatchTime = timestamp; // Track last successful match frame

      const elapsed = timestamp - this.dojoMatchStart;
      this.currentResonancePct = Math.min(100, (elapsed / this.dojoResonanceTime) * 100);
      
      this.resonanceProgressBar.style.width = `${this.currentResonancePct}%`;
      this.resonancePct.textContent = `${Math.round(this.currentResonancePct)}%`;
      this.strumPrompt.textContent = "Hold! Keep it clean...";
      this.strumPrompt.style.color = 'var(--accent-color)';

      // Check if held long enough
      if (elapsed >= this.dojoResonanceTime) {
        this.score += 100;
        this.scoreDisplay.textContent = this.score.toString().padStart(4, '0');
        this.streak += 1;
        this.streakDisplay.textContent = `x${this.streak}`;
        
        // Trigger visual splash success
        this.dojoStage.style.animation = 'hitPulse 0.3s ease-out';
        setTimeout(() => { this.dojoStage.style.animation = ''; }, 300);

        // Spawn clearance rewards particles & text
        const rect = this.dojoStage.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2 - 40;
        this.triggerClearJuice(centerX, centerY, `+100 x${this.streak}`);

        if (!this.dojoHelped) {
          this.recordSRSSuccess(this.currentChordKey);
          this.checkProgressionUnlock();
        } else {
          this.showPopupNotification("Cleared with helper! (Try from memory to level up)");
        }
        this.advanceNextChord();
      }
    } else {
      // Grace period check: if we had a match, and the drop has been less than 350ms, keep the timer running!
      const timeSinceLastMatch = this.dojoLastMatchTime ? (timestamp - this.dojoLastMatchTime) : Infinity;
      
      if (timeSinceLastMatch < 350) {
        // Keep progress bar at current level and keep match timer active
        this.strumPrompt.textContent = "Resonance dropping...";
        this.strumPrompt.style.color = 'var(--accent-purple)';
      } else {
        // Reset/decay after grace period expires
        if (this.currentResonancePct > 0) {
          this.dojoMatchStart = null;
          this.currentResonancePct = Math.max(0, this.currentResonancePct - 1.5);
          this.resonanceProgressBar.style.width = `${this.currentResonancePct}%`;
          this.resonancePct.textContent = `${Math.round(this.currentResonancePct)}%`;
        }
        this.strumPrompt.textContent = "Strum now and sustain resonance!";
        this.strumPrompt.style.color = 'var(--text-muted)';
      }
    }
  }

  // Advance chord in Dojo Mode using Spaced Repetition (SRS)
  advanceNextChord() {
    const nextChord = this.getNextSRSChord();
    const unlocked = this.getUnlockedChords();

    if (unlocked.length > 1 && nextChord === this.currentChordKey) {
      // Temporarily penalize/delay the current chord to avoid instant repeats
      const currentLastPlayed = this.srsData[this.currentChordKey].lastPlayed;
      this.srsData[this.currentChordKey].lastPlayed = Date.now() + 2000; 
      const adjustedNext = this.getNextSRSChord();
      this.srsData[this.currentChordKey].lastPlayed = currentLastPlayed; // Restore
      this.setTargetChord(adjustedNext);
    } else {
      this.setTargetChord(nextChord);
    }
  }

  // --- ARCADE MODE TIMELINE LOGIC ---

  startArcade() {
    this.isPlayingArcade = true;
    this.arcadeTargets = [];
    this.scrollingTrack.innerHTML = '';
    this.score = 0;
    this.streak = 1;
    this.scoreDisplay.textContent = '0000';
    this.streakDisplay.textContent = 'x1';
    
    this.restartMetronome();
    this.lastSpawnTime = performance.now();
  }

  stopArcade() {
    this.isPlayingArcade = false;
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
    this.scrollingTrack.innerHTML = '';
  }

  restartMetronome() {
    if (this.metronomeInterval) clearInterval(this.metronomeInterval);
    
    const beatMs = 60000 / this.bpm;
    this.metronomeInterval = setInterval(() => {
      this.triggerMetronomeBeat();
    }, beatMs);
  }

  triggerMetronomeBeat() {
    // Pulse light
    this.metronomeVisual.classList.add('beat');
    setTimeout(() => {
      this.metronomeVisual.classList.remove('beat');
    }, 120);

    // Spawn a target chord bubble every 4 beats
    this.beatCount++;
    if (this.beatCount % 4 === 0) {
      this.spawnArcadeTarget();
    }
  }

  spawnArcadeTarget() {
    // Pick target chord dynamically using Spaced Repetition (due review priority)
    const targetChord = this.getNextSRSChord();

    // Target specifications
    const target = {
      id: 'target-' + Date.now(),
      chord: targetChord,
      spawnTime: performance.now(),
      hitTime: performance.now() + 3000, // Takes 3 seconds to reach hitZoneX
      element: null,
      scored: false
    };

    // Create target DOM element
    const bubble = document.createElement('div');
    bubble.className = 'moving-target';
    bubble.id = target.id;
    bubble.textContent = targetChord;
    
    this.scrollingTrack.appendChild(bubble);
    target.element = bubble;

    this.arcadeTargets.push(target);
  }

  updateArcade(timestamp, audioState) {
    const trackWidth = this.scrollingTrack.clientWidth;
    const targetsToRemove = [];

    // Position of targets is calculated dynamically:
    // When timestamp = target.hitTime, target is at hitZoneX.
    // When timestamp = target.spawnTime, target is at trackWidth.
    // Speed: velocity = (trackWidth - hitZoneX) / 3000
    const span = 3000;
    const velocity = (trackWidth - this.hitZoneX) / span;

    this.arcadeTargets.forEach(target => {
      const elapsed = timestamp - target.spawnTime;
      const x = trackWidth - elapsed * velocity;

      // Position bubble element
      if (target.element) {
        target.element.style.left = `${x}px`;
      }

      // Check real-time matching behavior when bubble approaches and is within timing window
      const diffFromHitCenter = Math.abs(timestamp - target.hitTime);
      const isCorrectChord = audioState.detectedChord === target.chord;

      if (isCorrectChord && diffFromHitCenter <= this.hitToleranceMs) {
        if (target.element) {
          target.element.classList.add('active-match');
        }
      } else {
        if (target.element) {
          target.element.classList.remove('active-match');
        }
      }

      // Check hit trigger when close or passing the window
      if (!target.scored) {
        if (isCorrectChord && diffFromHitCenter <= this.hitToleranceMs) {
          // Scored hit!
          target.scored = true;
          this.scoreTarget(target, diffFromHitCenter);
        } else if (timestamp > target.hitTime + this.hitToleranceMs) {
          // Missed target
          target.scored = true;
          this.scoreTarget(target, null); // Miss
        }
      }

      // Cleanup targets that scrolled completely off the left screen
      if (x < -100) {
        targetsToRemove.push(target);
      }
    });

    // Remove old targets
    targetsToRemove.forEach(target => {
      if (target.element) target.element.remove();
      this.arcadeTargets = this.arcadeTargets.filter(t => t.id !== target.id);
    });
  }

  scoreTarget(target, differenceMs) {
    if (differenceMs === null) {
      // Miss
      this.streak = 1;
      this.streakDisplay.textContent = 'x1';
      this.flashHitIndicator('MISS', 'var(--danger-color)');
      if (target.element) {
        target.element.style.borderColor = 'var(--danger-color)';
        target.element.style.transform = 'scale(0.8)';
        target.element.style.opacity = '0.5';
      }
      this.recordSRSFail(target.chord);
      return;
    }

    // Hit rating
    let points = 0;
    let text = '';
    let color = '';

    if (differenceMs < 80) {
      points = 500;
      text = 'PERFECT!';
      color = 'var(--accent-color)';
    } else {
      points = 250;
      text = 'GOOD!';
      color = 'var(--accent-purple)';
    }

    const calculatedPoints = points * this.streak;
    this.score += calculatedPoints;
    this.scoreDisplay.textContent = this.score.toString().padStart(4, '0');
    
    this.streak++;
    this.streakDisplay.textContent = `x${this.streak}`;

    this.flashHitIndicator(text, color);

    // Spawn clearance rewards particles & text in Arcade Mode
    let centerX = window.innerWidth / 2;
    let centerY = window.innerHeight / 2;
    if (target.element) {
      const rect = target.element.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;
    }
    this.triggerClearJuice(centerX, centerY, `+${calculatedPoints}`);

    this.recordSRSSuccess(target.chord);
    this.checkProgressionUnlock();

    if (target.element) {
      target.element.style.borderColor = 'var(--success-color)';
      target.element.style.transform = 'scale(1.2)';
      target.element.style.opacity = '0';
      target.element.style.transition = 'all 0.3s ease';
    }
  }

  flashHitIndicator(text, color) {
    this.hitIndicator.textContent = text;
    this.hitIndicator.style.borderColor = color;
    this.hitIndicator.style.color = color;
    this.hitIndicator.classList.add('active');
    setTimeout(() => {
      this.hitIndicator.classList.remove('active');
    }, 150);
  }

  // --- GOOGLE DRIVE INTEGRATION ---

  initGoogleDriveState() {
    if (this.accessToken) {
      this.updateSyncStatus('connected', 'Linked');
      this.syncProgressWithDrive();
    } else {
      this.updateSyncStatus('disconnected', 'Disconnected');
    }
  }

  authenticateGoogle() {
    if (!this.gapiClientId) {
      alert("Please enter your Google Client ID in the input field first.");
      return;
    }

    this.updateSyncStatus('disconnected', 'Connecting...');

    try {
      if (!this.tokenClient) {
        // Initialize GIS Client SDK Token client using user's Client ID
        this.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.gapiClientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: async (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              console.error("Google Auth error:", tokenResponse);
              this.updateSyncStatus('disconnected', 'Auth Failed');
              return;
            }
            this.accessToken = tokenResponse.access_token;
            localStorage.setItem('chordninja_gapi_token', this.accessToken);
            // GIS tokens live for 3600 seconds (1 hour)
            this.tokenExpiry = Date.now() + (parseInt(tokenResponse.expires_in) || 3600) * 1000;
            
            this.updateSyncStatus('connected', 'Syncing...');
            await this.syncProgressWithDrive();
          }
        });
      }

      // Trigger OAuth 2.0 Identity consent screen
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error("Failed to initialize Google Token Client:", err);
      this.updateSyncStatus('disconnected', 'Setup Failed');
      alert("Error initializing Google Identity Services. Check your Client ID format.");
    }
  }

  async syncProgressWithDrive() {
    if (!this.accessToken) return;

    try {
      // Find files named "chordninja_save.json" in Drive
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?q=name="chordninja_save.json" and trashed=false',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          this.unlinkGoogleDrive();
          this.updateSyncStatus('disconnected', 'Session Expired');
          return;
        }
        throw new Error("Failed to search Drive files");
      }

      const searchResult = await response.json();
      
      if (searchResult.files && searchResult.files.length > 0) {
        const cloudFile = searchResult.files[0];
        this.gapiFileId = cloudFile.id;
        localStorage.setItem('chordninja_gapi_file_id', this.gapiFileId);
        await this.loadFromCloud(this.gapiFileId);
      } else {
        // No save file found in Google Drive
        let startFresh = false;
        const hasLocalProgress = this.score > 0 || Object.values(this.srsData).some(d => d.mastery > 0);
        
        if (hasLocalProgress) {
          const keepLocal = confirm("No save file found in Google Drive!\n\nClick 'OK' to upload your current local progress to Google Drive.\nClick 'Cancel' to start fresh (this will reset your scores and mastery progress).");
          if (!keepLocal) {
            startFresh = true;
          }
        }

        if (startFresh) {
          this.resetLocalProgressState();
        }
        await this.createCloudSaveFile();
      }
    } catch (err) {
      console.error("Error during Google Drive sync:", err);
      this.updateSyncStatus('connected', 'Sync Error');
    }
  }

  resetLocalProgressState() {
    this.score = 0;
    this.scoreDisplay.textContent = '0000';
    this.streak = 1;
    this.streakDisplay.textContent = 'x1';
    
    // Reset SRS
    for (const key in this.srsData) {
      this.srsData[key] = {
        box: 1,
        lastPlayed: 0,
        intervalMs: 15000,
        mastery: 0
      };
    }
    
    // Save to localStorage
    localStorage.setItem('chordninja_srs', JSON.stringify(this.srsData));
    localStorage.setItem('chordninja_srs_timestamp', Date.now().toString());
    
    this.recentClearedChords = [];
    this.renderSkillTree();
    this.setTargetChord(this.currentChordKey);
    this.showPopupNotification("Progress reset successfully!");
  }

  async createCloudSaveFile() {
    if (!this.accessToken) return;

    this.updateSyncStatus('connected', 'Creating Save...');
    
    const metadata = {
      name: 'chordninja_save.json',
      mimeType: 'application/json'
    };

    const saveData = {
      srs: this.srsData,
      score: this.score,
      streak: this.streak,
      holdTime: this.dojoResonanceTime / 1000,
      timestamp: Date.now()
    };

    try {
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(saveData)], { type: 'application/json' }));

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: form
        }
      );

      if (!response.ok) throw new Error("Google Drive file creation failed");

      const resData = await response.json();
      this.gapiFileId = resData.id;
      localStorage.setItem('chordninja_gapi_file_id', this.gapiFileId);
      this.updateSyncStatus('connected', 'Synced');
    } catch (err) {
      console.error("Failed to create save file in Google Drive:", err);
      this.updateSyncStatus('connected', 'Create Failed');
    }
  }

  async saveToCloud() {
    // If not connected to Google Drive, do nothing (regular guest mode)
    if (!this.accessToken || !this.gapiFileId) return;

    // Check expiry
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      this.updateSyncStatus('disconnected', 'Session Expired');
      return;
    }

    const saveData = {
      srs: this.srsData,
      score: this.score,
      streak: this.streak,
      holdTime: this.dojoResonanceTime / 1000,
      timestamp: Date.now()
    };

    try {
      const response = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${this.gapiFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(saveData)
        }
      );

      if (!response.ok) throw new Error("Upload failed");
      this.updateSyncStatus('connected', 'Synced');
    } catch (err) {
      console.warn("Background cloud sync lagged:", err);
      this.updateSyncStatus('connected', 'Sync Lagged');
    }
  }

  async loadFromCloud(fileId) {
    if (!this.accessToken) return;

    try {
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (!response.ok) throw new Error("File content read failed");
      const cloudData = await response.json();

      const localTS = parseInt(localStorage.getItem('chordninja_srs_timestamp') || '0');
      const cloudTS = cloudData.timestamp || 0;

      if (cloudTS > localTS) {
        if (confirm("Newer progress found in Google Drive! Load from cloud? (This updates your scores and chord masteries)")) {
          this.applyCloudData(cloudData);
        } else {
          // Keep local progress and force update cloud file
          await this.saveToCloud();
        }
      } else if (localTS > cloudTS) {
        // Local is newer, update cloud save in background
        await this.saveToCloud();
      } else {
        // Timestamps align, load progress
        this.applyCloudData(cloudData);
      }
    } catch (err) {
      console.error("Failed to read cloud save data:", err);
      this.updateSyncStatus('connected', 'Load Failed');
    }
  }

  applyCloudData(cloudData) {
    if (cloudData.srs) {
      this.srsData = cloudData.srs;
      localStorage.setItem('chordninja_srs', JSON.stringify(this.srsData));
      if (cloudData.timestamp) {
        localStorage.setItem('chordninja_srs_timestamp', cloudData.timestamp.toString());
      }
    }
    if (cloudData.score !== undefined) {
      this.score = cloudData.score;
      this.scoreDisplay.textContent = this.score.toString().padStart(4, '0');
    }
    if (cloudData.streak !== undefined) {
      this.streak = cloudData.streak;
      this.streakDisplay.textContent = `x${this.streak}`;
    }
    if (cloudData.holdTime !== undefined) {
      this.dojoResonanceTime = cloudData.holdTime * 1000;
      if (this.sliderHoldTime && this.valHoldTime) {
        this.sliderHoldTime.value = cloudData.holdTime;
        this.valHoldTime.textContent = `${cloudData.holdTime.toFixed(1)}s`;
      }
    }

    this.renderSkillTree();
    this.setTargetChord(this.currentChordKey);
    this.updateSyncStatus('connected', 'Synced');
  }

  updateSyncStatus(state, message) {
    if (!this.syncStatusBadge) return;
    
    this.syncStatusBadge.textContent = message;

    if (state === 'connected') {
      this.syncStatusBadge.className = 'status-badge connected';
      if (this.btnGoogleAuth) {
        this.btnGoogleAuth.textContent = 'Unlink Drive';
        this.btnGoogleAuth.style.backgroundColor = 'var(--danger-color)';
      }
    } else {
      this.syncStatusBadge.className = 'status-badge disconnected';
      if (this.btnGoogleAuth) {
        this.btnGoogleAuth.textContent = 'Link Google Drive';
        this.btnGoogleAuth.style.backgroundColor = 'var(--accent-purple)';
      }
    }
  }

  unlinkGoogleDrive() {
    this.accessToken = null;
    this.gapiFileId = null;
    this.tokenExpiry = null;
    this.tokenClient = null;

    localStorage.removeItem('chordninja_gapi_token');
    localStorage.removeItem('chordninja_gapi_file_id');
    
    this.updateSyncStatus('disconnected', 'Disconnected');
    this.showPopupNotification("Google Drive unlinked. (Guest mode active)");
  }

  // physics-based particle system, floating text and numeric popup pop bounce feedback emission
  triggerClearJuice(x, y, textVal = '+100') {
    // 1. Create Floating text popup (slowed to 1.5s)
    const floatText = document.createElement('div');
    floatText.className = 'juice-floating-text';
    floatText.textContent = textVal;
    floatText.style.left = `${x}px`;
    floatText.style.top = `${y}px`;
    document.body.appendChild(floatText);
    setTimeout(() => floatText.remove(), 1500);

    // 2. Create Shockwave expanding ring ripple (slowed to 1.2s)
    const shockwave = document.createElement('div');
    shockwave.className = 'juice-shockwave';
    shockwave.style.left = `${x}px`;
    shockwave.style.top = `${y}px`;
    document.body.appendChild(shockwave);
    setTimeout(() => shockwave.remove(), 1200);

    // 3. Score & Streak numeric spring pop-bounce triggers
    const headerScore = document.getElementById('score-display');
    const headerStreak = document.getElementById('streak-display');
    
    if (headerScore) {
      headerScore.classList.remove('pop-bounce');
      void headerScore.offsetWidth; // force browser layout recalculation
      headerScore.classList.add('pop-bounce');
    }
    if (headerStreak) {
      headerStreak.classList.remove('pop-bounce');
      void headerStreak.offsetWidth; // force browser layout recalculation
      headerStreak.classList.add('pop-bounce');
    }

    // 4. Erupt neon spark particles (made floatier and slower)
    const particleCount = 38;
    const colors = ['#00ffc4', '#c07cf7', '#ff3366', '#ffd700', '#00e676'];
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'juice-particle';
      
      const size = 4 + Math.random() * 8;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.style.background = color;
      particle.style.boxShadow = `0 0 12px ${color}, 0 0 4px ${color}`;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      
      document.body.appendChild(particle);

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.8; // cut speeds in half
      
      particles.push({
        element: particle,
        px: x,
        py: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2, // slight upward ejection bias
        alpha: 1.0,
        decay: 0.005 + Math.random() * 0.007 // slower decay for longer lifetime
      });
    }

    // Physics Animation Loop
    const tick = () => {
      let active = false;
      particles.forEach(p => {
        if (p.alpha <= 0) return;
        
        p.px += p.vx;
        p.py += p.vy;
        p.vy += 0.22; // apply gravity pull downwards
        p.vx *= 0.96; // apply horizontal drag
        p.vy *= 0.96; // apply vertical drag
        
        p.alpha -= p.decay; // fade particle
        
        p.element.style.transform = `translate(${p.px - x}px, ${p.py - y}px)`;
        p.element.style.opacity = p.alpha;
        
        if (p.alpha > 0) {
          active = true;
        } else {
          p.element.remove();
        }
      });

      if (active) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}

// Instantiate the game controller once window has loaded
window.addEventListener('DOMContentLoaded', () => {
  new GameController();
});
