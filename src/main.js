import * as THREE from '../vendor/three.module.js'
import { createScene } from './scene.js'
import { createHouseVisual } from './houseVisual.js'
import { createBoardVisual } from './boardVisual.js'
import { createEffects, createFlights } from './fx.js'
import { createCameraRig } from './cameraRig.js'
import { GameAudio } from './audio.js'
import {
  COLS, ROWS, TYPES, createBag, emptyBoard, cellsFor, collides,
  landingY, tryRotate, fullRows, clearRows
} from './tetris.js'
import { HOUSE_LINES } from './house.js'
import { PIECE_COLORS } from './textures.js'

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */

const stage = createScene()
const { renderer, scene, camera, M, boardGroup, boardZone, houseZone } = stage
const house = createHouseVisual(stage.houseGroup, M)
const boardVis = createBoardVisual(boardGroup, M)
const effects = createEffects(scene)
const flights = createFlights(scene, M, onFlightsLand)
const rig = createCameraRig(camera, renderer.domElement)
const audio = new GameAudio()

const LOCK_DELAY = 0.42
const BUILD_PER_LINE = Math.ceil(house.total / HOUSE_LINES)
const LINE_SCORE = [0, 100, 300, 500, 800]

const MAT_COLORS = {
  foundation: '#a5adb7',
  foundationAlt: '#7e848c',
  wall: '#c1945f',
  frame: '#8b5e3c',
  trim: '#5c3d2b',
  roof: '#9a5140',
  glass: '#b7ecf7',
  door: '#6a4630',
  chimney: '#7b838b',
  porch: '#a89c84',
  lantern: '#ffd166'
}

const $ = (id) => document.getElementById(id)
const ui = {
  body: document.body,
  hero: $('hero'),
  startBtn: $('startBtn'),
  topbar: $('topbar'),
  score: $('score'),
  lines: $('lines'),
  level: $('level'),
  next: $('next'),
  hold: $('hold'),
  housePercent: $('house-percent'),
  housePips: $('house-pips'),
  houseStage: $('house-stage'),
  houseLines: $('house-lines'),
  toast: $('toast'),
  toastTitle: $('toast-title'),
  toastSub: $('toast-sub'),
  soundBtn: $('soundBtn'),
  pauseBtn: $('pauseBtn'),
  pause: $('pause'),
  resumeBtn: $('resumeBtn'),
  restartPauseBtn: $('restartPauseBtn'),
  end: $('end'),
  endKicker: $('endKicker'),
  endTitle: $('endTitle'),
  endSub: $('endSub'),
  endScore: $('endScore'),
  endLines: $('endLines'),
  endBest: $('endBest'),
  againBtn: $('againBtn'),
  touch: $('touch')
}

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let state = 'menu'
let board = emptyBoard()
let active = null
let queue = []
let hold = null
let canHold = true
let score = 0
let lines = 0
let level = 1
let combo = -1
let dropAccum = 0
let lockTimer = 0
let clearingRows = []
let clearTimer = 0
let reservedCursor = 0
let elapsed = 0
let displayScore = 0
let preset = null
let mobileLayout = null
let pausedFrom = 'playing'
let endTimer = null
let toastTimer = null
let lastBuildSound = 0
let bestScore = 0

const moveHeld = { dir: 0, held: new Set(), time: 0, repeat: 0 }
let softHeld = false

const format = (n) => Math.max(0, Math.round(n)).toLocaleString('en-US')

try {
  bestScore = Number(window.localStorage.getItem('tetrihome-best') || 0) || 0
  const muted = window.localStorage.getItem('tetrihome-muted') === '1'
  audio.setEnabled(!muted)
} catch { /* private mode */ }
audio.setEnabled(audio.enabled)

/* ------------------------------------------------------------------ */
/*  Menu / run lifecycle                                               */
/* ------------------------------------------------------------------ */

function fillQueue() {
  while (queue.length < 6) queue.push(...createBag())
}

