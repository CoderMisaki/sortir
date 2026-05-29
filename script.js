'use strict';

const GameConfig = {
  startingLives: 3,
  basePackageTime: 8000,
  minPackageTime: 2600,
  levelUpEvery: 10,
  timeAttackLimit: 60,
  timeAttackBonus: 1,
  timeAttackPenalty: 2,
  inputLockMs: 420,
  categories: [
    { key: 'A', label: 'Rak A', prefix: 'A-' },
    { key: 'B', label: 'Rak B', prefix: 'B-' },
    { key: 'C', label: 'Rak C', prefix: 'C-' },
    { key: 'EXP', label: 'Express', prefix: 'EXP-' },
    { key: 'FRG', label: 'Fragile', prefix: 'FRG-' },
    { key: 'RET', label: 'Return', prefix: 'RET-' }
  ]
};

const GameState = {
  sessionId: 0,
  mode: 'classic',
  score: 0,
  lives: GameConfig.startingLives,
  level: 1,
  combo: 0,
  correctCount: 0,
  wrongCount: 0,
  timeoutCount: 0,
  totalProcessed: 0,
  maxCombo: 0,
  currentPackage: null,
  isRunning: false,
  isPaused: false,
  isInputLocked: false,
  packageTimeLimit: GameConfig.basePackageTime,
  packageTimerLeft: GameConfig.basePackageTime,
  globalTimeAttackLeft: GameConfig.timeAttackLimit,
  lastFrameTime: 0
};

