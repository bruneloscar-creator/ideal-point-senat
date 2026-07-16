import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { searchSenators } from './senatorSearch.js';
import {
  PARTY_SHORT,
  partyKey,
  drawIdealScatter as drawIdealScatterCore,
  mountIdealScatter,
} from './idealScatter.js';
import {
  initI18n,
  mountLangToggle,
  onLangChange,
  t,
  tForChamber,
  localeTag,
} from './i18n.js';
import {
  SENAT_COLORS,
  ASSEMBLEE_COLORS,
  readStoredChamber,
  storeChamber,
  applyPaletteToMaterials,
} from '../assemblee nationale 3D/theme.js';
import { buildAssembleeArchitecture } from '../assemblee nationale 3D/assembleeChamber.js';

const QUERY = new URLSearchParams(window.location.search);
const BACKGROUND_MODE = QUERY.get('background') === '1';
const DEBUG_MAPPING = QUERY.get('debugMapping') === '1';

initI18n();
document.querySelectorAll('[data-lang-host]').forEach((host) => mountLangToggle(host));

/* ── Palette active (Sénat par défaut ; AN via basculeur) ───── */
let chamberId = readStoredChamber();
storeChamber(chamberId);
const COLORS = { ...(chamberId === 'assemblee' ? ASSEMBLEE_COLORS : SENAT_COLORS) };
const SENATORS_URL = '/assets/senators.json';
const DEPUTIES_URL = '/assets/deputies.json';
const DEPUTIES_MANIFEST_URL = '/assets/deputies/manifest.json';