function setupMenu() {
  state = 'menu'
  ui.body.dataset.state = 'menu'
  ui.body.classList.remove('game-live')
  ui.hero.classList.remove('gone')
  ui.pause.classList.add('hidden')
  ui.end.classList.add('hidden')
  ui.toast.classList.remove('show')

  board = emptyBoard()
  const heights = [2, 4, 3, 5, 4, 6, 3, 5, 4, 2]
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < heights[col]; row++) {
      if ((row * 5 + col * 3) % 11 === 0) continue
      board[row][col] = TYPES[(row + col * 2) % TYPES.length]
    }
  }
  boardVis.setBoard(board)
  boardVis.reset()
  boardVis.renderCells(board)
  house.buildAll(true)
  updateHud()
  updatePips()
}

function startGame() {
  audio.init()
  clearTimeout(endTimer)
  endTimer = null
  ui.hero.classList.add('gone')
  ui.pause.classList.add('hidden')
  ui.end.classList.add('hidden')
  ui.toast.classList.remove('show')

  state = 'playing'
  ui.body.dataset.state = 'playing'
  ui.body.classList.add('game-live')

  score = 0
  lines = 0
  level = 1
  combo = -1
  displayScore = 0
  dropAccum = 0
  lockTimer = 0
  softHeld = false
  moveHeld.dir = 0
  moveHeld.held.clear()
  reservedCursor = 0
  clearingRows = []
  clearTimer = 0
  active = null

  board = emptyBoard()
  boardVis.setBoard(board)
  boardVis.reset()
  boardVis.renderCells(board)
  house.reset()

  flights.clear()
  effects.clear()
  queue = []
  fillQueue()
  hold = null
  canHold = true

  rig.setPreset(preset)
  rig.setMode('play')
  updateHud()
  updatePips()
  updateQueue()
  updateHold()
  spawnPiece()
  audio.start()
}

function pauseGame() {
  if (state !== 'playing' && state !== 'clearing') return
  pausedFrom = state
  state = 'paused'
  ui.body.dataset.state = 'paused'
  ui.pause.classList.remove('hidden')
  if (audio.enabled) audio.tone(330, 0.07, 'triangle', 0.25, 0.8)
}

function resumeGame() {
  if (state !== 'paused') return
  state = pausedFrom
  ui.body.dataset.state = state
  ui.pause.classList.add('hidden')
  audio.init()
}

function togglePause() {
  if (state === 'paused') resumeGame()
  else pauseGame()
}

function gameOver() {
  if (state === 'over' || state === 'won') return
  state = 'over'
  ui.body.dataset.state = 'over'
  active = null
  boardVis.removePiece()
  boardVis.removeGhost()
  audio.lose()
  rig.addShake(0.22)
  clearTimeout(endTimer)
  endTimer = setTimeout(() => showEnd(false), 650)
}

function completeHouse() {
  if (state === 'won' || state === 'over') return
  state = 'won'
  ui.body.dataset.state = 'won'
  active = null
  boardVis.removePiece()
  boardVis.removeGhost()
  audio.win()
  rig.addShake(0.08)
  const center = house.center(new THREE.Vector3())
  effects.confetti(center, 150)
  rig.focus(center, 13.5, true)
  updateHud()
  updatePips()
  clearTimeout(endTimer)
  endTimer = setTimeout(() => showEnd(true), 1450)
}

function showEnd(won) {
  const finalScore = Math.round(score)
  if (finalScore > bestScore) {
    bestScore = finalScore
    try { window.localStorage.setItem('tetrihome-best', String(bestScore)) } catch { /* noop */ }
  }
  ui.endKicker.textContent = won ? 'BLUEPRINT COMPLETE' : 'THE WELL IS FULL'
  ui.endTitle.textContent = won ? 'HOME SWEET HOME' : 'OUT OF SPACE'
  ui.endSub.textContent = won
    ? 'Every block found its place. The cottage is officially cozy.'
    : 'The stack reached the sky before the last block landed. One more try?'
  ui.endScore.textContent = format(finalScore)
  ui.endLines.textContent = format(lines)
  ui.endBest.textContent = format(bestScore)
  ui.end.classList.remove('hidden')
}

/* ------------------------------------------------------------------ */
/*  Piece lifecycle                                                    */
/* ------------------------------------------------------------------ */

function spawnPiece(type = null) {
  if (state !== 'playing') return
  fillQueue()
  if (!type) type = queue.shift()
  fillQueue()
  const cells = cellsFor(type, 0)
  const x = 3
  const y = ROWS - 3
  if (collides(board, cells, x, y)) {
    gameOver()
    return
  }
  active = { type, rot: 0, x, y, cells }
  canHold = true
  dropAccum = 0
  lockTimer = 0
  boardVis.setBoard(board)
  boardVis.createPiece(active)
  boardVis.updatePiece(active, 0, true)
  updateQueue()
  updateHold()
}