const DOM = {
  score: document.getElementById('scoreDisplay'),
  bestScore: document.getElementById('bestScoreDisplay'),
  combo: document.getElementById('comboDisplay'),
  comboBadge: document.getElementById('comboBadge'),
  lives: document.getElementById('livesDisplay'),
  level: document.getElementById('levelDisplay'),
  modeLabel: document.getElementById('modeHeaderLabel'),
  accuracy: document.getElementById('accuracyDisplay'),
  totalSorted: document.getElementById('totalSortedDisplay'),
  timeLeft: document.getElementById('timeLeftDisplay'),
  timerBar: document.getElementById('packageTimerBar'),
  conveyor: document.getElementById('conveyorBelt'),
  packageContainer: document.getElementById('packageContainer'),
  destZones: Array.from(document.querySelectorAll('.dest-zone')),
  modeModal: document.getElementById('modeModal'),
  tutorialModal: document.getElementById('tutorialModal'),
  pauseModal: document.getElementById('pauseModal'),
  gameOverModal: document.getElementById('gameOverModal'),
  resetModal: document.getElementById('resetModal'),
  darkModeBtn: document.getElementById('darkModeBtn'),
  sunIcon: document.getElementById('sunIcon'),
  moonIcon: document.getElementById('moonIcon'),
  muteBtn: document.getElementById('muteBtn'),
  unmutedIcon: document.getElementById('unmutedIcon'),
  mutedIcon: document.getElementById('mutedIcon'),
  helpBtn: document.getElementById('helpBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  pauseBtnText: document.getElementById('pauseBtnText'),
  selectClassicBtn: document.getElementById('selectClassicBtn'),
  selectTimeAttackBtn: document.getElementById('selectTimeAttackBtn'),
  closeTutorialBtn: document.getElementById('closeTutorialBtn'),
  startFromTutorialBtn: document.getElementById('startFromTutorialBtn'),
  resumeModalBtn: document.getElementById('resumeModalBtn'),
  restartFromPauseBtn: document.getElementById('restartFromPauseBtn'),
  goRestartBtn: document.getElementById('goRestartBtn'),
  goMenuBtn: document.getElementById('goMenuBtn'),
  resetHighScoreBtn: document.getElementById('resetHighScoreBtn'),
  cancelResetBtn: document.getElementById('cancelResetBtn'),
  confirmResetBtn: document.getElementById('confirmResetBtn'),
  resetFeedback: document.getElementById('resetFeedback'),
  highClassicLabel: document.getElementById('highClassicLabel'),
  highTimeLabel: document.getElementById('highTimeLabel'),
  gameOverStats: document.getElementById('gameOverStats'),
  achievementList: document.getElementById('achievementList'),
  newHighScoreAlert: document.getElementById('newHighScoreAlert'),
  levelUpBanner: document.getElementById('levelUpBanner'),
  levelUpDesc: document.getElementById('levelUpDesc')
};

const StorageManager = {
  getHighScore(mode) {
    try { return Number.parseInt(localStorage.getItem(`kurir_kilat_highscore_${mode}`), 10) || 0; } catch { return 0; }
  },
  setHighScore(mode, score) {
    try { localStorage.setItem(`kurir_kilat_highscore_${mode}`, String(score)); return true; } catch { return false; }
  },
  getMutePreference() {
    try { return localStorage.getItem('kurir_kilat_mute') === 'true'; } catch { return false; }
  },
  setMutePreference(value) {
    try { localStorage.setItem('kurir_kilat_mute', String(value)); return true; } catch { return false; }
  },
  getDarkModePreference() {
    try {
      const stored = localStorage.getItem('kurir_kilat_dark');
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  },
  setDarkModePreference(value) {
    try { localStorage.setItem('kurir_kilat_dark', String(value)); return true; } catch { return false; }
  },
  clearHighScores() {
    try {
      localStorage.removeItem('kurir_kilat_highscore_classic');
      localStorage.removeItem('kurir_kilat_highscore_timeAttack');
      return true;
    } catch { return false; }
  }
};

const TimeoutManager = {
  ids: new Set(),
  set(callback, delay, sessionId = GameState.sessionId) {
    const timeoutId = window.setTimeout(() => {
      this.ids.delete(timeoutId);
      if (sessionId === GameState.sessionId) callback();
    }, delay);
    this.ids.add(timeoutId);
    return timeoutId;
  },
  clearAll() {
    this.ids.forEach(timeoutId => window.clearTimeout(timeoutId));
    this.ids.clear();
  }
};

const AudioManager = {
  isMuted: false,
  audioCtx: null,
  masterGain: null,
  musicGain: null,
  musicTimer: null,
  musicNodes: [],
  musicStep: 0,
  isMusicPlaying: false,
  isSupported: Boolean(window.AudioContext || window.webkitAudioContext),

  init() {
    this.isMuted = StorageManager.getMutePreference();
    this.updateMuteUI();
  },
  ensureContext() {
    if (!this.isSupported) return null;
    try {
      if (!this.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new Ctx();
        this.masterGain = this.audioCtx.createGain();
        this.musicGain = this.audioCtx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : 0.38;
        this.musicGain.gain.value = 0.055;
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.audioCtx.destination);
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => undefined);
      }
      return this.audioCtx;
    } catch {
      this.isSupported = false;
      return null;
    }
  },
  setMasterVolume() {
    if (!this.audioCtx || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.38, this.audioCtx.currentTime, 0.02);
  },
  playTone(freq, type, duration, delay = 0, volume = 0.08) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startAt = ctx.currentTime + delay;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.03);
    } catch {
      this.isSupported = false;
    }
  },
  playClick() { this.playTone(420, 'sine', 0.06, 0, 0.035); },
  playCorrect() { this.playTone(523.25, 'triangle', 0.11, 0, 0.07); this.playTone(783.99, 'sine', 0.16, 0.07, 0.06); },
  playWrong() { this.playTone(155.56, 'sawtooth', 0.25, 0, 0.08); },
  playLevelUp() { [261.63, 329.63, 392, 523.25].forEach((freq, index) => this.playTone(freq, 'sine', 0.18, index * 0.07, 0.07)); },
  playGameOver() { [392, 349.23, 293.66, 196].forEach((freq, index) => this.playTone(freq, 'triangle', 0.3, index * 0.1, 0.065)); },
  startMusic() {
    if (this.isMuted || this.isMusicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;
    this.scheduleMusic();
  },
  scheduleMusic() {
    if (!this.isMusicPlaying || this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    const notes = [196, 246.94, 293.66, 246.94, 220, 261.63, 329.63, 261.63];
    const startAt = ctx.currentTime;
    this.createMusicOsc(notes[this.musicStep % notes.length], 'sine', startAt, 0.55, 0.025);
    if (this.musicStep % 2 === 0) this.createMusicOsc(98 + (this.musicStep % 4) * 6, 'triangle', startAt, 0.7, 0.016);
    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => this.scheduleMusic(), 620);
  },
  createMusicOsc(freq, type, startAt, duration, volume) {
    if (!this.audioCtx || !this.musicGain) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.04);
      this.musicNodes.push(osc, gain);
      window.setTimeout(() => {
        this.musicNodes = this.musicNodes.filter(node => node !== osc && node !== gain);
      }, (duration + 0.1) * 1000);
    } catch {
      this.isSupported = false;
    }
  },
  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicNodes.forEach(node => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch { /* node already stopped */ }
    });
    this.musicNodes = [];
  },
  toggleMute() {
    this.isMuted = !this.isMuted;
    StorageManager.setMutePreference(this.isMuted);
    this.setMasterVolume();
    this.updateMuteUI();
    if (this.isMuted) this.stopMusic();
    if (!this.isMuted && GameState.isRunning && !GameState.isPaused) this.startMusic();
  },
  updateMuteUI() {
    DOM.unmutedIcon.classList.toggle('hidden', this.isMuted);
    DOM.mutedIcon.classList.toggle('hidden', !this.isMuted);
    DOM.muteBtn.setAttribute('aria-pressed', String(this.isMuted));
  }
};

