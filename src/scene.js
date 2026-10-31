import * as THREE from '../vendor/three.module.js'
import { configureTextures, createMaterials } from './textures.js'
import { COLS, ROWS } from './tetris.js'
import { HOUSE_VOXEL } from './house.js'

export const CELL = 0.7
export const BASE_Y = 1.28

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const rand = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tiled(material, rx, ry) {
  const m = material.clone()
  if (m.map) {
    m.map = m.map.clone()
    m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping
    m.map.repeat.set(rx, ry)
    m.map.needsUpdate = true
  }
  return m
}

function addBox(parent, w, h, d, material, x, y, z, cast = true, receive = true) {
  const mesh = new THREE.Mesh(boxGeo, material)
  mesh.scale.set(w, h, d)
  mesh.position.set(x, y, z)
  mesh.castShadow = cast
  mesh.receiveShadow = receive
  parent.add(mesh)
  return mesh
}

function makePuffTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 31)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,.65)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function addFlowers(group, M, random, count, radiusX, radiusZ, centerZ = 0) {
  const plane = new THREE.PlaneGeometry(0.42, 0.42)
  const colors = [M.flower.red, M.flower.yellow, M.flower.white]
  for (let i = 0; i < count; i++) {
    const x = (random() * 2 - 1) * radiusX
    const z = (random() * 2 - 1) * radiusZ + centerZ
    if (Math.abs(x) < 1.2 && Math.abs(z) < 2.4) continue
    const mat = colors[(random() * colors.length) | 0]
    const holder = new THREE.Group()
    holder.position.set(x, 0.03, z)
    const scale = 0.7 + random() * 0.65
    for (let k = 0; k < 2; k++) {
      const mesh = new THREE.Mesh(plane, mat)
      mesh.position.y = 0.2 * scale
      mesh.scale.setScalar(scale)
      mesh.rotation.y = k * Math.PI / 2 + random() * 0.4
      mesh.castShadow = false
      holder.add(mesh)
    }
    group.add(holder)
  }
}

function addTree(group, M, x, z, scale, seed) {
  const random = rand(seed)
  const tree = new THREE.Group()
  tree.position.set(x, 0, z)
  tree.scale.setScalar(scale)
  const trunkH = 4 + ((random() * 2) | 0)
  for (let i = 0; i < trunkH; i++) {
    addBox(tree, 0.42, 0.42, 0.42, M.env.log, 0, 0.21 + i * 0.42, 0)
  }
  const canopyY = trunkH * 0.42 + 0.1
  for (let ly = -1; ly <= 2; ly++) {
    for (let lx = -1; lx <= 1; lx++) {
      for (let lz = -1; lz <= 1; lz++) {
        if (lx === 0 && lz === 0 && ly < 2) continue
        if (Math.abs(lx) + Math.abs(lz) === 2 && random() > 0.72) continue
        addBox(tree, 0.62, 0.62, 0.62, M.env.leaves,
          lx * 0.58 + (random() - 0.5) * 0.12,
          canopyY + ly * 0.54,
          lz * 0.58 + (random() - 0.5) * 0.12)
      }
    }
  }
  addBox(tree, 0.62, 0.62, 0.62, M.env.leaves, 0, canopyY + 1.22, 0)
  group.add(tree)
  return tree
}

function makeSign(M, text = 'HOME') {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#b78956'
  ctx.fillRect(0, 0, 128, 64)
  ctx.fillStyle = 'rgba(82,50,27,.35)'
  for (let y = 8; y < 64; y += 14) ctx.fillRect(0, y, 128, 2)
  ctx.strokeStyle = '#5d3a20'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, 123, 59)
  ctx.fillStyle = '#2d1c10'
  ctx.font = 'bold 34px "Courier New", monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 64, 34)
  ctx.fillStyle = 'rgba(255,238,196,.35)'
  ctx.fillRect(8, 6, 112, 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.NearestFilter
  const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })
  return mat
}

