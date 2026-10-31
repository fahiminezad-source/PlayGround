import * as THREE from '../vendor/three.module.js'

export function createCameraRig(camera, canvas) {
  const current = {
    target: new THREE.Vector3(2.0, 5.8, 0),
    yaw: 0.72,
    pitch: 0.38,
    dist: 48,
    fov: 34
  }
  const goal = {
    target: current.target.clone(),
    yaw: current.yaw,
    pitch: current.pitch,
    dist: current.dist,
    fov: current.fov
  }
  const base = { target: current.target.clone(), yaw: current.yaw, pitch: current.pitch, dist: current.dist, fov: current.fov }
  let mode = 'menu'
  let autoOrbit = true
  let orbitPhase = 0
  let userMovedAt = -100
  let elapsed = 0
  let shake = 0
  let dragging = false
  let pointerId = null
  let lastX = 0
  let lastY = 0

  camera.position.set(18, 20, 38)

  function setPreset(preset, immediate = false) {
    base.target.copy(preset.target)
    base.yaw = preset.yaw
    base.pitch = preset.pitch
    base.dist = preset.dist
    base.fov = preset.fov
    goal.target.copy(preset.target)
    goal.yaw = preset.yaw
    goal.pitch = preset.pitch
    goal.dist = preset.dist
    goal.fov = preset.fov
    if (immediate) {
      current.target.copy(goal.target)
      current.yaw = goal.yaw
      current.pitch = goal.pitch
      current.dist = goal.dist
      current.fov = goal.fov
    }
  }

  function setMode(next) {
    mode = next
    autoOrbit = next !== 'play'
    userMovedAt = -100
    if (next === 'play') {
      goal.target.copy(base.target)
      goal.yaw = base.yaw
      goal.pitch = base.pitch
      goal.dist = base.dist
      goal.fov = base.fov
    }
  }

  function focus(position, distance = 13, orbit = true) {
    mode = 'focus'
    autoOrbit = orbit
    goal.target.copy(position)
    goal.dist = distance
    goal.fov = 33
    goal.pitch = 0.28
    goal.yaw = base.yaw - 0.35
    userMovedAt = -100
  }

  function addShake(amount) {
    shake = Math.min(0.32, shake + amount)
  }

  function resetView() {
    goal.target.copy(base.target)
    goal.yaw = base.yaw
    goal.pitch = base.pitch
    goal.dist = base.dist
    goal.fov = base.fov
    userMovedAt = elapsed
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    dragging = true
    pointerId = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    canvas.setPointerCapture?.(pointerId)
    canvas.classList.add('grabbing')
  }

  function onPointerMove(event) {
    if (!dragging || event.pointerId !== pointerId) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    if (Math.abs(dx) + Math.abs(dy) < 1) return
    goal.yaw -= dx * 0.0052
    goal.pitch = THREE.MathUtils.clamp(goal.pitch + dy * 0.0035, 0.08, 0.95)
    userMovedAt = elapsed
    autoOrbit = false
  }

  function endDrag(event) {
    if (pointerId !== null && event?.pointerId !== undefined && event.pointerId !== pointerId) return
    dragging = false
    pointerId = null
    canvas.classList.remove('grabbing')
  }

  function onWheel(event) {
    event.preventDefault()
    goal.dist = THREE.MathUtils.clamp(goal.dist + event.deltaY * 0.018, 11, 55)
    userMovedAt = elapsed
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('dblclick', resetView)

  function update(dt) {
    elapsed += dt
    if (autoOrbit) {
      orbitPhase += dt * (mode === 'menu' ? 0.22 : 0.14)
      goal.yaw = base.yaw + Math.sin(orbitPhase) * (mode === 'menu' ? 0.09 : 0.06)
      goal.pitch = base.pitch + Math.sin(orbitPhase * 0.7) * 0.012
    } else if (mode !== 'play' && elapsed - userMovedAt > 7) {
      goal.yaw = THREE.MathUtils.damp(goal.yaw, base.yaw, 0.9, dt)
      goal.pitch = THREE.MathUtils.damp(goal.pitch, base.pitch, 0.9, dt)
    }

    const damp = 3.4
    current.target.x = THREE.MathUtils.damp(current.target.x, goal.target.x, damp, dt)
    current.target.y = THREE.MathUtils.damp(current.target.y, goal.target.y, damp, dt)
    current.target.z = THREE.MathUtils.damp(current.target.z, goal.target.z, damp, dt)
    current.yaw = THREE.MathUtils.damp(current.yaw, goal.yaw, damp, dt)
    current.pitch = THREE.MathUtils.damp(current.pitch, goal.pitch, damp, dt)
    current.dist = THREE.MathUtils.damp(current.dist, goal.dist, 2.8, dt)
    current.fov = THREE.MathUtils.damp(current.fov, goal.fov, 2.8, dt)

    if (Math.abs(camera.fov - current.fov) > 0.01) {
      camera.fov = current.fov
      camera.updateProjectionMatrix()
    }

    const cp = Math.cos(current.pitch)
    camera.position.set(
      current.target.x + Math.sin(current.yaw) * cp * current.dist,
      current.target.y + Math.sin(current.pitch) * current.dist,
      current.target.z + Math.cos(current.yaw) * cp * current.dist
    )
    camera.lookAt(current.target)

    if (shake > 0.0005) {
      camera.position.x += (Math.random() - 0.5) * shake
      camera.position.y += (Math.random() - 0.5) * shake
      camera.position.z += (Math.random() - 0.5) * shake
      shake *= Math.exp(-dt * 9)
    } else {
      shake = 0
    }
  }

  return {
    current,
    goal,
    setPreset,
    setMode,
    focus,
    resetView,
    addShake,
    update,
    get mode() { return mode }
  }
}
