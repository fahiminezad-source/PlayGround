import * as THREE from '../vendor/three.module.js'
import { COLS } from './tetris.js'
import { CELL, BASE_Y } from './scene.js'

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const edgeGeo = new THREE.EdgesGeometry(boxGeo)
const flashGeo = new THREE.PlaneGeometry(1, 1)

export function createBoardVisual(boardGroup, M) {
  const lockedLayer = new THREE.Group()
  const pieceLayer = new THREE.Group()
  const ghostLayer = new THREE.Group()
  ghostLayer.renderOrder = 2
  boardGroup.add(lockedLayer)
  boardGroup.add(pieceLayer)
  boardGroup.add(ghostLayer)

  const ghostMats = {}
  for (const type of Object.keys(M.piece)) {
    ghostMats[type] = new THREE.MeshBasicMaterial({
      map: M.piece[type].map,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      toneMapped: false
    })
  }
  const ghostEdgeMat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    toneMapped: false
  })

  let pieceGroup = null
  let ghostGroup = null
  let ghostSignature = ''
  let pulse = 0
  let lastType = null
  const flashes = []

  function renderCells(board) {
    while (lockedLayer.children.length) {
      lockedLayer.remove(lockedLayer.children[0])
    }
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < COLS; col++) {
        const type = board[row][col]
        if (!type) continue
        const mesh = new THREE.Mesh(boxGeo, M.piece[type])
        mesh.scale.setScalar(CELL * 0.96)
        mesh.position.set(
          (col - (COLS - 1) / 2) * CELL,
          BASE_Y + row * CELL + CELL / 2,
          0
        )
        mesh.castShadow = true
        mesh.receiveShadow = true
        lockedLayer.add(mesh)
      }
    }
  }

  function shapeChildPositions(group, cells) {
    const children = group.children
    for (let i = 0; i < cells.length; i++) {
      if (!children[i]) continue
      children[i].position.set(cells[i][0] * CELL, cells[i][1] * CELL + CELL / 2, 0)
    }
  }

  function createPiece(active) {
    removePiece()
    lastType = active.type
    pieceGroup = new THREE.Group()
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(boxGeo, M.piece[active.type])
      mesh.scale.setScalar(CELL * 0.96)
      mesh.castShadow = true
      mesh.receiveShadow = true
      pieceGroup.add(mesh)
    }
    shapeChildPositions(pieceGroup, active.cells)
    pieceGroup.position.set(
      (active.x - (COLS - 1) / 2) * CELL,
      BASE_Y + active.y * CELL,
      0
    )
    pieceLayer.add(pieceGroup)
    pulse = 0.9
    createGhost(active)
  }

  function removePiece() {
    if (!pieceGroup) return
    pieceLayer.remove(pieceGroup)
    pieceGroup = null
    lastType = null
  }

  function updatePiece(active, dt, snap = false) {
    if (!pieceGroup || !active) return
    const tx = (active.x - (COLS - 1) / 2) * CELL
    const ty = BASE_Y + active.y * CELL
    if (snap) {
      pieceGroup.position.x = tx
      pieceGroup.position.y = ty
    } else {
      const lambda = 26
      pieceGroup.position.x = THREE.MathUtils.damp(pieceGroup.position.x, tx, lambda, dt)
      pieceGroup.position.y = THREE.MathUtils.damp(pieceGroup.position.y, ty, lambda, dt)
    }
    shapeChildPositions(pieceGroup, active.cells)
    pulse = Math.max(0, pulse - dt * 7)
    const s = 1 + Math.sin(pulse * Math.PI) * 0.07
    pieceGroup.scale.setScalar(s)
    showGhost(active)
  }

  function createGhost(active) {
    removeGhost()
    ghostGroup = new THREE.Group()
    ghostSignature = `${active.type}:${active.rot}`
    for (let i = 0; i < 4; i++) {
      const mesh = new THREE.Mesh(boxGeo, ghostMats[active.type])
      mesh.scale.setScalar(CELL * 0.92)
      mesh.add(new THREE.LineSegments(edgeGeo, ghostEdgeMat))
      ghostGroup.add(mesh)
    }
    shapeChildPositions(ghostGroup, active.cells)
    ghostLayer.add(ghostGroup)
  }

  function removeGhost() {
    if (!ghostGroup) return
    ghostLayer.remove(ghostGroup)
    ghostGroup = null
    ghostSignature = ''
  }

  // Updated by main so the ghost can query the live board.
  let liveBoard = []
  const canDrop = (active, y) => {
    for (const [cx, cy] of active.cells) {
      const bx = active.x + cx
      const by = y + cy
      if (by < 0) return false
      if (by < liveBoard.length && liveBoard[by] && liveBoard[by][bx]) return false
    }
    return true
  }

  function showGhost(active) {
    if (!active) {
      if (ghostGroup) ghostGroup.visible = false
      return
    }
    if (!ghostGroup) createGhost(active)
    const sig = `${active.type}:${active.rot}`
    if (sig !== ghostSignature) {
      ghostSignature = sig
      shapeChildPositions(ghostGroup, active.cells)
    }
    ghostGroup.visible = true
    let ly = active.y
    while (canDrop(active, ly - 1)) ly--
    ghostGroup.position.set(
      (active.x - (COLS - 1) / 2) * CELL,
      BASE_Y + ly * CELL,
      0
    )
  }

  function setBoard(board) {
    liveBoard = board
  }

  function worldCell(row, col, target = new THREE.Vector3()) {
    return target
      .set((col - (COLS - 1) / 2) * CELL, BASE_Y + row * CELL + CELL / 2, 0)
      .applyMatrix4(boardGroup.matrixWorld)
  }

  function flashRows(rows) {
    for (const row of rows) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
      const mesh = new THREE.Mesh(flashGeo, mat)
      mesh.scale.set(COLS * CELL * 1.03, CELL * 0.98, 1)
      mesh.position.set(0, BASE_Y + row * CELL + CELL / 2, 0.52)
      boardGroup.add(mesh)
      flashes.push({ mesh, life: 0.35, max: 0.35 })
    }
  }

  function update(dt) {
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      f.life -= dt
      const t = Math.max(0, f.life / f.max)
      f.mesh.material.opacity = t * 0.8
      f.mesh.scale.x = COLS * CELL * (1.03 + (1 - t) * 0.16)
      if (f.life <= 0) {
        boardGroup.remove(f.mesh)
        f.mesh.material.dispose()
        flashes.splice(i, 1)
      }
    }
  }

  function reset() {
    removePiece()
    removeGhost()
    while (lockedLayer.children.length) lockedLayer.remove(lockedLayer.children[0])
    for (const f of flashes) {
      boardGroup.remove(f.mesh)
      f.mesh.material.dispose()
    }
    flashes.length = 0
    pulse = 0
  }

  return {
    renderCells,
    createPiece,
    removePiece,
    updatePiece,
    showGhost,
    removeGhost,
    setBoard,
    worldCell,
    flashRows,
    update,
    reset,
    get ghostGroup() { return ghostGroup }
  }
}