async function fetchCachedJson(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Impossible de charger ${url}`);
  return res.json();
}

/* Start the useful network request before constructing the 3D architecture. */
let senatorPayloadPromise = chamberId === 'senat'
  ? fetchCachedJson(SENATORS_URL).catch(() => null)
  : null;
let deputiesManifestPromise = chamberId === 'assemblee'
  ? fetchCachedJson(DEPUTIES_MANIFEST_URL).catch(() => null)
  : null;

const canvas = document.getElementById('c');
const IS_MOBILE_DEVICE = window.matchMedia('(max-width: 700px), (pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !IS_MOBILE_DEVICE,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, BACKGROUND_MODE ? 1 : (IS_MOBILE_DEVICE ? 1 : 1.25)));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !IS_MOBILE_DEVICE;
/* Soft shadows on hundreds of seat instances is a major GPU cost; PCF is enough here. */
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = IS_MOBILE_DEVICE ? 1.55 : 1.48;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b0d0b);
scene.fog = new THREE.Fog(0x1b0d0b, 62, 108);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
/* Vue de base : au-dessus de la présidente, regard vers l'hémicycle */
const DEFAULT_CAM = { x: 0, y: 12.5, z: -7.5 };
const DEFAULT_TARGET = { x: 0, y: 3.2, z: 8 };
camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);

const controls = new OrbitControls(camera, canvas);
controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
/* Guided orbit around the hemicycle — no free-fly / no pan */
controls.enablePan = false;
controls.minDistance = 12;
controls.maxDistance = 26;
controls.minPolarAngle = 0.38;
controls.maxPolarAngle = 1.22;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.65;
controls.update();

let autoOrbit = false;
let autoOrbitStartedAt = 0;
let autoOrbitSettleUntil = 0;
const _orbitCam = new THREE.Vector3();
const _orbitLook = new THREE.Vector3();
const _orbitDesiredCam = new THREE.Vector3();
const _orbitDesiredLook = new THREE.Vector3();
const _orbitFromCam = new THREE.Vector3();
const _orbitFromLook = new THREE.Vector3();
const _orbitSettleFrom = new THREE.Vector3();
const _orbitSettleTo = new THREE.Vector3();
const _orbitSpherical = new THREE.Spherical();
const _orbitOffset = new THREE.Vector3();

/**
 * Orbit auto — vue « depuis les bancs » : caméra à hauteur de sénateur
 * (légèrement au-dessus), glisse le long de l'arc de l'hémicycle, regard
 * fixe vers la tribune / président (−Z). Chemin scripté (controls off)
 * pour rester crédible malgré les limites polaires d'OrbitControls.
 */
const SENATOR_ORBIT = {
  lookAt: new THREE.Vector3(0, 2.55, -4.6),
  radius: 14.8,
  eyeY: 4.15,
  yawCenter: Math.PI * 0.5,
  yawAmp: 0.48,
  speed: 0.000038,
  bobAmp: 0.08,
  radiusPulse: 0.28,
  easeInMs: 1800,
  settleMs: 1000,
};

function senatorOrbitPose(nowMs, outCam, outLook) {
  const t = nowMs * SENATOR_ORBIT.speed;
  const yaw = SENATOR_ORBIT.yawCenter + Math.sin(t) * SENATOR_ORBIT.yawAmp;
  const r = SENATOR_ORBIT.radius + Math.sin(t * 0.41) * SENATOR_ORBIT.radiusPulse;
  const y = SENATOR_ORBIT.eyeY + Math.sin(t * 0.53) * SENATOR_ORBIT.bobAmp;
  outCam.set(Math.cos(yaw) * r, y, Math.sin(yaw) * r);
  outLook.copy(SENATOR_ORBIT.lookAt);
  /* Léger suivi du regard vers le côté balayé (tribune reste le centre) */
  outLook.x += Math.sin(yaw - SENATOR_ORBIT.yawCenter) * 0.85;
}

/** Project a free camera pose onto OrbitControls polar/distance limits. */
function clampCamToOrbitLimits(cam, target, out) {
  _orbitOffset.copy(cam).sub(target);
  _orbitSpherical.setFromVector3(_orbitOffset);
  _orbitSpherical.phi = THREE.MathUtils.clamp(
    _orbitSpherical.phi,
    controls.minPolarAngle,
    controls.maxPolarAngle
  );
  _orbitSpherical.radius = THREE.MathUtils.clamp(
    _orbitSpherical.radius,
    controls.minDistance,
    controls.maxDistance
  );
  out.copy(target).add(_orbitOffset.setFromSpherical(_orbitSpherical));
  return out;
}

function setAutoOrbit(on) {
  if (on === autoOrbit) return;
  autoOrbit = on;
  const orbitBtn = document.getElementById('btn-orbit');
  if (orbitBtn) orbitBtn.classList.toggle('active', autoOrbit);
  if (autoOrbit) {
    autoOrbitStartedAt = performance.now();
    autoOrbitSettleUntil = 0;
    _orbitFromCam.copy(camera.position);
    _orbitFromLook.copy(controls.target);
    controls.enabled = false;
  } else {
    const look = _orbitLook.lengthSq() > 0 ? _orbitLook : SENATOR_ORBIT.lookAt;
    controls.target.copy(look);
    _orbitSettleFrom.copy(camera.position);
    clampCamToOrbitLimits(camera.position, look, _orbitSettleTo);
    autoOrbitSettleUntil = performance.now() + SENATOR_ORBIT.settleMs;
    controls.enabled = false;
  }
}

const mat = {
  velvet: new THREE.MeshPhysicalMaterial({
    color: COLORS.velvet,
    roughness: 0.78,
    metalness: 0,
    sheen: 0.72,
    sheenColor: new THREE.Color(0x9d3442),
    sheenRoughness: 0.82,
  }),
  velvetDark: new THREE.MeshPhysicalMaterial({
    color: COLORS.velvetDark,
    roughness: 0.82,
    metalness: 0,
    sheen: 0.52,
    sheenColor: new THREE.Color(0x75202d),
    sheenRoughness: 0.88,
  }),
  velvetDeep: new THREE.MeshPhysicalMaterial({ color: COLORS.velvetDeep, roughness: 0.92, metalness: 0 }),
  wood: new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.44, metalness: 0.04 }),
  woodDark: new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.5, metalness: 0.02 }),
  woodPolish: new THREE.MeshStandardMaterial({ color: COLORS.woodPolish, roughness: 0.3, metalness: 0.08 }),
  woodLight: new THREE.MeshStandardMaterial({ color: COLORS.woodLight, roughness: 0.46, metalness: 0.03 }),
  gold: new THREE.MeshPhysicalMaterial({ color: COLORS.gold, roughness: 0.38, metalness: 0.74, clearcoat: 0.15 }),
  goldBright: new THREE.MeshPhysicalMaterial({ color: COLORS.goldBright, roughness: 0.3, metalness: 0.8, clearcoat: 0.2 }),
  goldMuted: new THREE.MeshPhysicalMaterial({ color: COLORS.goldMuted, roughness: 0.5, metalness: 0.55 }),
  carpet: new THREE.MeshStandardMaterial({ color: COLORS.carpet, roughness: 0.97, metalness: 0 }),
  carpetDark: new THREE.MeshStandardMaterial({ color: COLORS.carpetDark, roughness: 0.97, metalness: 0 }),
  marble: new THREE.MeshPhysicalMaterial({ color: COLORS.marble, roughness: 0.34, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.45 }),
  marbleWarm: new THREE.MeshPhysicalMaterial({ color: COLORS.marbleWarm, roughness: 0.42, metalness: 0, clearcoat: 0.14, clearcoatRoughness: 0.5 }),
  curtain: new THREE.MeshStandardMaterial({ color: COLORS.curtain, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
  deskTop: new THREE.MeshStandardMaterial({ color: COLORS.deskTop, roughness: 0.25, metalness: 0.2 }),
  deskLeather: new THREE.MeshPhysicalMaterial({ color: COLORS.deskLeather, roughness: 0.68, metalness: 0, sheen: 0.14, sheenColor: new THREE.Color(0x537461) }),
  marbleRed: new THREE.MeshStandardMaterial({ color: COLORS.marbleRed, roughness: 0.35, metalness: 0.08 }),
  marbleCream: new THREE.MeshStandardMaterial({ color: COLORS.marbleCream, roughness: 0.4, metalness: 0.05 }),
  paintWarm: new THREE.MeshStandardMaterial({ color: COLORS.paintWarm, roughness: 0.85, metalness: 0 }),
  paintSky: new THREE.MeshStandardMaterial({ color: COLORS.paintSky, roughness: 0.8, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({
    color: COLORS.glass,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  }),
  flagBlue: new THREE.MeshStandardMaterial({ color: COLORS.flagBlue, roughness: 0.7, metalness: 0 }),
  flagWhite: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.7, metalness: 0 }),
  flagRed: new THREE.MeshStandardMaterial({ color: COLORS.flagRed, roughness: 0.7, metalness: 0 }),
  flagEu: new THREE.MeshStandardMaterial({ color: COLORS.flagEuBlue, roughness: 0.7, metalness: 0 }),
};

const root = new THREE.Group();
scene.add(root);
/** Architecture de salle (reconstruite au changement Sénat / AN) */
const archRoot = new THREE.Group();
root.add(archRoot);
/** Sièges + gradins (reconstruits si le nombre de places change) */
const seatRoot = new THREE.Group();
root.add(seatRoot);

/* ── Textures photo (références Sénat) ─────────────────────── */
const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(IS_MOBILE_DEVICE ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
let TEX = null;

function ensureSenatTextures() {
  if (TEX) return TEX;
  TEX = {
    wallArt: loadTex('/textures/wall-art.jpg?v=clean2'),
    paintL: loadTex('/textures/painting-left.jpg?v=clean2'),
    paintR: loadTex('/textures/painting-right.jpg?v=clean2'),
    marbleCream: loadTex('/textures/marble-cream.jpg?v=clean2'),
    ceiling: loadTex('/textures/ceiling.jpg?v=clean3'),
    skylight: loadTex('/textures/skylight.jpg?v=clean3'),
    wood: loadTex('/textures/wood-panel.jpg?v=clean2'),
  };
  TEX.wood.wrapS = TEX.wood.wrapT = THREE.RepeatWrapping;
  TEX.wood.repeat.set(3, 2);
  TEX.ceiling.wrapS = TEX.ceiling.wrapT = THREE.RepeatWrapping;
  TEX.ceiling.repeat.set(5, 4);
  TEX.marbleCream.wrapS = TEX.marbleCream.wrapT = THREE.RepeatWrapping;
  TEX.marbleCream.repeat.set(2, 2);

  /* Le veinage réel reste discret : il enrichit le bois sans l'éclaircir. */
  for (const [material, tint] of [
    [mat.wood, 0xc49a7b],
    [mat.woodDark, 0x8a624d],
    [mat.woodPolish, 0xd3a078],
    [mat.woodLight, 0xe0b18a],
  ]) {
    material.map = TEX.wood;
    material.color.setHex(tint);
    material.needsUpdate = true;
  }
  return TEX;
}


const boxGeometryCache = new Map();
const cylinderGeometryCache = new Map();

function geometryKey(...values) {
  return values.map((value) => Number(value).toFixed(4)).join('|');
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const key = geometryKey(w, h, d);
  let geometry = boxGeometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.BoxGeometry(w, h, d);
    boxGeometryCache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  /* Les milliers de panneaux reçoivent les ombres ; seuls les volumes clés les projettent. */
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rTop, rBot, h, material, segs = 24) {
  const key = geometryKey(rTop, rBot, h, segs);
  let geometry = cylinderGeometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    cylinderGeometryCache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/** Convertit les boîtes statiques en instances GPU sans reconstruction géométrique. */
function instanceStaticBoxes(container) {
  container.updateMatrixWorld(true);
  const batches = new Map();

  container.traverse((object) => {
    if (!object.isMesh || object.isInstancedMesh || object.geometry?.type !== 'BoxGeometry') return;
    if (Array.isArray(object.material) || object.userData?.noBatch) return;
    /* Garder le mur d’honneur intact pour pouvoir le masquer en reculant la caméra. */
    for (let p = object.parent; p; p = p.parent) {
      if (p.userData?.honorWall) return;
    }
    const key = [
      object.material.uuid,
      object.castShadow ? 1 : 0,
      object.receiveShadow ? 1 : 0,
      object.renderOrder || 0,
    ].join('|');
    if (!batches.has(key)) {
      batches.set(key, {
        material: object.material,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        renderOrder: object.renderOrder,
        items: [],
      });
    }
    batches.get(key).items.push(object);
  });

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const sizeScale = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  let instancedObjects = 0;
  let batchCount = 0;
  for (const batch of batches.values()) {
    if (batch.items.length < 2) continue;
    const mesh = new THREE.InstancedMesh(unitBox, batch.material, batch.items.length);
    mesh.castShadow = batch.castShadow;
    mesh.receiveShadow = batch.receiveShadow;
    mesh.renderOrder = batch.renderOrder;
    mesh.frustumCulled = false;
    batch.items.forEach((item, index) => {
      const { width = 1, height = 1, depth = 1 } = item.geometry.parameters || {};
      sizeScale.makeScale(width, height, depth);
      instanceMatrix.copy(item.matrixWorld).multiply(sizeScale);
      mesh.setMatrixAt(index, instanceMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    container.add(mesh);
    batch.items.forEach((item) => item.parent?.remove(item));
    instancedObjects += batch.items.length;
    batchCount += 1;
  }
  console.info(`Architecture optimisée : ${instancedObjects} volumes instanciés en ${batchCount} lots.`);
}

/** Arc presque demi-cercle, ouvert vers -Z (bureau) — comme la photo */
const ARC_START = Math.PI * 0.08;
const ARC_END = Math.PI * 0.92;

function alongArc(radius, angle, y = 0) {
  return {
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
    a: angle,
    /* Face le centre (bureau) */
    rotY: -angle - Math.PI / 2,
  };
}

/**
 * 3 allées radiales (photo) → 4 blocs de sièges.
 */
const AISLE_FRAC = [0.25, 0.5, 0.75];
const AISLE_GAP = 0.055;

function getBlockRanges() {
  const totalArc = ARC_END - ARC_START;
  const aisleAngles = AISLE_FRAC.map((f) => ARC_START + totalArc * f);
  const ranges = [];
  let cursor = ARC_START;
  for (const aisle of aisleAngles) {
    ranges.push({ start: cursor, end: aisle - AISLE_GAP / 2 });
    cursor = aisle + AISLE_GAP / 2;
  }
  ranges.push({ start: cursor, end: ARC_END });
  return ranges;
}

/** Répartition exacte : 348 sièges sur 11 rangées (Sénat) */
const SENAT_SEATS_PER_TIER = [18, 22, 26, 28, 30, 32, 34, 36, 38, 40, 44];

/** Scale the Senate tier pattern to an arbitrary seat count (AN ≈ 577+). */
function seatsPerTierForCount(n) {
  const target = Math.max(1, Math.round(Number(n) || 348));
  const base = SENAT_SEATS_PER_TIER;
  const scale = target / 348;
  const tiers = base.map((x) => Math.max(1, Math.round(x * scale)));
  let diff = target - tiers.reduce((a, b) => a + b, 0);
  let i = tiers.length - 1;
  let guard = 0;
  while (diff !== 0 && guard < target * 4) {
    if (diff > 0) {
      tiers[i] += 1;
      diff -= 1;
    } else if (tiers[i] > 1) {
      tiers[i] -= 1;
      diff += 1;
    }
    i = (i - 1 + tiers.length) % tiers.length;
    guard += 1;
  }
  return tiers;
}

let SEATS_PER_TIER = [...SENAT_SEATS_PER_TIER];
let TOTAL_SEATS = SEATS_PER_TIER.reduce((s, n) => s + n, 0);

function distributeSeatsInBlocks(count, ranges) {
  const lengths = ranges.map((r) => Math.max(0.001, r.end - r.start));
  const sumLen = lengths.reduce((a, b) => a + b, 0);
  const raw = lengths.map((l) => (count * l) / sumLen);
  const floors = raw.map((x) => Math.floor(x));
  let remaining = count - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = floors.slice();
  for (let k = 0; k < remaining; k++) result[order[k % order.length].i] += 1;
  return result;
}

function seatAnglesForTier(count) {
  const ranges = getBlockRanges();
  const perBlock = distributeSeatsInBlocks(count, ranges);
  const angles = [];
  for (let b = 0; b < ranges.length; b++) {
    const n = perBlock[b];
    const { start, end } = ranges[b];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : (i + 0.5) / n;
      angles.push(start + (end - start) * t);
    }
  }
  return angles;
}

/* ── Sol & tapis rouge ─────────────────────────────────────── */
function buildFloor() {
  const floor = box(52, 0.12, 42, mat.woodDark, 0, -0.06, 2);
  archRoot.add(floor);

  const shape = new THREE.Shape();
  shape.absarc(0, 0, 9.5, Math.PI * 0.04, Math.PI * 0.96, false);
  shape.lineTo(Math.cos(Math.PI * 0.96) * 9.5, -2.2);
  shape.lineTo(Math.cos(Math.PI * 0.04) * 9.5, -2.2);
  shape.closePath();

  const carpetGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
  /* +X rot : l'arc du tapis reste du côté des sièges (+Z), pas derrière la présidente */
  carpetGeo.rotateX(Math.PI / 2);
  const carpet = new THREE.Mesh(carpetGeo, mat.carpet);
  carpet.position.set(0, 0.01, 0);
  carpet.receiveShadow = true;
  archRoot.add(carpet);

  const totalArc = ARC_END - ARC_START;
  for (const f of AISLE_FRAC) {
    const a = ARC_START + totalArc * f;
    for (let r = 7.0; r < 20.5; r += 0.75) {
      const p = alongArc(r, a, 0.035);
      const strip = box(0.7, 0.02, 0.8, mat.carpet);
      strip.position.set(p.x, p.y, p.z);
      strip.rotation.y = p.rotY;
      archRoot.add(strip);
    }
  }
}

/* ── Fauteuils + pupitres continus (comme la photo) ────────── */

/** Géométries d'un fauteuil Sénat : velours + cadre bois */
function createChairGeometries() {
  return {
    cushion: new RoundedBoxGeometry(0.48, 0.14, 0.42, 3, 0.045),
    cushionFront: new RoundedBoxGeometry(0.46, 0.08, 0.06, 2, 0.025),
    backPad: new RoundedBoxGeometry(0.46, 0.62, 0.1, 3, 0.045),
    backTop: new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    woodSideL: new THREE.BoxGeometry(0.04, 0.7, 0.08),
    woodSideR: new THREE.BoxGeometry(0.04, 0.7, 0.08),
    woodTop: new THREE.BoxGeometry(0.5, 0.05, 0.07),
    armWood: new THREE.BoxGeometry(0.06, 0.08, 0.36),
    armPad: new RoundedBoxGeometry(0.07, 0.05, 0.28, 2, 0.02),
    leg: new THREE.BoxGeometry(0.04, 0.32, 0.04),
  };
}

/**
 * Pupitre CONTINU courbe par rangée (pas des petites tables séparées),
 * + 348 fauteuils velours individuels derrière.
 */
function buildSeats() {
  const TIER_COUNT = SEATS_PER_TIER.length;
  const INNER_R = 7.4;
  const TIER_DEPTH = 1.2;
  const TIER_RISE = 0.42;
  const DESK_SEGS = IS_MOBILE_DEVICE ? 32 : 48;

  const geos = createChairGeometries();
  const dummy = new THREE.Object3D();

  /* Blanc de base : la couleur d'instance (parti) s'affiche sans teinte velours */
  const velvetTint = mat.velvet.clone();
  velvetTint.color.set(0xffffff);
  const velvetDarkTint = mat.velvetDark.clone();
  velvetDarkTint.color.set(0xffffff);

  const cushionMesh = new THREE.InstancedMesh(geos.cushion, velvetTint, TOTAL_SEATS);
  const cushionFrontMesh = new THREE.InstancedMesh(geos.cushionFront, velvetDarkTint, TOTAL_SEATS);
  const backPadMesh = new THREE.InstancedMesh(geos.backPad, velvetTint, TOTAL_SEATS);
  const backTopMesh = new THREE.InstancedMesh(geos.backTop, velvetDarkTint, TOTAL_SEATS);
  const woodSideLMesh = new THREE.InstancedMesh(geos.woodSideL, mat.woodDark, TOTAL_SEATS);
  const woodSideRMesh = new THREE.InstancedMesh(geos.woodSideR, mat.woodDark, TOTAL_SEATS);
  const woodTopMesh = new THREE.InstancedMesh(geos.woodTop, mat.woodPolish, TOTAL_SEATS);
  const armWoodLMesh = new THREE.InstancedMesh(geos.armWood, mat.woodPolish, TOTAL_SEATS);
  const armWoodRMesh = new THREE.InstancedMesh(geos.armWood, mat.woodPolish, TOTAL_SEATS);
  const armPadLMesh = new THREE.InstancedMesh(geos.armPad, velvetDarkTint, TOTAL_SEATS);
  const armPadRMesh = new THREE.InstancedMesh(geos.armPad, velvetDarkTint, TOTAL_SEATS);
  const leatherMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.52, 0.018, 0.3, 2, 0.025), mat.deskLeather, TOTAL_SEATS);
  const seatBaseMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.46, 0.28, 0.4, 2, 0.025), mat.woodDark, TOTAL_SEATS);
  const seatSkirtMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.5, 0.08, 0.44, 2, 0.02), mat.woodPolish, TOTAL_SEATS);
  const voteUnitMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.12, 0.035, 0.075, 2, 0.012), mat.deskTop, TOTAL_SEATS);
  const namePlateMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(0.2, 0.018, 0.045, 2, 0.008), mat.goldMuted, TOTAL_SEATS);

  const seatMeshes = [
    cushionMesh, cushionFrontMesh, backPadMesh, backTopMesh,
    woodSideLMesh, woodSideRMesh, woodTopMesh,
    armWoodLMesh, armWoodRMesh, armPadLMesh, armPadRMesh, leatherMesh,
    seatBaseMesh, seatSkirtMesh, voteUnitMesh, namePlateMesh,
  ];
  /* Shadows: one caster + a couple of receivers — full seat shadows crushed FPS. */
  const shadowCasters = new Set([cushionMesh]);
  const shadowReceivers = new Set([cushionMesh, leatherMesh, seatBaseMesh]);
  for (const m of seatMeshes) {
    m.castShadow = renderer.shadowMap.enabled && shadowCasters.has(m);
    m.receiveShadow = renderer.shadowMap.enabled && shadowReceivers.has(m);
    m.frustumCulled = false;
    seatRoot.add(m);
  }

  let idx = 0;
  const seats = [];

  for (let t = 0; t < TIER_COUNT; t++) {
    const radius = INNER_R + t * TIER_DEPTH;
    const yBase = t * TIER_RISE;
    const count = SEATS_PER_TIER[t];
    const angles = seatAnglesForTier(count);
    const rIn = radius - 0.08;
    const rOut = radius + TIER_DEPTH * 0.92;
    const solidH = Math.max(0.12, yBase + 0.1);

    /* Masse pleine du gradin (plus de vide en dessous) */
    const SOLID_SEGS = IS_MOBILE_DEVICE ? 24 : 36;
    for (let i = 0; i < SOLID_SEGS; i++) {
      const a0 = ARC_START + (ARC_END - ARC_START) * (i / SOLID_SEGS);
      const a1 = ARC_START + (ARC_END - ARC_START) * ((i + 1) / SOLID_SEGS);
      const aMid = (a0 + a1) / 2;
      const rMid = (rIn + rOut) * 0.5;
      const depth = rOut - rIn;
      const segW = (a1 - a0) * rMid * 1.05;

      const block = box(segW, solidH, depth, mat.woodDark);
      block.position.set(
        Math.cos(aMid) * rMid,
        solidH * 0.5,
        Math.sin(aMid) * rMid
      );
      block.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(block);

      /* Surface supérieure (plateforme) */
      const top = box(segW, 0.055, depth * 0.98, mat.carpetDark);
      top.position.set(
        Math.cos(aMid) * rMid,
        solidH + 0.02,
        Math.sin(aMid) * rMid
      );
      top.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(top);
    }

    /* Face avant du gradin (contremarche vers le centre) */
    const RISER_SEGS = IS_MOBILE_DEVICE ? 24 : 36;
    for (let i = 0; i < RISER_SEGS; i++) {
      const a0 = ARC_START + (ARC_END - ARC_START) * (i / RISER_SEGS);
      const a1 = ARC_START + (ARC_END - ARC_START) * ((i + 1) / RISER_SEGS);
      const aMid = (a0 + a1) / 2;
      const segLen = (a1 - a0) * rIn * 1.05;
      const riser = box(segLen, solidH, 0.1, mat.woodPolish);
      riser.position.set(
        Math.cos(aMid) * rIn,
        solidH * 0.5,
        Math.sin(aMid) * rIn
      );
      riser.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(riser);
    }

    /*
     * PUPITRE CONTINU : face jusqu'au sol du gradin + plateau
     */
    const deskFrontR = radius + 0.18;
    const deskTopR = radius + 0.32;
    const deskTopY = solidH + 0.72;

    for (let i = 0; i < DESK_SEGS; i++) {
      const a0 = ARC_START + (ARC_END - ARC_START) * (i / DESK_SEGS);
      const a1 = ARC_START + (ARC_END - ARC_START) * ((i + 1) / DESK_SEGS);
      const aMid = (a0 + a1) / 2;

      const frac = (aMid - ARC_START) / (ARC_END - ARC_START);
      if (AISLE_FRAC.some((f) => Math.abs(frac - f) < 0.028)) continue;

      const segW = (a1 - a0) * deskFrontR * 1.04;
      const frontH = deskTopY - solidH;

      /* Face avant pleine (du sol du gradin jusqu'au plateau) */
      const front = box(segW, frontH, 0.09, mat.woodPolish);
      front.position.set(
        Math.cos(aMid) * deskFrontR,
        solidH + frontH * 0.5,
        Math.sin(aMid) * deskFrontR
      );
      front.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(front);

      /* Panneau bas décoratif */
      const kick = box(segW, 0.12, 0.1, mat.woodDark);
      kick.position.set(
        Math.cos(aMid) * (deskFrontR + 0.02),
        solidH + 0.08,
        Math.sin(aMid) * (deskFrontR + 0.02)
      );
      kick.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(kick);

      const mould = box(segW, 0.045, 0.1, mat.woodDark);
      mould.position.set(
        Math.cos(aMid) * (deskFrontR + 0.01),
        deskTopY,
        Math.sin(aMid) * (deskFrontR + 0.01)
      );
      mould.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(mould);

      const top = box(segW, 0.05, 0.42, mat.woodPolish);
      top.position.set(
        Math.cos(aMid) * deskTopR,
        deskTopY + 0.03,
        Math.sin(aMid) * deskTopR
      );
      top.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(top);
    }

    /* Dosseret derrière les sièges (ferme le gradin) */
    const backR = rOut - 0.05;
    for (let i = 0; i < DESK_SEGS; i++) {
      const a0 = ARC_START + (ARC_END - ARC_START) * (i / DESK_SEGS);
      const a1 = ARC_START + (ARC_END - ARC_START) * ((i + 1) / DESK_SEGS);
      const aMid = (a0 + a1) / 2;
      const frac = (aMid - ARC_START) / (ARC_END - ARC_START);
      if (AISLE_FRAC.some((f) => Math.abs(frac - f) < 0.028)) continue;
      const segW = (a1 - a0) * backR * 1.04;
      const backPanel = box(segW, 0.55, 0.08, mat.woodDark);
      backPanel.position.set(
        Math.cos(aMid) * backR,
        solidH + 0.35,
        Math.sin(aMid) * backR
      );
      backPanel.rotation.y = -aMid - Math.PI / 2;
      seatRoot.add(backPanel);
    }

    /* Sièges sur la plateforme pleine */
    const seatR = radius + TIER_DEPTH * 0.55;
    const seatY = solidH;

    for (const angle of angles) {
      const p = alongArc(seatR, angle, seatY);
      const rot = p.rotY;

      const set = (mesh, x, y, z, ry = rot, rx = 0, rz = 0) => {
        dummy.position.set(x, y, z);
        dummy.rotation.set(rx, ry, rz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      };

      set(cushionMesh, p.x, seatY + 0.38, p.z);
      const cf = alongArc(seatR - 0.2, angle, seatY);
      set(cushionFrontMesh, cf.x, seatY + 0.34, cf.z);

      /* Socle bois sous l'assise — plus de vide en dessous */
      set(seatBaseMesh, p.x, seatY + 0.16, p.z);
      set(seatSkirtMesh, p.x, seatY + 0.05, p.z);

      const backSeatR = seatR + 0.16;
      const bp = alongArc(backSeatR, angle, seatY);
      set(backPadMesh, bp.x, seatY + 0.72, bp.z);
      set(backTopMesh, bp.x, seatY + 1.05, bp.z, rot, 0, 0);

      const sideOff = 0.24;
      const sl = alongArc(backSeatR, angle + sideOff / backSeatR, seatY);
      const sr = alongArc(backSeatR, angle - sideOff / backSeatR, seatY);
      set(woodSideLMesh, sl.x, seatY + 0.7, sl.z);
      set(woodSideRMesh, sr.x, seatY + 0.7, sr.z);
      set(woodTopMesh, bp.x, seatY + 1.08, bp.z);

      const armR = seatR + 0.02;
      const al = alongArc(armR, angle + 0.26 / armR, seatY);
      const ar = alongArc(armR, angle - 0.26 / armR, seatY);
      set(armWoodLMesh, al.x, seatY + 0.5, al.z);
      set(armWoodRMesh, ar.x, seatY + 0.5, ar.z);
      set(armPadLMesh, al.x, seatY + 0.56, al.z);
      set(armPadRMesh, ar.x, seatY + 0.56, ar.z);

      const d = alongArc(deskTopR, angle, seatY);
      set(leatherMesh, d.x, deskTopY + 0.07, d.z);
      const voter = alongArc(deskTopR - 0.08, angle + 0.13 / deskTopR, seatY);
      set(voteUnitMesh, voter.x, deskTopY + 0.1, voter.z);
      const plate = alongArc(deskTopR - 0.09, angle - 0.13 / deskTopR, seatY);
      set(namePlateMesh, plate.x, deskTopY + 0.092, plate.z);

      seats.push({
        index: idx,
        tier: t,
        angle,
        x: p.x,
        y: seatY + 0.38,
        z: p.z,
        senator: null,
      });

      idx++;
    }
  }

  console.info(`Hémicycle: ${idx} sièges (cible ${TOTAL_SEATS})`);
  for (const m of seatMeshes) m.instanceMatrix.needsUpdate = true;

  /* Volumes de picking invisibles, plus larges que le coussin (survol fiable) */
  const pickGeo = new THREE.BoxGeometry(0.72, 0.95, 0.7);
  const pickMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const pickMesh = new THREE.InstancedMesh(pickGeo, pickMat, TOTAL_SEATS);
  pickMesh.frustumCulled = false;
  pickMesh.layers.set(0);
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i];
    dummy.position.set(s.x, s.y + 0.28, s.z);
    dummy.rotation.set(0, -s.angle - Math.PI / 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pickMesh.setMatrixAt(i, dummy.matrix);
  }
  pickMesh.instanceMatrix.needsUpdate = true;
  seatRoot.add(pickMesh);

  const colorMeshes = [
    cushionMesh, cushionFrontMesh, backPadMesh, backTopMesh, armPadLMesh, armPadRMesh,
  ];
  return { seatCount: idx, seats, pickMesh, colorMeshes };
}

function clearSeats() {
  while (seatRoot.children.length) {
    const child = seatRoot.children[0];
    seatRoot.remove(child);
    disposeArchTree(child);
  }
}

function setSeatLayoutForCount(n) {
  SEATS_PER_TIER = seatsPerTierForCount(n);
  TOTAL_SEATS = SEATS_PER_TIER.reduce((s, k) => s + k, 0);
}

function rebuildSeats(n) {
  clearSeats();
  setSeatLayoutForCount(n);
  const next = buildSeats();
  /* Desk / gradin boxes are individual meshes — batch them like architecture. */
  instanceStaticBoxes(seatRoot);
  canvas.dataset.seatCount = String(next.seatCount);
  return next;
}

const ASSEMBLEE_SEAT_COUNT = 577;
const SENAT_SEAT_COUNT = 348;
const seatCache = { senat: null, assemblee: null };

function detachSeatRoot() {
  while (seatRoot.children.length) {
    seatRoot.remove(seatRoot.children[0]);
  }
}

/** Keep a stable hemicycle size; never grow seats to historical headcount. */
function ensureChamberSeatLayout() {
  const target = chamberId === 'assemblee' ? ASSEMBLEE_SEAT_COUNT : SENAT_SEAT_COUNT;
  if (seatSystem?.chamberKey === chamberId && seatSystem.seats.length === target) {
    return false;
  }

  /* Park the current layout so Sénat↔AN can swap without a full rebuild. */
  if (seatSystem?.chamberKey && seatRoot.children.length) {
    seatCache[seatSystem.chamberKey] = {
      system: seatSystem,
      children: [...seatRoot.children],
    };
    detachSeatRoot();
  }

  const cached = seatCache[chamberId];
  if (cached?.system?.seats?.length === target) {
    for (const child of cached.children) seatRoot.add(child);
    seatSystem = cached.system;
    canvas.dataset.seatCount = String(seatSystem.seatCount);
    return true;
  }

  seatSystem = rebuildSeats(target);
  seatSystem.chamberKey = chamberId;
  seatCache[chamberId] = {
    system: seatSystem,
    children: [...seatRoot.children],
  };
  return true;
}

/**
 * When a legislature has more deputies than physical seats, sample evenly
 * across the Ideal-X spectrum so left AND right remain represented.
 */
function selectLegislatorsForSeats(senators, seatCount) {
  if (!Array.isArray(senators) || !senators.length) return [];
  if (senators.length <= seatCount) return senators;
  const sorted = senators
    .map((s, i) => ({ s, i, x: Number(s.idealX) || 0, y: Number(s.idealY) || 0 }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.i - b.i);
  const picked = [];
  const used = new Set();
  for (let i = 0; i < seatCount; i++) {
    const idx = Math.round((i / (seatCount - 1)) * (sorted.length - 1));
    let j = idx;
    while (used.has(j) && j < sorted.length - 1) j += 1;
    while (used.has(j) && j > 0) j -= 1;
    used.add(j);
    picked.push(sorted[j].s);
  }
  return picked;
}

/* ── Helpers artistiques ───────────────────────────────────── */
function makeStatue() {
  const s = new THREE.Group();
  s.add(box(0.64, 0.24, 0.5, mat.marbleWarm, 0, 0.12, 0));
  s.add(box(0.5, 0.14, 0.4, mat.marble, 0, 0.31, 0));

  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.28, 18), mat.marble);
  robe.position.y = 0.96;
  robe.castShadow = true;
  s.add(robe);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.34, 5, 12), mat.marbleWarm);
  torso.position.y = 1.54;
  torso.castShadow = true;
  s.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat.marble);
  head.position.y = 2.06;
  head.castShadow = true;
  s.add(head);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.48, 4, 8), mat.marble);
    arm.position.set(side * 0.29, 1.53, 0.02);
    arm.rotation.z = side * 0.22;
    arm.castShadow = true;
    s.add(arm);
  }

  /* Quelques plis en relief évitent l'effet « pion » sans alourdir la scène. */
  for (const x of [-0.18, 0, 0.18]) {
    const fold = box(0.035, 0.84, 0.035, mat.marbleWarm, x, 0.82, 0.29);
    fold.rotation.z = -x * 0.3;
    s.add(fold);
  }
  return s;
}

function tubeArc(points, radius, material, segments = 48) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
  mesh.castShadow = true;
  return mesh;
}

function makeClock() {
  const g = new THREE.Group();
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1e7d2,
    roughness: 0.5,
    clearcoat: 0.16,
  });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.48, 32), faceMat);
  face.position.z = 0.025;
  g.add(face);
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.075, 10, 36), mat.goldBright));
  const hour = box(0.045, 0.28, 0.025, mat.woodDark, 0.06, 0.12, 0.06);
  hour.rotation.z = -0.42;
  g.add(hour);
  const minute = box(0.035, 0.38, 0.025, mat.woodDark, -0.11, 0.1, 0.065);
  minute.rotation.z = 0.72;
  g.add(minute);
  return g;
}

function makeWallSconce(withLight = false) {
  const g = new THREE.Group();
  g.add(box(0.12, 0.48, 0.12, mat.goldMuted, 0, 0.05, 0));
  const arm = cyl(0.035, 0.045, 0.42, mat.gold, 10);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, -0.03, -0.22);
  g.add(arm);
  const globeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffe1ad,
    emissive: 0xffb86b,
    emissiveIntensity: 1.8,
    roughness: 0.24,
    transmission: 0.18,
    thickness: 0.08,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), globeMat);
  globe.position.set(0, -0.04, -0.48);
  g.add(globe);
  if (withLight) {
    const light = new THREE.PointLight(0xffc17a, 7, 7.5, 1.8);
    light.position.copy(globe.position);
    g.add(light);
  }
  return g;
}

function makeFlag(kind = 'fr') {
  const f = new THREE.Group();
  const pole = cyl(0.025, 0.03, 2.4, mat.gold, 8);
  pole.position.y = 1.2;
  f.add(pole);
  if (kind === 'fr') {
    f.add(box(0.28, 1.1, 0.02, mat.flagBlue, -0.28, 1.7, 0.02));
    f.add(box(0.28, 1.1, 0.02, mat.flagWhite, 0, 1.7, 0.02));
    f.add(box(0.28, 1.1, 0.02, mat.flagRed, 0.28, 1.7, 0.02));
  } else {
    f.add(box(0.85, 1.1, 0.02, mat.flagEu, 0, 1.7, 0.02));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const star = box(0.06, 0.06, 0.02, mat.goldBright, Math.cos(a) * 0.22, 1.7 + Math.sin(a) * 0.22, 0.04);
      f.add(star);
    }
  }
  return f;
}

function addRedMarbleColumn(parent, x, z, yBase, height) {
  const col = new THREE.Group();
  col.position.set(x, yBase, z);
  col.add(box(0.7, 0.18, 0.7, mat.marbleCream, 0, 0.09, 0));
  col.add(box(0.55, 0.12, 0.55, mat.gold, 0, 0.24, 0));
  const shaft = cyl(0.18, 0.22, height - 0.75, mat.marbleRed, 16);
  shaft.position.y = (height - 0.75) / 2 + 0.35;
  col.add(shaft);
  col.add(box(0.62, 0.16, 0.62, mat.gold, 0, height - 0.4, 0));
  col.add(box(0.78, 0.12, 0.78, mat.goldBright, 0, height - 0.22, 0));
  for (const sx of [-0.22, 0.22]) {
    const volute = cyl(0.09, 0.09, 0.12, mat.goldBright, 8);
    volute.rotation.z = Math.PI / 2;
    volute.position.set(sx, height - 0.48, 0.15);
    col.add(volute);
  }
  parent.add(col);
}

/* ── Bureau / tribune du président ─────────────────────────── */
function buildBureau() {
  const g = new THREE.Group();
  g.position.set(0, 0, -5.8);

  g.add(box(13.5, 0.85, 6.2, mat.woodDark, 0, 0.425, 0.2));
  g.add(box(13.2, 0.04, 5.9, mat.carpet, 0, 0.88, 0.2));

  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      g.add(box(1.4, 0.16, 0.55, mat.wood, side * (4.2 + i * 0.05), 0.08 + i * 0.16, 2.4 - i * 0.4));
      g.add(box(1.35, 0.02, 0.52, mat.carpet, side * (4.2 + i * 0.05), 0.17 + i * 0.16, 2.4 - i * 0.4));
    }
  }

  for (let i = 0; i < 5; i++) {
    g.add(box(3.4 - i * 0.12, 0.18, 0.48, mat.wood, 0, 0.09 + i * 0.18, 3.1 - i * 0.38));
    g.add(box(3.3 - i * 0.12, 0.02, 0.46, mat.carpet, 0, 0.19 + i * 0.18, 3.1 - i * 0.38));
  }

  g.add(box(10.5, 0.08, 1.15, mat.deskTop, 0, 1.05, 1.35));
  g.add(box(10.5, 0.55, 0.1, mat.woodDark, 0, 0.78, 1.9));
  g.add(box(10.5, 0.06, 0.06, mat.gold, 0, 1.08, 1.95));
  for (let i = -4; i <= 4; i++) {
    g.add(box(0.48, 0.08, 0.42, mat.velvet, i * 1.1, 1.15, 0.95));
    g.add(box(0.48, 0.42, 0.07, mat.velvetDark, i * 1.1, 1.38, 0.72));
  }

  g.add(box(6.2, 0.55, 2.4, mat.woodDark, 0, 1.2, -1.1));
  g.add(box(6.0, 0.1, 2.2, mat.carpet, 0, 1.5, -1.1));
  g.add(box(5.4, 0.1, 1.35, mat.deskTop, 0, 1.95, -0.85));
  g.add(box(5.6, 0.9, 0.14, mat.woodPolish, 0, 1.7, -0.15));
  g.add(box(5.5, 0.12, 0.05, mat.goldBright, 0, 2.12, -0.08));
  g.add(box(5.5, 0.08, 0.05, mat.gold, 0, 1.35, -0.08));
  for (let i = -2; i <= 2; i++) {
    g.add(box(0.08, 0.7, 0.04, mat.goldMuted, i * 1.1, 1.7, -0.06));
  }

  g.add(box(0.72, 0.12, 0.62, mat.velvet, 0, 2.12, -1.55));
  g.add(box(0.72, 1.05, 0.1, mat.velvetDark, 0, 2.65, -1.85));
  g.add(box(0.1, 0.55, 0.5, mat.wood, -0.38, 2.4, -1.55));
  g.add(box(0.1, 0.55, 0.5, mat.wood, 0.38, 2.4, -1.55));

  for (const x of [-5.8, 5.8]) {
    g.add(box(0.08, 0.55, 4.8, mat.goldMuted, x, 1.2, 0.4));
  }
  g.add(box(11.6, 0.06, 0.06, mat.gold, 0, 1.48, 2.75));

  for (const [x, kind] of [[-2.2, 'fr'], [-1.1, 'eu'], [1.1, 'eu'], [2.2, 'fr']]) {
    const fl = makeFlag(kind);
    fl.position.set(x, 2.3, -2.15);
    fl.scale.set(0.85, 0.85, 0.85);
    g.add(fl);
  }

  archRoot.add(g);
}

/* ── Tribune des orateurs ──────────────────────────────────── */
function buildOrator() {
  const g = new THREE.Group();
  g.position.set(0, 0, 1.0);

  g.add(box(2.8, 1.15, 1.5, mat.woodDark, 0, 0.575, 0));
  g.add(box(2.95, 0.08, 1.65, mat.woodPolish, 0, 1.18, 0));
  g.add(box(2.7, 0.7, 0.06, mat.goldMuted, 0, 0.7, 0.78));
  g.add(box(2.5, 0.08, 0.05, mat.goldBright, 0, 1.0, 0.82));
  g.add(box(2.5, 0.08, 0.05, mat.goldBright, 0, 0.4, 0.82));
  const lectern = box(1.9, 0.07, 0.75, mat.deskTop, 0, 1.45, 0.18);
  lectern.rotation.x = -0.28;
  g.add(lectern);
  g.add(box(0.1, 1.15, 1.3, mat.wood, -1.35, 0.58, 0));
  g.add(box(0.1, 1.15, 1.3, mat.wood, 1.35, 0.58, 0));

  const mic = cyl(0.02, 0.02, 0.5, mat.gold, 8);
  mic.position.set(0, 1.6, 0.4);
  g.add(mic);
  const head = cyl(0.035, 0.028, 0.1, mat.deskTop, 8);
  head.rotation.z = Math.PI / 2;
  head.position.set(0.05, 1.85, 0.4);
  g.add(head);

  archRoot.add(g);
}

function buildBackdrop() {
  const g = new THREE.Group();
  const R = 10.8;
  const cz = -8 + R;
  const arc = Math.PI * 0.72;
  const theta0 = Math.PI - arc / 2;

  /* Une seule photo courbe : mur d'honneur (statues) */
  const shellH = 9.5;
  const shellY = 7.6;
  const shellGeo = new THREE.CylinderGeometry(R, R, shellH, 80, 1, true, theta0, arc);
  const uv = shellGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));

  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshStandardMaterial({
      map: TEX.wallArt,
      roughness: 0.55,
      metalness: 0.04,
      side: THREE.BackSide,
    })
  );
  shell.position.set(0, shellY, cz);
  shell.receiveShadow = true;
  g.add(shell);

  /* Boiserie basse continue */
  const wood = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.05, R - 0.05, 2.4, 64, 1, true, theta0, arc),
    new THREE.MeshStandardMaterial({
      map: TEX.wood,
      roughness: 0.48,
      metalness: 0.08,
      side: THREE.BackSide,
    })
  );
  wood.position.set(0, 1.25, cz);
  wood.receiveShadow = true;
  g.add(wood);

  /* Corniche or au sommet du mur */
  for (let i = 0; i < 32; i++) {
    const t = i / 32;
    const t2 = (i + 1) / 32;
    const th0 = theta0 + arc * t;
    const th1 = theta0 + arc * t2;
    const x0 = Math.sin(th0) * (R - 0.2);
    const z0 = cz + Math.cos(th0) * (R - 0.2);
    const x1 = Math.sin(th1) * (R - 0.2);
    const z1 = cz + Math.cos(th1) * (R - 0.2);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const beam = box(len * 1.05, 0.16, 0.2, mat.goldBright);
    beam.position.set(mx, shellY + shellH / 2 + 0.05, mz);
    beam.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    g.add(beam);
  }

  const artLight = new THREE.SpotLight(0xffe8c8, 18, 30, 0.68, 0.52, 1.4);
  artLight.position.set(0, 13, 5);
  artLight.target.position.set(0, 7, -6);
  g.add(artLight);
  g.add(artLight.target);

  archRoot.add(g);
}

/* Ailes latérales du mur d'honneur, sans recouvrir la photo centrale réelle. */
function buildHonorArchitecture() {
  const g = new THREE.Group();
  const wallZ = -7.88;
  const sideWoodMat = new THREE.MeshStandardMaterial({
    map: TEX.wood,
    color: 0x9a7562,
    roughness: 0.46,
    metalness: 0.04,
  });

  for (const [x, texture] of [[-9.2, TEX.paintL], [9.2, TEX.paintR]]) {
    /* Boiseries hautes qui ferment les vides noirs autour du mur courbe. */
    g.add(box(5.25, 11.1, 0.34, sideWoodMat, x, 5.55, wallZ));
    for (const y of [0.55, 3.95, 6.05, 10.75]) {
      g.add(box(5.12, 0.09, 0.12, y === 10.75 ? mat.goldBright : mat.goldMuted, x, y, wallZ + 0.22));
    }

    /* Fresques et cadres en saillie. */
    const panelMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.78, side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 2.12), panelMat);
    panel.position.set(x, 8.55, wallZ + 0.2);
    g.add(panel);
    g.add(box(3.52, 0.11, 0.12, mat.gold, x, 7.44, wallZ + 0.24));
    g.add(box(3.52, 0.11, 0.12, mat.gold, x, 9.66, wallZ + 0.24));
    g.add(box(0.11, 2.32, 0.12, mat.gold, x - 1.71, 8.55, wallZ + 0.24));
    g.add(box(0.11, 2.32, 0.12, mat.gold, x + 1.71, 8.55, wallZ + 0.24));

    /* Portes monumentales, rideaux et horloges latérales. */
    g.add(box(2.45, 3.35, 0.24, mat.woodDark, x, 2.18, wallZ + 0.2));
    g.add(box(1.72, 2.92, 0.08, mat.curtain, x, 2.15, wallZ + 0.37));
    g.add(box(2.72, 0.2, 0.28, mat.goldMuted, x, 3.88, wallZ + 0.31));
    const clock = makeClock();
    clock.position.set(x, 4.78, wallZ + 0.43);
    g.add(clock);

    const sconce = makeWallSconce(true);
    sconce.position.set(x + Math.sign(x) * 1.9, 5.35, wallZ + 0.45);
    sconce.rotation.y = Math.PI;
    g.add(sconce);
  }

  g.add(box(23.6, 0.22, 0.38, mat.goldBright, 0, 11.18, wallZ + 0.08));

  archRoot.add(g);
}

function addCorinthianColumn(parent, x, z, yBase, height) {
  const col = new THREE.Group();
  col.position.set(x, yBase, z);
  col.add(box(0.95, 0.22, 0.95, mat.marbleWarm, 0, 0.11, 0));
  col.add(box(0.78, 0.16, 0.78, mat.gold, 0, 0.3, 0));
  const shaft = cyl(0.28, 0.32, height - 0.9, mat.marbleWarm, 24);
  shaft.position.y = (height - 0.9) / 2 + 0.4;
  col.add(shaft);
  col.add(box(0.85, 0.22, 0.85, mat.gold, 0, height - 0.45, 0));
  col.add(box(1.05, 0.16, 1.05, mat.goldBright, 0, height - 0.22, 0));
  for (const sx of [-0.35, 0.35]) {
    const volute = cyl(0.12, 0.12, 0.14, mat.goldBright, 10);
    volute.rotation.z = Math.PI / 2;
    volute.position.set(sx, height - 0.55, 0.2);
    col.add(volute);
  }
  parent.add(col);
}

/* ── Murs = tribunes visiteurs (rouge + piliers or) ────────── */
function buildCurvedWall() {
  const WALL_R = 24.2;
  const SEGMENTS = IS_MOBILE_DEVICE ? 28 : 36;

  const woodMat = new THREE.MeshStandardMaterial({
    map: TEX.wood,
    roughness: 0.48,
    metalness: 0.08,
  });
  /* Fond rouge des tribunes publiques */
  const redWallMat = new THREE.MeshStandardMaterial({
    color: 0x5b1220,
    roughness: 0.94,
    metalness: 0.02,
  });

  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = ARC_START - 0.04 + ((ARC_END - ARC_START + 0.08) * i) / SEGMENTS;
    const a1 = ARC_START - 0.04 + ((ARC_END - ARC_START + 0.08) * (i + 1)) / SEGMENTS;
    const aMid = (a0 + a1) / 2;
    const segW = (a1 - a0) * WALL_R * 1.02;
    const rotY = -aMid + Math.PI / 2;
    const x = Math.cos(aMid) * (WALL_R - 0.1);
    const z = Math.sin(aMid) * (WALL_R - 0.1);

    /* Boiserie basse */
    const low = box(segW, 3.4, 0.22, woodMat);
    low.position.set(x, 1.7, z);
    low.rotation.y = rotY;
    archRoot.add(low);

    for (const y of [0.42, 1.72, 3.05]) {
      const mould = box(segW, 0.055, 0.06, y === 1.72 ? mat.woodPolish : mat.goldMuted);
      mould.position.set(Math.cos(aMid) * (WALL_R - 0.22), y, Math.sin(aMid) * (WALL_R - 0.22));
      mould.rotation.y = rotY;
      archRoot.add(mould);
    }

    /* Mur rouge derrière les galeries visiteurs */
    const red = box(segW, 8.6, 0.16, redWallMat);
    red.position.set(x, 7.9, z);
    red.rotation.y = rotY;
    archRoot.add(red);

    /* Corniche or */
    const cornice = box(segW, 0.2, 0.38, mat.gold);
    cornice.position.set(x, 12.3, z);
    cornice.rotation.y = rotY;
    archRoot.add(cornice);
  }

  /* Piliers or entre les travées visiteurs */
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = ARC_START + (ARC_END - ARC_START) * t;
    addCorinthianColumn(archRoot, Math.cos(a) * (WALL_R - 0.7), Math.sin(a) * (WALL_R - 0.7), 0, 11.8);
  }

  /* Globes muraux : ponctuation chaude visible dans les photos de la salle. */
  for (let i = 0; i < 10; i++) {
    const a = ARC_START + (ARC_END - ARC_START) * ((i + 0.5) / 10);
    const sconce = makeWallSconce(i % 2 === 0);
    sconce.position.set(Math.cos(a) * (WALL_R - 0.48), 2.65, Math.sin(a) * (WALL_R - 0.48));
    sconce.rotation.y = -a + Math.PI / 2;
    archRoot.add(sconce);
  }
}

/* ── Galeries visiteurs (observer l'hémicycle) ─────────────── */
function buildGalleries() {
  const levels = [
    { y: 5.2, depth: 2.6, r: 22.6 },
    { y: 8.4, depth: 2.4, r: 22.9 },
  ];

  for (const level of levels) {
    const bayCount = 12;
    for (let b = 0; b < bayCount; b++) {
      const t0 = b / bayCount;
      const t1 = (b + 1) / bayCount;
      const a0 = ARC_START + (ARC_END - ARC_START) * t0 + 0.02;
      const a1 = ARC_START + (ARC_END - ARC_START) * t1 - 0.02;
      const aMid = (a0 + a1) / 2;
      const segW = Math.max(0.4, (a1 - a0) * level.r);
      const rotY = -aMid + Math.PI / 2;

      /* Plancher de tribune */
      const floor = box(segW, 0.12, level.depth, mat.woodDark);
      floor.position.set(Math.cos(aMid) * level.r, level.y, Math.sin(aMid) * level.r);
      floor.rotation.y = rotY;
      archRoot.add(floor);

      /* Tapis rouge */
      const carpet = box(segW * 0.92, 0.04, level.depth * 0.85, mat.carpet);
      carpet.position.set(Math.cos(aMid) * level.r, level.y + 0.08, Math.sin(aMid) * level.r);
      carpet.rotation.y = rotY;
      archRoot.add(carpet);

      /* Balustrade or (ouverte sur la salle) */
      const railR = level.r - level.depth * 0.48;
      const rail = box(segW * 0.98, 0.12, 0.12, mat.woodPolish);
      rail.position.set(Math.cos(aMid) * railR, level.y + 0.85, Math.sin(aMid) * railR);
      rail.rotation.y = rotY;
      archRoot.add(rail);

      const railGold = box(segW * 0.96, 0.045, 0.09, mat.goldBright);
      railGold.position.set(Math.cos(aMid) * railR, level.y + 0.79, Math.sin(aMid) * railR);
      railGold.rotation.y = rotY;
      archRoot.add(railGold);

      for (let k = 0; k < 4; k++) {
        const tf = (k + 0.5) / 4;
        const ak = a0 + (a1 - a0) * tf;
        const bal = cyl(0.04, 0.045, 0.75, mat.gold, 8);
        bal.position.set(Math.cos(ak) * railR, level.y + 0.42, Math.sin(ak) * railR);
        archRoot.add(bal);
      }

      /* Rideau rouge au fond de la travée */
      const backR = level.r + level.depth * 0.35;
      const curtain = box(segW * 0.88, 1.7, 0.08, mat.curtain);
      curtain.position.set(Math.cos(aMid) * backR, level.y + 1.55, Math.sin(aMid) * backR);
      curtain.rotation.y = rotY;
      archRoot.add(curtain);

      const lintel = box(segW * 0.94, 0.12, 0.16, mat.goldMuted);
      lintel.position.set(Math.cos(aMid) * backR, level.y + 2.42, Math.sin(aMid) * backR);
      lintel.rotation.y = rotY;
      archRoot.add(lintel);

      /* Petits sièges visiteurs (rouges) */
      for (let s = 0; s < 3; s++) {
        const sf = (s + 0.5) / 3;
        const as = a0 + (a1 - a0) * sf;
        const sr = level.r + 0.15;
        const seat = box(0.38, 0.12, 0.36, mat.velvet);
        seat.position.set(Math.cos(as) * sr, level.y + 0.28, Math.sin(as) * sr);
        seat.rotation.y = -as - Math.PI / 2;
        archRoot.add(seat);
        const back = box(0.38, 0.4, 0.08, mat.velvetDark);
        back.position.set(Math.cos(as) * (sr + 0.18), level.y + 0.5, Math.sin(as) * (sr + 0.18));
        back.rotation.y = -as - Math.PI / 2;
        archRoot.add(back);
      }
    }
  }
}

/* ── Plafond + verrière DEMI-CERCLE (éventail) ─────────────── */
const ROOF = {
  y: 13.6,
  /** @type {{ mat: THREE.Material, inside: number, outside: number }[]} */
  layers: [],
};

/** Mur d’honneur AN : masqué quand la caméra recule derrière le perchoir. */
const HONOR_WALL = {
  group: null,
  z: -7.88,
};

let lastRoofExterior = null;
let lastWallExterior = null;
function updateRoofTransparency() {
  /* Above the ceiling plane → exterior: see into the hemicycle */
  const roofExterior = camera.position.y >= ROOF.y - 0.9;
  if (roofExterior !== lastRoofExterior) {
    lastRoofExterior = roofExterior;
    for (const layer of ROOF.layers) {
      layer.mat.opacity = roofExterior ? layer.outside : layer.inside;
      layer.mat.depthWrite = !roofExterior;
    }
  }

  /* Face aux parlementaires + recul derrière le mur de la présidente → voir les sièges, pas le mur. */
  const wallExterior =
    chamberId === 'assemblee' && camera.position.z < HONOR_WALL.z - 0.35;
  if (wallExterior !== lastWallExterior) {
    lastWallExterior = wallExterior;
    if (HONOR_WALL.group) HONOR_WALL.group.visible = !wallExterior;
  }
}

function buildCeiling() {
  const ceilY = ROOF.y;
  const skyR = 7.8;
  const skyZ = -3.4;

  const ceilMat = new THREE.MeshStandardMaterial({
    map: TEX.ceiling,
    color: 0x8b6338,
    roughness: 0.58,
    metalness: 0.12,
    emissive: 0x1b0c04,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    depthWrite: true,
  });
  ROOF.layers.push({ mat: ceilMat, inside: 0.94, outside: 0.14 });
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(26, 72), ceilMat);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.set(0, ceilY, 4);
  ceiling.receiveShadow = true;
  archRoot.add(ceiling);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(25.2, 0.2, 8, 80), mat.gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, ceilY - 0.12, 4);
  archRoot.add(ring);

  /* Anneaux moulurés et rosaces : ils cassent l'effet de plafond plat. */
  for (const [radius, tube] of [[9.2, 0.12], [14.4, 0.1], [19.5, 0.12], [23.6, 0.09]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 96), radius === 19.5 ? mat.goldBright : mat.goldMuted);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, ceilY - 0.16, 4);
    archRoot.add(band);
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rosette = cyl(0.2, 0.2, 0.09, i % 2 ? mat.goldMuted : mat.goldBright, 12);
    rosette.position.set(Math.cos(a) * 21.7, ceilY - 0.2, 4 + Math.sin(a) * 21.7);
    archRoot.add(rosette);
  }

  /* Emprise sombre sous la verrière (lit le demi-cercle) */
  const recessMat = new THREE.MeshStandardMaterial({
    color: 0x1a1210,
    roughness: 1,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    depthWrite: true,
  });
  ROOF.layers.push({ mat: recessMat, inside: 1, outside: 0.06 });
  const recess = new THREE.Mesh(new THREE.CircleGeometry(skyR + 0.15, 56, 0, Math.PI), recessMat);
  recess.rotation.x = -Math.PI / 2;
  recess.position.set(0, ceilY - 0.08, skyZ);
  archRoot.add(recess);

  const skyGroup = new THREE.Group();
  skyGroup.position.set(0, ceilY - 0.12, skyZ);
  skyGroup.scale.z = 0.7;

  const skyMat = new THREE.MeshStandardMaterial({
    color: 0xe8f0f8,
    map: TEX.skylight,
    roughness: 0.22,
    metalness: 0.04,
    emissive: new THREE.Color(0x8aa0b8),
    emissiveIntensity: 0.42,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
  });
  ROOF.layers.push({ mat: skyMat, inside: 0.88, outside: 0.2 });
  const glass = new THREE.Mesh(new THREE.CircleGeometry(skyR, 56, 0, Math.PI), skyMat);
  glass.rotation.x = -Math.PI / 2;
  glass.position.y = 0.02;
  skyGroup.add(glass);

  skyGroup.add(box(skyR * 2 + 0.35, 0.18, 0.2, mat.goldBright, 0, 0.1, 0));

  const arcPts = [];
  for (let i = 0; i <= 56; i++) {
    const a = (i / 56) * Math.PI;
    arcPts.push(new THREE.Vector3(Math.cos(a) * skyR, 0.1, Math.sin(a) * skyR));
  }
  skyGroup.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 56, 0.12, 6, false),
      mat.goldBright
    )
  );

  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    const rib = box(0.08, 0.08, skyR * 0.96, mat.gold);
    rib.position.set(Math.cos(a) * skyR * 0.5, 0.11, Math.sin(a) * skyR * 0.5);
    rib.rotation.y = -a;
    skyGroup.add(rib);
  }

  for (const rr of [0.32, 0.54, 0.76]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * skyR * rr, 0.11, Math.sin(a) * skyR * rr));
    }
    skyGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 5, false),
        mat.goldMuted
      )
    );
  }

  const skyLight = new THREE.PointLight(0xe8f1ff, 22, 42, 1.35);
  skyLight.position.set(0, -1.2, skyR * 0.4);
  skyGroup.add(skyLight);
  archRoot.add(skyGroup);

  for (const [lx, lz] of [[-8, 10], [8, 10], [0, 15]]) {
    const chand = new THREE.Group();
    chand.position.set(lx, ceilY - 1.25, lz);
    const stem = cyl(0.04, 0.04, 0.4, mat.gold, 8);
    stem.position.y = 0.1;
    chand.add(stem);
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      mat.goldBright
    );
    bowl.rotation.x = Math.PI;
    chand.add(bowl);
    const light = new THREE.PointLight(0xffefd4, 6, 9, 2);
    light.position.y = -0.06;
    chand.add(light);
    archRoot.add(chand);
  }
}

/* ── Éclairage global ──────────────────────────────────────── */
function buildLights() {
  scene.add(new THREE.AmbientLight(0xffead9, 0.58));
  scene.add(new THREE.HemisphereLight(0xf3f6f8, 0x3d1812, 0.72));

  const key = new THREE.DirectionalLight(0xffead6, 1.68);
  key.position.set(-4, 24, 14);
  key.castShadow = renderer.shadowMap.enabled;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  key.shadow.bias = -0.00025;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe5eef4, 0.48);
  fill.position.set(14, 12, -4);
  scene.add(fill);

  /* Éclairage frontal doux : révèle le velours et les couleurs des groupes
     depuis la vue principale, sans ajouter d'ombre ni de coût notable. */
  const frontFill = new THREE.DirectionalLight(0xfff3e8, 1.22);
  frontFill.position.set(0, 10, -16);
  frontFill.target.position.set(0, 3.6, 9);
  scene.add(frontFill);
  scene.add(frontFill.target);

  const spot = new THREE.SpotLight(0xffd7a6, 26, 38, 0.5, 0.55, 1.6);
  spot.position.set(0, 11, 2);
  spot.target.position.set(0, 1.8, -6);
  scene.add(spot);
  scene.add(spot.target);

  const seatFill = new THREE.PointLight(0xffc58f, 34, 46, 1.45);
  seatFill.position.set(0, 8, 10);
  scene.add(seatFill);

  const seatFill2 = new THREE.PointLight(0xffd6ad, 28, 42, 1.5);
  seatFill2.position.set(0, 6, 14);
  scene.add(seatFill2);

  const seatFillL = new THREE.PointLight(0xffba7a, 18, 30, 1.55);
  seatFillL.position.set(-10, 7, 8);
  scene.add(seatFillL);

  const seatFillR = new THREE.PointLight(0xffba7a, 18, 30, 1.55);
  seatFillR.position.set(10, 7, 8);
  scene.add(seatFillR);
}

/* ── Assemblage architecture (Sénat ou Assemblée) ──────────── */
function disposeArchTree(object) {
  const sharedMats = new Set(Object.values(mat));
  const sharedGeos = new Set([
    ...boxGeometryCache.values(),
    ...cylinderGeometryCache.values(),
  ]);
  object.traverse((child) => {
    if (child.geometry && !sharedGeos.has(child.geometry)) {
      child.geometry.dispose();
    }
    if (!child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of list) {
      if (sharedMats.has(m)) continue;
      if (m.map && (m.map.isCanvasTexture || m.userData?.disposeMap)) {
        m.map.dispose();
      }
      m.dispose();
    }
  });
}

function clearArchitecture() {
  while (archRoot.children.length) {
    const child = archRoot.children[0];
    archRoot.remove(child);
    disposeArchTree(child);
  }
  ROOF.layers.length = 0;
}

function buildSenatArchitecture() {
  ensureSenatTextures();
  buildFloor();
  buildBureau();
  buildOrator();
  buildBackdrop();
  buildHonorArchitecture();
  buildCurvedWall();
  buildGalleries();
  buildCeiling();
}

function chamberHelpers() {
  return {
    parent: archRoot,
    box,
    cyl,
    mat,
    ROOF,
    HONOR_WALL,
    IS_MOBILE_DEVICE,
    IS_MOBILE: IS_MOBILE_DEVICE,
    ARC_START,
    ARC_END,
    alongArc,
    AISLE_FRAC,
    makeStatue,
    makeClock,
    makeWallSconce,
    makeFlag,
    addCorinthianColumn,
  };
}

/* ── Données sénateurs + mapping idéal → sièges ─────────────── */
const DEFAULT_SEAT_COLOR = new THREE.Color(COLORS.velvet);

function applyChamberVisuals(id) {
  const palette = id === 'assemblee' ? ASSEMBLEE_COLORS : SENAT_COLORS;
  Object.assign(COLORS, palette);
  applyPaletteToMaterials(mat, palette, id);
  DEFAULT_SEAT_COLOR.setHex(palette.velvet);
  scene.background = new THREE.Color(palette.sceneBg || 0x1b0d0b);
  scene.fog = new THREE.Fog(palette.sceneBg || 0x1b0d0b, 62, 108);
  document.documentElement.dataset.chamber = id;
}

const archCache = { senat: null, assemblee: null };
const roofCache = { senat: null, assemblee: null };

function detachArchitecture() {
  while (archRoot.children.length) {
    archRoot.remove(archRoot.children[0]);
  }
  ROOF.layers.length = 0;
  HONOR_WALL.group = null;
  lastRoofExterior = null;
  lastWallExterior = null;
}

function bindHonorWallFromArch() {
  HONOR_WALL.group =
    archRoot.children.find((c) => c.userData?.honorWall === true) || null;
  if (HONOR_WALL.group) HONOR_WALL.group.visible = true;
}

function buildChamberArchitecture(id) {
  applyChamberVisuals(id);
  detachArchitecture();

  if (archCache[id]?.length) {
    for (const child of archCache[id]) archRoot.add(child);
    if (roofCache[id]?.length) ROOF.layers.push(...roofCache[id]);
    bindHonorWallFromArch();
    return;
  }

  if (id === 'assemblee') {
    buildAssembleeArchitecture(chamberHelpers());
  } else {
    buildSenatArchitecture();
  }
  instanceStaticBoxes(archRoot);
  archCache[id] = [...archRoot.children];
  roofCache[id] = [...ROOF.layers];
  bindHonorWallFromArch();
}

buildChamberArchitecture(chamberId);
let seatSystem = rebuildSeats(chamberId === 'assemblee' ? ASSEMBLEE_SEAT_COUNT : SENAT_SEAT_COUNT);
seatSystem.chamberKey = chamberId;
seatCache[chamberId] = {
  system: seatSystem,
  children: [...seatRoot.children],
};
buildLights();

/* ── Données multi-chambre / timeline AN ─────────────────────── */
let assembleePayload = null;
const assembleePeriodPromises = new Map();
let currentPeriodId = null;
let periodLoadToken = 0;
let allSenators = [];
let groupColors = {};

function setChamber(id, { persist = true } = {}) {
  if (id !== 'senat' && id !== 'assemblee') return;
  if (id === chamberId && archRoot.children.length) {
    syncChamberSwitchUI();
    syncPeriodSliderUI();
    return;
  }
  window.clearTimeout(periodApplyTimer);
  periodLoadToken += 1;
  periodPreviewId = null;
  chamberId = id;
  if (persist) storeChamber(id);
  buildChamberArchitecture(id);
  syncChamberSwitchUI();
  canvas.dataset.chamber = id;
  syncPeriodSliderUI();
  loadChamberData().catch((err) => console.warn('loadChamberData failed', err));
}

function syncChamberSwitchUI() {
  const rootEl = document.getElementById('chamber-switch');
  if (!rootEl) return;
  rootEl.querySelectorAll('[data-chamber]').forEach((btn) => {
    const active = btn.getAttribute('data-chamber') === chamberId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

document.getElementById('chamber-switch')?.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-chamber]');
  if (!btn) return;
  setChamber(btn.getAttribute('data-chamber'));
});
syncChamberSwitchUI();

function fittedAssembleePeriods() {
  const periods = assembleePayload?.periods || [];
  return periods.filter((p) => p?.fitted);
}

function formatPeriodDate(iso, fallback) {
  if (!iso) return fallback || '…';
  const d = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }
  return d;
}

function periodDisplayLabel(period) {
  const english = document.documentElement.lang?.toLowerCase().startsWith('en');
  return english ? period?.labelEn || period?.label || '' : period?.label || '';
}

function periodShortLabel(period) {
  const number = Number(period?.legislature);
  const english = document.documentElement.lang?.toLowerCase().startsWith('en');
  if (!Number.isFinite(number)) return period?.startLabel || '';
  if (!english) return `${number}e`;
  const mod100 = number % 100;
  const suffix = mod100 >= 11 && mod100 <= 13
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] || 'th');
  return `${number}${suffix}`;
}

function syncPeriodSliderUI() {
  const rootEl = document.getElementById('period-slider');
  const range = document.getElementById('period-range');
  const ticks = document.getElementById('period-ticks');
  const datesEl = document.getElementById('period-dates');
  const currentEl = document.getElementById('period-current');
  if (!rootEl || !range) return;

  const show = chamberId === 'assemblee';
  rootEl.hidden = !show;
  if (!show) return;

  const periods = fittedAssembleePeriods();
  if (!periods.length) {
    rootEl.hidden = true;
    return;
  }
  if (!currentPeriodId || !periods.some((p) => p.id === currentPeriodId)) {
    currentPeriodId =
      assembleePayload?.meta?.defaultPeriod &&
      periods.some((p) => p.id === assembleePayload.meta.defaultPeriod)
        ? assembleePayload.meta.defaultPeriod
        : periods[periods.length - 1].id;
  }
  const idx = Math.max(0, periods.findIndex((p) => p.id === currentPeriodId));
  range.min = '0';
  range.max = String(Math.max(0, periods.length - 1));
  range.value = String(idx);
  range.disabled = periods.length < 2;

  if (ticks) {
    ticks.innerHTML = periods
      .map((p, i) => {
        const years = `${p.startLabel || '…'}—${p.endLabel || '…'}`;
        const active = i === idx;
        return `<button type="button" class="period-tick${active ? ' is-active' : ''}" data-period-idx="${i}" aria-pressed="${active}" aria-label="${periodDisplayLabel(p)} · ${years}"><span>${periodShortLabel(p)}</span><small>${years}</small></button>`;
      })
      .join('');
  }
  const period = periods[idx];
  if (currentEl) {
    currentEl.textContent = periodDisplayLabel(period);
  }
  if (datesEl && period) {
    const start = formatPeriodDate(period.start || period.dateMin, period.startLabel);
    const end = period.end
      ? formatPeriodDate(period.end, period.endLabel || '…')
      : period.endLabel || '…';
    datesEl.textContent = t('period.dates', { start, end });
  }
}

async function loadDeputiesPayload(retries = 4, delayMs = 300) {
  if (assembleePayload?.periods) return assembleePayload;
  for (let i = 0; i < retries; i++) {
    try {
      let data = null;
      try {
        data = await deputiesManifestPromise;
        deputiesManifestPromise = null;
        if (!data) data = await fetchCachedJson(DEPUTIES_MANIFEST_URL);
      } catch {
        deputiesManifestPromise = null;
      }
      if (Array.isArray(data?.periods)) {
        assembleePayload = {
          ...data,
          deputiesByPeriod: {},
        };
        return assembleePayload;
      }

      /* Backward-compatible fallback for an older deployment. */
      const legacy = await fetchCachedJson(DEPUTIES_URL);
      if (legacy?.deputiesByPeriod) {
        assembleePayload = legacy;
        return legacy;
      }
    } catch {
      /* retry */
    }
    await sleep(delayMs);
  }
  return null;
}

async function loadDeputiesPeriod(periodId) {
  if (!assembleePayload) return [];
  const cached = assembleePayload.deputiesByPeriod?.[periodId];
  if (Array.isArray(cached) && cached.length) return cached;
  if (assembleePeriodPromises.has(periodId)) return assembleePeriodPromises.get(periodId);

  const fileName = assembleePayload.files?.[periodId] || `${periodId}.json`;
  const promise = fetchCachedJson(`/assets/deputies/${fileName}`)
    .then((data) => {
      const list = Array.isArray(data?.deputies) ? data.deputies : [];
      if (!assembleePayload.deputiesByPeriod) assembleePayload.deputiesByPeriod = {};
      assembleePayload.deputiesByPeriod[periodId] = list;
      if (data?.groupColors) {
        assembleePayload.groupColors = {
          ...(assembleePayload.groupColors || {}),
          ...data.groupColors,
        };
      }
      return list;
    })
    .finally(() => assembleePeriodPromises.delete(periodId));
  assembleePeriodPromises.set(periodId, promise);
  return promise;
}

async function applyAssembleePeriod(periodId, { remountHeader = true, quiet = false } = {}) {
  if (!assembleePayload) return;
  const periods = fittedAssembleePeriods();
  const period =
    periods.find((p) => p.id === periodId) || periods[periods.length - 1];
  if (!period) return;
  const loadToken = ++periodLoadToken;
  const periodDeputies = await loadDeputiesPeriod(period.id);
  if (chamberId !== 'assemblee' || loadToken !== periodLoadToken) return;
  currentPeriodId = period.id;
  const fullList = periodDeputies.map(normalizeSenator);
  if (assembleePayload.groupColors) groupColors = assembleePayload.groupColors;
  /* Fixed 577-seat hemicycle — never rebuild just because headcount differs. */
  ensureChamberSeatLayout();
  const meta = {
    ...(assembleePayload.meta || {}),
    count: fullList.length,
    period,
    chamber: 'assemblee',
  };
  applySenatorData(fullList, meta, 'file', { quiet });
  paintIntroIdeal(fullList, groupColors);
  syncPeriodSliderUI();
  if (remountHeader) updateChamberChrome();
  closePanel();
  hideTooltip();
  if (!quiet) {
    const seated = seatSystem.seats.filter((s) => s.senator).length;
    console.info(
      `AN ${period.id}: ${fullList.length} députés (Ideal) → ${seated} placés / ${seatSystem.seats.length} sièges`
    );
  }
}

function updateChamberChrome() {
  const title = document.querySelector('.header-brand h1');
  const eyebrow = document.querySelector('.header-brand .eyebrow');
  const seatsMeta = document.querySelector('.header-meta [data-i18n="header.metaSeats"]');
  const searchLabel = document.querySelector('label[for="senator-search-input"]');
  const searchInput = document.getElementById('senator-search-input');
  const idealSub = document.querySelector('.ideal-card-sub');
  const idealScatterEl = document.getElementById('ideal-scatter');
  const coachTitle = document.querySelector('#scene-coach [data-i18n="coach.title"]');
  const aboutLinks = document.querySelectorAll('a.about-link, a.intro-about');
  const aboutHref = chamberId === 'assemblee' ? '/about-assemblee.html' : '/about.html';

  aboutLinks.forEach((a) => {
    a.setAttribute('href', aboutHref);
  });

  if (chamberId === 'assemblee') {
    if (title) {
      title.removeAttribute('data-i18n-html');
      title.innerHTML = t('header.titleAn');
    }
    if (eyebrow) {
      eyebrow.removeAttribute('data-i18n');
      eyebrow.textContent = t('header.eyebrowAn');
    }
    if (seatsMeta) {
      seatsMeta.removeAttribute('data-i18n');
      seatsMeta.textContent = t('header.metaSeatsAn');
    }
    if (searchLabel) {
      searchLabel.removeAttribute('data-i18n');
      searchLabel.textContent = t('search.labelAn');
    }
    if (searchInput) {
      searchInput.setAttribute('data-i18n-placeholder', 'search.placeholderAn');
      searchInput.placeholder = t('search.placeholderAn');
    }
    if (idealSub) {
      idealSub.removeAttribute('data-i18n');
      idealSub.textContent = t('panel.idealSubAn');
    }
    if (idealScatterEl) {
      idealScatterEl.removeAttribute('data-i18n-aria');
      idealScatterEl.setAttribute('aria-label', t('panel.scatterAriaAn'));
    }
    if (coachTitle) {
      coachTitle.removeAttribute('data-i18n');
      coachTitle.textContent = t('coach.titleAn');
    }
  } else {
    if (title) {
      title.setAttribute('data-i18n-html', 'header.title');
      title.innerHTML = t('header.title');
    }
    if (eyebrow) {
      eyebrow.setAttribute('data-i18n', 'header.eyebrow');
      eyebrow.textContent = t('header.eyebrow');
    }
    if (seatsMeta) {
      seatsMeta.setAttribute('data-i18n', 'header.metaSeats');
      seatsMeta.textContent = t('header.metaSeats');
    }
    if (searchLabel) {
      searchLabel.setAttribute('data-i18n', 'search.label');
      searchLabel.textContent = t('search.label');
    }
    if (searchInput) {
      searchInput.setAttribute('data-i18n-placeholder', 'search.placeholder');
      searchInput.placeholder = t('search.placeholder');
    }
    if (idealSub) {
      idealSub.setAttribute('data-i18n', 'panel.idealSub');
      idealSub.textContent = t('panel.idealSub');
    }
    if (idealScatterEl) {
      idealScatterEl.setAttribute('data-i18n-aria', 'panel.scatterAria');
      idealScatterEl.setAttribute('aria-label', t('panel.scatterAria'));
    }
    if (coachTitle) {
      coachTitle.setAttribute('data-i18n', 'coach.title');
      coachTitle.textContent = t('coach.title');
    }
  }
}

async function loadChamberData() {
  updateChamberChrome();
  closePanel();
  hideTooltip();
  hoveredSeat = -1;
  selectedSeat = -1;

  if (chamberId === 'assemblee') {
    const payload = await loadDeputiesPayload();
    if (!payload) {
      console.warn('deputies.json absent — fallback placeholders');
      ensureChamberSeatLayout();
      applySenatorData(
        PLACEHOLDER_SENATORS.map(normalizeSenator),
        { chamber: 'assemblee' },
        'placeholder'
      );
      syncPeriodSliderUI();
      return;
    }
    assembleePayload = payload;
    const periods = fittedAssembleePeriods();
    const want =
      currentPeriodId && periods.some((p) => p.id === currentPeriodId)
        ? currentPeriodId
        : payload.meta?.defaultPeriod || periods[periods.length - 1]?.id;
    await applyAssembleePeriod(want);
    return;
  }

  /* Sénat */
  syncPeriodSliderUI();
  ensureChamberSeatLayout();
  const { senators, source, meta, groupColors: gc } = await loadSenators();
  if (gc && Object.keys(gc).length) groupColors = gc;
  applySenatorData(senators, meta, source);
  paintIntroIdeal(senators, groupColors);
}

let periodApplyTimer = 0;
let periodPreviewId = null;

function previewPeriodSlider(period, idx) {
  const currentEl = document.getElementById('period-current');
  const datesEl = document.getElementById('period-dates');
  const ticks = document.getElementById('period-ticks');
  if (currentEl) currentEl.textContent = periodDisplayLabel(period);
  if (datesEl && period) {
    const start = formatPeriodDate(period.start || period.dateMin, period.startLabel);
    const end = period.end
      ? formatPeriodDate(period.end, period.endLabel || '…')
      : period.endLabel || '…';
    datesEl.textContent = t('period.dates', { start, end });
  }
  if (ticks) {
    ticks.querySelectorAll('.period-tick').forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
}

async function commitAssembleePeriod(periodId) {
  if (chamberId !== 'assemblee' || !assembleePayload) return;
  if (periodId === currentPeriodId && seatSystem.seats.some((s) => s.senator)) {
    syncPeriodSliderUI();
    return;
  }
  await applyAssembleePeriod(periodId, { quiet: true });
}

document.getElementById('period-range')?.addEventListener('input', (event) => {
  if (chamberId !== 'assemblee' || !assembleePayload) return;
  const periods = fittedAssembleePeriods();
  const idx = Number(event.target.value);
  const period = periods[idx];
  if (!period) return;
  periodPreviewId = period.id;
  previewPeriodSlider(period, idx);
  window.clearTimeout(periodApplyTimer);
  periodApplyTimer = window.setTimeout(() => {
    commitAssembleePeriod(periodPreviewId).catch((err) => console.warn('Period load failed', err));
  }, 70);
});

document.getElementById('period-range')?.addEventListener('change', (event) => {
  if (chamberId !== 'assemblee' || !assembleePayload) return;
  const periods = fittedAssembleePeriods();
  const idx = Number(event.target.value);
  const period = periods[idx];
  if (!period) return;
  window.clearTimeout(periodApplyTimer);
  commitAssembleePeriod(period.id).catch((err) => console.warn('Period load failed', err));
});

document.getElementById('period-ticks')?.addEventListener('click', (event) => {
  const tick = event.target.closest('[data-period-idx]');
  if (!tick || chamberId !== 'assemblee') return;
  const idx = Number(tick.getAttribute('data-period-idx'));
  const periods = fittedAssembleePeriods();
  const period = periods[idx];
  const range = document.getElementById('period-range');
  if (!period || !range) return;
  range.value = String(idx);
  window.clearTimeout(periodApplyTimer);
  previewPeriodSlider(period, idx);
  commitAssembleePeriod(period.id).catch((err) => console.warn('Period load failed', err));
});

applySeatColors(seatSystem.seats, seatSystem.colorMeshes);
const PLACEHOLDER_SENATORS = [
  {
    id: 'placeholder-1',
    name: 'Alice Dupont',
    party: 'Groupe A',
    partyColor: '#1f4e79',
    idealX: -0.6,
    idealY: 0.2,
    abstentionPct: 4.2,
    distToGroup: 0.12,
    farFromGroup: false,
  },
  {
    id: 'placeholder-2',
    name: 'Bruno Martin',
    party: 'Groupe B',
    partyColor: '#c0392b',
    idealX: 0.1,
    idealY: -0.3,
    abstentionPct: 11.5,
    distToGroup: 0.48,
    farFromGroup: true,
  },
  {
    id: 'placeholder-3',
    name: 'Claire Petit',
    party: 'Groupe C',
    partyColor: '#2e7d32',
    idealX: 0.7,
    idealY: 0.15,
    abstentionPct: 2.8,
    distToGroup: 0.09,
    farFromGroup: false,
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeSenator(raw) {
  const party =
    raw.groupe_libelle ||
    raw.party ||
    raw.parti ||
    raw.groupe ||
    raw.groupe_code ||
    'Groupe inconnu';
  return {
    ...raw,
    id: raw.id ?? '',
    name: raw.name || [raw.prenom, raw.nom].filter(Boolean).join(' ') || 'Sans nom',
    party,
    partyColor: raw.partyColor || raw.party_color || '#8c1a28',
    idealX: Number(raw.idealX),
    idealY: Number(raw.idealY),
    abstentionPct: raw.abstentionPct,
    distToGroup: raw.distToGroup,
    farFromGroup: raw.farFromGroup === true || raw.farFromGroup === 'true',
  };
}

async function loadSenators(retries = 6, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      let data = await senatorPayloadPromise;
      if (!data) data = await fetchCachedJson(SENATORS_URL);
      const list = Array.isArray(data) ? data : data.senators;
      if (Array.isArray(list) && list.length > 0) {
        const senators = list.map(normalizeSenator);
        const notebook = (data.meta && data.meta.notebook) || 'inconnu';
        console.info(
          `Sénateurs chargés: ${senators.length} depuis ${SENATORS_URL} (notebook: ${notebook})`
        );
        return {
          senators,
          source: 'file',
          meta: data.meta || null,
          groupColors: data.groupColors || {},
        };
      }
    } catch {
      /* fichier pas encore prêt */
    }
    await sleep(delayMs);
  }
  console.warn('senators.json absent — placeholder temporaire (3 sénateurs)');
  return { senators: PLACEHOLDER_SENATORS.map(normalizeSenator), source: 'placeholder', meta: null, groupColors: {} };
}

/**
 * Colonnes radiales de l'hémicycle : angles du rang le plus peuplé (tier externe).
 * Chaque siège est rattaché à la colonne d'angle le plus proche → même « rayon »
 * gauche→droite, plusieurs tiers haut/bas.
 */
function hemicycleColumnAngles() {
  return seatAnglesForTier(SEATS_PER_TIER[SEATS_PER_TIER.length - 1]);
}

function seatColumnIndex(angle, columnAngles) {
  const refs = columnAngles || hemicycleColumnAngles();
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < refs.length; i++) {
    const d = Math.abs(angle - refs[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Tier cible (0…TIER_MAX) depuis le rang Ideal Y — haut Ideal Y → haut de l'hémicycle. */
function idealYTargetTier(senators) {
  const tierMax = SEATS_PER_TIER.length - 1;
  const byY = senators
    .map((s, i) => ({ s, y: Number(s.idealY) || 0, i }))
    .sort((a, b) => a.y - b.y || a.i - b.i);
  const rank = new Map();
  byY.forEach((item, r) => rank.set(item.s, r));
  const denom = Math.max(1, senators.length - 1);
  return (sen) => Math.round(((rank.get(sen) ?? 0) / denom) * tierMax);
}

function pearsonCorr(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den > 0 ? num / den : NaN;
}

function countIdealXAngleCrossings(seats) {
  const filled = seats.filter((s) => s.senator);
  let crossings = 0;
  for (let i = 0; i < filled.length; i++) {
    const xi = Number(filled[i].senator.idealX) || 0;
    const ai = filled[i].angle;
    for (let j = i + 1; j < filled.length; j++) {
      const xj = Number(filled[j].senator.idealX) || 0;
      if ((xi - xj) * (ai - filled[j].angle) < 0) crossings += 1;
    }
  }
  return crossings;
}

/**
 * Relaxation Y locale après le mapping colonnes X.
 * Ne touche que les outliers |tier − targetY| ≥ thresh, via swaps locaux :
 *   - Δ idealX ≤ maxXDelta (≈ 0.12–0.15)
 *   - Δ colonnes ≤ maxColDelta
 *   - vole un siège plus haut à quelqu'un de Ideal Y plus bas (ou l'inverse)
 *   - verrouille le siège réparé pour éviter le re-vol par un voisin proche en X
 * X reste dominant : peu d'exceptions, corr(idealX, angle) reste élevée.
 */
function relaxYOutliers(seats, senators, columnAngles, {
  thresh = 5,
  maxXDelta = 0.15,
  maxColDelta = 2,
  maxSwaps = 20,
} = {}) {
  const targetTier = idealYTargetTier(senators);
  const colOf = (seat) => seatColumnIndex(seat.angle, columnAngles);
  for (const seat of seats) {
    if (seat.senator) seat._col = colOf(seat);
  }

  const lockedSeats = new Set();
  const lockedPeople = new Set();
  const log = [];
  let swaps = 0;

  function findBest(a, { xDelta, colDelta, minGain }) {
    const filled = seats.filter((s) => s.senator);
    const ax = Number(a.senator.idealX) || 0;
    const ay = Number(a.senator.idealY) || 0;
    const aAbs = Math.abs(a.tier - targetTier(a.senator));
    const err = a.tier - targetTier(a.senator);
    let best = null;
    for (const b of filled) {
      if (b === a || !b.senator) continue;
      if (lockedSeats.has(b.index)) continue;
      if (lockedPeople.has(b.senator)) continue;
      if (Math.abs((a._col ?? 0) - (b._col ?? 0)) > colDelta) continue;
      const bx = Number(b.senator.idealX) || 0;
      const by = Number(b.senator.idealY) || 0;
      if (Math.abs(ax - bx) > xDelta) continue;
      if (err < 0 && !(b.tier > a.tier && by < ay)) continue;
      if (err > 0 && !(b.tier < a.tier && by > ay)) continue;
      const newAAbs = Math.abs(b.tier - targetTier(a.senator));
      const gain = aAbs - newAAbs;
      if (gain < minGain) continue;
      const oldBAbs = Math.abs(b.tier - targetTier(b.senator));
      const newBAbs = Math.abs(a.tier - targetTier(b.senator));
      const be = b.tier - targetTier(b.senator);
      const complementary = err * be < 0;
      if (!complementary && newBAbs > oldBAbs + gain) continue;
      if (newBAbs > aAbs) continue;
      const score =
        gain * 25 +
        (err < 0 ? b.tier : SEATS_PER_TIER.length - 1 - b.tier) * 2 -
        Math.abs(ax - bx) * 80 -
        Math.abs((a._col ?? 0) - (b._col ?? 0)) * 3 +
        (complementary ? 20 : 0) -
        (newBAbs - oldBAbs) * 4;
      if (!best || score > best.score) {
        best = { b, score, gain, dX: Math.abs(ax - bx) };
      }
    }
    return best;
  }

  for (let round = 0; round < 4 && swaps < maxSwaps; round++) {
    const filled = seats.filter((s) => s.senator);
    const outliers = filled
      .map((s) => ({ s, abs: Math.abs(s.tier - targetTier(s.senator)) }))
      .filter((o) => o.abs >= thresh)
      .sort((a, b) => b.abs - a.abs);
    let passSwaps = 0;
    for (const { s: a } of outliers) {
      if (swaps >= maxSwaps) break;
      const best = findBest(a, {
        xDelta: maxXDelta + (round > 1 ? 0.03 : 0),
        colDelta: maxColDelta + (round > 1 ? 1 : 0),
        minGain: round === 0 ? 3 : 2,
      });
      if (!best) continue;
      const mover = a.senator;
      const victim = best.b.senator;
      log.push({
        mover: mover.name,
        victim: victim.name,
        fromTier: a.tier,
        toTier: best.b.tier,
        dX: best.dX,
        gain: best.gain,
      });
      lockedSeats.delete(a.index);
      a.senator = victim;
      best.b.senator = mover;
      lockedSeats.add(best.b.index);
      lockedPeople.add(mover);
      swaps += 1;
      passSwaps += 1;
    }
    if (!passSwaps) break;
  }

  return { swaps, log, targetTier };
}

/**
 * Mapping déterministe Ideal Point → 348 sièges (colonnes radiales).
 * Source of truth: senat_ideal_point_model_R_simple.ipynb (+ senators.json from recovery)
 *   dim1 (idealX): PRIORITÉ #1 — gauche (CRC/SOC) → droite (UC/RTLI/UMP)
 *   dim2 (idealY): PRIORITÉ #2 — bas/proche → haut/loin (RDPI)
 *
 * Géométrie : tribune / présidente vers −Z, hémicycle vers +Z.
 * Caméra derrière la présidente (regard vers +Z) : monde +X = GAUCHE écran,
 * monde −X = DROITE écran.
 *   ARC_START → +X → gauche visuelle ; ARC_END → −X → droite visuelle
 *   tier 0 = proche présidente ; tier élevé = loin (haut de l'hémicycle)
 *
 * Algorithme :
 *   1. Colonnes = sièges groupés par angle de référence (tier externe), G→D.
 *   2. Trier tous les sénateurs par idealX↑ puis idealY↑.
 *   3. Allouer des blocs consécutifs aux colonnes (capacité) — ordre X global.
 *   4. Dans chaque colonne : sénateurs par idealY↑, sièges par tier↑, zip 1:1.
 *   5. Relaxation Y : outliers |tier−targetY| ≥ 5 peuvent swapper localement
 *      (ΔidealX ≤ 0.15, ±2 colonnes) — X reste dominant, peu d'exceptions.
 */
function mapSenatorsToSeats(senators, seats) {
  for (const seat of seats) seat.senator = null;
  const n = Math.min(senators.length, seats.length);
  if (!n) return null;

  const columnAngles = hemicycleColumnAngles();

  const byIdeal = senators
    .map((s, i) => ({
      s,
      i,
      x: Number(s.idealX) || 0,
      y: Number(s.idealY) || 0,
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.i - b.i)
    .slice(0, n);

  const colMap = new Map();
  for (const seat of seats) {
    const c = seatColumnIndex(seat.angle, columnAngles);
    let bucket = colMap.get(c);
    if (!bucket) {
      bucket = [];
      colMap.set(c, bucket);
    }
    bucket.push(seat);
  }

  const columns = [...colMap.entries()].sort((a, b) => a[0] - b[0]);
  let offset = 0;
  for (const [, colSeats] of columns) {
    if (offset >= byIdeal.length) break;
    const cap = Math.min(colSeats.length, byIdeal.length - offset);
    const block = byIdeal.slice(offset, offset + cap);
    offset += cap;

    block.sort((a, b) => a.y - b.y || a.x - b.x || a.i - b.i);
    const seatsByTier = [...colSeats].sort(
      (a, b) => a.tier - b.tier || a.angle - b.angle
    );
    for (let i = 0; i < cap; i++) {
      seatsByTier[i].senator = block[i].s;
    }
  }

  const findBuval = () => seats.find((s) => s.senator && /Buval/i.test(s.senator.name || ''));
  const buvalBeforeSeat = DEBUG_MAPPING ? findBuval() : null;
  const buvalBefore = buvalBeforeSeat
    ? {
        tier: buvalBeforeSeat.tier,
        col: seatColumnIndex(buvalBeforeSeat.angle, columnAngles),
        idealX: Number(buvalBeforeSeat.senator.idealX) || 0,
        idealY: Number(buvalBeforeSeat.senator.idealY) || 0,
      }
    : null;

  const crossingsBefore = DEBUG_MAPPING ? countIdealXAngleCrossings(seats) : null;
  const filledBefore = DEBUG_MAPPING ? seats.filter((s) => s.senator) : [];
  const corrBefore = DEBUG_MAPPING
    ? pearsonCorr(
        filledBefore.map((s) => Number(s.senator.idealX) || 0),
        filledBefore.map((s) => s.angle)
      )
    : null;

  const relax = relaxYOutliers(seats, senators.slice(0, n), columnAngles);

  const buvalAfterSeat = DEBUG_MAPPING ? findBuval() : null;
  const buvalAfter = buvalAfterSeat
    ? {
        tier: buvalAfterSeat.tier,
        col: seatColumnIndex(buvalAfterSeat.angle, columnAngles),
        idealX: Number(buvalAfterSeat.senator.idealX) || 0,
        idealY: Number(buvalAfterSeat.senator.idealY) || 0,
      }
    : null;

  const filled = DEBUG_MAPPING ? seats.filter((s) => s.senator) : [];
  const corrAfter = DEBUG_MAPPING
    ? pearsonCorr(
        filled.map((s) => Number(s.senator.idealX) || 0),
        filled.map((s) => s.angle)
      )
    : null;
  const crossingsAfter = DEBUG_MAPPING ? countIdealXAngleCrossings(seats) : null;

  const neighborIdealX = [];
  if (DEBUG_MAPPING && buvalAfterSeat) {
    const col = buvalAfter.col;
    for (const s of seats) {
      if (!s.senator) continue;
      const c = seatColumnIndex(s.angle, columnAngles);
      if (Math.abs(c - col) <= 1 && Math.abs(s.tier - buvalAfter.tier) <= 1) {
        neighborIdealX.push({
          name: s.senator.name,
          tier: s.tier,
          col: c,
          idealX: Number(s.senator.idealX) || 0,
          idealY: Number(s.senator.idealY) || 0,
        });
      }
    }
    neighborIdealX.sort((a, b) => a.col - b.col || a.tier - b.tier);
  }

  return {
    swaps: relax.swaps,
    log: relax.log,
    targetTier: relax.targetTier,
    buvalBefore,
    buvalAfter,
    neighborIdealX,
    corrBefore,
    corrAfter,
    crossingsBefore,
    crossingsAfter,
  };
}

function parsePartyColor(hex, fallback = DEFAULT_SEAT_COLOR) {
  const c = new THREE.Color();
  try {
    if (typeof hex === 'string' && hex.trim()) {
      c.set(hex);
      return c;
    }
  } catch {
    /* ignore */
  }
  return fallback.clone();
}

function applySeatColors(seats, colorMeshes, { hoverIdx = -1, selectedIdx = -1 } = {}) {
  const tmp = new THREE.Color();
  const hoverBoost = new THREE.Color(0xffffff);
  const hsl = { h: 0, s: 0, l: 0 };
  for (let i = 0; i < seats.length; i++) {
    const sen = seats[i].senator;
    if (sen) {
      tmp.copy(parsePartyColor(sen.partyColor));
      tmp.getHSL(hsl);
      /* Les teintes restent velours, mais chaque groupe reste identifiable à distance. */
      tmp.setHSL(
        hsl.h,
        THREE.MathUtils.clamp(hsl.s * 1.02, 0.55, 0.92),
        THREE.MathUtils.clamp(hsl.l * 0.92, 0.38, 0.6)
      );
    } else tmp.copy(DEFAULT_SEAT_COLOR);
    if (i === selectedIdx) {
      tmp.lerp(hoverBoost, 0.45);
    } else if (i === hoverIdx) {
      tmp.lerp(hoverBoost, 0.32);
    }
    for (const mesh of colorMeshes) mesh.setColorAt(i, tmp);
  }
  for (const mesh of colorMeshes) {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}

/* ── Interaction : survol + panneau ─────────────────────────── */
const tooltipEl = document.getElementById('tooltip');
const tooltipName = tooltipEl.querySelector('.tooltip-name');
const tooltipParty = tooltipEl.querySelector('.tooltip-party');
const panelEl = document.getElementById('panel');
const sceneCoachEl = document.getElementById('scene-coach');
let sceneCoachShowTimer = 0;
let sceneCoachHideTimer = 0;

function hideSceneCoach() {
  window.clearTimeout(sceneCoachShowTimer);
  window.clearTimeout(sceneCoachHideTimer);
  if (!sceneCoachEl || sceneCoachEl.hidden) return;
  sceneCoachEl.classList.remove('is-visible');
  sceneCoachEl.classList.add('is-leaving');
  window.setTimeout(() => {
    sceneCoachEl.hidden = true;
    sceneCoachEl.classList.remove('is-leaving');
  }, 360);
}

function showSceneCoach(delay = 450) {
  if (!sceneCoachEl || BACKGROUND_MODE) return;
  window.clearTimeout(sceneCoachShowTimer);
  window.clearTimeout(sceneCoachHideTimer);
  sceneCoachShowTimer = window.setTimeout(() => {
    sceneCoachEl.hidden = false;
    sceneCoachEl.classList.remove('is-leaving');
    requestAnimationFrame(() => sceneCoachEl.classList.add('is-visible'));
    sceneCoachHideTimer = window.setTimeout(hideSceneCoach, 15000);
  }, delay);
}
const panelName = document.getElementById('panel-name');
const panelParty = document.getElementById('panel-party');
const panelIdentityMeta = document.getElementById('panel-identity-meta');
const panelAvatar = document.getElementById('panel-avatar');
const panelMetrics = document.getElementById('panel-metrics');
const panelFields = document.getElementById('panel-fields');
const panelClose = document.getElementById('panel-close');
const idealScatter = document.getElementById('ideal-scatter');
const idealLegend = document.getElementById('ideal-legend');

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredSeat = -1;
let selectedSeat = -1;
let pointerDown = null;

function formatPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString(localeTag(), { maximumFractionDigits: 1 })} %`;
}

