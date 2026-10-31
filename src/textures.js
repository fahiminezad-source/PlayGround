import * as THREE from '../vendor/three.module.js'

/* ------------------------------------------------------------------
   Tiny procedural pixel-art texture kit. Everything in the game is
   generated at runtime, so the build stays a single static bundle.
------------------------------------------------------------------- */

let maxAnisotropy = 4
export function configureTextures(renderer) {
  maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
}

export const PIECE_COLORS = {
  I: '#54d9e8',
  O: '#f2c94c',
  T: '#b46fe4',
  S: '#67c75f',
  Z: '#ef6a5a',
  J: '#5b8cf0',
  L: '#ef9a4a'
}

export const PIECE_NAMES = {
  I: 'diamond',
  O: 'gold',
  T: 'amethyst',
  S: 'emerald',
  Z: 'redstone',
  J: 'lapis',
  L: 'copper'
}

const shadeCache = new Map()
function rgb(hex) {
  if (shadeCache.has(hex)) return shadeCache.get(hex)
  const n = parseInt(hex.replace('#', ''), 16)
  const out = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  shadeCache.set(hex, out)
  return out
}
function rgba(r, g, b, a = 1) {
  return `rgba(${Math.max(0, Math.min(255, r | 0))},${Math.max(0, Math.min(255, g | 0))},${Math.max(0, Math.min(255, b | 0))},${a})`
}
function shift(hex, amount) {
  const [r, g, b] = rgb(hex)
  return rgba(r + amount, g + amount, b + amount)
}
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeCanvas(size = 32) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx, size }
}

function speckle(ctx, size, random, amount = 15, density = 0.34, alpha = 0.9) {
  for (let i = 0; i < size * size * density; i++) {
    const x = (random() * size) | 0
    const y = (random() * size) | 0
    const a = (random() * 2 - 1) * amount
    ctx.fillStyle = shift(a > 0 ? '#ffffff' : '#000000', 0)
    ctx.globalAlpha = Math.abs(a) / 255 * 1.6 * alpha
    ctx.fillStyle = a > 0 ? '#ffffff' : '#000000'
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.globalAlpha = 1
}

function border(ctx, size, color = 'rgba(12,20,24,.32)', inner = 'rgba(255,255,255,.2)') {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, size, 1)
  ctx.fillRect(0, size - 1, size, 1)
  ctx.fillRect(0, 0, 1, size)
  ctx.fillRect(size - 1, 0, 1, size)
  ctx.fillStyle = inner
  ctx.fillRect(1, 1, size - 2, 1)
  ctx.fillRect(1, 1, 1, size - 2)
}

function finish(canvas, { repeat = false, transparent = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestMipmapLinearFilter
  texture.anisotropy = maxAnisotropy
  texture.generateMipmaps = true
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  }
  if (transparent) texture.premultiplyAlpha = false
  return texture
}

function baseBlock(ctx, size, base, random, amount = 16) {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  speckle(ctx, size, random, amount, 0.5)
}

/* ---------------------------- terrain ---------------------------- */

function grassTopTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(7)
  baseBlock(ctx, size, '#71bf49', random, 18)
  for (let i = 0; i < 26; i++) {
    const x = (random() * size) | 0
    const y = (random() * size) | 0
    ctx.fillStyle = random() > 0.5 ? '#8bd85e' : '#5fa93d'
    ctx.fillRect(x, y, 1 + ((random() * 2) | 0), 1)
  }
  border(ctx, size, 'rgba(35,70,30,.35)', 'rgba(210,255,160,.2)')
  return finish(canvas)
}

function grassSideTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(11)
  baseBlock(ctx, size, '#8a5a3c', random, 18)
  // jagged grass cap
  const depth = 6
  for (let x = 0; x < size; x++) {
    const d = depth + ((random() * 4) | 0)
    ctx.fillStyle = '#6fbf49'
    ctx.fillRect(x, 0, 1, d)
    ctx.fillStyle = '#8ad75d'
    ctx.fillRect(x, 0, 1, 1)
    if (random() > 0.5) {
      ctx.fillStyle = '#5ea63c'
      ctx.fillRect(x, d - 1, 1, 1)
    }
  }
  for (let i = 0; i < 20; i++) {
    const x = (random() * size) | 0
    const y = depth + ((random() * (size - depth)) | 0)
    ctx.fillStyle = random() > 0.5 ? '#a06b49' : '#70452c'
    ctx.fillRect(x, y, 1, 1)
  }
  border(ctx, size)
  return finish(canvas)
}

function dirtTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(19)
  baseBlock(ctx, size, '#86573a', random, 20)
  for (let i = 0; i < 36; i++) {
    const x = (random() * size) | 0
    const y = (random() * size) | 0
    ctx.fillStyle = random() > 0.5 ? '#9c6847' : '#68402a'
    ctx.fillRect(x, y, 1 + ((random() * 2) | 0), 1)
  }
  border(ctx, size)
  return finish(canvas)
}

function stoneTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(23)
  baseBlock(ctx, size, '#89929c', random, 17)
  ctx.fillStyle = 'rgba(58,66,74,.5)'
  ctx.fillRect(0, 10, size, 1)
  ctx.fillRect(0, 22, size, 1)
  ctx.fillRect(12, 0, 1, 10)
  ctx.fillRect(24, 11, 1, 11)
  ctx.fillRect(7, 23, 1, 9)
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(255,255,255,.16)'
    ctx.fillRect((random() * size) | 0, (random() * size) | 0, 2, 1)
  }
  border(ctx, size)
  return finish(canvas)
}

function cobbleTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(29)
  baseBlock(ctx, size, '#737b83', random, 22)
  const stones = [
    [1, 1, 13, 8], [16, 1, 15, 12], [1, 11, 9, 9],
    [12, 13, 8, 7], [22, 15, 9, 10], [1, 22, 12, 9],
    [15, 22, 7, 9], [24, 27, 7, 4]
  ]
  for (const [x, y, w, h] of stones) {
    ctx.strokeStyle = 'rgba(40,47,53,.55)'
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    ctx.fillStyle = 'rgba(255,255,255,.06)'
    ctx.fillRect(x + 1, y + 1, w - 2, 1)
  }
  border(ctx, size)
  return finish(canvas)
}

function logTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(31)
  baseBlock(ctx, size, '#7b5131', random, 16)
  for (let x = 0; x < size; x += 4) {
    ctx.fillStyle = 'rgba(49,29,18,.4)'
    ctx.fillRect(x, 0, 1, size)
    ctx.fillStyle = 'rgba(196,147,93,.2)'
    ctx.fillRect(x + 1, 0, 1, size)
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = 'rgba(50,30,18,.35)'
    ctx.fillRect(0, (random() * size) | 0, size, 1)
  }
  border(ctx, size)
  return finish(canvas)
}

function logTopTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(37)
  baseBlock(ctx, size, '#b3814f', random, 8)
  ctx.strokeStyle = 'rgba(92,57,30,.65)'
  for (let r = 4; r < 16; r += 4) {
    ctx.beginPath()
    ctx.arc(16, 16, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  border(ctx, size, 'rgba(61,37,20,.55)')
  return finish(canvas)
}

function planksTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(41)
  baseBlock(ctx, size, '#c1945f', random, 12)
  for (let row = 0; row < 4; row++) {
    const y = row * 8
    ctx.fillStyle = 'rgba(97,62,34,.42)'
    ctx.fillRect(0, y, size, 1)
    ctx.fillStyle = 'rgba(255,225,176,.2)'
    ctx.fillRect(0, y + 1, size, 1)
    const seam = row % 2 ? 10 : 23
    ctx.fillStyle = 'rgba(97,62,34,.38)'
    ctx.fillRect(seam, y, 1, 8)
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(111,73,42,.25)'
      ctx.fillRect((random() * size) | 0, y + 2 + ((random() * 5) | 0), 3, 1)
    }
  }
  border(ctx, size)
  return finish(canvas)
}

function darkPlanksTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(43)
  baseBlock(ctx, size, '#5c3d2b', random, 10)
  for (let row = 0; row < 4; row++) {
    const y = row * 8
    ctx.fillStyle = 'rgba(30,18,12,.55)'
    ctx.fillRect(0, y, size, 1)
    ctx.fillStyle = 'rgba(185,132,85,.14)'
    ctx.fillRect(0, y + 1, size, 1)
    const seam = row % 2 ? 8 : 21
    ctx.fillStyle = 'rgba(30,18,12,.48)'
    ctx.fillRect(seam, y, 1, 8)
  }
  border(ctx, size)
  return finish(canvas)
}

function roofTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(47)
  baseBlock(ctx, size, '#8d4b3c', random, 12)
  for (let row = 0; row < 5; row++) {
    const y = row * 7
    ctx.fillStyle = 'rgba(59,28,24,.5)'
    ctx.fillRect(0, y, size, 1)
    ctx.fillStyle = 'rgba(220,130,100,.16)'
    ctx.fillRect(0, y + 1, size, 1)
    const offset = row % 2 ? 4 : 0
    for (let x = offset; x < size; x += 8) {
      ctx.fillStyle = 'rgba(57,27,23,.34)'
      ctx.fillRect(x, y, 1, 7)
    }
  }
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = 'rgba(255,180,140,.14)'
    ctx.fillRect((random() * size) | 0, (random() * size) | 0, 2, 1)
  }
  border(ctx, size, 'rgba(50,22,19,.5)')
  return finish(canvas)
}

function glassTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(53)
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(175,231,246,.55)'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = 'rgba(230,255,255,.26)'
    ctx.fillRect((random() * size) | 0, (random() * size) | 0, 2, 1)
  }
  ctx.fillStyle = 'rgba(255,255,255,.55)'
  ctx.fillRect(5, 5, 1, 12)
  ctx.fillRect(6, 5, 1, 8)
  ctx.fillRect(18, 20, 1, 7)
  ctx.strokeStyle = 'rgba(65,120,140,.75)'
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1)
  ctx.fillStyle = 'rgba(120,190,210,.5)'
  ctx.fillRect(1, 1, size - 2, 1)
  return finish(canvas, { transparent: true })
}

function leavesTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(59)
  ctx.clearRect(0, 0, size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (random() < 0.09) continue
      const n = random()
      ctx.fillStyle = n > 0.72 ? '#7ecb57' : n > 0.36 ? '#4f9f3b' : '#3d7f2f'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.fillStyle = 'rgba(20,48,18,.25)'
  ctx.fillRect(0, 0, size, 1)
  ctx.fillRect(0, size - 1, size, 1)
  ctx.fillRect(0, 0, 1, size)
  ctx.fillRect(size - 1, 0, 1, size)
  return finish(canvas, { transparent: true })
}

function flowerTexture(hex) {
  const { canvas, ctx, size } = makeCanvas(16)
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#3f8e35'
  ctx.fillRect(7, 7, 2, 9)
  ctx.fillStyle = '#5eb947'
  ctx.fillRect(4, 10, 4, 2)
  ctx.fillStyle = hex
  ctx.fillRect(5, 3, 3, 3)
  ctx.fillRect(2, 5, 3, 3)
  ctx.fillRect(8, 5, 3, 3)
  ctx.fillRect(5, 8, 3, 3)
  ctx.fillStyle = '#ffe9a8'
  ctx.fillRect(6, 5, 1, 1)
  return finish(canvas, { transparent: true })
}

/* ---------------------------- blocks ---------------------------- */

function pieceTexture(type) {
  const base = PIECE_COLORS[type]
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(101 + type.charCodeAt(0))
  baseBlock(ctx, size, base, random, 12)
  // chunky pixel bevel
  ctx.fillStyle = 'rgba(255,255,255,.34)'
  ctx.fillRect(2, 2, size - 4, 2)
  ctx.fillRect(2, 2, 2, size - 4)
  ctx.fillStyle = 'rgba(12,22,28,.32)'
  ctx.fillRect(2, size - 4, size - 4, 2)
  ctx.fillRect(size - 4, 2, 2, size - 4)
  // little mineral flecks
  for (let i = 0; i < 9; i++) {
    const x = 4 + ((random() * (size - 8)) | 0)
    const y = 4 + ((random() * (size - 8)) | 0)
    ctx.fillStyle = 'rgba(255,255,255,.65)'
    ctx.fillRect(x, y, 2, 2)
    ctx.fillStyle = 'rgba(8,20,26,.22)'
    ctx.fillRect(x + 2, y + 2, 1, 1)
  }
  border(ctx, size, 'rgba(8,16,20,.45)')
  return finish(canvas)
}

function ghostTexture() {
  const { canvas, ctx, size } = makeCanvas()
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(112,235,255,.08)'
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(177,250,255,.92)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(0.75, 0.75, size - 1.5, size - 1.5)
  ctx.fillStyle = 'rgba(220,255,255,.9)'
  ctx.fillRect(3, 3, 2, 2)
  ctx.fillRect(27, 3, 2, 2)
  ctx.fillRect(3, 27, 2, 2)
  ctx.fillRect(27, 27, 2, 2)
  return finish(canvas, { transparent: true })
}

function gridTexture() {
  const { canvas, ctx, size } = makeCanvas(64)
  const g = ctx.createLinearGradient(0, 0, 0, size)
  g.addColorStop(0, '#0b2233')
  g.addColorStop(0.55, '#0a1c2a')
  g.addColorStop(1, '#07141f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(112,220,255,.18)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1)
  ctx.strokeStyle = 'rgba(112,220,255,.07)'
  ctx.beginPath()
  ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size)
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2)
  ctx.stroke()
  return finish(canvas, { repeat: true })
}

function pathTexture() {
  const { canvas, ctx, size } = makeCanvas()
  const random = mulberry32(71)
  baseBlock(ctx, size, '#9a917d', random, 14)
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = 'rgba(70,64,52,.42)'
    ctx.fillRect((random() * size) | 0, (random() * size) | 0, 3 + ((random() * 3) | 0), 2)
  }
  border(ctx, size)
  return finish(canvas)
}