function moveActive(dx, dy) {
  if (!active || state !== 'playing') return false
  const nx = active.x + dx
  const ny = active.y + dy
  if (collides(board, active.cells, nx, ny)) return false
  active.x = nx
  active.y = ny
  lockTimer = 0
  return true
}

function stepDown(soft = false) {
  if (!active) return false
  if (moveActive(0, -1)) {
    if (soft) score += 1
    dropAccum = 0
    return true
  }
  return false
}

function rotateActive(dir) {
  if (!active || state !== 'playing') return
  const next = tryRotate(board, active, dir)
  if (!next) return
  active = next
  lockTimer = 0
  boardVis.updatePiece(active, 0.016, false)
  audio.rotate()
}

function hardDrop() {
  if (!active || state !== 'playing') return
  const targetY = landingY(board, active.cells, active.x, active.y)
  const distance = active.y - targetY
  if (distance > 0) {
    active.y = targetY
    score += distance * 2
    boardVis.updatePiece(active, 0, true)
    const pos = new THREE.Vector3()
    for (const [cx, cy] of active.cells.slice(0, 2)) {
      boardVis.worldCell(targetY + cy, active.x + cx, pos)
      effects.spawn(pos, PIECE_COLORS[active.type], {
        count: 4, size: 0.075, speed: 1.6, gravity: 7, life: 0.36, up: 0.9
      })
    }
  }
  audio.hardDrop()
  rig.addShake(0.085)
  lockPiece()
}

function holdPiece() {
  if (!active || !canHold || state !== 'playing') return
  const currentType = active.type
  boardVis.removePiece()
  boardVis.removeGhost()
  active = null
  if (hold === null) {
    hold = currentType
    spawnPiece()
  } else {
    const swap = hold
    hold = currentType
    spawnPiece(swap)
  }
  canHold = false
  audio.hold()
  updateHold()
  updateQueue()
}

function lockPiece() {
  if (!active) return
  stage.scene.updateMatrixWorld(true)
  const locked = active
  const dustPositions = []
  for (const [cx, cy] of locked.cells) {
    const bx = locked.x + cx
    const by = locked.y + cy
    if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS) continue
    board[by][bx] = locked.type
    const p = boardVis.worldCell(by, bx, new THREE.Vector3())
    dustPositions.push(p)
  }
  boardVis.removePiece()
  boardVis.removeGhost()
  active = null
  boardVis.setBoard(board)
  boardVis.renderCells(board)

  for (let i = 0; i < Math.min(3, dustPositions.length); i++) {
    effects.spawn(dustPositions[i], PIECE_COLORS[locked.type], {
      count: 4, size: 0.07, speed: 1.4, gravity: 8, life: 0.4, up: 1.1
    })
  }
  audio.lock()
  rig.addShake(0.035)

  const rows = fullRows(board)
  if (rows.length) {
    handleLines(rows)
  } else {
    combo = -1
    spawnPiece()
    updateHud()
  }
}

function handleLines(rows) {
  state = 'clearing'
  ui.body.dataset.state = 'clearing'
  clearTimer = 0.34
  clearingRows = rows

  const n = rows.length
  const base = LINE_SCORE[n] * level
  combo = combo < 0 ? 0 : combo + 1
  const comboBonus = combo > 0 ? combo * 50 * level : 0
  score += base + comboBonus
  lines += n
  level = 1 + Math.floor(lines / 10)

  boardVis.flashRows(rows)
  audio.clear(n)
  rig.addShake(0.14)

  const labels = ['LINE CLEAR', 'DOUBLE!', 'TRIPLE!', 'TETRIS!']
  const label = labels[Math.min(3, n - 1)]
  const plural = n === 1 ? 'line' : 'lines'
  let sub = `${n} ${plural} shipped · +${base + comboBonus}`
  if (combo > 0) sub += ` · combo x${combo + 1}`
  showToast(label, sub, n >= 3 ? 'hot' : '')

  stage.scene.updateMatrixWorld(true)
  const cells = []
  for (const row of rows) {
    for (let col = 0; col < COLS; col++) {
      cells.push({ row, col, type: board[row][col] || 'O' })
    }
  }

  const chunk = []
  const remaining = house.total - reservedCursor
  const want = Math.min(n * BUILD_PER_LINE, Math.max(0, remaining))
  for (let i = 0; i < want; i++) chunk.push(house.voxels[reservedCursor++])

  const groups = cells.map(() => [])
  chunk.forEach((voxel, i) => groups[i % cells.length].push(voxel))

  const end = new THREE.Vector3()
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const start = boardVis.worldCell(cell.row, cell.col, new THREE.Vector3())
    const targets = groups[i]
    if (targets.length) {
      end.set(0, 0, 0)
      for (const voxel of targets) end.add(house.worldPosition(voxel))
      end.multiplyScalar(1 / targets.length)
    } else {
      end.copy(start).add(new THREE.Vector3(3.5, 4.5, 0))
    }
    flights.launch(start, end, cell.type, targets, { arc: 4 + Math.random() * 4 })
  }

  updateHud()
  updatePips()
}