function formatNum(v, digits = 3) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(localeTag(), { maximumFractionDigits: digits });
}

function partyDisplay(senator) {
  if (senator.partyLabel) return senator.partyLabel;
  if (senator.groupe_code && PARTY_SHORT[senator.groupe_code]) return PARTY_SHORT[senator.groupe_code];
  if (senator.party && PARTY_SHORT[senator.party]) return PARTY_SHORT[senator.party];
  return senator.party || t('panel.partyUnknown');
}

/** Rang compétition (1 = extrême selon ascending) + % strictement en-dessous / au-dessus. */
function rankStats(values, value, { ascending = true } = {}) {
  const vals = values.map(Number).filter(Number.isFinite);
  const v = Number(value);
  if (!Number.isFinite(v) || !vals.length) return null;
  const better = ascending ? (x) => x < v : (x) => x > v;
  const worse = ascending ? (x) => x > v : (x) => x < v;
  const lessExtreme = vals.filter(better).length;
  const moreExtreme = vals.filter(worse).length;
  const rank = lessExtreme + 1;
  const pctBelow = Math.round((lessExtreme / vals.length) * 100);
  const pctAbove = Math.round((moreExtreme / vals.length) * 100);
  return {
    rank,
    total: vals.length,
    /** % de sénateurs avec une valeur plus faible (si ascending) / plus élevée (si !ascending) */
    pctMoreExtreme: pctAbove,
    pctLessExtreme: pctBelow,
  };
}

