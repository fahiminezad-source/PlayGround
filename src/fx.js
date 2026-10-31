import * as THREE from '../vendor/three.module.js'
import { PIECE_COLORS } from './textures.js'

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const dummy = new THREE.Object3D()
const tmpColor = new THREE.Color()

export function createEffects(scene) {
  const MAX = 260
  const material = new THREE.MeshBasicMaterial({ toneMapped: false })
  const mesh = new THREE.InstancedMesh(boxGeo, material, MAX)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  mesh.castShadow = false
  mesh.receiveShadow = false
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, tmpColor.set(0xffffff))
  mesh.instanceColor.needsUpdate = true
  scene.add(mesh)

  const pool = []
  for (let i = 0; i < MAX; i++) {
    pool.push({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      maxLife: 1,
      size: 0.1,
      gravity: 8,
      spin: 0,
      rot: new THREE.Euler()
    })
    mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
  }
  mesh.instanceMatrix.needsUpdate = true
  let cursor = 0

  function spawn(position, colorHex, options = {}) {
    const {
      count = 8, speed = 2.2, size = 0.09, gravity = 7,
      life = 0.55, spread = 1, up = 1.8
    } = options
    for (let n = 0; n < count; n++) {
      const i = cursor
      cursor = (cursor + 1) % MAX
      const p = pool[i]
      p.active = true
      p.pos.copy(position)
      p.pos.x += (Math.random() - 0.5) * spread
      p.pos.y += (Math.random() - 0.5) * spread * 0.6
      p.pos.z += (Math.random() - 0.5) * spread
      p.vel.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.75 + up,
        (Math.random() - 0.5) * speed
      )
      p.life = p.maxLife = life * (0.7 + Math.random() * 0.6)
      p.size = size * (0.65 + Math.random() * 0.8)
      p.gravity = gravity
      p.spin = (Math.random() - 0.5) * 10
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      mesh.setColorAt(i, tmpColor.set(colorHex))
    }
    mesh.instanceColor.needsUpdate = true
  }

  function confetti(center, count = 120) {
    const colors = ['#ef6a5a', '#f2c94c', '#67c75f', '#54d9e8', '#b46fe4', '#ff9f68', '#fff2c1']
    for (let n = 0; n < count; n++) {
      const i = cursor
      cursor = (cursor + 1) % MAX
      const p = pool[i]
      p.active = true
      p.pos.copy(center)
      p.pos.x += (Math.random() - 0.5) * 7
      p.pos.y += Math.random() * 3
      p.pos.z += (Math.random() - 0.5) * 5
      p.vel.set((Math.random() - 0.5) * 3.2, 2 + Math.random() * 3.6, (Math.random() - 0.5) * 3.2)
      p.life = p.maxLife = 1.7 + Math.random() * 1.1
      p.size = 0.09 + Math.random() * 0.09
      p.gravity = 4.2
      p.spin = (Math.random() - 0.5) * 14
      p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
      mesh.setColorAt(i, tmpColor.set(colors[(Math.random() * colors.length) | 0]))
    }
    mesh.instanceColor.needsUpdate = true
  }

  function update(dt) {
    let dirty = false
    for (let i = 0; i < MAX; i++) {
      const p = pool[i]
      if (!p.active) continue
      dirty = true
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
        continue
      }
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      p.rot.x += p.spin * dt
      p.rot.y += p.spin * 0.7 * dt
      const t = Math.max(0, p.life / p.maxLife)
      const scale = p.size * (0.3 + t * 0.7)
      dummy.position.copy(p.pos)
      dummy.rotation.copy(p.rot)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
  }

  function clear() {
    for (let i = 0; i < MAX; i++) {
      pool[i].active = false
      mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0))
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  return { spawn, confetti, update, clear }
}

export function createFlights(scene, M, onLand) {
  const flights = []

  function launch(start, end, type, targets, options = {}) {
    const material = M.piece[type] || M.piece.O
    const cube = new THREE.Mesh(boxGeo, material)
    cube.scale.setScalar(options.size || 0.22)
    cube.position.copy(start)
    cube.castShadow = false
    scene.add(cube)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    mid.y += options.arc || (3.5 + Math.random() * 4)
    mid.x += (Math.random() - 0.5) * 2.4
    mid.z += (Math.random() - 0.5) * 1.6
    const dist = start.distanceTo(end)
    flights.push({
      cube,
      start: start.clone(),
      control: mid,
      end: end.clone(),
      t: 0,
      duration: options.duration || 0.62 + dist * 0.012,
      targets: targets || [],
      spin: new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6
      )
    })
  }

  function update(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      f.t += dt / f.duration
      const t = Math.min(1, f.t)
      const e = t * t * (3 - 2 * t)
      // Quadratic Bézier.
      const a = (1 - e) * (1 - e)
      const b = 2 * (1 - e) * e
      const c = e * e
      f.cube.position.set(
        a * f.start.x + b * f.control.x + c * f.end.x,
        a * f.start.y + b * f.control.y + c * f.end.y,
        a * f.start.z + b * f.control.z + c * f.end.z
      )
      f.cube.rotation.x += f.spin.x * dt
      f.cube.rotation.y += f.spin.y * dt
      f.cube.rotation.z += f.spin.z * dt
      f.cube.scale.setScalar((0.22 + Math.sin(t * Math.PI) * 0.05) * (1 - (t > 0.86 ? (t - 0.86) / 0.14 * 0.6 : 0)))
      if (t >= 1) {
        scene.remove(f.cube)
        if (f.targets.length) onLand(f.targets, f.end)
        flights.splice(i, 1)
      }
    }
  }

  function clear() {
    for (const f of flights) scene.remove(f.cube)
    flights.length = 0
  }

  return { launch, update, clear, get count() { return flights.length } }
}