function resolveClear() {
  if (clearingRows.length) {
    board = clearRows(board, clearingRows)
    boardVis.setBoard(board)
    boardVis.renderCells(board)
    clearingRows = []
  }
  if (state === 'clearing') {
    state = 'playing'
    ui.body.dataset.state = 'playing'
    spawnPiece()
  }
  updateHud()
}

function onFlightsLand(targets) {
  if (!targets || !targets.length) return
  let built = 0
  for (let i = 0; i < targets.length; i++) {
    const voxel = targets[i]
    if (!house.build(voxel, false)) continue
    voxel.animDelay = i * 0.055
    const pos = house.worldPosition(voxel)
    effects.spawn(pos, MAT_COLORS[voxel.mat] || '#ffffff', {
      count: 2, size: 0.055, speed: 1.1, gravity: 6, life: 0.34, up: 0.6
    })
    built++
  }
  if (built) {
    const now = performance.now()
    if (now - lastBuildSound > 65) {
      audio.build()
      lastBuildSound = now
    }
    updateHud()
    updatePips()
  }
  if (house.builtCount >= house.total) completeHouse()
}

/* ------------------------------------------------------------------ */
/*  Game tick                                                          */
/* ------------------------------------------------------------------ */

function dropInterval() {
  return Math.max(0.105, 0.86 - (level - 1) * 0.058)
}

function updateGame(dt) {
  if (state === 'clearing') {
    clearTimer -= dt
    if (clearTimer <= 0) resolveClear()
    return
  }
  if (state !== 'playing') return

  if (!active) {
    spawnPiece()
    if (!active) return
  }

  if (moveHeld.dir) {
    moveHeld.time += dt
    if (moveHeld.time > 0.155) {
      moveHeld.repeat += dt
      if (moveHeld.repeat > 0.045) {
        if (moveActive(moveHeld.dir, 0)) audio.move()
        moveHeld.repeat = 0
      }
    }
  }

  dropAccum += dt
  const interval = softHeld ? 0.045 : dropInterval()
  if (dropAccum >= interval) {
    dropAccum = 0
    stepDown(softHeld)
    if (!active) return
  }

  if (collides(board, active.cells, active.x, active.y - 1)) {
    lockTimer += dt
    if (lockTimer >= LOCK_DELAY) lockPiece()
  } else {
    lockTimer = 0
  }
}

function updateVisuals(dt) {
  if (active && state === 'playing') boardVis.updatePiece(active, dt, false)
  boardVis.update(dt)
  house.update(dt)
}

/* ------------------------------------------------------------------ */
/*  UI                                                                 */
/* ------------------------------------------------------------------ */

function buildPips() {
  ui.housePips.innerHTML = ''
  for (let i = 0; i < HOUSE_LINES; i++) {
    const pip = document.createElement('i')
    pip.className = 'pip'
    ui.housePips.appendChild(pip)
  }
}

function updatePips() {
  const pips = ui.housePips.children
  const filled = Math.min(HOUSE_LINES, Math.ceil(house.percent * HOUSE_LINES))
  for (let i = 0; i < pips.length; i++) {
    pips[i].classList.toggle('on', i < filled)
    pips[i].classList.toggle('now', i === filled && house.percent < 1 && state !== 'menu')
  }
}