function finiteVals(list, getter) {
  return list.map(getter).map(Number).filter(Number.isFinite);
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(nums, p) {
  const s = nums.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const pos = Math.max(0, Math.min(1, p)) * (s.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Percentile empirique à mi-rang, plus stable en présence d'ex æquo. */
function percentilePosition(values, value) {
  const vals = values.map(Number).filter(Number.isFinite);
  const v = Number(value);
  if (!vals.length || !Number.isFinite(v)) return null;
  const lower = vals.filter((x) => x < v).length;
  const equal = vals.filter((x) => x === v).length;
  return Math.round(((lower + equal * 0.5) / vals.length) * 100);
}

function hypot2(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

/** Échelle robuste d'un axe Ideal : IQR ramené à un écart-type normal. */
function robustIdealScale(values) {
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const robust = q1 != null && q3 != null ? (q3 - q1) / 1.349 : 0;
  if (Number.isFinite(robust) && robust > 1e-6) return robust;
  const vals = values.map(Number).filter(Number.isFinite);
  const mean = vals.reduce((sum, v) => sum + v, 0) / Math.max(vals.length, 1);
  const variance = vals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(vals.length, 1);
  return Math.sqrt(variance) || 1;
}

function idealAxisScales() {
  return {
    x: robustIdealScale(allSenators.map((s) => s.idealX)),
    y: robustIdealScale(allSenators.map((s) => s.idealY)),
  };
}

/** Position Ideal « attendue » pour un siège = médiane Ideal des k voisins géométriques. */
function seatNeighborIdealTarget(seatIdx, k = 8) {
  const seats = seatSystem.seats;
  const seat = seats[seatIdx];
  if (!seat) return null;
  const neighbors = seats
    .map((s, i) => {
      if (i === seatIdx || !s.senator) return null;
      const dx = s.x - seat.x;
      const dz = s.z - seat.z;
      return {
        dist2: dx * dx + dz * dz,
        x: Number(s.senator.idealX) || 0,
        y: Number(s.senator.idealY) || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dist2 - b.dist2)
    .slice(0, k);
  if (neighbors.length < 3) return null;
  const tx = median(neighbors.map((n) => n.x));
  const ty = median(neighbors.map((n) => n.y));
  if (tx == null || ty == null) return null;
  return { idealX: tx, idealY: ty, n: neighbors.length };
}

function seatGapForIndex(seatIdx) {
  const seat = seatSystem.seats[seatIdx];
  const sen = seat?.senator;
  if (!sen) return null;
  const target = seatNeighborIdealTarget(seatIdx);
  if (!target) return null;
  const scales = idealAxisScales();
  const dx = (Number(sen.idealX) || 0) - target.idealX;
  const dy = (Number(sen.idealY) || 0) - target.idealY;
  /* Les deux axes n'ont pas la même dispersion. Les standardiser évite que
     l'axe X, naturellement plus étalé, domine artificiellement la distance. */
  const gap = hypot2(dx / scales.x, dy / scales.y);
  return { gap, target, dx, dy, scales };
}

function allSeatGaps() {
  const gaps = [];
  for (let i = 0; i < seatSystem.seats.length; i++) {
    const g = seatGapForIndex(i);
    if (g) gaps.push(g.gap);
  }
  return gaps;
}

/* ── Mini-graphiques SVG (fiche sénateur) ───────────────────── */
function svgEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAxisValue(value, digits = 1, suffix = '') {
  return `${formatNum(value, digits)}${suffix}`;
}

/**
 * Résumé robuste d'une distribution : moustaches P5–P95, boîte Q1–Q3,
 * médiane Sénat, médiane du groupe et position du sénateur.
 */
function buildBoxPlotSVG(
  values,
  marker,
  { groupValues = [], label = 'indicateur', digits = 1, suffix = '' } = {}
) {
  const vals = values.map(Number).filter(Number.isFinite);
  const m = Number(marker);
  if (vals.length < 4 || !Number.isFinite(m)) return '';

  const p05 = quantile(vals, 0.05);
  const q1 = quantile(vals, 0.25);
  const med = quantile(vals, 0.5);
  const q3 = quantile(vals, 0.75);
  const p95 = quantile(vals, 0.95);
  if (![p05, q1, med, q3, p95].every(Number.isFinite)) return '';

  const width = 320;
  const height = 84;
  const left = 16;
  const right = width - 16;
  const span = Math.max(p95 - p05, Math.abs(p95 || 1) * 0.001, 0.001);
  const xOf = (v) => left + ((v - p05) / span) * (right - left);
  const clampX = (v) => Math.max(left, Math.min(right, xOf(v)));
  const x1 = clampX(q1);
  const xm = clampX(med);
  const x3 = clampX(q3);
  const xs = clampX(m);
  const groupMedian = median(groupValues.map(Number).filter(Number.isFinite));
  const xg = groupMedian == null ? null : clampX(groupMedian);
  const clippedLow = m < p05;
  const clippedHigh = m > p95;

  const markerShape = clippedLow
    ? `<path d="M ${left + 1} 23 L ${left + 9} 18 L ${left + 9} 28 Z" class="boxplot-selected"/>`
    : clippedHigh
      ? `<path d="M ${right - 1} 23 L ${right - 9} 18 L ${right - 9} 28 Z" class="boxplot-selected"/>`
      : `<circle cx="${xs.toFixed(1)}" cy="23" r="5" class="boxplot-selected"/>`;

  const title = t('chart.distribution', { label });
  const desc = tForChamber(chamberId, 'chart.distributionDesc', {
    value: formatAxisValue(m, digits, suffix),
  });

  return `<div class="metric-distribution">
    <svg class="metric-chart metric-boxplot" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgEscape(desc)}">
      <title>${svgEscape(title)}</title>
      <desc>${svgEscape(desc)}</desc>
      <line x1="${left}" y1="40" x2="${right}" y2="40" class="boxplot-whisker"/>
      <line x1="${left}" y1="34" x2="${left}" y2="46" class="boxplot-whisker"/>
      <line x1="${right}" y1="34" x2="${right}" y2="46" class="boxplot-whisker"/>
      <rect x="${x1.toFixed(1)}" y="31" width="${Math.max(2, x3 - x1).toFixed(1)}" height="18" rx="5" class="boxplot-iqr"/>
      <line x1="${xm.toFixed(1)}" y1="29" x2="${xm.toFixed(1)}" y2="51" class="boxplot-median"/>
      <line x1="${xs.toFixed(1)}" y1="23" x2="${xs.toFixed(1)}" y2="40" class="boxplot-selected-line"/>
      ${markerShape}
      ${xg == null ? '' : `<path d="M ${xg.toFixed(1)} 55 l 4 4 l -4 4 l -4 -4 Z" class="boxplot-group"/>`}
      <text x="${left}" y="78" text-anchor="start" class="boxplot-axis">P5 · ${svgEscape(formatAxisValue(p05, digits, suffix))}</text>
      <text x="${right}" y="78" text-anchor="end" class="boxplot-axis">P95 · ${svgEscape(formatAxisValue(p95, digits, suffix))}</text>
    </svg>
    <div class="metric-legend" aria-hidden="true">
      <span><i class="legend-selected"></i>${tForChamber(chamberId, 'chart.senator')}</span>
      <span><i class="legend-senate"></i>${tForChamber(chamberId, 'chart.senateMedian')}</span>
      ${xg == null ? '' : `<span><i class="legend-group"></i>${t('chart.groupMedian')}</span>`}
    </div>
  </div>`;
}

function metricCardHTML({ label, valueHtml, percentile, assessment, readout, hint, chartHtml }) {
  return `<article class="metric-card">
    <div class="metric-card-head">
      <span class="metric-label">${svgEscape(label)}</span>
      ${percentile == null ? '' : `<span class="metric-percentile">P${Math.max(0, Math.min(100, percentile))}</span>`}
    </div>
    <div class="metric-primary">
      <span class="metric-value">${valueHtml}</span>
      ${assessment ? `<span class="metric-assessment">${svgEscape(assessment)}</span>` : ''}
    </div>
    <p class="metric-readout">${readout}</p>
    ${chartHtml || ''}
    ${hint ? `<p class="metric-hint">${hint}</p>` : ''}
  </article>`;
}

function buildSenatorComparisons(senator, seatIdx) {
  const party = partyKey(senator);
  const peers = allSenators.filter((s) => partyKey(s) === party);
  const partyLabel = partyDisplay(senator);

  const abstAll = finiteVals(allSenators, (s) => s.abstentionPct);
  const abstParty = finiteVals(peers, (s) => s.abstentionPct);
  const abst = Number(senator.abstentionPct);
  const abstRank = rankStats(abstAll, abst, { ascending: true });
  const abstPartyRank = rankStats(abstParty, abst, { ascending: true });

  const distAll = finiteVals(allSenators, (s) => s.distToGroup);
  const distParty = finiteVals(peers, (s) => s.distToGroup);
  const dist = Number(senator.distToGroup);
  const distRank = rankStats(distAll, dist, { ascending: true });
  const distPartyRank = rankStats(distParty, dist, { ascending: true });

  const loyaltyRaw = senator.groupLoyaltyPct;
  const loyalty = Number(loyaltyRaw);
  const hasLoyalty = Number.isFinite(loyalty);
  const loyAll = finiteVals(allSenators, (s) => s.groupLoyaltyPct);
  const loyParty = finiteVals(peers, (s) => s.groupLoyaltyPct);
  const loyRank = hasLoyalty ? rankStats(loyAll, loyalty, { ascending: false }) : null;
  const loyPartyRank = hasLoyalty ? rankStats(loyParty, loyalty, { ascending: false }) : null;

  const seatGapInfo = seatIdx >= 0 ? seatGapForIndex(seatIdx) : null;
  const allGaps = seatGapInfo ? allSeatGaps() : [];
  const gapRank = seatGapInfo ? rankStats(allGaps, seatGapInfo.gap, { ascending: true }) : null;

  return {
    party,
    partyLabel,
    abst,
    abstRank,
    abstPartyRank,
    abstAll,
    abstParty,
    dist,
    distRank,
    distPartyRank,
    distAll,
    distParty,
    loyalty,
    hasLoyalty,
    loyRank,
    loyPartyRank,
    loyAll,
    loyParty,
    seatGapInfo,
    gapRank,
    allGaps,
  };
}

function refreshSeatColors() {
  applySeatColors(seatSystem.seats, seatSystem.colorMeshes, {
    hoverIdx: hoveredSeat,
    selectedIdx: selectedSeat,
  });
}

function positionTooltip(clientX, clientY) {
  const pad = 14;
  const tw = tooltipEl.offsetWidth || 160;
  const th = tooltipEl.offsetHeight || 56;
  let left = clientX + pad;
  let top = clientY + pad;
  if (left + tw > window.innerWidth - 8) left = clientX - tw - pad;
  if (top + th > window.innerHeight - 8) top = clientY - th - pad;
  left = Math.max(8, left);
  top = Math.max(8, top);
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.style.transform = 'none';
}

function showTooltip(senator, clientX, clientY) {
  tooltipName.textContent = senator.name || t('panel.unnamed');
  tooltipParty.textContent = partyDisplay(senator);
  tooltipParty.style.color = senator.partyColor || '#c9a27a';
  tooltipEl.hidden = false;
  positionTooltip(clientX, clientY);
}

function hideTooltip() {
  tooltipEl.hidden = true;
}

function drawIdealScatter(selected) {
  drawIdealScatterCore(idealScatter, allSenators, {
    selected,
    groupColors,
    legendEl: idealLegend,
  });
}

function openPanel(senator) {
  hideSceneCoach();
  panelName.textContent = senator.name || t('panel.unnamed');
  panelParty.textContent = partyDisplay(senator);
  panelParty.style.color = senator.partyColor || '#c9a27a';

  if (panelAvatar) {
    if (senator.avatar) {
      panelAvatar.hidden = false;
      panelAvatar.alt = senator.name || '';
      panelAvatar.src = senator.avatar;
      panelAvatar.onerror = () => {
        panelAvatar.hidden = true;
        panelAvatar.removeAttribute('src');
      };
    } else {
      panelAvatar.hidden = true;
      panelAvatar.removeAttribute('src');
    }
  }

  const coords = `Ideal X ${formatNum(senator.idealX)} · Y ${formatNum(senator.idealY)}`;
  const circ = senator.circonscription ? String(senator.circonscription) : '';
  if (panelIdentityMeta) {
    panelIdentityMeta.textContent = [circ, coords].filter(Boolean).join(' · ');
  }

  const cmp = buildSenatorComparisons(senator, selectedSeat);
  const cards = [];

  cards.push(`<div class="panel-metrics-heading">
    <p class="panel-metrics-title">${t('panel.comparisons')}</p>
    <p>${tForChamber(chamberId, 'panel.comparisonSub')}</p>
  </div>`);

  /* Abstention */
  if (Number.isFinite(cmp.abst) && cmp.abstRank) {
    const r = cmp.abstRank;
    const pr = cmp.abstPartyRank;
    const p = percentilePosition(cmp.abstAll, cmp.abst);
    const groupMed = median(cmp.abstParty);
    const assessment = p <= 25
      ? t('metric.abstentionLow')
      : p < 75
        ? t('metric.typical')
        : t('metric.abstentionHigh');
    const groupBit = pr && groupMed != null
      ? t('metric.groupMedianBit', {
          party: svgEscape(cmp.partyLabel),
          value: formatPct(groupMed),
        })
      : '';
    cards.push(
      metricCardHTML({
        label: t('metric.abstention'),
        valueHtml: svgEscape(formatPct(cmp.abst)),
        percentile: p,
        assessment,
        readout: tForChamber(chamberId, 'metric.abstentionReadout', {
          pct: r.pctLessExtreme,
          groupBit,
        }),
        chartHtml: buildBoxPlotSVG(cmp.abstAll, cmp.abst, {
          groupValues: cmp.abstParty,
          label: t('metric.abstention').toLocaleLowerCase(localeTag()),
          digits: 1,
          suffix: ' %',
        }),
        hint: tForChamber(chamberId, 'metric.abstentionHint'),
      })
    );
  }

  /* Distance au groupe */
  if (Number.isFinite(cmp.dist) && cmp.distRank) {
    const r = cmp.distRank;
    const pr = cmp.distPartyRank;
    const p = percentilePosition(cmp.distAll, cmp.dist);
    const groupMed = median(cmp.distParty);
    const assessment = p <= 25
      ? t('metric.distNear')
      : p < 75
        ? t('metric.distTypical')
        : t('metric.distFar');
    const groupBit = pr && groupMed != null
      ? t('metric.groupMedianBit', {
          party: svgEscape(cmp.partyLabel),
          value: formatNum(groupMed, 3),
        })
      : '';
    cards.push(
      metricCardHTML({
        label: t('metric.distGroup'),
        valueHtml: svgEscape(formatNum(cmp.dist, 3)),
        percentile: p,
        assessment,
        readout: tForChamber(chamberId, 'metric.distReadout', {
          pct: r.pctLessExtreme,
          groupBit,
        }),
        chartHtml: buildBoxPlotSVG(cmp.distAll, cmp.dist, {
          groupValues: cmp.distParty,
          label: t('metric.distGroup').toLocaleLowerCase(localeTag()),
          digits: 3,
        }),
        hint: tForChamber(chamberId, 'metric.distHint'),
      })
    );
  }

  /* Fidélité au groupe */
  if (cmp.hasLoyalty && cmp.loyRank) {
    const r = cmp.loyRank;
    const pr = cmp.loyPartyRank;
    const p = percentilePosition(cmp.loyAll, cmp.loyalty);
    const groupMed = median(cmp.loyParty);
    const assessment = p <= 25
      ? t('metric.loyaltyLow')
      : p < 75
        ? t('metric.loyaltyTypical')
        : t('metric.loyaltyHigh');
    const groupBit = pr && groupMed != null
      ? t('metric.groupMedianBit', {
          party: svgEscape(cmp.partyLabel),
          value: formatPct(groupMed),
        })
      : '';
    cards.push(
      metricCardHTML({
        label: t('metric.loyalty'),
        valueHtml: svgEscape(formatPct(cmp.loyalty)),
        percentile: p,
        assessment,
        readout: tForChamber(chamberId, 'metric.loyaltyReadout', {
          pct: r.pctMoreExtreme,
          groupBit,
        }),
        chartHtml: buildBoxPlotSVG(cmp.loyAll, cmp.loyalty, {
          groupValues: cmp.loyParty,
          label: t('metric.loyalty').toLocaleLowerCase(localeTag()),
          digits: 1,
          suffix: ' %',
        }),
        hint: t('metric.loyaltyHint'),
      })
    );
  } else {
    cards.push(
      metricCardHTML({
        label: t('metric.loyalty'),
        valueHtml: '—',
        readout: tForChamber(chamberId, 'metric.loyaltyMissing'),
        hint: t('metric.loyaltyMissingHint'),
      })
    );
  }

  /* Écart au siège */
  if (cmp.seatGapInfo && cmp.gapRank) {
    const { gap, target } = cmp.seatGapInfo;
    const r = cmp.gapRank;
    const p = percentilePosition(cmp.allGaps, gap);
    const assessment = p <= 25
      ? t('metric.seatVeryAligned')
      : p < 75
        ? t('metric.seatTypical')
        : p < 90
          ? t('metric.seatMarked')
          : t('metric.seatVeryMarked');
    cards.push(
      metricCardHTML({
        label: t('metric.seatGap'),
        valueHtml: `${svgEscape(formatNum(gap, 2))}<small>${t('metric.seatValueUnit')}</small>`,
        percentile: p,
        assessment,
        readout: t('metric.seatGapReadout', {
          pct: r.pctLessExtreme,
        }),
        chartHtml: buildBoxPlotSVG(cmp.allGaps, gap, {
          label: t('metric.seatGap').toLocaleLowerCase(localeTag()),
          digits: 2,
        }),
        hint: tForChamber(chamberId, 'metric.seatGapHint', { n: target.n }),
      })
    );
  }

  if (panelMetrics) panelMetrics.innerHTML = cards.join('');

  const rows = [];
  if (senator.circonscription) {
    rows.push([t('field.circonscription'), svgEscape(String(senator.circonscription))]);
  }
  if (senator.siege != null) rows.push([t('field.officialSeat'), String(senator.siege)]);
  else if (senator.siegeOfficiel != null) rows.push([t('field.officialSeat'), String(senator.siegeOfficiel)]);
  if (senator.idealRankLeftToRight != null) {
    rows.push([t('field.idealRank'), String(senator.idealRankLeftToRight)]);
  }
  if (senator.idealImputed === true) rows.push([t('field.idealImputed'), t('field.idealImputedYes')]);
  if (senator.nonVotingPct != null) rows.push([t('field.nonVoting'), formatPct(senator.nonVotingPct)]);
  if (senator.url) {
    if (chamberId === 'assemblee' || /assemblee-nationale/i.test(senator.url)) {
      rows.push([
        t('field.assembleePage'),
        `<a href="${svgEscape(senator.url)}" target="_blank" rel="noopener noreferrer">assemblee-nationale.fr</a>`,
      ]);
    } else {
      rows.push([
        t('field.senatePage'),
        `<a href="${svgEscape(senator.url)}" target="_blank" rel="noopener noreferrer">senat.fr</a>`,
      ]);
    }
  }

  panelFields.innerHTML = rows
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
  panelEl.hidden = false;
  drawIdealScatter(senator);
  requestAnimationFrame(() => drawIdealScatter(senator));
}

function closePanel() {
  panelEl.hidden = true;
  selectedSeat = -1;
  refreshSeatColors();
}

/** Resolve seat index from current mapping (consume assignment only). */
function seatIndexForSenator(senator) {
  if (!senator || !seatSystem?.seats) return -1;
  const seats = seatSystem.seats;
  for (let i = 0; i < seats.length; i++) {
    const s = seats[i].senator;
    if (!s) continue;
    if (s === senator) return i;
    if (senator.id && s.id && senator.id === s.id) return i;
    if (senator.matricule && s.matricule && senator.matricule === s.matricule) return i;
  }
  return -1;
}

/** Soft camera nudge toward a seat without leaving orbit limits. */
function focusSeatInView(seatIdx) {
  const seat = seatSystem.seats[seatIdx];
  if (!seat) return;
  setAutoOrbit(false);
  autoOrbitSettleUntil = 0;
  controls.enabled = true;

  const seatPos = new THREE.Vector3(seat.x, seat.y + 0.4, seat.z);
  const target = new THREE.Vector3(
    seat.x * 0.35,
    Math.max(DEFAULT_TARGET.y, seat.y * 0.45 + 1.2),
    seat.z * 0.35 + DEFAULT_TARGET.z * 0.55
  );

  const camDir = camera.position.clone().sub(controls.target).normalize();
  const dist = THREE.MathUtils.clamp(
    camera.position.distanceTo(controls.target),
    controls.minDistance,
    controls.maxDistance
  );
  const nextCam = target.clone().add(camDir.multiplyScalar(dist));
  /* Bias slightly toward the seat so it sits nearer the frame center */
  nextCam.lerp(seatPos.clone().add(new THREE.Vector3(0, 8.5, -4)), 0.18);
  nextCam.y = THREE.MathUtils.clamp(nextCam.y, 9.5, 15.5);
  nextCam.x = THREE.MathUtils.clamp(nextCam.x, -8, 8);
  nextCam.z = THREE.MathUtils.clamp(nextCam.z, -12, 2);

  controls.target.copy(target);
  camera.position.copy(nextCam);
  controls.update();
}

function selectSenatorFromSearch(senator) {
  if (!senator) return;
  const seatIdx = seatIndexForSenator(senator);
  if (seatIdx >= 0) {
    selectedSeat = seatIdx;
    refreshSeatColors();
    focusSeatInView(seatIdx);
  }
  openPanel(senator);
}

function seatFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.params.Mesh = raycaster.params.Mesh || {};
  const hits = raycaster.intersectObject(seatSystem.pickMesh, false);
  if (!hits.length) return -1;
  const id = hits[0].instanceId;
  return Number.isInteger(id) ? id : -1;
}

function setHoveredSeat(idx, clientX, clientY) {
  if (idx !== hoveredSeat) {
    hoveredSeat = idx;
    refreshSeatColors();
  }
  const sen = idx >= 0 ? seatSystem.seats[idx]?.senator : null;
  if (sen) {
    canvas.style.cursor = 'pointer';
    showTooltip(sen, clientX, clientY);
  } else {
    canvas.style.cursor = 'default';
    hideTooltip();
  }
}

function onPointerMove(event) {
  const idx = seatFromPointer(event);
  if (idx === hoveredSeat) {
    if (idx >= 0 && seatSystem.seats[idx]?.senator) {
      positionTooltip(event.clientX, event.clientY);
    }
    return;
  }
  setHoveredSeat(idx, event.clientX, event.clientY);
}

function onPointerLeave() {
  if (hoveredSeat !== -1) {
    hoveredSeat = -1;
    refreshSeatColors();
  }
  canvas.style.cursor = 'default';
  hideTooltip();
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  pointerDown = { x: event.clientX, y: event.clientY, seat: seatFromPointer(event) };
});

canvas.addEventListener('pointerup', (event) => {
  if (!pointerDown || event.button !== 0) return;
  const dx = event.clientX - pointerDown.x;
  const dy = event.clientY - pointerDown.y;
  const click = dx * dx + dy * dy < 36;
  const seat = seatFromPointer(event);
  if (click && seat >= 0 && seat === pointerDown.seat) {
    const sen = seatSystem.seats[seat].senator;
    if (sen) {
      selectedSeat = seat;
      refreshSeatColors();
      openPanel(sen);
    }
  }
  pointerDown = null;
});

canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerleave', onPointerLeave);
panelClose.addEventListener('click', closePanel);

/* ── Recherche sénateur (fuzzy) ─────────────────────────────── */
const searchRoot = document.getElementById('senator-search');
const searchInput = document.getElementById('senator-search-input');
const searchResultsEl = document.getElementById('senator-search-results');
let searchMatches = [];
let searchActiveIndex = 0;

function setSearchUiOpen(open) {
  document.body.classList.toggle('search-open', Boolean(open));
}

/* Keep iOS from page-zooming while users interact with search or senator cards. */
for (const surface of [searchRoot, panelEl]) {
  surface?.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  surface?.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });
}

function closeSenatorSearchDropdown() {
  if (!searchResultsEl || searchResultsEl.hidden) {
    setSearchUiOpen(false);
    return false;
  }
  searchResultsEl.hidden = true;
  searchResultsEl.innerHTML = '';
  searchMatches = [];
  searchActiveIndex = 0;
  setSearchUiOpen(false);
  if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
  return true;
}

function renderSenatorSearchResults(matches, query) {
  if (!searchResultsEl || !searchInput) return;
  searchMatches = matches;
  searchActiveIndex = 0;

  if (!query.trim()) {
    closeSenatorSearchDropdown();
    return;
  }

  if (!matches.length) {
    searchResultsEl.innerHTML =
      `<li class="senator-search-empty" role="presentation">${tForChamber(chamberId, 'search.empty')}</li>`;
    searchResultsEl.hidden = false;
    setSearchUiOpen(true);
    searchInput.setAttribute('aria-expanded', 'true');
    return;
  }

  searchResultsEl.innerHTML = matches
    .map((m, i) => {
      const sen = m.senator;
      const party = partyDisplay(sen);
      const circ = sen.circonscription ? String(sen.circonscription) : '';
      const meta = [party, circ].filter(Boolean).join(' · ');
      return `<li role="option" id="senator-search-opt-${i}">
        <button type="button" class="senator-search-item" data-search-index="${i}" aria-selected="${i === 0 ? 'true' : 'false'}">
          <span class="senator-search-item-name">${svgEscape(sen.name || t('search.unnamed'))}</span>
          <span class="senator-search-item-meta">${svgEscape(meta)}</span>
        </button>
      </li>`;
    })
    .join('');
  searchResultsEl.hidden = false;
  setSearchUiOpen(true);
  searchInput.setAttribute('aria-expanded', 'true');
}

function setSearchActiveIndex(next) {
  if (!searchMatches.length || !searchResultsEl) return;
  searchActiveIndex = ((next % searchMatches.length) + searchMatches.length) % searchMatches.length;
  const items = searchResultsEl.querySelectorAll('.senator-search-item');
  items.forEach((el, i) => {
    el.setAttribute('aria-selected', i === searchActiveIndex ? 'true' : 'false');
  });
  items[searchActiveIndex]?.scrollIntoView({ block: 'nearest' });
}

function confirmSenatorSearchSelection(index = searchActiveIndex) {
  const hit = searchMatches[index];
  if (!hit) return;
  selectSenatorFromSearch(hit.senator);
  if (searchInput) {
    searchInput.value = hit.senator.name || '';
    searchInput.blur();
  }
  closeSenatorSearchDropdown();
}

function runSenatorSearch() {
  if (!searchInput) return;
  const q = searchInput.value;
  const matches = searchSenators(allSenators, q, { limit: 8 });
  renderSenatorSearchResults(matches, q);
}

if (searchInput && searchResultsEl && searchRoot) {
  let searchTimer = 0;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSenatorSearch, 80);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      if (searchResultsEl.hidden) runSenatorSearch();
      else setSearchActiveIndex(searchActiveIndex + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      if (!searchResultsEl.hidden) setSearchActiveIndex(searchActiveIndex - 1);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (!searchResultsEl.hidden && searchMatches.length) {
        confirmSenatorSearchSelection(searchActiveIndex);
        e.preventDefault();
      } else {
        runSenatorSearch();
        if (searchMatches.length) {
          confirmSenatorSearchSelection(0);
          e.preventDefault();
        }
      }
    } else if (e.key === 'Escape') {
      if (closeSenatorSearchDropdown()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  });

  searchResultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-search-index]');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-search-index'));
    if (Number.isInteger(idx)) confirmSenatorSearchSelection(idx);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) runSenatorSearch();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!searchRoot.contains(e.target)) closeSenatorSearchDropdown();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (closeSenatorSearchDropdown()) return;
  closePanel();
});

