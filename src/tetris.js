export const COLS = 10
export const ROWS = 16

export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

// Rotation centre is (1.5, 1.5) in a 4x4 box, which keeps every
// rotation on integer cells and gives the pieces a familiar feel.
export const BASE_SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 1], [2, 1], [1, 2], [2, 2]],
  T: [[1, 2], [0, 1], [1, 1], [2, 1]],
  S: [[1, 2], [2, 2], [0, 1], [1, 1]],
  Z: [[0, 2], [1, 2], [1, 1], [2, 1]],
  J: [[0, 2], [0, 1], [1, 1], [2, 1]],
  L: [[2, 2], [0, 1], [1, 1], [2, 1]]
}

function rotateCW(cells) {
  return cells.map(([x, y]) => [y, 3 - x])
}

export const SHAPES = {}
for (const type of TYPES) {
  const rotations = [BASE_SHAPES[type]]
  for (let i = 1; i < 4; i++) {
    if (type === 'O') rotations.push(rotations[0])
    else rotations.push(rotateCW(rotations[i - 1]))
  }
  SHAPES[type] = rotations
}

export function createBag(random = Math.random) {
  const bag = TYPES.slice()
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}

export function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

export function cellsFor(type, rot) {
  return SHAPES[type][((rot % 4) + 4) % 4]
}

export function collides(board, cells, x, y) {
  for (const [cx, cy] of cells) {
    const bx = x + cx
    const by = y + cy
    if (bx < 0 || bx >= COLS || by < 0) return true
    if (by >= ROWS) continue
    if (board[by][bx]) return true
  }
  return false
}

export function landingY(board, cells, x, y) {
  let ly = y
  while (!collides(board, cells, x, ly - 1)) ly--
  return ly
}

const KICKS = [
  [0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [0, 1], [-1, -1], [1, -1]
]

export function tryRotate(board, piece, dir) {
  const nextRot = ((piece.rot + dir) % 4 + 4) % 4
  const cells = cellsFor(piece.type, nextRot)
  for (const [dx, dy] of KICKS) {
    if (!collides(board, cells, piece.x + dx, piece.y + dy)) {
      return { ...piece, rot: nextRot, x: piece.x + dx, y: piece.y + dy, cells }
    }
  }
  return null
}

export function fullRows(board) {
  const rows = []
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every(Boolean)) rows.push(y)
  }
  return rows
}

export function clearRows(board, rows) {
  const remove = new Set(rows)
  const kept = board.filter((_, y) => !remove.has(y))
  while (kept.length < ROWS) kept.push(Array(COLS).fill(null))
  return kept
}