function createIsland({ width, depth, seed, flowers = true, rimNotch = 0, M }) {
  const group = new THREE.Group()
  const random = rand(seed)
  const grassTop = tiled(M.env.grassTop, width / 1.6, depth / 1.6)
  const grassSide = tiled(M.env.grassSide, width / 1.6, 1)
  const dirtTop = tiled(M.env.dirt, width / 2, depth / 2)
  const stone = tiled(M.env.stone, width / 2.2, depth / 2.2)
  const grassBlock = [grassSide, grassSide, grassTop, dirtTop, grassSide, grassSide]

  addBox(group, width, 0.72, depth, grassBlock, 0, -0.36, 0)
  addBox(group, width * 0.98, 0.72, depth * 0.98, dirtTop, 0, -1.03, 0)
  addBox(group, width * 0.93, 0.72, depth * 0.93, dirtTop, 0, -1.7, 0)
  addBox(group, width * 0.82, 0.8, depth * 0.8, stone, 0, -2.4, 0)
  addBox(group, width * 0.62, 0.8, depth * 0.6, stone, 0, -3.1, 0)
  addBox(group, width * 0.38, 0.7, depth * 0.38, stone, 0, -3.72, 0)

  // Chipped, grassy rim made of little blocks.
  const nx = Math.max(4, Math.round(width / 1.05))
  const nz = Math.max(4, Math.round(depth / 1.05))
  const rimCount = nx * 2 + nz * 2
  for (let i = 0; i < rimCount; i++) {
    let x, z
    if (i < nx) { x = -width / 2 + i * (width / (nx - 1)); z = -depth / 2 }
    else if (i < nx * 2) { x = -width / 2 + (i - nx) * (width / (nx - 1)); z = depth / 2 }
    else if (i < nx * 2 + nz) { x = width / 2; z = -depth / 2 + (i - nx * 2) * (depth / (nz - 1)) }
    else { x = -width / 2; z = -depth / 2 + (i - nx * 2 - nz) * (depth / (nz - 1)) }
    if (random() > 0.82) continue
    if (z > 0 && Math.abs(x) < rimNotch) continue
    const h = 0.55 + random() * 0.5
    addBox(group, 0.86, h, 0.86, M.env.grassBlock,
      x + (random() - 0.5) * 0.3, h / 2 - 0.05, z + (random() - 0.5) * 0.3)
  }

  // Hanging rock tips and vines give the chunk a floating look.
  for (let i = 0; i < 7; i++) {
    const s = 0.7 + random() * 1.7
    addBox(group, s, s * 0.8, s, stone,
      (random() - 0.5) * width * 0.6,
      -3.7 - random() * 1.4,
      (random() - 0.5) * depth * 0.6)
  }
  const vineMat = new THREE.MeshLambertMaterial({ color: 0x4d8f37 })
  for (let i = 0; i < 10; i++) {
    const h = 0.8 + random() * 2.2
    addBox(group, 0.07, h, 0.07, vineMat,
      (random() > 0.5 ? 1 : -1) * (width / 2 - 0.2),
      -0.7 - random() * 1.8,
      (random() - 0.5) * depth * 0.7, false, false)
  }

  // Grass tufts.
  for (let i = 0; i < 20; i++) {
    const x = (random() * 2 - 1) * (width / 2 - 0.5)
    const z = (random() * 2 - 1) * (depth / 2 - 0.5)
    if (Math.abs(x) < 1.4 && Math.abs(z) < 2.5) continue
    addBox(group, 0.05, 0.25 + random() * 0.25, 0.05,
      new THREE.MeshLambertMaterial({ color: random() > 0.5 ? 0x7ac84f : 0x5da63c }),
      x, 0.12, z, false, false)
  }

  if (flowers) addFlowers(group, M, random, 16, width / 2 - 0.7, depth / 2 - 0.7)

  return group
}