const Game = {
  gameLoopId: null,

  init() {
    this.applyTheme(StorageManager.getDarkModePreference());
    AudioManager.init();
    this.updateHighScoreLabels();
    this.updateStatsUI();
    this.bindEvents();
    DOM.conveyor.classList.add('paused');
  },
  bindEvents() {
    DOM.selectClassicBtn.addEventListener('click', () => this.startGame('classic'));
    DOM.selectTimeAttackBtn.addEventListener('click', () => this.startGame('timeAttack'));
    DOM.pauseBtn.addEventListener('click', () => this.togglePause());
    DOM.resumeModalBtn.addEventListener('click', () => this.togglePause(false));
    DOM.restartFromPauseBtn.addEventListener('click', () => this.startGame(GameState.mode));
    DOM.goRestartBtn.addEventListener('click', () => this.startGame(GameState.mode));
    DOM.goMenuBtn.addEventListener('click', () => this.backToMenu());
    DOM.helpBtn.addEventListener('click', () => this.showModal(DOM.tutorialModal));
    DOM.closeTutorialBtn.addEventListener('click', () => this.hideModal(DOM.tutorialModal));
    DOM.startFromTutorialBtn.addEventListener('click', () => this.hideModal(DOM.tutorialModal));
    DOM.muteBtn.addEventListener('click', () => { AudioManager.toggleMute(); AudioManager.playClick(); });
    DOM.darkModeBtn.addEventListener('click', () => this.toggleTheme());
    DOM.resetHighScoreBtn.addEventListener('click', () => this.openResetModal());
    DOM.cancelResetBtn.addEventListener('click', () => this.hideModal(DOM.resetModal));
    DOM.confirmResetBtn.addEventListener('click', () => this.confirmResetHighScore());
    DOM.destZones.forEach(zone => {
      zone.addEventListener('click', () => this.submitSort(zone.dataset.dest));
      zone.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
      zone.addEventListener('drop', event => { event.preventDefault(); this.submitSort(zone.dataset.dest); });
    });
    document.addEventListener('keydown', event => this.handleKeyboard(event));
  },
  handleKeyboard(event) {
    if (this.hasOpenBlockingModal()) return;
    const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'EXP', '5': 'FRG', '6': 'RET' };
    if (keyMap[event.key]) {
      event.preventDefault();
      this.flashZone(keyMap[event.key]);
      this.submitSort(keyMap[event.key]);
    }
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.togglePause();
    }
  },
  hasOpenBlockingModal() {
    return [DOM.modeModal, DOM.tutorialModal, DOM.pauseModal, DOM.gameOverModal, DOM.resetModal].some(modal => !modal.classList.contains('hidden'));
  },
  startGame(mode) {
    this.cleanupSession();
    GameState.sessionId += 1;
    GameState.mode = mode;
    GameState.score = 0;
    GameState.lives = GameConfig.startingLives;
    GameState.level = 1;
    GameState.combo = 0;
    GameState.correctCount = 0;
    GameState.wrongCount = 0;
    GameState.timeoutCount = 0;
    GameState.totalProcessed = 0;
    GameState.maxCombo = 0;
    GameState.currentPackage = null;
    GameState.isRunning = true;
    GameState.isPaused = false;
    GameState.isInputLocked = false;
    GameState.packageTimeLimit = GameConfig.basePackageTime;
    GameState.packageTimerLeft = GameConfig.basePackageTime;
    GameState.globalTimeAttackLeft = GameConfig.timeAttackLimit;
    GameState.lastFrameTime = performance.now();
    [DOM.modeModal, DOM.pauseModal, DOM.gameOverModal, DOM.resetModal].forEach(modal => modal.classList.add('hidden'));
    DOM.pauseBtn.classList.remove('hidden');
    DOM.pauseBtnText.textContent = 'Pause';
    DOM.conveyor.classList.remove('paused');
    DOM.levelUpBanner.classList.remove('show');
    AudioManager.playClick();
    AudioManager.startMusic();
    this.updateStatsUI();
    this.generatePackage();
    this.startLoop();
  },
  cleanupSession() {
    TimeoutManager.clearAll();
    if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
    this.gameLoopId = null;
    document.querySelectorAll('.particle').forEach(particle => particle.remove());
    DOM.packageContainer.replaceChildren();
    DOM.destZones.forEach(zone => zone.classList.remove('active-hit'));
  },
  startLoop() {
    if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
    const session = GameState.sessionId;
    const tick = now => {
      if (session !== GameState.sessionId || !GameState.isRunning) return;
      this.gameLoopId = requestAnimationFrame(tick);
      if (GameState.isPaused) {
        GameState.lastFrameTime = now;
        return;
      }
      const delta = Math.min(120, now - GameState.lastFrameTime);
      GameState.lastFrameTime = now;
      GameState.packageTimerLeft = Math.max(0, GameState.packageTimerLeft - delta);
      if (GameState.mode === 'timeAttack') {
        GameState.globalTimeAttackLeft = Math.max(0, GameState.globalTimeAttackLeft - delta / 1000);
        if (GameState.globalTimeAttackLeft <= 0) {
          this.gameOver();
          return;
        }
      }
      this.updateTimerUI();
      if (GameState.packageTimerLeft <= 0) this.handleTimeout();
    };
    this.gameLoopId = requestAnimationFrame(tick);
  },
  generatePackage() {
    if (!GameState.isRunning || GameState.isPaused) return;
    const category = GameConfig.categories[Math.floor(Math.random() * GameConfig.categories.length)];
    const number = String(Math.floor(Math.random() * 900) + 10).padStart(2, '0');
    const id = Math.random().toString(16).slice(2, 8).toUpperCase();
    GameState.currentPackage = {
      destination: category.key,
      code: `${category.prefix}${number}`,
      id
    };
    GameState.packageTimeLimit = Math.max(GameConfig.minPackageTime, GameConfig.basePackageTime - (GameState.level - 1) * 450);
    GameState.packageTimerLeft = GameState.packageTimeLimit;
    this.renderPackage(GameState.currentPackage);
    this.updateTimerUI();
  },
  renderPackage(pkg) {
    DOM.packageContainer.replaceChildren();
    const card = document.createElement('div');
    card.className = 'package-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Paket aktif ${pkg.code}, seret ke rak tujuan atau tekan shortcut`);

    const code = document.createElement('span');
    code.className = 'package-code';
    code.textContent = pkg.code;
    const barcode = document.createElement('div');
    barcode.className = 'barcode';
    barcode.setAttribute('aria-hidden', 'true');
    const holo = document.createElement('div');
    holo.className = 'holo-id';
    const idLabel = document.createElement('small');
    idLabel.textContent = 'ID';
    const idValue = document.createElement('span');
    idValue.textContent = pkg.id;
    holo.append(idLabel, idValue);
    card.append(code, barcode, holo);
    card.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', pkg.id);
    });
    DOM.packageContainer.appendChild(card);
  },
  submitSort(destination) {
    if (!GameState.isRunning || GameState.isPaused || GameState.isInputLocked || !GameState.currentPackage) return;
    GameState.isInputLocked = true;
    this.flashZone(destination);
    const isCorrect = destination === GameState.currentPackage.destination;
    GameState.totalProcessed += 1;
    if (isCorrect) this.handleCorrectSort();
    else this.handleWrongSort();
  },
  handleCorrectSort() {
    GameState.correctCount += 1;
    GameState.combo += 1;
    GameState.maxCombo = Math.max(GameState.maxCombo, GameState.combo);
    const baseScore = 100;
    const timeBonus = Math.ceil((GameState.packageTimerLeft / GameState.packageTimeLimit) * 60);
    const comboBonus = Math.floor(GameState.combo * 15);
    GameState.score += baseScore + timeBonus + comboBonus;
    if (GameState.mode === 'timeAttack') GameState.globalTimeAttackLeft += GameConfig.timeAttackBonus;
    this.animatePackage('success');
    this.createParticles('✦');
    AudioManager.playCorrect();
    if (GameState.mode === 'classic' && GameState.correctCount > 0 && GameState.correctCount % GameConfig.levelUpEvery === 0) {
      GameState.level += 1;
      this.showLevelUp();
    }
    this.finishTurn();
  },
  handleWrongSort() {
    GameState.wrongCount += 1;
    GameState.combo = 0;
    if (GameState.mode === 'classic') GameState.lives -= 1;
    if (GameState.mode === 'timeAttack') GameState.globalTimeAttackLeft = Math.max(0, GameState.globalTimeAttackLeft - GameConfig.timeAttackPenalty);
    this.animatePackage('shake');
    AudioManager.playWrong();
    this.updateStatsUI();
    if ((GameState.mode === 'classic' && GameState.lives <= 0) || (GameState.mode === 'timeAttack' && GameState.globalTimeAttackLeft <= 0)) {
      TimeoutManager.set(() => this.gameOver(), 360);
      return;
    }
    this.finishTurn();
  },
  handleTimeout() {
    if (!GameState.isRunning || GameState.isPaused || GameState.isInputLocked) return;
    GameState.isInputLocked = true;
    GameState.timeoutCount += 1;
    GameState.totalProcessed += 1;
    GameState.combo = 0;
    if (GameState.mode === 'classic') GameState.lives -= 1;
    this.animatePackage('timeout');
    AudioManager.playWrong();
    this.updateStatsUI();
    if (GameState.mode === 'classic' && GameState.lives <= 0) {
      TimeoutManager.set(() => this.gameOver(), 360);
      return;
    }
    this.finishTurn();
  },
  finishTurn() {
    this.updateStatsUI();
    const session = GameState.sessionId;
    TimeoutManager.set(() => {
      if (!GameState.isRunning || session !== GameState.sessionId) return;
      GameState.isInputLocked = false;
      this.generatePackage();
    }, GameConfig.inputLockMs, session);
  },
  animatePackage(className) {
    const card = DOM.packageContainer.querySelector('.package-card');
    if (card) card.classList.add(className);
  },
  showLevelUp() {
    const session = GameState.sessionId;
    DOM.levelUpDesc.textContent = `Level ${GameState.level}: timer paket makin singkat.`;
    DOM.levelUpBanner.classList.add('show');
    AudioManager.playLevelUp();
    TimeoutManager.set(() => DOM.levelUpBanner.classList.remove('show'), 1000, session);
  },
  updateStatsUI() {
    DOM.score.textContent = this.formatNumber(GameState.score);
    DOM.bestScore.textContent = this.formatNumber(Math.max(StorageManager.getHighScore(GameState.mode), GameState.score));
    DOM.combo.textContent = `x${GameState.combo}`;
    DOM.comboBadge.classList.toggle('hidden', GameState.combo < 3);
    DOM.accuracy.textContent = `${this.getAccuracy()}%`;
    DOM.totalSorted.textContent = this.formatNumber(GameState.totalProcessed);
    DOM.modeLabel.textContent = GameState.mode === 'classic' ? 'CLASSIC' : 'TIME ATTACK';
    if (GameState.mode === 'classic') {
      DOM.lives.innerHTML = this.renderHearts(GameState.lives);
      DOM.level.textContent = String(GameState.level);
    } else {
      DOM.lives.innerHTML = '<svg class="icon icon-infinity"><use href="#icon-infinity"></use></svg>';
      DOM.level.textContent = `${Math.ceil(GameState.globalTimeAttackLeft)}s`;
    }
    this.updateTimerUI();
  },
  updateTimerUI() {
    const ratio = GameState.packageTimeLimit > 0 ? Math.max(0, GameState.packageTimerLeft / GameState.packageTimeLimit) : 0;
    DOM.timerBar.style.width = `${ratio * 100}%`;
    DOM.timerBar.classList.toggle('warning', ratio <= 0.28);
    DOM.timerBar.classList.toggle('time-attack', GameState.mode === 'timeAttack' && ratio > 0.28);
    DOM.timeLeft.textContent = `${(GameState.packageTimerLeft / 1000).toFixed(1)}s`;
    if (GameState.mode === 'timeAttack') DOM.level.textContent = `${Math.ceil(GameState.globalTimeAttackLeft)}s`;
  },
  getAccuracy() {
    if (GameState.totalProcessed === 0) return 100;
    return Math.round((GameState.correctCount / GameState.totalProcessed) * 100);
  },
  renderHearts(lives) {
    const full = Math.max(0, Math.min(GameConfig.startingLives, lives));
    const empty = GameConfig.startingLives - full;
    const fullHeart = `<svg class="icon icon-heart full"><use href="#icon-heart-full"></use></svg>`;
    const emptyHeart = `<svg class="icon icon-heart empty"><use href="#icon-heart-empty"></use></svg>`;
    return `${fullHeart.repeat(full)}${emptyHeart.repeat(empty)}`;
  },
  togglePause(forcePaused) {
    if (!GameState.isRunning) return;
    const nextPaused = typeof forcePaused === 'boolean' ? forcePaused : !GameState.isPaused;
    GameState.isPaused = nextPaused;
    DOM.pauseModal.classList.toggle('hidden', !nextPaused);
    DOM.conveyor.classList.toggle('paused', nextPaused);
    DOM.pauseBtnText.textContent = nextPaused ? 'Resume' : 'Pause';
    if (nextPaused) {
      AudioManager.stopMusic();
    } else {
      GameState.lastFrameTime = performance.now();
      AudioManager.startMusic();
    }
  },
  gameOver() {
    if (!GameState.isRunning) return;
    GameState.isRunning = false;
    GameState.isPaused = false;
    GameState.isInputLocked = true;
    TimeoutManager.clearAll();
    if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
    this.gameLoopId = null;
    DOM.pauseBtn.classList.add('hidden');
    DOM.conveyor.classList.add('paused');
    DOM.pauseModal.classList.add('hidden');
    DOM.levelUpBanner.classList.remove('show');
    AudioManager.stopMusic();
    AudioManager.playGameOver();
    this.renderGameOver();
    DOM.gameOverModal.classList.remove('hidden');
  },
  renderGameOver() {
    const previousHigh = StorageManager.getHighScore(GameState.mode);
    const isNewHigh = GameState.score > previousHigh;
    if (isNewHigh) StorageManager.setHighScore(GameState.mode, GameState.score);
    DOM.newHighScoreAlert.classList.toggle('hidden', !isNewHigh);
    this.updateHighScoreLabels();
    const rows = [
      ['Final Score', this.formatNumber(GameState.score)],
      ['High Score', this.formatNumber(StorageManager.getHighScore(GameState.mode))],
      ['Level Terakhir', GameState.mode === 'classic' ? GameState.level : 'Time Attack'],
      ['Accuracy', `${this.getAccuracy()}%`],
      ['Correct Count', GameState.correctCount],
      ['Wrong Count', GameState.wrongCount],
      ['Timeout Count', GameState.timeoutCount],
      ['Processed Count', GameState.totalProcessed],
      ['Max Combo', `x${GameState.maxCombo}`]
    ];
    DOM.gameOverStats.replaceChildren();
    rows.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const valueEl = document.createElement('strong');
      valueEl.textContent = String(value);
      card.append(labelEl, valueEl);
      DOM.gameOverStats.appendChild(card);
    });
    this.renderAchievements(isNewHigh);
  },
  renderAchievements(isNewHigh) {
    const achievements = [];
    if (isNewHigh) achievements.push('<svg class="icon"><use href="#icon-medal"></use></svg> Rekor Baru');
    if (GameState.correctCount >= 10) achievements.push('<svg class="icon"><use href="#icon-box"></use></svg> Kurir Andal');
    if (GameState.maxCombo >= 8) achievements.push('<svg class="icon"><use href="#icon-lightning"></use></svg> Combo Kilat');
    if (this.getAccuracy() >= 90 && GameState.totalProcessed >= 5) achievements.push('<svg class="icon"><use href="#icon-crosshair"></use></svg> Scanner Presisi');
    if (GameState.timeoutCount === 0 && GameState.totalProcessed > 0) achievements.push('<svg class="icon"><use href="#icon-clock"></use></svg> Anti Timeout');
    if (GameState.score >= 3000) achievements.push('<svg class="icon"><use href="#icon-trophy"></use></svg> Operator Elite');
    if (achievements.length === 0) achievements.push('<svg class="icon"><use href="#icon-seedling"></use></svg> Rookie Gudang');
    DOM.achievementList.replaceChildren();
    achievements.forEach(text => {
      const item = document.createElement('div');
      item.className = 'achievement-item';
      item.innerHTML = text;
      DOM.achievementList.appendChild(item);
    });
  },
  updateHighScoreLabels() {
    DOM.highClassicLabel.textContent = this.formatNumber(StorageManager.getHighScore('classic'));
    DOM.highTimeLabel.textContent = this.formatNumber(StorageManager.getHighScore('timeAttack'));
    DOM.bestScore.textContent = this.formatNumber(StorageManager.getHighScore(GameState.mode));
  },
  openResetModal() {
    DOM.resetFeedback.textContent = '';
    DOM.confirmResetBtn.disabled = false;
    DOM.resetModal.classList.remove('hidden');
  },
  confirmResetHighScore() {
    const didClear = StorageManager.clearHighScores();
    this.updateHighScoreLabels();
    DOM.resetFeedback.textContent = didClear ? 'High score berhasil direset.' : 'Browser menolak akses localStorage.';
    DOM.confirmResetBtn.disabled = true;
    TimeoutManager.set(() => this.hideModal(DOM.resetModal), 950, GameState.sessionId);
  },
  backToMenu() {
    this.cleanupSession();
    GameState.sessionId += 1;
    GameState.isRunning = false;
    GameState.isPaused = false;
    GameState.isInputLocked = false;
    AudioManager.stopMusic();
    DOM.pauseBtn.classList.add('hidden');
    DOM.gameOverModal.classList.add('hidden');
    DOM.modeModal.classList.remove('hidden');
    DOM.conveyor.classList.add('paused');
    this.updateHighScoreLabels();
  },
  showModal(modal) {
    modal.classList.remove('hidden');
  },
  hideModal(modal) {
    modal.classList.add('hidden');
  },
  flashZone(destination) {
    const zone = DOM.destZones.find(item => item.dataset.dest === destination);
    if (!zone) return;
    zone.classList.add('active-hit');
    TimeoutManager.set(() => zone.classList.remove('active-hit'), 150, GameState.sessionId);
  },
  createParticles(symbol) {
    const rect = DOM.packageContainer.getBoundingClientRect();
    for (let index = 0; index < 10; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.innerHTML = symbol;
      particle.style.left = `${rect.left + rect.width / 2 + Math.random() * 90 - 45}px`;
      particle.style.top = `${rect.top + rect.height / 2 + Math.random() * 36 - 18}px`;
      document.body.appendChild(particle);
      TimeoutManager.set(() => particle.remove(), 850, GameState.sessionId);
    }
  },
  toggleTheme() {
    const isDark = !document.documentElement.classList.contains('light');
    this.applyTheme(!isDark);
    StorageManager.setDarkModePreference(!isDark);
    AudioManager.playClick();
  },
  applyTheme(isDark) {
    document.documentElement.classList.toggle('light', !isDark);
    document.documentElement.classList.toggle('dark', isDark);
    DOM.sunIcon.classList.toggle('hidden', isDark);
    DOM.moonIcon.classList.toggle('hidden', !isDark);
    DOM.darkModeBtn.setAttribute('aria-pressed', String(isDark));
  },
  formatNumber(value) {
    return new Intl.NumberFormat('id-ID').format(value);
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());