function applySenatorData(senators, meta, source, { quiet = false } = {}) {
  allSenators = senators;
  ensureChamberSeatLayout();
  const seated = selectLegislatorsForSeats(senators, seatSystem.seats.length);
  const mapStats = mapSenatorsToSeats(seated, seatSystem.seats);
  refreshSeatColors();
  const filled = seatSystem.seats.filter((s) => s.senator).length;
  if (!quiet) {
    console.info(`Sièges colorés: ${filled}/${seatSystem.seats.length} (${source})`);
  }

  const hint = document.querySelector('.hint');
  if (hint && source === 'file') {
    const n = meta?.count || meta?.n_senators || filled;
    const nb = meta?.notebook ? ` · ${meta.notebook}` : '';
    hint.dataset.hintMode = chamberId === 'assemblee' ? 'loadedAn' : 'loaded';
    hint.dataset.hintN = String(n);
    hint.dataset.hintNb = nb;
    hint.dataset.hintLabel = meta?.period?.label || meta?.period?.id || '';
    hint.removeAttribute('data-i18n');
    if (chamberId === 'assemblee' && meta?.period) {
      hint.textContent = t('header.hintLoadedAn', {
        n,
        label: meta.period.label || meta.period.id,
        nb: '',
      });
    } else {
      hint.textContent = t('header.hintLoaded', { n, nb });
    }
  }

  if (quiet || !mapStats || !DEBUG_MAPPING) return;

  /* Vérif : monotonie X inter-colonnes ; Y bas < haut ; UMP extrêmes */
  const mean = (arr, fn) => (arr.length ? arr.reduce((a, s) => a + fn(s), 0) / arr.length : NaN);
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : 'n/a');
  const columnAngles = hemicycleColumnAngles();
  const colOf = (s) => seatColumnIndex(s.angle, columnAngles);

  console.info(
    `Relaxation Y: ${mapStats.swaps} swap(s) · corr(idealX,angle) ${fmt(mapStats.corrBefore)} → ${fmt(
      mapStats.corrAfter
    )} · crossings ${mapStats.crossingsBefore} → ${mapStats.crossingsAfter}`
  );

  const byVisual = [...seatSystem.seats]
    .filter((s) => s.senator)
    .sort((a, b) => colOf(a) - colOf(b) || a.tier - b.tier);
  let xViolations = 0;
  for (let i = 1; i < byVisual.length; i++) {
    if (colOf(byVisual[i]) === colOf(byVisual[i - 1])) continue;
    const prev = Number(byVisual[i - 1].senator.idealX) || 0;
    const cur = Number(byVisual[i].senator.idealX) || 0;
    if (cur < prev) xViolations += 1;
  }
  console.info(
    `Monotonie Ideal X (colonnes G→D): ${xViolations} violation(s) (X dominant ; quelques exceptions Y ok)`
  );

  const third = Math.floor(byVisual.length / 3);
  const leftThird = byVisual.slice(0, third);
  const rightThird = byVisual.slice(byVisual.length - third);
  console.info(
    `Prio X (sièges tiers G/D mean idealX): ${fmt(mean(leftThird, (s) => Number(s.senator.idealX) || 0))} ≪ ${fmt(
      mean(rightThird, (s) => Number(s.senator.idealX) || 0)
    )}`
  );

  const byTier = SEATS_PER_TIER.map((_, t) =>
    seatSystem.seats.filter((s) => s.tier === t && s.senator)
  );
  const tierMeansY = byTier.map((row) => mean(row, (s) => Number(s.senator.idealY) || 0));
  console.info(
    `Prio Y (mean idealY / tier 0→${SEATS_PER_TIER.length - 1}): ${tierMeansY.map(fmt).join(' · ')}`
  );

  const leftSeats = seatSystem.seats.filter((s) => s.senator && Number(s.senator.idealX) < -0.3);
  const rightSeats = seatSystem.seats.filter((s) => s.senator && Number(s.senator.idealX) > 0.2);
  const rdpiSeats = seatSystem.seats.filter(
    (s) => s.senator && (s.senator.party === 'LREM' || /RDPI/i.test(s.senator.partyLabel || ''))
  );
  const crcSeats = seatSystem.seats.filter((s) => s.senator && s.senator.party === 'CRC');
  const umpSeats = seatSystem.seats.filter((s) => s.senator && s.senator.party === 'UMP');
  console.info(
    `Orient. X: CRC meanAngle=${fmt(mean(crcSeats, (s) => s.angle))} · UMP meanAngle=${fmt(mean(umpSeats, (s) => s.angle))} · ` +
      `gauche ideal meanWorldX=${fmt(mean(leftSeats, (s) => s.x))} · droite ideal meanWorldX=${fmt(mean(rightSeats, (s) => s.x))}`
  );
  console.info(
    `Orient. Y: RDPI meanTier=${fmt(mean(rdpiSeats, (s) => s.tier))} / max=${SEATS_PER_TIER.length - 1}`
  );
}

