'use strict';

const GameConfig = {
  startingLives: 3,
  basePackageTime: 8000,
  minPackageTime: 2500,
  levelUpEvery: 10,
  comboBonusMultiplier: 0.1,
  timeAttackLimit: 60,
  timeAttackPenalty: 2,
  timeAttackBonus: 1,
  categories: [
    { key: 'A', label: 'Rak A', prefix: 'A-', color: '#2563eb' },
    { key: 'B', label: 'Rak B', prefix: 'B-', color: '#16a34a' },
    { key: 'C', label: 'Rak C', prefix: 'C-', color: '#9333ea' },
    { key: 'EXP', label: 'Express', prefix: 'EXP-', color: '#d97706' },
    { key: 'FRG', label: 'Fragile', prefix: 'FRG-', color: '#dc2626' },
    { key: 'RET', label: 'Return', prefix: 'RET-', color: '#64748b' }
  ]
};

const GameState = {
  sessionId: 0,
  mode: 'classic',
  score: 0,
  lives: GameConfig.startingLives,
  level: 1,
  combo: 0,
  maxCombo: 0,
  correctCount: 0,
  wrongCount: 0,
  timeoutCount: 0,
  totalProcessed: 0,
  currentPackage: null,
  isRunning: false,
  isPaused: false,
  isInputLocked: false,
  packageTimeLimit: GameConfig.basePackageTime,
  packageTimerLeft: GameConfig.basePackageTime,
  globalTimeAttackLeft: GameConfig.timeAttackLimit,
  lastFrameTime: null,
  unlockedAchievements: []
};

const DOM = {
  score: document.getElementById('scoreDisplay'),
  combo: document.getElementById('comboDisplay'),
  comboBadge: document.getElementById('comboBadge'),
  lives: document.getElementById('livesDisplay'),
  level: document.getElementById('levelDisplay'),
  modeHeaderLabel: document.getElementById('modeHeaderLabel'),
  accuracy: document.getElementById('accuracyDisplay'),
  totalSorted: document.getElementById('totalSortedDisplay'),
  timerBar: document.getElementById('packageTimerBar'),
  conveyor: document.getElementById('conveyorBelt'),
  packageContainer: document.getElementById('packageContainer'),
  destZones: Array.from(document.querySelectorAll('.dest-zone')),
  levelUpBanner: document.getElementById('levelUpBanner'),
  levelUpDesc: document.getElementById('levelUpDesc'),
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
  closeTutorial: document.getElementById('closeTutorialBtn'),
  startFromTutorialBtn: document.getElementById('startFromTutorialBtn'),
  selectClassicBtn: document.getElementById('selectClassicBtn'),
  selectTimeAttackBtn: document.getElementById('selectTimeAttackBtn'),
  resumeModalBtn: document.getElementById('resumeModalBtn'),
  restartFromPauseBtn: document.getElementById('restartFromPauseBtn'),
  goRestartBtn: document.getElementById('goRestartBtn'),
  goMenuBtn: document.getElementById('goMenuBtn'),
  resetHighScoreBtn: document.getElementById('resetHighScoreBtn'),
  cancelResetBtn: document.getElementById('cancelResetBtn'),
  confirmResetBtn: document.getElementById('confirmResetBtn'),
  resetFeedback: document.getElementById('resetFeedback'),
  gameOverStats: document.getElementById('gameOverStats'),
  achievementList: document.getElementById('achievementList'),
  newHighScoreAlert: document.getElementById('newHighScoreAlert'),
  highClassicLabel: document.getElementById('highClassicLabel'),
  highTimeLabel: document.getElementById('highTimeLabel')
};

