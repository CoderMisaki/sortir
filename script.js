'use strict';

const GameConfig = {
  startingLives: 3,
  levelUpEvery: 8,
  baseSpeed: 155,
  speedPerLevel: 22,
  maxSpeed: 360,
  spawnDelay: 650,
  dropDuration: 620,
  perfectBaseScore: 120,
  lateBaseScore: 70,
  timeAttackLimit: 60,
  packageVariants: [
    { className: 'pkg-small', width: 78, height: 58, tapeLeft: 35, label: 'compact' },
    { className: 'pkg-medium', width: 94, height: 66, tapeLeft: 43, label: 'standard' },
    { className: 'pkg-wide', width: 112, height: 62, tapeLeft: 52, label: 'wide' },
    { className: 'pkg-tall', width: 88, height: 76, tapeLeft: 40, label: 'tall' }
  ],
  categories: [
    { key: 'A', label: 'Rak A', prefix: 'A-', color: '#38bdf8' },
    { key: 'B', label: 'Rak B', prefix: 'B-', color: '#34d399' },
    { key: 'C', label: 'Rak C', prefix: 'C-', color: '#a78bfa' },
    { key: 'EXP', label: 'Express', prefix: 'EXP-', color: '#facc15' },
    { key: 'FRG', label: 'Fragile', prefix: 'FRG-', color: '#fb7185' },
    { key: 'RET', label: 'Return', prefix: 'RET-', color: '#fb923c' }
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
  perfectCount: 0,
  lateCount: 0,
  totalProcessed: 0,
  maxCombo: 0,
  currentPackage: null,
  packageX: 0,
  packageY: 0,
  packageSpeed: GameConfig.baseSpeed,
  packageWidth: 96,
  isDropping: false,
  dropTarget: null,
  hasAnswered: false,
  hasResolved: false,
  hasHintedSort: false,
  conveyorStartX: 0,
  conveyorEndX: 0,
  dropTriggerX: 0,
  missZoneX: 0,
  dropStartTime: 0,
  dropStartX: 0,
  dropStartY: 0,
  dropEndX: 0,
  dropEndY: 0,
  dropRotation: 0,
  isRunning: false,
  isPaused: false,
  lastFrameTime: 0,
  timeAttackLeft: GameConfig.timeAttackLimit,
  binCounts: {},
  wasNewBest: false
};

const DOM = {
  score: document.getElementById('scoreDisplay'),
  best: document.getElementById('bestDisplay'),
  level: document.getElementById('levelDisplay'),
  lives: document.getElementById('livesDisplay'),
  combo: document.getElementById('comboDisplay'),
  accuracy: document.getElementById('accuracyDisplay'),
  status: document.getElementById('statusText'),
  modeLabel: document.getElementById('modeLabel'),
  stage: document.getElementById('gameStage'),
  conveyorWrap: document.getElementById('conveyorWrap'),
  conveyor: document.getElementById('conveyorBelt'),
  packageBox: document.getElementById('packageBox'),
  packageCode: document.getElementById('packageCode'),
  packageDest: document.getElementById('packageDest'),
  sensorLine: document.getElementById('sensorLine'),
  missZone: document.getElementById('missZone'),
  rejectChute: document.getElementById('rejectChute'),
  dropLanes: Array.from(document.querySelectorAll('.drop-lane')),
  reportHero: document.getElementById('reportHero'),
  dropFeedback: document.getElementById('dropFeedback'),
  bins: Array.from(document.querySelectorAll('.dest-bin')),
  startModal: document.getElementById('startModal'),
  pauseModal: document.getElementById('pauseModal'),
  gameOverModal: document.getElementById('gameOverModal'),
  resultGrid: document.getElementById('resultGrid'),
  classicBtn: document.getElementById('classicBtn'),
  timeBtn: document.getElementById('timeBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartPauseBtn: document.getElementById('restartPauseBtn'),
  restartBtn: document.getElementById('restartBtn'),
  menuBtn: document.getElementById('menuBtn'),
  themeBtn: document.getElementById('themeBtn'),
  soundBtn: document.getElementById('soundBtn')
};

const Storage = {
  getBest(mode) {
    try { return Number.parseInt(localStorage.getItem(`sortir_best_${mode}`), 10) || 0; } catch { return 0; }
  },
  setBest(mode, value) {
    try { localStorage.setItem(`sortir_best_${mode}`, String(value)); } catch { /* ignore private mode */ }
  },
  getTheme() {
    try { return localStorage.getItem('sortir_light') === 'true'; } catch { return false; }
  },
  setTheme(isLight) {
    try { localStorage.setItem('sortir_light', String(isLight)); } catch { /* ignore */ }
  },
  getMuted() {
    try { return localStorage.getItem('sortir_muted') === 'true'; } catch { return false; }
  },
  setMuted(isMuted) {
    try { localStorage.setItem('sortir_muted', String(isMuted)); } catch { /* ignore */ }
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

const AudioFx = {
  muted: false,
  ctx: null,
  init() {
    this.muted = Storage.getMuted();
    this.updateButton();
  },
  tone(freq, type = 'sine', duration = 0.09, delay = 0, volume = 0.035) {
    if (this.muted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.ctx) this.ctx = new AudioContext();
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  },
  click() { this.tone(440, 'triangle', 0.05); },
  success() { this.tone(523, 'triangle', 0.11, 0, 0.05); this.tone(784, 'sine', 0.16, 0.07, 0.04); },
  fail() { this.tone(160, 'sawtooth', 0.16, 0, 0.045); },
  level() { [392, 494, 659].forEach((freq, index) => this.tone(freq, 'sine', 0.12, index * 0.07, 0.04)); },
  toggle() {
    this.muted = !this.muted;
    Storage.setMuted(this.muted);
    this.updateButton();
  },
  updateButton() {
    DOM.soundBtn.classList.toggle('muted', this.muted);
    DOM.soundBtn.setAttribute('aria-label', this.muted ? 'Nyalakan suara' : 'Matikan suara');
  }
};

const Game = {
  rafId: null,
  layoutRafId: null,
  layoutSettleTimeoutId: null,
  eventsBound: false,

  init() {
    document.documentElement.classList.toggle('light', Storage.getTheme());
    AudioFx.init();
    this.bindEvents();
    this.updateLayoutMetrics();
    this.updateUI();
    DOM.packageBox.classList.add('hidden');
    DOM.stage.classList.add('paused');
  },

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    DOM.classicBtn.addEventListener('click', () => this.startGame('classic'));
    DOM.timeBtn.addEventListener('click', () => this.startGame('timeAttack'));
    DOM.pauseBtn.addEventListener('click', () => this.togglePause());
    DOM.resumeBtn.addEventListener('click', () => this.togglePause(false));
    DOM.restartPauseBtn.addEventListener('click', () => this.startGame(GameState.mode));
    DOM.restartBtn.addEventListener('click', () => this.startGame(GameState.mode));
    DOM.menuBtn.addEventListener('click', () => this.backToMenu());
    DOM.themeBtn.addEventListener('click', () => this.toggleTheme());
    DOM.soundBtn.addEventListener('click', () => { AudioFx.toggle(); AudioFx.click(); });
    DOM.bins.forEach(bin => bin.addEventListener('click', () => this.submitSort(bin.dataset.dest)));
    document.addEventListener('keydown', event => this.handleKeyboard(event));
    window.addEventListener('resize', () => this.scheduleLayoutRefresh());
    window.addEventListener('orientationchange', () => this.scheduleLayoutRefresh({ settle: true }));
  },

  startGame(mode) {
    this.cleanupSession();
    GameState.sessionId += 1;
    Object.assign(GameState, {
      mode,
      score: 0,
      lives: GameConfig.startingLives,
      level: 1,
      combo: 0,
      correctCount: 0,
      wrongCount: 0,
      timeoutCount: 0,
      perfectCount: 0,
      lateCount: 0,
      totalProcessed: 0,
      maxCombo: 0,
      currentPackage: null,
      isRunning: true,
      isPaused: false,
      isDropping: false,
      hasAnswered: false,
      hasResolved: false,
      hasHintedSort: false,
      binCounts: Object.fromEntries(GameConfig.categories.map(category => [category.key, 0])),
      wasNewBest: false,
      lastFrameTime: performance.now(),
      timeAttackLeft: GameConfig.timeAttackLimit
    });
    DOM.startModal.classList.add('hidden');
    DOM.pauseModal.classList.add('hidden');
    DOM.gameOverModal.classList.add('hidden');
    DOM.pauseBtn.classList.remove('hidden');
    DOM.stage.classList.remove('paused');
    DOM.modeLabel.textContent = mode === 'classic' ? 'CLASSIC' : 'TIME ATTACK';
    DOM.status.textContent = 'SCAN: LIVE FEED → TARGET: --';
    this.updateLayoutMetrics();
    this.resetBinCounters();
    this.updateUI();
    this.spawnPackage();
    this.startLoop();
  },

  cleanupSession() {
    TimeoutManager.clearAll();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.clearBinStates();
    DOM.packageBox.className = 'package hidden';
    DOM.dropFeedback.className = 'drop-feedback';
    DOM.dropFeedback.textContent = '';
    DOM.sensorLine.classList.remove('alert');
    DOM.rejectChute.classList.remove('flash');
    DOM.stage.classList.remove('flash-correct', 'flash-wrong', 'shake');
  },

  startLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(time => this.loop(time));
  },

  loop(now) {
    if (!GameState.isRunning) return;

    if (GameState.isPaused) {
      GameState.lastFrameTime = now;
      this.rafId = requestAnimationFrame(time => this.loop(time));
      return;
    }

    const delta = Math.min((now - GameState.lastFrameTime) / 1000, 0.05);
    GameState.lastFrameTime = now;

    if (GameState.mode === 'timeAttack') {
      GameState.timeAttackLeft = Math.max(0, GameState.timeAttackLeft - delta);
      if (GameState.timeAttackLeft <= 0) {
        this.endGame();
        return;
      }
    }

    if (GameState.isDropping) this.updateDrop(now);
    else this.updatePackageMove(delta);

    this.renderPackage();
    this.updateUI(false);
    this.rafId = requestAnimationFrame(time => this.loop(time));
  },

  updatePackageMove(delta) {
    if (!GameState.currentPackage) return;

    GameState.packageX += GameState.packageSpeed * delta;
    const isNearDecision = GameState.packageX >= GameState.dropTriggerX - 115 && GameState.packageX <= GameState.missZoneX;
    DOM.sensorLine.classList.toggle('alert', isNearDecision && !GameState.hasAnswered);

    if (!GameState.hasAnswered && !GameState.hasHintedSort && GameState.packageX >= GameState.dropTriggerX) {
      this.hintCorrectBin();
    }

    if (!GameState.hasAnswered && GameState.packageX >= GameState.missZoneX) {
      this.resolvePackage('timeout', null);
    }
  },

  updateDrop(now) {
    const progress = Math.min((now - GameState.dropStartTime) / GameConfig.dropDuration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const arc = Math.sin(progress * Math.PI) * -34;
    GameState.packageX = this.lerp(GameState.dropStartX, GameState.dropEndX, eased);
    GameState.packageY = this.lerp(GameState.dropStartY, GameState.dropEndY, eased) + arc;

    const rotate = this.lerp(0, GameState.dropRotation, eased);
    if (GameState.currentPackage?.result === 'correct' && progress > 0.68) {
      DOM.packageBox.classList.add('receiving');
    }
    DOM.packageBox.style.transform = `translate3d(${GameState.packageX}px, ${GameState.packageY}px, 0) rotate(${rotate}deg) scale(${GameState.currentPackage?.result === 'correct' ? this.lerp(1, 0.58, eased) : 1})`;

    if (progress >= 1 && !GameState.hasResolved) this.finishResolution();
  },

  spawnPackage() {
    if (!GameState.isRunning || GameState.isPaused) return;
    const category = this.randomCategory();
    const variant = this.randomPackageVariant();
    const code = `${category.prefix}${Math.floor(100 + Math.random() * 900)}`;
    GameState.currentPackage = { category, code, variant, timing: null, awardedScore: 0 };
    DOM.packageBox.className = `package ${variant.className}`;
    DOM.packageBox.style.setProperty('--pkg-w', `${variant.width}px`);
    DOM.packageBox.style.setProperty('--pkg-h', `${variant.height}px`);
    DOM.packageBox.style.setProperty('--tape-left', `${variant.tapeLeft}px`);
    DOM.packageBox.style.setProperty('--pkg-color', category.color);
    GameState.packageWidth = DOM.packageBox.offsetWidth || variant.width;
    GameState.packageSpeed = Math.min(GameConfig.baseSpeed + (GameState.level - 1) * GameConfig.speedPerLevel, GameConfig.maxSpeed);
    GameState.packageX = GameState.conveyorStartX - GameState.packageWidth - 24;
    GameState.packageY = this.getConveyorPackageY();
    GameState.isDropping = false;
    GameState.dropTarget = null;
    GameState.hasAnswered = false;
    GameState.hasResolved = false;
    GameState.hasHintedSort = false;
    DOM.packageCode.textContent = code;
    DOM.packageDest.textContent = `${category.label} · ${variant.label} · Kode ${category.key}`;
    DOM.sensorLine.classList.remove('alert');
    DOM.rejectChute.classList.remove('flash');
    DOM.stage.classList.remove('flash-correct', 'flash-wrong', 'shake');
    this.clearBinStates();
    this.renderPackage();
    DOM.status.textContent = `SCAN: ${code} → TARGET: ${category.label.toUpperCase()}`;
  },

  submitSort(destination) {
    if (!GameState.isRunning || GameState.isPaused || !GameState.currentPackage || GameState.hasAnswered || GameState.isDropping) return;

    GameState.hasAnswered = true;
    const selectedBin = this.getBin(destination);
    selectedBin?.classList.add('active');
    const isBeforeMiss = GameState.packageX < GameState.missZoneX;
    const isCorrect = destination === GameState.currentPackage.category.key && isBeforeMiss;

    const timing = GameState.packageX < GameState.dropTriggerX ? 'perfect' : 'late';
    if (!isBeforeMiss) this.resolvePackage('timeout', null);
    else if (isCorrect) this.resolvePackage('correct', destination, timing);
    else this.resolvePackage('wrong', destination);
  },

  resolvePackage(result, destination, timing = null) {
    if (GameState.isDropping || GameState.hasResolved) return;
    GameState.hasAnswered = true;
    GameState.isDropping = true;
    GameState.dropTarget = destination;
    GameState.dropStartTime = performance.now();
    GameState.dropStartX = GameState.packageX;
    GameState.dropStartY = GameState.packageY;
    DOM.sensorLine.classList.remove('alert');
    DOM.rejectChute.classList.remove('flash');
    DOM.stage.classList.remove('flash-correct', 'flash-wrong', 'shake');

    const endPoint = this.getDropEndpoint(result, destination);
    GameState.dropEndX = endPoint.x;
    GameState.dropEndY = endPoint.y;
    GameState.dropRotation = result === 'correct' ? 11 : result === 'wrong' ? -17 : 21;

    DOM.packageBox.classList.add(result === 'correct' ? 'correct' : result === 'wrong' ? 'wrong' : 'timeout');
    if (result === 'correct') {
      GameState.currentPackage.timing = timing || 'late';
      this.markBin(destination, `correct ${GameState.currentPackage.timing}`);
      this.markLane(destination, 'lane-glow');
      this.showFeedback(GameState.currentPackage.timing === 'perfect' ? 'PERFECT' : 'LATE', 'success');
      this.flashStage('correct');
      AudioFx.success();
      this.createParticles('', '#34d399');
    } else if (result === 'wrong') {
      this.markBin(destination, 'wrong');
      this.showFeedback('WRONG BIN', 'fail');
      this.flashStage('wrong');
      AudioFx.fail();
      this.createParticles('', '#fb7185');
    } else {
      this.showFeedback('MISS', 'fail');
      DOM.rejectChute.classList.add('flash');
      this.flashStage('miss');
      AudioFx.fail();
      this.createParticles('', '#fb7185');
    }

    GameState.currentPackage.result = result;
  },

  finishResolution() {
    GameState.hasResolved = true;
    const result = GameState.currentPackage?.result;

    if (result === 'correct') {
      GameState.correctCount += 1;
      GameState.combo += 1;
      GameState.maxCombo = Math.max(GameState.maxCombo, GameState.combo);
      const isPerfect = GameState.currentPackage?.timing === 'perfect';
      if (isPerfect) GameState.perfectCount += 1;
      else GameState.lateCount += 1;
      const comboBonus = Math.min(GameState.combo * 8, 120);
      const timingBonus = isPerfect ? 30 : 0;
      const baseScore = isPerfect ? GameConfig.perfectBaseScore : GameConfig.lateBaseScore;
      const gained = baseScore + comboBonus + timingBonus + GameState.level * 10;
      GameState.score += gained;
      GameState.currentPackage.awardedScore = gained;
      this.incrementBinCounter(GameState.currentPackage.category.key);
      this.floatText(`+${gained}`, 'score');
      if (GameState.correctCount % GameConfig.levelUpEvery === 0) {
        GameState.level += 1;
        this.showFeedback(`LEVEL ${GameState.level}`, 'success');
        AudioFx.level();
      }
    } else {
      if (result === 'timeout') {
        GameState.timeoutCount += 1;
        this.floatText('MISS', 'miss');
      } else {
        GameState.wrongCount += 1;
        this.floatText('WRONG BIN', 'wrong');
      }
      GameState.combo = 0;
      if (GameState.mode === 'classic') GameState.lives -= 1;
      else GameState.score = Math.max(0, GameState.score - 60);
    }

    GameState.totalProcessed += 1;
    this.updateUI();

    if (GameState.mode === 'classic' && GameState.lives <= 0) {
      TimeoutManager.set(() => this.endGame(), 420, GameState.sessionId);
      return;
    }

    const session = GameState.sessionId;
    TimeoutManager.set(() => {
      if (session !== GameState.sessionId) return;
      DOM.packageBox.classList.add('hidden');
      this.spawnPackage();
    }, GameConfig.spawnDelay, session);
  },

  getDropEndpoint(result, destination) {
    if (result === 'correct' || result === 'wrong') {
      const bin = this.getBin(destination) || this.getBin(GameState.currentPackage.category.key);
      const lane = this.getLane(destination) || this.getLane(GameState.currentPackage.category.key);
      const stageRect = DOM.stage.getBoundingClientRect();
      const binRect = bin.getBoundingClientRect();
      const laneRect = lane?.getBoundingClientRect();
      return {
        x: (laneRect ? laneRect.left - stageRect.left + laneRect.width / 2 : binRect.left - stageRect.left + binRect.width / 2) - GameState.packageWidth / 2,
        y: stageRect.height - Math.min(42, Math.max(28, stageRect.height * 0.12))
      };
    }
    return this.getRejectEndpoint();
  },

  scheduleLayoutRefresh({ settle = false } = {}) {
    if (this.layoutRafId) cancelAnimationFrame(this.layoutRafId);
    this.layoutRafId = requestAnimationFrame(() => {
      this.layoutRafId = null;
      this.updateLayoutMetrics({ preserveProgress: true });
    });

    if (settle) {
      if (this.layoutSettleTimeoutId) window.clearTimeout(this.layoutSettleTimeoutId);
      this.layoutSettleTimeoutId = window.setTimeout(() => {
        this.layoutSettleTimeoutId = null;
        this.updateLayoutMetrics({ preserveProgress: true });
      }, 180);
    }
  },

  updateLayoutMetrics({ preserveProgress = false } = {}) {
    const previousStartX = GameState.conveyorStartX;
    const previousEndX = GameState.conveyorEndX;
    const previousTravel = previousEndX - previousStartX;
    const packageProgress = previousTravel > 0
      ? (GameState.packageX - previousStartX) / previousTravel
      : 0;

    const stageRect = DOM.stage.getBoundingClientRect();
    const beltRect = DOM.conveyorWrap.getBoundingClientRect();
    const packageHeight = DOM.packageBox.offsetHeight || 72;
    GameState.packageWidth = DOM.packageBox.offsetWidth || GameState.packageWidth || 96;
    GameState.conveyorStartX = beltRect.left - stageRect.left + 8;
    GameState.conveyorEndX = beltRect.right - stageRect.left - 12;
    GameState.dropTriggerX = GameState.conveyorStartX + (GameState.conveyorEndX - GameState.conveyorStartX) * 0.66;
    GameState.missZoneX = GameState.conveyorEndX - GameState.packageWidth * 0.56;

    if (!GameState.isDropping) {
      GameState.packageY = beltRect.top - stageRect.top + beltRect.height * 0.26 - packageHeight * 0.82;
      if (preserveProgress && GameState.currentPackage) {
        const nextTravel = GameState.conveyorEndX - GameState.conveyorStartX;
        GameState.packageX = GameState.conveyorStartX + packageProgress * nextTravel;
      }
    }

    DOM.sensorLine.style.left = `${GameState.dropTriggerX}px`;
    DOM.missZone.style.left = `${GameState.missZoneX}px`;
    DOM.missZone.style.right = 'auto';

    if (GameState.isRunning && GameState.currentPackage && !GameState.isDropping) {
      this.renderPackage();
    }
  },

  getConveyorPackageY() {
    const stageRect = DOM.stage.getBoundingClientRect();
    const beltRect = DOM.conveyorWrap.getBoundingClientRect();
    const packageHeight = DOM.packageBox.offsetHeight || 72;
    return beltRect.top - stageRect.top + beltRect.height * 0.26 - packageHeight * 0.82;
  },

  renderPackage() {
    if (!GameState.currentPackage) return;
    if (!GameState.isDropping) {
      DOM.packageBox.style.transform = `translate3d(${GameState.packageX}px, ${GameState.packageY}px, 0)`;
    }
  },

  handleKeyboard(event) {
    const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'EXP', '5': 'FRG', '6': 'RET' };
    if (keyMap[event.key]) {
      event.preventDefault();
      this.submitSort(keyMap[event.key]);
    }
    if (event.key.toLowerCase() === 'p' && GameState.isRunning) {
      event.preventDefault();
      this.togglePause();
    }
  },

  togglePause(forcePaused = !GameState.isPaused) {
    if (!GameState.isRunning) return;
    GameState.isPaused = forcePaused;
    GameState.lastFrameTime = performance.now();
    DOM.pauseModal.classList.toggle('hidden', !GameState.isPaused);
    DOM.stage.classList.toggle('paused', GameState.isPaused);
    DOM.pauseBtn.textContent = GameState.isPaused ? 'Resume' : 'Pause';
    DOM.status.textContent = GameState.isPaused ? 'SCAN: PAUSED → TARGET: HOLD' : 'SCAN: LIVE FEED → TARGET: --';
  },

  endGame() {
    if (!GameState.isRunning) return;
    GameState.isRunning = false;
    TimeoutManager.clearAll();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    DOM.pauseBtn.classList.add('hidden');
    DOM.pauseModal.classList.add('hidden');
    DOM.stage.classList.add('paused');
    const best = Storage.getBest(GameState.mode);
    GameState.wasNewBest = GameState.score > best;
    if (GameState.wasNewBest) Storage.setBest(GameState.mode, GameState.score);
    this.renderResults();
    this.updateUI();
    DOM.gameOverModal.classList.remove('hidden');
  },

  backToMenu() {
    this.cleanupSession();
    GameState.sessionId += 1;
    GameState.isRunning = false;
    GameState.isPaused = false;
    DOM.pauseBtn.classList.add('hidden');
    DOM.gameOverModal.classList.add('hidden');
    DOM.startModal.classList.remove('hidden');
    DOM.stage.classList.add('paused');
    DOM.status.textContent = 'SCAN: STANDBY → TARGET: --';
    this.updateUI();
  },

  renderResults() {
    const accuracy = this.getAccuracy();
    const grade = this.getGrade(accuracy);
    const best = Storage.getBest(GameState.mode);
    const achievements = this.getAchievements(grade, accuracy);
    DOM.resultGrid.parentElement?.querySelector('.achievement-chips')?.remove();
    DOM.reportHero.innerHTML = `
      <div class="grade-badge grade-${grade.toLowerCase()}">${grade}</div>
      <div>
        <span>${GameState.wasNewBest ? 'NEW HIGH SCORE' : 'SHIFT COMPLETE'}</span>
        <strong>${this.format(GameState.score)}</strong>
        <small>Best ${this.format(best)} · Accuracy ${accuracy}%</small>
      </div>
    `;
    const rows = [
      ['Final Score', this.format(GameState.score)],
      ['Accuracy', `${accuracy}%`],
      ['Correct', GameState.correctCount],
      ['Wrong', GameState.wrongCount],
      ['Miss', GameState.timeoutCount],
      ['Perfect', GameState.perfectCount],
      ['Late', GameState.lateCount],
      ['Max Combo', `x${GameState.maxCombo}`]
    ];
    DOM.resultGrid.replaceChildren();
    rows.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'result-card';
      card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      DOM.resultGrid.appendChild(card);
    });
    const chips = document.createElement('div');
    chips.className = 'achievement-chips';
    achievements.forEach(text => {
      const chip = document.createElement('span');
      chip.textContent = text;
      chips.appendChild(chip);
    });
    DOM.resultGrid.after(chips);
  },

  updateUI(includeBest = true) {
    DOM.score.textContent = this.format(GameState.score);
    if (includeBest) DOM.best.textContent = this.format(Storage.getBest(GameState.mode));
    DOM.level.textContent = GameState.mode === 'timeAttack' ? `${Math.ceil(GameState.timeAttackLeft)}s` : GameState.level;
    DOM.lives.innerHTML = this.renderLives();
    DOM.lives.setAttribute('aria-label', GameState.mode === 'classic' ? `${Math.max(0, GameState.lives)} lives` : 'Time attack unlimited lives');
    DOM.combo.textContent = `x${GameState.combo}`;
    DOM.accuracy.textContent = `${this.getAccuracy()}%`;
  },

  showFeedback(text, type) {
    DOM.dropFeedback.textContent = text;
    DOM.dropFeedback.className = `drop-feedback ${type} show`;
  },

  createParticles(symbol, color) {
    const rect = DOM.packageBox.getBoundingClientRect();
    for (let i = 0; i < 10; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'particle';
      particle.textContent = symbol;
      particle.style.color = color;
      if (!symbol) {
        particle.classList.add('spark');
        particle.style.background = color;
      }
      particle.style.left = `${rect.left + rect.width / 2 + Math.random() * 70 - 35}px`;
      particle.style.top = `${rect.top + rect.height / 2 + Math.random() * 30 - 15}px`;
      particle.style.setProperty('--px', `${Math.random() * 80 - 40}px`);
      document.body.appendChild(particle);
      TimeoutManager.set(() => particle.remove(), 920, GameState.sessionId);
    }
  },

  clearBinStates() {
    DOM.bins.forEach(bin => bin.classList.remove('active', 'correct', 'wrong', 'perfect', 'late', 'sort-hint'));
    DOM.dropLanes.forEach(lane => lane.classList.remove('lane-glow'));
  },

  hintCorrectBin() {
    const destination = GameState.currentPackage?.category.key;
    const bin = this.getBin(destination);
    if (!bin) return;
    GameState.hasHintedSort = true;
    bin.classList.remove('sort-hint');
    void bin.offsetWidth;
    bin.classList.add('sort-hint');
    TimeoutManager.set(() => bin.classList.remove('sort-hint'), 720, GameState.sessionId);
  },

  markBin(destination, className) {
    const bin = this.getBin(destination);
    if (!bin) return;
    bin.classList.add(...className.split(' '), 'active');
    TimeoutManager.set(() => bin.classList.remove(...className.split(' '), 'active'), 780, GameState.sessionId);
  },

  getBin(destination) {
    return DOM.bins.find(bin => bin.dataset.dest === destination);
  },

  getLane(destination) {
    return DOM.dropLanes.find(lane => lane.dataset.dest === destination);
  },

  markLane(destination, className) {
    const lane = this.getLane(destination);
    if (!lane) return;
    lane.classList.add(className);
    TimeoutManager.set(() => lane.classList.remove(className), 780, GameState.sessionId);
  },

  getRejectEndpoint() {
    const stageRect = DOM.stage.getBoundingClientRect();
    const rejectRect = DOM.rejectChute.getBoundingClientRect();
    return {
      x: rejectRect.left - stageRect.left + rejectRect.width / 2 - GameState.packageWidth / 2,
      y: rejectRect.top - stageRect.top + rejectRect.height * 0.32
    };
  },

  flashStage(type) {
    DOM.stage.classList.remove('flash-correct', 'flash-wrong', 'shake');
    void DOM.stage.offsetWidth;
    if (type === 'correct') DOM.stage.classList.add('flash-correct');
    else DOM.stage.classList.add('flash-wrong', 'shake');
    TimeoutManager.set(() => DOM.stage.classList.remove('flash-correct', 'flash-wrong', 'shake'), 520, GameState.sessionId);
  },

  floatText(text, type = 'score') {
    const floater = document.createElement('div');
    floater.className = `floating-score ${type}`;
    floater.textContent = text;
    const rect = DOM.packageBox.getBoundingClientRect();
    const stageRect = DOM.stage.getBoundingClientRect();
    floater.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
    floater.style.top = `${rect.top - stageRect.top}px`;
    DOM.stage.appendChild(floater);
    TimeoutManager.set(() => floater.remove(), 920, GameState.sessionId);
  },

  incrementBinCounter(destination) {
    GameState.binCounts[destination] = (GameState.binCounts[destination] || 0) + 1;
    const bin = this.getBin(destination);
    const counter = bin?.querySelector('.bin-count');
    if (counter) {
      counter.textContent = GameState.binCounts[destination];
      counter.classList.remove('pop');
      void counter.offsetWidth;
      counter.classList.add('pop');
    }
  },

  resetBinCounters() {
    DOM.bins.forEach(bin => {
      const counter = bin.querySelector('.bin-count');
      if (counter) counter.textContent = '0';
    });
  },

  renderLives() {
    if (GameState.mode !== 'classic') {
      return '<span class="time-icon"></span><span class="time-icon"></span><span class="time-icon"></span>';
    }
    return Array.from({ length: GameConfig.startingLives }, (_, index) => `<span class="${index < GameState.lives ? '' : 'lost'}"></span>`).join('');
  },

  getGrade(accuracy) {
    if (accuracy >= 96 && GameState.wrongCount === 0 && GameState.timeoutCount === 0) return 'S';
    if (accuracy >= 85) return 'A';
    if (accuracy >= 70) return 'B';
    return 'C';
  },

  getAchievements(grade, accuracy) {
    const chips = [grade === 'S' ? 'Flawless Shift' : `Grade ${grade}`];
    if (GameState.wasNewBest) chips.push('High Score Baru');
    if (GameState.maxCombo >= 8) chips.push('Combo Master');
    if (GameState.perfectCount >= Math.max(3, GameState.lateCount)) chips.push('Early Sorter');
    if (accuracy >= 90) chips.push('Akurasi Tinggi');
    if (chips.length === 1) chips.push('Shift Selesai');
    return chips;
  },

  randomCategory() {
    return GameConfig.categories[Math.floor(Math.random() * GameConfig.categories.length)];
  },

  randomPackageVariant() {
    return GameConfig.packageVariants[Math.floor(Math.random() * GameConfig.packageVariants.length)];
  },

  getAccuracy() {
    if (GameState.totalProcessed === 0) return 100;
    return Math.round((GameState.correctCount / GameState.totalProcessed) * 100);
  },

  toggleTheme() {
    const nextLight = !document.documentElement.classList.contains('light');
    document.documentElement.classList.toggle('light', nextLight);
    Storage.setTheme(nextLight);
    AudioFx.click();
  },

  lerp(start, end, amount) {
    return start + (end - start) * amount;
  },

  format(value) {
    return new Intl.NumberFormat('id-ID').format(value);
  }
};

window.addEventListener('DOMContentLoaded', () => Game.init());