function lanternTexture() {
  const { canvas, ctx, size } = makeCanvas()
  baseBlock(ctx, size, '#ffcb62', mulberry32(73), 12)
  ctx.fillStyle = 'rgba(255,255,220,.85)'
  ctx.fillRect(9, 9, 14, 14)
  ctx.fillStyle = 'rgba(255,145,52,.7)'
  ctx.fillRect(12, 12, 8, 8)
  ctx.strokeStyle = 'rgba(74,47,25,.8)'
  ctx.lineWidth = 3
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3)
  ctx.beginPath()
  ctx.moveTo(4, 4); ctx.lineTo(28, 28)
  ctx.moveTo(28, 4); ctx.lineTo(4, 28)
  ctx.strokeStyle = 'rgba(74,47,25,.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  return finish(canvas)
}

function cloudTexture() {
  const { canvas, ctx, size } = makeCanvas(64)
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31)
  g.addColorStop(0, 'rgba(255,255,255,.95)')
  g.addColorStop(0.55, 'rgba(255,255,255,.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return finish(canvas, { transparent: true })
}

/* ---------------------------- export ---------------------------- */

export function createMaterials() {
  const lambert = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra })
  const box = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra })

  const grassTop = grassTopTexture()
  const grassSide = grassSideTexture()
  const dirt = dirtTexture()
  const stone = stoneTexture()
  const cobble = cobbleTexture()
  const log = logTexture()
  const logTop = logTopTexture()
  const planks = planksTexture()
  const darkPlanks = darkPlanksTexture()
  const roof = roofTexture()
  const glass = glassTexture()
  const leaves = leavesTexture()
  const path = pathTexture()
  const lantern = lanternTexture()
  const grid = gridTexture()
  const ghost = ghostTexture()
  const cloud = cloudTexture()

  const stoneMat = box(stone)
  const dirtMat = box(dirt)
  const grassSideMat = box(grassSide)
  const grassTopMat = box(grassTop)
  const cobbleMat = box(cobble)
  const planksMat = box(planks)
  const logMat = box(log)
  const logTopMat = box(logTop)
  const leavesMat = box(leaves, { alphaTest: 0.35, transparent: false })
  const glassMat = box(glass, { transparent: true, opacity: 0.86, depthWrite: true })
  const pathMat = box(path)
  const roofMat = box(roof)
  const darkPlanksMat = box(darkPlanks)
  const lanternMat = new THREE.MeshBasicMaterial({ map: lantern, toneMapped: false })

  const grassBlock = [
    grassSideMat, grassSideMat, grassTopMat, dirtMat, grassSideMat, grassSideMat
  ]

  const piece = {}
  for (const type of Object.keys(PIECE_COLORS)) {
    const map = pieceTexture(type)
    piece[type] = lambert(map)
  }

  const scene = {
    grassTop, grassSide, dirt, stone, cobble, log, logTop, planks,
    darkPlanks, roof, glass, leaves, path, lantern, cloud
  }

  return {
    scene,
    piece,
    house: {
      foundation: stoneMat,
      foundationAlt: cobbleMat,
      wall: planksMat,
      frame: logMat,
      trim: darkPlanksMat,
      roof: roofMat,
      glass: glassMat,
      door: darkPlanksMat,
      chimney: cobbleMat,
      porch: pathMat,
      lantern: lanternMat
    },
    env: {
      grassTop: grassTopMat,
      grassSide: grassSideMat,
      grassBlock,
      dirt: dirtMat,
      stone: stoneMat,
      cobble: cobbleMat,
      log: logMat,
      logTop: logTopMat,
      planks: planksMat,
      darkPlanks: darkPlanksMat,
      leaves: leavesMat,
      path: pathMat,
      cloud: new THREE.MeshLambertMaterial({ map: cloud, transparent: true, opacity: 0.85, depthWrite: false }),
      lantern: lanternMat
    },
    ghost: new THREE.MeshBasicMaterial({
      map: ghost,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false
    }),
    boardGrid: new THREE.MeshBasicMaterial({
      map: grid,
      transparent: true,
      opacity: 0.92,
      toneMapped: false
    }),
    flower: {
      red: new THREE.MeshLambertMaterial({ map: flowerTexture('#e9594f'), alphaTest: 0.3, side: THREE.DoubleSide }),
      yellow: new THREE.MeshLambertMaterial({ map: flowerTexture('#f3d35b'), alphaTest: 0.3, side: THREE.DoubleSide }),
      white: new THREE.MeshLambertMaterial({ map: flowerTexture('#f4f0df'), alphaTest: 0.3, side: THREE.DoubleSide })
    }
  }
}