function updateHud() {
  ui.lines.textContent = format(lines)
  ui.level.textContent = format(level)
  const percent = Math.round(house.percent * 100)
  ui.housePercent.textContent = `${percent}%`
  let stageName = 'Blueprint'
  if (house.builtCount > 0) {
    stageName = house.voxels[Math.min(house.builtCount - 1, house.total - 1)].stage
  }
  if (percent >= 100) stageName = 'Home sweet home'
  ui.houseStage.textContent = stageName
  ui.houseLines.textContent = `${lines} / ${HOUSE_LINES} lines`
  updatePips()
}

function renderMini(host, type) {
  host.innerHTML = ''
  host.classList.toggle('empty', !type)
  if (!type) return
  const cells = cellsFor(type, 0)
  const xs = cells.map(([x]) => x)
  const ys = cells.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const grid = document.createElement('div')
  grid.className = 'mini-grid'
  grid.style.gridTemplateColumns = `repeat(${width}, auto)`
  grid.style.gridTemplateRows = `repeat(${height}, auto)`
  for (let y = maxY; y >= minY; y--) {
    for (let x = minX; x <= maxX; x++) {
      const cell = document.createElement('div')
      cell.className = 'mini-cell'
      if (cells.some(([cx, cy]) => cx === x && cy === y)) {
        cell.classList.add('on')
        cell.style.setProperty('--c', PIECE_COLORS[type])
      }
      grid.appendChild(cell)
    }
  }
  host.appendChild(grid)
}

function updateQueue() {
  const minis = ui.next.querySelectorAll('.mini')
  for (let i = 0; i < minis.length; i++) renderMini(minis[i], queue[i] || null)
}

function updateHold() {
  renderMini(ui.hold, hold)
}

function showToast(title, sub, kind = '') {
  ui.toastTitle.textContent = title
  ui.toastSub.textContent = sub
  ui.toast.className = `toast show ${kind}`.trim()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 1550)
}

function updateScoreDisplay(dt) {
  const diff = score - displayScore
  if (Math.abs(diff) < 0.6) {
    displayScore = score
  } else {
    displayScore += diff * Math.min(1, dt * 9)
  }
  ui.score.textContent = format(displayScore)
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

function beginMove(dir) {
  if (state !== 'playing') return
  moveHeld.held.add(dir)
  moveHeld.dir = dir
  moveHeld.time = 0
  moveHeld.repeat = 0
  if (moveActive(dir, 0)) audio.move()
}

function endMove(dir) {
  moveHeld.held.delete(dir)
  if (moveHeld.held.has(-1)) moveHeld.dir = -1
  else if (moveHeld.held.has(1)) moveHeld.dir = 1
  else moveHeld.dir = 0
}

window.addEventListener('keydown', (event) => {
  const key = event.key
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) event.preventDefault()

  if (key === 'm' || key === 'M') {
    toggleSound()
    return
  }

  if (state === 'menu') {
    if (key === 'Enter' || key === ' ') startGame()
    return
  }
  if (state === 'paused') {
    if (key === 'p' || key === 'P' || key === 'Escape' || key === 'Enter') resumeGame()
    return
  }
  if (state === 'won' || state === 'over') {
    if (key === 'Enter' || key === ' ') startGame()
    return
  }
  if (key === 'p' || key === 'P' || key === 'Escape') {
    pauseGame()
    return
  }
  if (state !== 'playing') return
  if (event.repeat) return

  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      beginMove(-1)
      break
    case 'ArrowRight':
    case 'd':
    case 'D':
      beginMove(1)
      break
    case 'ArrowDown':
    case 's':
    case 'S':
      softHeld = true
      break
    case 'ArrowUp':
    case 'w':
    case 'W':
    case 'x':
    case 'X':
      rotateActive(1)
      break
    case 'z':
    case 'Z':
      rotateActive(-1)
      break
    case ' ':
    case 'Spacebar':
      hardDrop()
      break
    case 'c':
    case 'C':
    case 'Shift':
      holdPiece()
      break
  }
})

window.addEventListener('keyup', (event) => {
  const key = event.key
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') endMove(-1)
  else if (key === 'ArrowRight' || key === 'd' || key === 'D') endMove(1)
  else if (key === 'ArrowDown' || key === 's' || key === 'S') softHeld = false
})