loadChamberData().then(() => {
  showSceneCoach();
}).catch((err) => {
  console.warn('loadChamberData failed', err);
});

/* Debug / smoke-test helpers */
window.__hemicycle = {
  chamber: () => chamberId,
  period: () => currentPeriodId,
  seatCount: () => seatSystem.seats.length,
  filledCount: () => seatSystem.seats.filter((s) => s.senator).length,
  seats: () => seatSystem.seats,
  openSeat: (i) => {
    const sen = seatSystem.seats[i]?.senator;
    if (!sen) return false;
    selectedSeat = i;
    refreshSeatColors();
    openPanel(sen);
    return true;
  },
  search: (q) => searchSenators(allSenators, q, { limit: 8 }),
  selectSenator: (senator) => {
    selectSenatorFromSearch(senator);
    return true;
  },
  pick: (clientX, clientY) => seatFromPointer({ clientX, clientY }),
  senators: () => allSenators,
  mappingCheck: () => {
    const seats = seatSystem.seats;
    const byParty = {};
    for (const seat of seats) {
      if (!seat.senator) continue;
      const p = seat.senator.party;
      if (!byParty[p]) byParty[p] = { n: 0, x: 0, tier: 0 };
      byParty[p].n += 1;
      byParty[p].x += seat.x;
      byParty[p].tier += seat.tier;
    }
    for (const p of Object.keys(byParty)) {
      byParty[p].x /= byParty[p].n;
      byParty[p].tier /= byParty[p].n;
    }
    const left = seats.filter((s) => s.senator && Number(s.senator.idealX) < -0.3);
    const right = seats.filter((s) => s.senator && Number(s.senator.idealX) > 0.2);
    const rdpi = seats.filter(
      (s) => s.senator && (s.senator.party === 'LREM' || /RDPI/i.test(s.senator.partyLabel || ''))
    );
    const avg = (arr, fn) => arr.reduce((a, s) => a + fn(s), 0) / (arr.length || 1);
    return {
      leftMeanWorldX: avg(left, (s) => s.x),
      rightMeanWorldX: avg(right, (s) => s.x),
      rdpiMeanTier: avg(rdpi, (s) => s.tier),
      rdpiCount: rdpi.length,
      byParty,
    };
  },
};