const StorageManager = {
  getHighScore(mode) {
    try { return Number.parseInt(localStorage.getItem(`kurir_kilat_highscore_${mode}`), 10) || 0; } catch { return 0; }
  },
  setHighScore(mode, score) {
    try { localStorage.setItem(`kurir_kilat_highscore_${mode}`, String(score)); } catch { return false; }
    return true;
  },
  getMutePreference() {
    try { return localStorage.getItem('kurir_kilat_mute') === 'true'; } catch { return false; }
  },
  setMutePreference(value) {
    try { localStorage.setItem('kurir_kilat_mute', String(value)); } catch { return false; }
    return true;
  },
  getDarkModePreference() {
    try { return localStorage.getItem('kurir_kilat_dark') === 'true'; } catch { return false; }
  },
  setDarkModePreference(value) {
    try { localStorage.setItem('kurir_kilat_dark', String(value)); } catch { return false; }
    return true;
  },
  clearHighScores() {
    try {
      localStorage.removeItem('kurir_kilat_highscore_classic');
      localStorage.removeItem('kurir_kilat_highscore_timeAttack');
      return true;
    } catch { return false; }
  }
};

const AudioManager = {
  isMuted: false,
  audioCtx: null,
  masterGain: null,
  musicGain: null,
  musicNodes: [],
  musicTimer: null,
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
        this.masterGain.gain.value = this.isMuted ? 0 : 0.45;
        this.masterGain.connect(this.audioCtx.destination);
        this.musicGain = this.audioCtx.createGain();
        this.musicGain.gain.value = 0.08;
        this.musicGain.connect(this.masterGain);
      }
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      return this.audioCtx;
    } catch {
      this.isSupported = false;
      return null;
    }
  },
  setMasterVolume() {
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.45, this.audioCtx.currentTime, 0.02);
    }
  },
  playTone(freq, type, duration, delay = 0, volume = 0.12) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
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
    osc.stop(startAt + duration + 0.02);
  },
  playCorrect() { this.playTone(523.25, 'triangle', 0.13, 0, 0.08); this.playTone(659.25, 'triangle', 0.18, 0.08, 0.08); },
  playWrong() { this.playTone(180, 'sawtooth', 0.28, 0, 0.1); },
  playLevelUp() { [261.63, 329.63, 392, 523.25].forEach((freq, index) => this.playTone(freq, 'sine', 0.22, index * 0.07, 0.09)); },
  playGameOver() { [392, 349.23, 311.13, 220].forEach((freq, index) => this.playTone(freq, 'triangle', 0.32, index * 0.11, 0.08)); },
  playClick() { this.playTone(420, 'sine', 0.06, 0, 0.04); },
  startMusic() {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain || this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    this.musicStep = 0;
    this.scheduleMusicStep();
  },
  scheduleMusicStep() {
    if (!this.isMusicPlaying) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.musicGain) return;
    const notes = [196, 246.94, 293.66, 246.94, 220, 261.63, 329.63, 261.63];
    const bass = [98, 98, 110, 110];
    const now = ctx.currentTime;
    const note = notes[this.musicStep % notes.length];
    const bassNote = bass[Math.floor(this.musicStep / 2) % bass.length];
    this.createMusicOsc(note, 'sine', now, 0.55, 0.035);
    if (this.musicStep % 2 === 0) this.createMusicOsc(bassNote, 'triangle', now, 0.8, 0.025);
    this.musicStep += 1;
    this.musicTimer = window.setTimeout(() => this.scheduleMusicStep(), 600);
  },
  createMusicOsc(freq, type, startAt, duration, volume) {
    if (!this.audioCtx || !this.musicGain) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(volume, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
    this.musicNodes.push(osc, gain);
    window.setTimeout(() => {
      this.musicNodes = this.musicNodes.filter(node => node !== osc && node !== gain);
    }, (duration + 0.1) * 1000);
  },
  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicNodes.forEach(node => {
      if (typeof node.stop === 'function') {
        try { node.stop(); } catch { /* already stopped */ }
      }
      if (typeof node.disconnect === 'function') {
        try { node.disconnect(); } catch { /* already disconnected */ }
      }
    });
    this.musicNodes = [];
  },
  toggleMute() {
    this.isMuted = !this.isMuted;
    StorageManager.setMutePreference(this.isMuted);
    this.setMasterVolume();
    this.updateMuteUI();
    if (!this.isMuted && GameState.isRunning && !GameState.isPaused) this.startMusic();
  },
  updateMuteUI() {
    DOM.unmutedIcon.classList.toggle('hidden', this.isMuted);
    DOM.mutedIcon.classList.toggle('hidden', !this.isMuted);
    DOM.muteBtn.setAttribute('aria-pressed', String(this.isMuted));
  }
};