function bindTouchControls() {
  const buttons = document.querySelectorAll('[data-action]')
  for (const button of buttons) {
    const action = button.dataset.action
    const down = (event) => {
      event.preventDefault()
      audio.init()
      button.classList.add('pressed')
      if (action === 'left') beginMove(-1)
      else if (action === 'right') beginMove(1)
      else if (action === 'down') softHeld = true
      else if (action === 'rotate') rotateActive(1)
      else if (action === 'drop') hardDrop()
      else if (action === 'hold') holdPiece()
    }
    const up = (event) => {
      event.preventDefault()
      button.classList.remove('pressed')
      if (action === 'left') endMove(-1)
      else if (action === 'right') endMove(1)
      else if (action === 'down') softHeld = false
    }
    button.addEventListener('pointerdown', down)
    button.addEventListener('pointerup', up)
    button.addEventListener('pointercancel', up)
    button.addEventListener('pointerleave', up)
  }
  ui.touch.addEventListener('contextmenu', (event) => event.preventDefault())
}

ui.startBtn.addEventListener('click', () => {
  audio.init()
  startGame()
})
ui.againBtn.addEventListener('click', () => {
  audio.init()
  startGame()
})
ui.resumeBtn.addEventListener('click', resumeGame)
ui.restartPauseBtn.addEventListener('click', () => {
  audio.init()
  startGame()
})
ui.pauseBtn.addEventListener('click', togglePause)
ui.soundBtn.addEventListener('click', toggleSound)

function toggleSound() {
  audio.init()
  audio.setEnabled(!audio.enabled)
  try { window.localStorage.setItem('tetrihome-muted', audio.enabled ? '0' : '1') } catch { /* noop */ }
  ui.soundBtn.textContent = audio.enabled ? '♪' : '×'
  ui.soundBtn.classList.toggle('muted', !audio.enabled)
  ui.soundBtn.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Unmute sound')
  ui.soundBtn.title = audio.enabled ? 'Mute sound' : 'Unmute sound'
}

/* ------------------------------------------------------------------ */
/*  Layout + loop                                                      */
/* ------------------------------------------------------------------ */

function applyLayout(force = false) {
  const isMobile = window.innerWidth <= 900
  stage.resize(window.innerWidth, window.innerHeight)
  if (!force && isMobile === mobileLayout && preset) return
  mobileLayout = isMobile
  preset = stage.applyLayout(isMobile)
  stage.scene.updateMatrixWorld(true)
  if (state !== 'won') rig.setPreset(preset)
}

window.addEventListener('resize', () => applyLayout(false))
window.addEventListener('orientationchange', () => setTimeout(() => applyLayout(true), 120))

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state === 'playing' || state === 'clearing')) pauseGame()
})

let lastFrame = performance.now()
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000))
  lastFrame = now
  elapsed += dt

  stage.updateAmbient(dt, elapsed)
  updateVisuals(dt)
  if (state !== 'paused') {
    effects.update(dt)
    flights.update(dt)
  }
  updateGame(dt)
  rig.update(dt)
  updateScoreDisplay(dt)

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

/* ------------------------------------------------------------------ */
/*  Init                                                               */
/* ------------------------------------------------------------------ */

buildPips()
bindTouchControls()
applyLayout(true)
rig.setMode('menu')
setupMenu()
ui.soundBtn.textContent = audio.enabled ? '♪' : '×'
ui.soundBtn.classList.toggle('muted', !audio.enabled)
updateQueue()
updateHold()
updateHud()
lastFrame = performance.now()
requestAnimationFrame(frame)

/* Debug hooks used by automated play-testing. */
window.__TETRIHOME__ = {
  start: startGame,
  build(linesToBuild = 1) {
    if (state !== 'playing') return
    for (let n = 0; n < linesToBuild; n++) {
      const chunk = []
      const want = Math.min(BUILD_PER_LINE, house.total - reservedCursor)
      for (let i = 0; i < want; i++) chunk.push(house.voxels[reservedCursor++])
      for (const voxel of chunk) house.build(voxel, true)
      lines += 1
      score += LINE_SCORE[1] * level
    }
    updateHud()
    updatePips()
    if (house.builtCount >= house.total) completeHouse()
  },
  snapshot() {
    return {
      state,
      lines,
      score,
      built: house.builtCount,
      total: house.total,
      percent: Math.round(house.percent * 100),
      active: active ? active.type : null
    }
  }
}