/* ── UI caméra ──────────────────────────────────────────────── */
const btnReset = document.getElementById('btn-reset');
const btnOrbit = document.getElementById('btn-orbit');

btnReset.addEventListener('click', () => {
  setAutoOrbit(false);
  autoOrbitSettleUntil = 0;
  controls.enabled = true;
  camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);
  controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
  controls.update();
});

btnOrbit.addEventListener('click', () => {
  setAutoOrbit(!autoOrbit);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastBackgroundRender = 0;
let lastMobileRender = 0;

function animate(frameTime = performance.now()) {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  if (BACKGROUND_MODE && frameTime - lastBackgroundRender < 33) return;
  if (BACKGROUND_MODE) lastBackgroundRender = frameTime;
  if (IS_MOBILE_DEVICE && frameTime - lastMobileRender < 33) return;
  if (IS_MOBILE_DEVICE) lastMobileRender = frameTime;
  const now = performance.now();
  if (autoOrbit) {
    senatorOrbitPose(now, _orbitDesiredCam, _orbitDesiredLook);
    const u = Math.min(1, (now - autoOrbitStartedAt) / SENATOR_ORBIT.easeInMs);
    const e = u * u * (3 - 2 * u);
    _orbitCam.lerpVectors(_orbitFromCam, _orbitDesiredCam, e);
    _orbitLook.lerpVectors(_orbitFromLook, _orbitDesiredLook, e);
    camera.position.copy(_orbitCam);
    camera.lookAt(_orbitLook);
    controls.target.copy(_orbitLook);
  } else if (now < autoOrbitSettleUntil) {
    const u = 1 - (autoOrbitSettleUntil - now) / SENATOR_ORBIT.settleMs;
    const e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(_orbitSettleFrom, _orbitSettleTo, e);
    camera.lookAt(controls.target);
  } else {
    if (autoOrbitSettleUntil) {
      camera.position.copy(_orbitSettleTo);
      controls.enabled = true;
      controls.update();
      autoOrbitSettleUntil = 0;
    }
    controls.update();
  }
  updateRoofTransparency();
  renderer.render(scene, camera);
}

animate();

/* ── Intro overlay (first visit) ────────────────────────────── */
let unmountIntroScatter = null;
let introScatterRevealTimer = 0;

function paintIntroIdeal(senators, colors = {}) {
  const intro = document.getElementById('intro');
  const canvas = document.getElementById('intro-ideal-scatter');
  if (!intro || !canvas || !senators?.length) return;
  if (intro.classList.contains('is-hidden') || intro.classList.contains('is-leaving')) return;
  const frame = canvas.closest('.intro-ideal');
  frame?.classList.add('is-loading');
  frame?.classList.remove('is-ready');
  unmountIntroScatter?.();
  unmountIntroScatter = mountIdealScatter(canvas, senators, {
    compact: true,
    aspect: 0.58,
    groupColors: colors,
  });

  const reveal = () => {
    if (intro.classList.contains('is-hidden') || intro.classList.contains('is-leaving')) return;
    /* Repeint après la mise en page : indispensable quand le panneau vient
       d'être révélé sur mobile et avait encore une largeur nulle. */
    drawIdealScatterCore(canvas, senators, {
      compact: true,
      aspect: 0.58,
      groupColors: colors,
    });
    frame?.classList.remove('is-loading');
    frame?.classList.add('is-ready');
  };
  requestAnimationFrame(() => requestAnimationFrame(reveal));
  window.clearTimeout(introScatterRevealTimer);
  introScatterRevealTimer = window.setTimeout(reveal, 450);
}

(function setupIntro() {
  const intro = document.getElementById('intro');
  if (!intro) return;

  if (BACKGROUND_MODE) {
    intro.classList.add('is-hidden');
    intro.setAttribute('aria-hidden', 'true');
    return;
  }

  const enterBtn = document.getElementById('intro-enter');
  const skipBtn = document.getElementById('intro-skip');
  let introAutoDismissTimer = 0;

  const dismiss = () => {
    if (intro.classList.contains('is-hidden') || intro.classList.contains('is-leaving')) return;
    window.clearTimeout(introAutoDismissTimer);
    unmountIntroScatter?.();
    unmountIntroScatter = null;
    window.clearTimeout(introScatterRevealTimer);
    intro.classList.add('is-leaving');
    const done = () => {
      intro.classList.add('is-hidden');
      intro.setAttribute('aria-hidden', 'true');
    };
    intro.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 600);
    showSceneCoach(520);
  };

  enterBtn?.addEventListener('click', dismiss);
  skipBtn?.addEventListener('click', dismiss);
  introAutoDismissTimer = window.setTimeout(dismiss, 15000);
  document.addEventListener('keydown', (e) => {
    if (intro.classList.contains('is-hidden') || intro.classList.contains('is-leaving')) return;
    if (e.key === 'Enter' || e.key === 'Escape') dismiss();
  });
})();

function refreshDynamicHint() {
  const hint = document.querySelector('.hint');
  if (!hint) return;
  const mode = hint.dataset.hintMode;
  if (mode === 'loadedAn') {
    hint.textContent = t('header.hintLoadedAn', {
      n: hint.dataset.hintN || '',
      label: hint.dataset.hintLabel || '',
      nb: '',
    });
  } else if (mode === 'loaded') {
    hint.textContent = t('header.hintLoaded', {
      n: hint.dataset.hintN || '',
      nb: hint.dataset.hintNb || '',
    });
  } else if (mode === 'placeholder') {
    hint.textContent = t('header.hintPlaceholder');
  }
}

onLangChange(() => {
  updateChamberChrome();
  syncPeriodSliderUI();
  refreshDynamicHint();
  if (!panelEl.hidden && selectedSeat >= 0) {
    const sen = seatSystem.seats[selectedSeat]?.senator;
    if (sen) openPanel(sen);
  } else if (!panelEl.hidden && allSenators.length) {
    const name = panelName.textContent;
    const sen = allSenators.find((s) => s.name === name);
    if (sen) openPanel(sen);
  }
  if (searchInput?.value?.trim() && searchResultsEl && !searchResultsEl.hidden) {
    runSenatorSearch();
  }
});