export function createScene() {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('scene'),
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  configureTextures(renderer)
  const M = createMaterials()

  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xc7e8f4, 58, 140)

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 240)

  const hemi = new THREE.HemisphereLight(0xdff4ff, 0x596e46, 1.45)
  scene.add(hemi)
  const sunLight = new THREE.DirectionalLight(0xfff1d2, 2.55)
  sunLight.position.set(-15, 27, 17)
  sunLight.target.position.set(2, 4, 0)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  sunLight.shadow.camera.left = -20
  sunLight.shadow.camera.right = 20
  sunLight.shadow.camera.top = 22
  sunLight.shadow.camera.bottom = -8
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 85
  sunLight.shadow.bias = -0.0004
  sunLight.shadow.normalBias = 0.025
  scene.add(sunLight)
  scene.add(sunLight.target)
  scene.add(new THREE.AmbientLight(0xa8c6d8, 0.28))

  const boardZone = new THREE.Group()
  const boardGroup = new THREE.Group()
  boardZone.add(boardGroup)
  scene.add(boardZone)

  const houseZone = new THREE.Group()
  const houseGroup = new THREE.Group()
  houseGroup.position.y = 0.04
  houseZone.add(houseGroup)
  scene.add(houseZone)

  /* ------------------------------ board ------------------------------ */

  const boardIsland = createIsland({ width: 12.4, depth: 9.4, seed: 3, flowers: true, rimNotch: 3.6, M })
  boardZone.add(boardIsland)

  const w = COLS * CELL
  const h = ROWS * CELL
  const baseY = BASE_Y
  const centerY = baseY + h / 2

  // Pedestal + steps.
  addBox(boardGroup, 8.8, BASE_Y - 0.04, 3.2, tiled(M.env.stone, 3, 1), 0, (BASE_Y - 0.04) / 2, 0)
  addBox(boardGroup, 5.4, 0.28, 1.1, tiled(M.env.stone, 2, 1), 0, 0.14, 2.0)
  addBox(boardGroup, 3.2, 0.2, 1.0, tiled(M.env.stone, 1, 1), 0, 0.1, 2.55)

  // Holographic grid backdrop.
  const gridMat = M.boardGrid.clone()
  gridMat.map = M.boardGrid.map.clone()
  gridMat.map.wrapS = gridMat.map.wrapT = THREE.RepeatWrapping
  gridMat.map.repeat.set(COLS, ROWS)
  gridMat.map.needsUpdate = true
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, h + 0.08), gridMat)
  back.position.set(0, centerY, -0.46)
  boardGroup.add(back)

  // Wooden frame.
  const frameMat = M.env.log
  const trimMat = tiled(M.env.darkPlanks, 2, 2)
  addBox(boardGroup, 0.34, h + 0.8, 1.02, frameMat, -(w / 2 + 0.18), centerY, 0.05)
  addBox(boardGroup, 0.34, h + 0.8, 1.02, frameMat, w / 2 + 0.18, centerY, 0.05)
  addBox(boardGroup, w + 0.72, 0.34, 1.02, frameMat, 0, baseY + h + 0.34, 0.05)
  addBox(boardGroup, w + 0.72, 0.34, 1.02, frameMat, 0, baseY - 0.18, 0.05)
  addBox(boardGroup, 0.16, h + 0.5, 0.16, trimMat, -(w / 2 + 0.18), centerY, 0.45)
  addBox(boardGroup, 0.16, h + 0.5, 0.16, trimMat, w / 2 + 0.18, centerY, 0.45)
  addBox(boardGroup, 0.22, 0.22, 0.22, M.env.lantern, -(w / 2 + 0.18), baseY + h + 0.62, 0.12, false, false)
  addBox(boardGroup, 0.22, 0.22, 0.22, M.env.lantern, w / 2 + 0.18, baseY + h + 0.62, 0.12, false, false)

  // A little build sign on the pedestal.
  const boardSign = new THREE.Group()
  boardSign.position.set(-3.35, 0.2, 2.35)
  boardSign.rotation.y = 0.18
  addBox(boardSign, 0.13, 1.1, 0.13, M.env.log, 0, 0.55, 0)
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.55), makeSign(M, 'BUILD'))
  plate.position.set(0, 1.0, 0.08)
  boardSign.add(plate)
  boardZone.add(boardSign)

  /* ------------------------------ house ------------------------------ */

  const houseIsland = createIsland({ width: 13, depth: 11, seed: 8, flowers: true, M })
  houseZone.add(houseIsland)

  // Stepping-stone path from the porch.
  const pathMat = M.env.path
  for (let i = 0; i < 5; i++) {
    const s = 0.68 - i * 0.035
    addBox(houseZone, s, 0.07, 0.5, pathMat, (i % 2 ? 0.12 : -0.1), 0.035, 2.9 + i * 0.62, false, true)
  }

  addTree(houseZone, M, -6.0, -4.6, 0.95, 21)
  addTree(houseZone, M, 5.9, -4.8, 0.74, 33)

  const sign = new THREE.Group()
  sign.position.set(2.6, 0.03, 4.3)
  sign.rotation.y = -0.34
  addBox(sign, 0.12, 1.0, 0.12, M.env.log, 0, 0.5, 0)
  const homePlate = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.62), makeSign(M))
  homePlate.position.set(0, 0.9, 0.07)
  sign.add(homePlate)
  houseZone.add(sign)

  // Tiny fence by the path.
  for (const x of [-1.7, 1.7]) {
    addBox(houseZone, 0.12, 0.8, 0.12, M.env.log, x, 0.4, 4.6)
    addBox(houseZone, 0.12, 0.8, 0.12, M.env.log, x, 0.4, 5.3)
    addBox(houseZone, 0.1, 0.1, 0.8, M.env.planks, x, 0.58, 4.95)
    addBox(houseZone, 0.1, 0.1, 0.8, M.env.planks, x, 0.3, 4.95)
  }

  /* ------------------------------- sky ------------------------------- */

  const cloudTex = makePuffTexture()
  const clouds = []
  const cloudRandom = rand(91)
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group()
    cloud.position.set(-28 + cloudRandom() * 56, 12 + cloudRandom() * 12, -24 - cloudRandom() * 32)
    cloud.scale.setScalar(0.8 + cloudRandom() * 1.2)
    const puffs = 4 + ((cloudRandom() * 4) | 0)
    for (let p = 0; p < puffs; p++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.55 + cloudRandom() * 0.25,
        depthWrite: false,
        color: 0xffffff
      })
      const sprite = new THREE.Sprite(mat)
      sprite.position.set((cloudRandom() - 0.5) * 7, (cloudRandom() - 0.5) * 1.8, (cloudRandom() - 0.5) * 3)
      sprite.scale.set(4 + cloudRandom() * 5, 1.8 + cloudRandom() * 2.2, 1)
      cloud.add(sprite)
    }
    cloud.userData.speed = 0.18 + cloudRandom() * 0.22
    clouds.push(cloud)
    scene.add(cloud)
  }

  const sunTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,253,235,1)')
    g.addColorStop(0.16, 'rgba(255,244,190,.95)')
    g.addColorStop(0.42, 'rgba(255,226,150,.38)')
    g.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  })()
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95
  }))
  sunSprite.position.set(26, 25, -54)
  sunSprite.scale.set(25, 25, 1)
  scene.add(sunSprite)

  // Far-away islands for a sense of scale.
  for (const [x, y, z, s] of [[-25, 10, -40, 1.15], [28, 15, -55, 0.9], [4, 19, -68, 1.35]]) {
    const far = createIsland({ width: 7, depth: 5, seed: x + 40, flowers: false, M })
    far.position.set(x, y, z)
    far.scale.setScalar(s)
    scene.add(far)
  }

  const dustTex = makePuffTexture()
  const dustCount = 110
  const dustGeo = new THREE.BufferGeometry()
  const dustPos = new Float32Array(dustCount * 3)
  const dustSeed = rand(177)
  const dustData = []
  for (let i = 0; i < dustCount; i++) {
    const x = -22 + dustSeed() * 44
    const y = 0.5 + dustSeed() * 20
    const z = -18 + dustSeed() * 30
    dustPos[i * 3] = x
    dustPos[i * 3 + 1] = y
    dustPos[i * 3 + 2] = z
    dustData.push({ y, speed: 0.06 + dustSeed() * 0.14, drift: dustSeed() * Math.PI * 2 })
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: dustTex, color: 0xfff2c1, size: 0.11, transparent: true, opacity: 0.55,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }))
  scene.add(dust)

  /* ----------------------------- layout ----------------------------- */

  let mobileLayout = null

  function applyLayout(mobile) {
    mobileLayout = mobile
    if (mobile) {
      boardZone.position.set(-0.4, 0, 1.3)
      houseZone.position.set(1.8, 13.2, -4.2)
      houseZone.scale.setScalar(0.9)
      sunLight.shadow.mapSize.set(1024, 1024)
      return {
        target: new THREE.Vector3(1.0, 8.3, 0),
        dist: 28.5,
        fov: 54,
        yaw: 0.32,
        pitch: 0.25
      }
    }
    boardZone.position.set(-3.0, 0, 0.6)
    houseZone.position.set(7.3, 3.7, -1.6)
    houseZone.scale.setScalar(1)
    sunLight.shadow.mapSize.set(2048, 2048)
    return {
      target: new THREE.Vector3(2.0, 5.8, 0),
      dist: 27.5,
      fov: 34,
      yaw: 0.55,
      pitch: 0.31
    }
  }

  function updateAmbient(dt, elapsed) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > 34) cloud.position.x = -34
      cloud.position.y += Math.sin(elapsed * 0.35 + cloud.position.z) * 0.0018
    }
    const pos = dustGeo.attributes.position.array
    for (let i = 0; i < dustCount; i++) {
      const d = dustData[i]
      pos[i * 3 + 1] += d.speed * dt
      pos[i * 3] += Math.sin(elapsed * 0.35 + d.drift) * 0.006
      if (pos[i * 3 + 1] > 22) pos[i * 3 + 1] = 0.3
    }
    dustGeo.attributes.position.needsUpdate = true
    sunSprite.material.opacity = 0.88 + Math.sin(elapsed * 0.5) * 0.06
  }

  function resize(width, height) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  return {
    renderer, scene, camera, M,
    boardZone, boardGroup, houseZone, houseGroup,
    applyLayout, updateAmbient, resize,
    isMobile: () => mobileLayout,
    BOARD: { width: w, height: h, baseY, centerY, cell: CELL }
  }
}
