export const HOUSE_VOXEL = 0.58
export const HOUSE_LINES = 12

/**
 * The cottage blueprint. Coordinates are voxel cells, centred on x/z with
 * y = 0 sitting on the island. The order of this array is the build order:
 * foundation → porch → walls (bottom to top) → roof → chimney → lanterns.
 */
export function createHouseVoxels() {
  const voxels = []
  const seen = new Set()

  function add(x, y, z, mat, stage) {
    const key = `${x},${y},${z}`
    if (seen.has(key)) return
    seen.add(key)
    voxels.push({ x, y, z, mat, stage })
  }

  // Foundation slab.
  for (let z = -3; z <= 3; z++) {
    for (let x = -4; x <= 4; x++) {
      const alt = (x * 7 + z * 11 + 100) % 13 === 0
      add(x, 0, z, alt ? 'foundationAlt' : 'foundation', 'Foundation')
    }
  }

  // Front step + two porch lantern posts.
  for (let x = -1; x <= 1; x++) add(x, 0, 4, 'porch', 'Foundation')
  add(-2, 0, 4, 'frame', 'Foundation')
  add(2, 0, 4, 'frame', 'Foundation')

  // Walls.
  for (let y = 1; y <= 4; y++) {
    for (let z = -3; z <= 3; z++) {
      for (let x = -4; x <= 4; x++) {
        const edge = Math.abs(x) === 4 || Math.abs(z) === 3
        if (!edge) continue
        const corner = Math.abs(x) === 4 && Math.abs(z) === 3
        const door = z === 3 && x === 0 && y <= 2
        const window =
          y === 2 &&
          ((z === 3 && (x === -2 || x === 2)) ||
            (z === -3 && (x === -2 || x === 0 || x === 2)) ||
            (Math.abs(x) === 4 && Math.abs(z) === 1))

        let mat = 'wall'
        if (corner) mat = 'frame'
        else if (y === 4) mat = 'trim'
        if (door) mat = 'door'
        if (window) mat = 'glass'
        add(x, y, z, mat, y < 3 ? 'Walls' : 'Frame')
      }
    }
  }

  // Gabled roof: full layers that step in toward the ridge.
  for (let y = 5; y <= 8; y++) {
    const inset = y - 5
    for (let z = -3 + inset; z <= 3 - inset; z++) {
      for (let x = -4; x <= 4; x++) {
        const chimneyHole = x >= 2 && x <= 3 && z >= -2 && z <= -1
        if (chimneyHole) continue
        add(x, y, z, 'roof', 'Roof')
      }
    }
  }

  // Chimney, threaded through the roof.
  for (let y = 5; y <= 9; y++) {
    for (let z = -2; z <= -1; z++) {
      for (let x = 2; x <= 3; x++) {
        add(x, y, z, 'chimney', 'Chimney')
      }
    }
  }

  // Lanterns go on at the very end.
  add(-2, 1, 4, 'lantern', 'Finishing')
  add(2, 1, 4, 'lantern', 'Finishing')

  return voxels
}

export const STAGE_ORDER = ['Foundation', 'Walls', 'Frame', 'Roof', 'Chimney', 'Finishing']