const TimeoutManager = {
  ids: new Set(),
  set(callback, delay, sessionId = GameState.sessionId) {
    const id = window.setTimeout(() => {
      this.ids.delete(id);
      if (sessionId === GameState.sessionId) callback();
    }, delay);
    this.ids.add(id);
    return id;
  },
  clearAll() {
    this.ids.forEach(id => window.clearTimeout(id));
    this.ids.clear();
  }
};

const Game = {
  gameLoopId: null,
  listenersBound: false,

  init() {
    AudioManager.init();
    this.setupTheme();
    this.setupEventListeners();
    this.updateHighScoreLabels();
    this.updateStatsUI();
  },
  setupTheme() {
    const darkPref = StorageManager.getDarkModePreference();
    document.documentElement.classList.toggle('dark', darkPref);
    DOM.sunIcon.classList.toggle('hidden', !darkPref);
    DOM.moonIcon.classList.toggle('hidden', darkPref);
  },
  setupEventListeners() {
    if (this.listenersBound) return;
    this.listenersBound = true;
    DOM.darkModeBtn.addEventListener('click', () => this.toggleTheme());
    DOM.muteBtn.addEventListener('click', () => AudioManager.toggleMute());
    DOM.helpBtn.addEventListener('click', () => this.showTutorial());
    DOM.closeTutorial.addEventListener('click', () => this.hideModal(DOM.tutorialModal));
    DOM.startFromTutorialBtn.addEventListener('click', () => this.hideModal(DOM.tutorialModal));
    DOM.pauseBtn.addEventListener('click', () => this.togglePause());
    DOM.resumeModalBtn.addEventListener('click', () => this.togglePause(false));
    DOM.restartFromPauseBtn.addEventListener('click', () => this.restart());
    DOM.selectClassicBtn.addEventListener('click', () => this.start('classic'));
    DOM.selectTimeAttackBtn.addEventListener('click', () => this.start('timeAttack'));
    DOM.goRestartBtn.addEventListener('click', () => this.restart());
    DOM.goMenuBtn.addEventListener('click', () => this.backToMenu());
    DOM.resetHighScoreBtn.addEventListener('click', () => this.openResetModal());
    DOM.cancelResetBtn.addEventListener('click', () => this.hideModal(DOM.resetModal));
    DOM.confirmResetBtn.addEventListener('click', () => this.confirmResetHighScore());
    DOM.destZones.forEach(zone => this.bindDestinationZone(zone));
    window.addEventListener('keydown', event => this.handleKeydown(event));
  },
  bindDestinationZone(zone) {
    zone.addEventListener('click', () => this.submitSort(zone.dataset.dest));
    zone.addEventListener('dragover', event => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', event => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      this.submitSort(zone.dataset.dest);
    });
  },
  isAnyModalOpen() {
    return [DOM.modeModal, DOM.tutorialModal, DOM.pauseModal, DOM.gameOverModal, DOM.resetModal].some(modal => !modal.classList.contains('hidden'));
  },
  isTextInputFocused() {
    const active = document.activeElement;
    return Boolean(active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
  },
  handleKeydown(event) {
    if (this.isTextInputFocused()) return;
    if (this.isAnyModalOpen() && !DOM.pauseModal.classList.contains('hidden')) {
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault();
        this.togglePause(false);
      }
      return;
    }
    if (this.isAnyModalOpen()) return;
    if (!GameState.isRunning) return;
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.togglePause();
      return;
    }
    if (GameState.isPaused || GameState.isInputLocked) return;
    const shortcutMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'EXP', '5': 'FRG', '6': 'RET' };
    const destination = shortcutMap[event.key];
    if (destination) {
      event.preventDefault();
      this.flashZone(destination);
      this.submitSort(destination);
    }
  },
  toggleTheme() {
    const isDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', isDark);
    DOM.sunIcon.classList.toggle('hidden', !isDark);
    DOM.moonIcon.classList.toggle('hidden', isDark);
    StorageManager.setDarkModePreference(isDark);
  },
  start(mode) {
    this.cleanupSession();
    GameState.sessionId += 1;
    GameState.mode = mode;
    GameState.score = 0;
    GameState.level = 1;
    GameState.combo = 0;
    GameState.maxCombo = 0;
    GameState.correctCount = 0;
    GameState.wrongCount = 0;
    GameState.timeoutCount = 0;
    GameState.totalProcessed = 0;
    GameState.currentPackage = null;
    GameState.unlockedAchievements = [];
    GameState.isRunning = true;
    GameState.isPaused = false;
    GameState.isInputLocked = false;
    GameState.lastFrameTime = performance.now();
    GameState.packageTimeLimit = GameConfig.basePackageTime;
    GameState.packageTimerLeft = GameConfig.basePackageTime;
    if (mode === 'classic') {
      GameState.lives = GameConfig.startingLives;
      DOM.modeHeaderLabel.textContent = 'Level';
      DOM.level.textContent = '1';
    } else {
      GameState.lives = 0;
      GameState.globalTimeAttackLeft = GameConfig.timeAttackLimit;
      GameState.packageTimeLimit = 4000;
      GameState.packageTimerLeft = 4000;
      DOM.modeHeaderLabel.textContent = 'Waktu';
      DOM.level.textContent = `${GameConfig.timeAttackLimit}s`;
    }
    this.hideModal(DOM.modeModal);
    this.hideModal(DOM.pauseModal);
    this.hideModal(DOM.gameOverModal);
    DOM.pauseBtn.classList.remove('hidden');
    DOM.conveyor.classList.remove('paused');
    this.updateStatsUI();
    this.generatePackage();
    AudioManager.startMusic();
    this.gameLoopId = requestAnimationFrame(timestamp => this.gameLoop(timestamp));
  },
  restart() { this.start(GameState.mode); },
  cleanupSession() {
    TimeoutManager.clearAll();
    if (this.gameLoopId) cancelAnimationFrame(this.gameLoopId);
    this.gameLoopId = null;
    GameState.isInputLocked = false;
    DOM.levelUpBanner.classList.remove('show');
    DOM.packageContainer.replaceChildren();
    document.querySelectorAll('.particle').forEach(particle => particle.remove());
    DOM.conveyor.classList.add('paused');
  },
  gameLoop(timestamp) {
    if (!GameState.isRunning) return;
    const delta = timestamp - (GameState.lastFrameTime || timestamp);
    GameState.lastFrameTime = timestamp;
    if (!GameState.isPaused) {
      if (GameState.mode === 'classic') {
        GameState.packageTimerLeft -= delta;
        if (GameState.packageTimerLeft <= 0) {
          GameState.packageTimerLeft = 0;
          this.handleTimeout();
          if (!GameState.isRunning) return;
        }
        this.updateTimerBar(GameState.packageTimerLeft / GameState.packageTimeLimit, 'classic');
      } else {
        GameState.globalTimeAttackLeft -= delta / 1000;
        if (GameState.globalTimeAttackLeft <= 0) {
          GameState.globalTimeAttackLeft = 0;
          DOM.level.textContent = '0s';
          this.gameOver();
          return;
        }
        DOM.level.textContent = `${Math.ceil(GameState.globalTimeAttackLeft)}s`;
        GameState.packageTimerLeft -= delta;
        if (GameState.packageTimerLeft <= 0) {
          this.handleTimeout();
          if (!GameState.isRunning) return;
        }
        this.updateTimerBar(GameState.packageTimerLeft / GameState.packageTimeLimit, 'timeAttack');
      }
    }
    if (GameState.isRunning) this.gameLoopId = requestAnimationFrame(next => this.gameLoop(next));
  },
  updateTimerBar(ratio, mode) {
    const percent = Math.max(0, Math.min(100, ratio * 100));
    DOM.timerBar.style.width = `${percent}%`;
    DOM.timerBar.classList.toggle('time-attack', mode === 'timeAttack');
    DOM.timerBar.classList.toggle('warning', mode === 'classic' && percent < 30);
  },
  generatePackage() {
    if (!GameState.isRunning) return;
    const category = GameConfig.categories[Math.floor(Math.random() * GameConfig.categories.length)];
    const idNumber = Math.floor(1000 + Math.random() * 9000);
    const packageCode = `${category.prefix}${Math.floor(10 + Math.random() * 990)}`;
    GameState.currentPackage = { id: `PKG-${idNumber}`, code: packageCode, destination: category.key, label: category.label, color: category.color };
    GameState.packageTimeLimit = GameState.mode === 'classic'
      ? Math.max(GameConfig.minPackageTime, GameConfig.basePackageTime - ((GameState.level - 1) * 450))
      : 4000;
    GameState.packageTimerLeft = GameState.packageTimeLimit;
    this.renderPackage(GameState.currentPackage);
  },
  renderPackage(pkg) {
    DOM.packageContainer.replaceChildren();
    const card = document.createElement('div');
    card.className = 'package-card';
    card.draggable = true;
    card.style.color = pkg.color;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Paket ${pkg.code}, ID ${pkg.id}`);
    const top = document.createElement('div');
    top.className = 'package-top';
    const code = document.createElement('span');
    code.className = 'package-code';
    code.textContent = pkg.code;
    const id = document.createElement('span');
    id.className = 'package-id';
    id.textContent = pkg.id;
    top.append(code, id);
    const label = document.createElement('div');
    label.className = 'package-label';
    label.textContent = 'Paket aktif di ban berjalan';
    card.append(top, label);
    card.addEventListener('dragstart', event => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', pkg.id);
    });
    DOM.packageContainer.appendChild(card);
  },
  submitSort(destination) {
    if (!GameState.isRunning || GameState.isPaused || GameState.isInputLocked || !GameState.currentPackage) return;
    GameState.isInputLocked = true;
    const isCorrect = destination === GameState.currentPackage.destination;
    GameState.totalProcessed += 1;
    if (isCorrect) this.handleCorrectSort(); else this.handleWrongSort();
  },
  handleCorrectSort() {
    GameState.correctCount += 1;
    GameState.combo += 1;
    GameState.maxCombo = Math.max(GameState.maxCombo, GameState.combo);
    const baseScore = 100;
    const timeBonus = Math.ceil((GameState.packageTimerLeft / GameState.packageTimeLimit) * 50);
    const comboBonus = Math.floor(baseScore * GameState.combo * GameConfig.comboBonusMultiplier);
    GameState.score += baseScore + timeBonus + comboBonus;
    if (GameState.mode === 'timeAttack') GameState.globalTimeAttackLeft += GameConfig.timeAttackBonus;
    AudioManager.playCorrect();
    this.animatePackage('success');
    this.createParticles('✨');
    if (GameState.mode === 'classic' && GameState.correctCount > 0 && GameState.correctCount % GameConfig.levelUpEvery === 0) {
      GameState.level += 1;
      this.showLevelUp();
    }
    this.finishTurn();
  },
  handleWrongSort() {
    GameState.wrongCount += 1;
    GameState.combo = 0;
    if (GameState.mode === 'classic') {
      GameState.lives -= 1;
    } else {
      GameState.globalTimeAttackLeft = Math.max(0, GameState.globalTimeAttackLeft - GameConfig.timeAttackPenalty);
    }
    AudioManager.playWrong();
    this.animatePackage('shake');
    this.updateStatsUI();
    if ((GameState.mode === 'classic' && GameState.lives <= 0) || (GameState.mode === 'timeAttack' && GameState.globalTimeAttackLeft <= 0)) {
      TimeoutManager.set(() => this.gameOver(), 320);
      return;
    }
    this.finishTurn();
  },
  handleTimeout() {
    if (!GameState.isRunning || GameState.isInputLocked) return;
    GameState.isInputLocked = true;
    GameState.timeoutCount += 1;
    GameState.totalProcessed += 1;
    GameState.combo = 0;
    if (GameState.mode === 'classic') {
      GameState.lives -= 1;
    }
    AudioManager.playWrong();
    this.updateStatsUI();
    if (GameState.mode === 'classic' && GameState.lives <= 0) {
      this.gameOver();
      return;
    }
    this.finishTurn();
  },
  finishTurn() {
    this.updateStatsUI();
    TimeoutManager.set(() => {
      if (!GameState.isRunning) return;
      GameState.isInputLocked = false;
      this.generatePackage();
    }, 380);
  },
  animatePackage(className) {
    const card = DOM.packageContainer.querySelector('.package-card');
    if (card) card.classList.add(className);
  },
  showLevelUp() {
    const sessionId = GameState.sessionId;
    DOM.levelUpDesc.textContent = `Level ${GameState.level}: paket makin cepat datang!`;
    DOM.levelUpBanner.classList.add('show');
    AudioManager.playLevelUp();
    TimeoutManager.set(() => {
      if (sessionId === GameState.sessionId) DOM.levelUpBanner.classList.remove('show');
    }, 900, sessionId);
  },
  createParticles(symbol) {
    const rect = DOM.packageContainer.getBoundingClientRect();
    for (let index = 0; index < 10; index += 1) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.textContent = symbol;
      particle.style.left = `${rect.left + rect.width / 2 + (Math.random() * 80 - 40)}px`;
      particle.style.top = `${rect.top + rect.height / 2 + (Math.random() * 26 - 13)}px`;
      document.body.appendChild(particle);
      TimeoutManager.set(() => particle.remove(), 820);
    }
  },
  updateStatsUI() {
    DOM.score.textContent = String(GameState.score);
    DOM.combo.textContent = String(GameState.combo);
    DOM.comboBadge.classList.toggle('hidden', GameState.combo < 3);
    DOM.totalSorted.textContent = String(GameState.totalProcessed);
    DOM.accuracy.textContent = `${this.getAccuracy()}%`;
    DOM.lives.replaceChildren();
    if (GameState.mode === 'classic') {
      for (let index = 0; index < Math.max(0, GameState.lives); index += 1) {
        const heart = document.createElement('span');
        heart.textContent = '❤️';
        DOM.lives.appendChild(heart);
      }
      DOM.level.textContent = String(GameState.level);
    } else {
      const label = document.createElement('span');
      label.textContent = '⏱️';
      DOM.lives.appendChild(label);
    }
  },
  getAccuracy() {
    if (GameState.totalProcessed === 0) return 100;
    return Math.round((GameState.correctCount / GameState.totalProcessed) * 100);
  },
  togglePause(forcePaused) {
    if (!GameState.isRunning) return;
    const shouldPause = typeof forcePaused === 'boolean' ? forcePaused : !GameState.isPaused;
    GameState.isPaused = shouldPause;
    DOM.conveyor.classList.toggle('paused', shouldPause);
    DOM.pauseBtnText.textContent = shouldPause ? 'Resume' : 'Pause';
    DOM.pauseModal.classList.toggle('hidden', !shouldPause);
    if (shouldPause) AudioManager.stopMusic(); else {
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
    DOM.pauseModal.classList.add('hidden');
    DOM.conveyor.classList.add('paused');
    DOM.levelUpBanner.classList.remove('show');
    document.querySelectorAll('.particle').forEach(particle => particle.remove());
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
    const stats = [
      ['Total Skor', GameState.score],
      ['Akurasi', `${this.getAccuracy()}%`],
      ['Benar', GameState.correctCount],
      ['Salah', GameState.wrongCount],
      ['Timeout', GameState.timeoutCount],
      ['Diproses', GameState.totalProcessed],
      [GameState.mode === 'classic' ? 'Level Tertinggi' : 'Sisa Waktu', GameState.mode === 'classic' ? GameState.level : `${Math.ceil(GameState.globalTimeAttackLeft)}s`],
      ['Combo Maks', GameState.maxCombo]
    ];
    DOM.gameOverStats.replaceChildren();
    stats.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      const statLabel = document.createElement('span');
      statLabel.textContent = label;
      const statValue = document.createElement('strong');
      statValue.textContent = String(value);
      card.append(statLabel, statValue);
      DOM.gameOverStats.appendChild(card);
    });
    this.renderAchievements();
  },
  renderAchievements() {
    const achievements = [];
    if (GameState.correctCount >= 10) achievements.push('📦 Kurir Andal');
    if (GameState.maxCombo >= 5) achievements.push('🔥 Combo Panas');
    if (this.getAccuracy() >= 90 && GameState.totalProcessed >= 5) achievements.push('🎯 Akurasi Elite');
    if (GameState.score >= 2500) achievements.push('🏆 Pemburu Skor');
    if (GameState.timeoutCount === 0 && GameState.totalProcessed > 0) achievements.push('⏳ Anti Timeout');
    if (achievements.length === 0) achievements.push('🌱 Pemula Gigih');
    DOM.achievementList.replaceChildren();
    achievements.forEach(text => {
      const item = document.createElement('div');
      item.className = 'achievement-item';
      item.textContent = text;
      DOM.achievementList.appendChild(item);
    });
  },
  updateHighScoreLabels() {
    DOM.highClassicLabel.textContent = String(StorageManager.getHighScore('classic'));
    DOM.highTimeLabel.textContent = String(StorageManager.getHighScore('timeAttack'));
  },
  flashZone(destination) {
    const zone = DOM.destZones.find(item => item.dataset.dest === destination);
    if (!zone) return;
    zone.classList.add('active-hit');
    TimeoutManager.set(() => zone.classList.remove('active-hit'), 120);
  },
  showTutorial() {
    DOM.tutorialModal.classList.remove('hidden');
  },
  hideModal(modal) {
    modal.classList.add('hidden');
  },
  openResetModal() {
    DOM.resetFeedback.textContent = '';
    DOM.confirmResetBtn.disabled = false;
    DOM.resetModal.classList.remove('hidden');
  },
  confirmResetHighScore() {
    const didClear = StorageManager.clearHighScores();
    this.updateHighScoreLabels();
    DOM.resetFeedback.textContent = didClear ? 'Rekor skor berhasil dihapus.' : 'Gagal menghapus rekor di browser ini.';
    DOM.confirmResetBtn.disabled = true;
    TimeoutManager.set(() => this.hideModal(DOM.resetModal), 900, GameState.sessionId);
  },
  backToMenu() {
    this.cleanupSession();
    GameState.isRunning = false;
    GameState.isPaused = false;
    GameState.isInputLocked = false;
    AudioManager.stopMusic();
    DOM.gameOverModal.classList.add('hidden');
    DOM.pauseBtn.classList.add('hidden');
    DOM.modeModal.classList.remove('hidden');
    this.updateHighScoreLabels();
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());
