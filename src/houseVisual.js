import * as THREE from '../vendor/three.module.js'
import { createHouseVoxels, HOUSE_VOXEL } from './house.js'

const boxGeo = new THREE.BoxGeometry(1, 1, 1)
const zero = new THREE.Matrix4().makeScale(0, 0, 0)

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}
function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function createGhostMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0x8cf1ff) },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        if (!gl_FrontFacing) n = -n;
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = pow(1.0 - abs(dot(n, viewDir)), 2.4);
        float scan = 0.5 + 0.5 * sin(vWorld.y * 24.0 - uTime * 1.9);
        float alpha = 0.075 + fresnel * 0.28 + scan * 0.028;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  })
}

export function createHouseVisual(houseGroup, M) {
  const voxels = createHouseVoxels()
  const total = voxels.length
  const dummy = new THREE.Object3D()
  const V = HOUSE_VOXEL
  const SCALE = V * 0.97

  const byMaterial = new Map()
  for (const voxel of voxels) {
    if (!byMaterial.has(voxel.mat)) byMaterial.set(voxel.mat, [])
    byMaterial.get(voxel.mat).push(voxel)
  }

  const solidMeshes = []
  for (const [mat, list] of byMaterial) {
    const material = M.house[mat]
    const mesh = new THREE.InstancedMesh(boxGeo, material, list.length)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.castShadow = mat !== 'glass' && mat !== 'lantern'
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    houseGroup.add(mesh)
    solidMeshes.push(mesh)
    list.forEach((voxel, index) => {
      voxel.solid = { mesh, index }
      mesh.setMatrixAt(index, zero)
    })
    mesh.instanceMatrix.needsUpdate = true
  }

  const voxelAt = new Map()
  for (const voxel of voxels) voxelAt.set(`${voxel.x},${voxel.y},${voxel.z}`, voxel)

  const ghostMaterial = createGhostMaterial()
  const ghostGeometry = new THREE.BufferGeometry()
  const ghost = new THREE.Mesh(ghostGeometry, ghostMaterial)
  ghost.frustumCulled = false
  ghost.renderOrder = 2
  houseGroup.add(ghost)

  const ghostEdgeGeometry = new THREE.BufferGeometry()
  const ghostEdges = new THREE.LineSegments(ghostEdgeGeometry, new THREE.LineBasicMaterial({
    color: 0xa8f8ff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    toneMapped: false
  }))
  ghostEdges.frustumCulled = false
  ghostEdges.renderOrder = 3
  houseGroup.add(ghostEdges)

  let builtCount = 0
  let ghostDirty = true
  const animating = []

  const FACES = [
    { n: [1, 0, 0], d: [1, -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1] },
    { n: [-1, 0, 0], d: [-1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1] },
    { n: [0, 1, 0], d: [-1, 1, -1, 1, 1, -1, 1, 1, 1, -1, 1, 1] },
    { n: [0, -1, 0], d: [-1, -1, 1, 1, -1, 1, 1, -1, -1, -1, -1, -1] },
    { n: [0, 0, 1], d: [-1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1] },
    { n: [0, 0, -1], d: [1, -1, -1, -1, -1, -1, -1, 1, -1, 1, 1, -1] }
  ]

  function rebuildGhost() {
    ghostDirty = false
    if (builtCount >= total) {
      ghost.visible = false
      ghostEdges.visible = false
      return
    }
    ghost.visible = true
    ghostEdges.visible = true
    const half = V * 0.49
    const positions = []
    const normals = []
    const indices = []
    const edgePositions = []
    const edgeSet = new Set()
    let vi = 0
    for (const voxel of voxels) {
      if (voxel.built) continue
      const cx = voxel.x * V
      const cy = (voxel.y + 0.5) * V
      const cz = voxel.z * V
      for (const face of FACES) {
        const nx = voxel.x + face.n[0]
        const ny = voxel.y + face.n[1]
        const nz = voxel.z + face.n[2]
        const neighbor = voxelAt.get(`${nx},${ny},${nz}`)
        if (neighbor && !neighbor.built) continue
        const verts = []
        for (let k = 0; k < 12; k += 3) {
          const vx = cx + face.d[k] * half
          const vy = cy + face.d[k + 1] * half
          const vz = cz + face.d[k + 2] * half
          positions.push(vx, vy, vz)
          normals.push(face.n[0], face.n[1], face.n[2])
          verts.push([vx, vy, vz])
        }
        for (let e = 0; e < 4; e++) {
          const a = verts[e]
          const b = verts[(e + 1) % 4]
          const ka = `${a[0].toFixed(3)},${a[1].toFixed(3)},${a[2].toFixed(3)}`
          const kb = `${b[0].toFixed(3)},${b[1].toFixed(3)},${b[2].toFixed(3)}`
          const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
          if (edgeSet.has(key)) continue
          edgeSet.add(key)
          edgePositions.push(a[0], a[1], a[2], b[0], b[1], b[2])
        }
        indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3)
        vi += 4
      }
    }
    ghostGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    ghostGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    ghostGeometry.setIndex(indices)
    ghostGeometry.computeBoundingSphere()
    ghost.visible = positions.length > 0
    ghostEdgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3))
    ghostEdgeGeometry.computeBoundingSphere()
    ghostEdges.visible = edgePositions.length > 0
  }

  function setMatrix(voxel, scale, yOffset = 0) {
    if (scale <= 0.001) {
      voxel.solid.mesh.setMatrixAt(voxel.solid.index, zero)
      return
    }
    dummy.position.set(voxel.x * V, (voxel.y + 0.5) * V + yOffset, voxel.z * V)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.setScalar(SCALE * scale)
    dummy.updateMatrix()
    voxel.solid.mesh.setMatrixAt(voxel.solid.index, dummy.matrix)
  }

  voxels.forEach((voxel) => {
    voxel.built = false
    voxel.anim = 0
    voxel.animDelay = 0
    setMatrix(voxel, 0)
  })
  for (const mesh of solidMeshes) mesh.instanceMatrix.needsUpdate = true
  rebuildGhost()

  function build(voxel, immediate = false) {
    if (!voxel || voxel.built) return false
    voxel.built = true
    builtCount++
    ghostDirty = true
    if (immediate) {
      setMatrix(voxel, 1)
      voxel.solid.mesh.instanceMatrix.needsUpdate = true
    } else {
      voxel.anim = 0
      voxel.animDelay = 0
      animating.push(voxel)
    }
    return true
  }

  function buildAll(immediate = true) {
    for (const voxel of voxels) {
      if (voxel.built) continue
      voxel.built = true
      builtCount++
      setMatrix(voxel, 1)
    }
    for (const mesh of solidMeshes) mesh.instanceMatrix.needsUpdate = true
    ghost.visible = false
    ghostEdges.visible = false
    ghostDirty = false
  }

  function reset() {
    builtCount = 0
    animating.length = 0
    ghostDirty = true
    for (const voxel of voxels) {
      voxel.built = false
      voxel.anim = 0
      voxel.animDelay = 0
      setMatrix(voxel, 0)
    }
    for (const mesh of solidMeshes) mesh.instanceMatrix.needsUpdate = true
    rebuildGhost()
  }

  function update(dt) {
    ghostMaterial.uniforms.uTime.value += dt
    if (ghostDirty) rebuildGhost()
    if (!animating.length) return
    for (let i = animating.length - 1; i >= 0; i--) {
      const voxel = animating[i]
      if (voxel.animDelay > 0) {
        voxel.animDelay -= dt
        setMatrix(voxel, 0.001, 0.15)
        voxel.solid.mesh.instanceMatrix.needsUpdate = true
        continue
      }
      voxel.anim += dt / 0.38
      const t = Math.min(1, voxel.anim)
      const scale = Math.max(0.001, easeOutBack(t))
      const yOffset = (1 - easeOutCubic(t)) * 0.62
      setMatrix(voxel, scale, yOffset)
      voxel.solid.mesh.instanceMatrix.needsUpdate = true
      if (t >= 1) {
        setMatrix(voxel, 1, 0)
        voxel.solid.mesh.instanceMatrix.needsUpdate = true
        animating.splice(i, 1)
      }
    }
  }

  function worldPosition(voxel, target = new THREE.Vector3()) {
    houseGroup.updateWorldMatrix(true, false)
    return target
      .set(voxel.x * V, (voxel.y + 0.5) * V, voxel.z * V)
      .applyMatrix4(houseGroup.matrixWorld)
  }

  function center(target = new THREE.Vector3()) {
    houseGroup.updateWorldMatrix(true, false)
    return target.set(0, 3.0, 0).applyMatrix4(houseGroup.matrixWorld)
  }

  return {
    voxels,
    total,
    ghost,
    ghostEdges,
    solidMeshes,
    build,
    buildAll,
    reset,
    update,
    worldPosition,
    center,
    get builtCount() { return builtCount },
    get percent() { return total ? builtCount / total : 0 }
  }
}
