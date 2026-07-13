import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ── Palette Sénat (fidèle à la photo) ─────────────────────── */
const COLORS = {
  /* Velours bordeaux / cramoisi des fauteuils */
  velvet: 0x8c1a28,
  velvetDark: 0x6e1420,
  velvetDeep: 0x4a0e16,
  /* Bois acajou / chêne poli (boiseries + pupitres) */
  wood: 0x6a4028,
  woodDark: 0x422818,
  woodPolish: 0x7a4a30,
  woodLight: 0x925832,
  gold: 0xc9a45a,
  goldBright: 0xe0c078,
  goldMuted: 0xa88848,
  carpet: 0x8b1a28,
  carpetDark: 0x6a1420,
  marble: 0xf2ebe0,
  marbleWarm: 0xe8dcc8,
  curtain: 0x5c1520,
  deskTop: 0x1a1210,
  deskLeather: 0x1c2e24,
  /* Marbre rouge des colonnes du fond */
  marbleRed: 0x6b3a3a,
  marbleCream: 0xe8dcc8,
  paintWarm: 0x8b6a4a,
  paintSky: 0x6a8aaa,
  glass: 0xc8d8e8,
  flagBlue: 0x002395,
  flagRed: 0xed2939,
  flagEuBlue: 0x003399,
};

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x140c0a);
scene.fog = new THREE.Fog(0x140c0a, 55, 95);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 200);
/* Vue de base : au-dessus de la présidente, regard vers l'hémicycle */
const DEFAULT_CAM = { x: 0, y: 12.5, z: -7.5 };
const DEFAULT_TARGET = { x: 0, y: 3.2, z: 8 };
camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);

const controls = new OrbitControls(camera, canvas);
controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 5;
controls.maxDistance = 55;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minPolarAngle = 0.08;
controls.update();

let autoOrbit = false;

const mat = {
  velvet: new THREE.MeshStandardMaterial({ color: COLORS.velvet, roughness: 0.86, metalness: 0.03 }),
  velvetDark: new THREE.MeshStandardMaterial({ color: COLORS.velvetDark, roughness: 0.88, metalness: 0.03 }),
  velvetDeep: new THREE.MeshStandardMaterial({ color: COLORS.velvetDeep, roughness: 0.9, metalness: 0 }),
  wood: new THREE.MeshStandardMaterial({ color: COLORS.wood, roughness: 0.4, metalness: 0.1 }),
  woodDark: new THREE.MeshStandardMaterial({ color: COLORS.woodDark, roughness: 0.36, metalness: 0.12 }),
  woodPolish: new THREE.MeshStandardMaterial({ color: COLORS.woodPolish, roughness: 0.28, metalness: 0.22 }),
  woodLight: new THREE.MeshStandardMaterial({ color: COLORS.woodLight, roughness: 0.45, metalness: 0.08 }),
  gold: new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.28, metalness: 0.78 }),
  goldBright: new THREE.MeshStandardMaterial({ color: COLORS.goldBright, roughness: 0.22, metalness: 0.85 }),
  goldMuted: new THREE.MeshStandardMaterial({ color: COLORS.goldMuted, roughness: 0.4, metalness: 0.65 }),
  carpet: new THREE.MeshStandardMaterial({ color: COLORS.carpet, roughness: 0.97, metalness: 0 }),
  carpetDark: new THREE.MeshStandardMaterial({ color: COLORS.carpetDark, roughness: 0.97, metalness: 0 }),
  marble: new THREE.MeshStandardMaterial({ color: COLORS.marble, roughness: 0.35, metalness: 0.05 }),
  marbleWarm: new THREE.MeshStandardMaterial({ color: COLORS.marbleWarm, roughness: 0.45, metalness: 0.04 }),
  curtain: new THREE.MeshStandardMaterial({ color: COLORS.curtain, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }),
  deskTop: new THREE.MeshStandardMaterial({ color: COLORS.deskTop, roughness: 0.25, metalness: 0.2 }),
  deskLeather: new THREE.MeshStandardMaterial({ color: COLORS.deskLeather, roughness: 0.75, metalness: 0.05 }),
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

/* ── Textures photo (références Sénat) ─────────────────────── */
const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const TEX = {
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


function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(rTop, rBot, h, material, segs = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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
const SEATS_PER_TIER = [18, 22, 26, 28, 30, 32, 34, 36, 38, 40, 44];
const TOTAL_SEATS = SEATS_PER_TIER.reduce((s, n) => s + n, 0); // 348

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
  root.add(floor);

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
  root.add(carpet);

  const totalArc = ARC_END - ARC_START;
  for (const f of AISLE_FRAC) {
    const a = ARC_START + totalArc * f;
    for (let r = 7.0; r < 20.5; r += 0.75) {
      const p = alongArc(r, a, 0.035);
      const strip = box(0.7, 0.02, 0.8, mat.carpet);
      strip.position.set(p.x, p.y, p.z);
      strip.rotation.y = p.rotY;
      root.add(strip);
    }
  }
}

/* ── Fauteuils + pupitres continus (comme la photo) ────────── */

/** Géométries d'un fauteuil Sénat : velours + cadre bois */
function createChairGeometries() {
  return {
    cushion: new THREE.BoxGeometry(0.48, 0.14, 0.42),
    cushionFront: new THREE.BoxGeometry(0.46, 0.08, 0.06),
    backPad: new THREE.BoxGeometry(0.46, 0.62, 0.1),
    backTop: new THREE.SphereGeometry(0.24, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    woodSideL: new THREE.BoxGeometry(0.04, 0.7, 0.08),
    woodSideR: new THREE.BoxGeometry(0.04, 0.7, 0.08),
    woodTop: new THREE.BoxGeometry(0.5, 0.05, 0.07),
    armWood: new THREE.BoxGeometry(0.06, 0.08, 0.36),
    armPad: new THREE.BoxGeometry(0.07, 0.05, 0.28),
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
  const DESK_SEGS = 72;

  const geos = createChairGeometries();
  const dummy = new THREE.Object3D();

  const cushionMesh = new THREE.InstancedMesh(geos.cushion, mat.velvet, TOTAL_SEATS);
  const cushionFrontMesh = new THREE.InstancedMesh(geos.cushionFront, mat.velvetDark, TOTAL_SEATS);
  const backPadMesh = new THREE.InstancedMesh(geos.backPad, mat.velvet, TOTAL_SEATS);
  const backTopMesh = new THREE.InstancedMesh(geos.backTop, mat.velvetDark, TOTAL_SEATS);
  const woodSideLMesh = new THREE.InstancedMesh(geos.woodSideL, mat.woodDark, TOTAL_SEATS);
  const woodSideRMesh = new THREE.InstancedMesh(geos.woodSideR, mat.woodDark, TOTAL_SEATS);
  const woodTopMesh = new THREE.InstancedMesh(geos.woodTop, mat.woodPolish, TOTAL_SEATS);
  const armWoodLMesh = new THREE.InstancedMesh(geos.armWood, mat.woodPolish, TOTAL_SEATS);
  const armWoodRMesh = new THREE.InstancedMesh(geos.armWood, mat.woodPolish, TOTAL_SEATS);
  const armPadLMesh = new THREE.InstancedMesh(geos.armPad, mat.velvetDark, TOTAL_SEATS);
  const armPadRMesh = new THREE.InstancedMesh(geos.armPad, mat.velvetDark, TOTAL_SEATS);
  const leatherMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.018, 0.26), mat.deskLeather, TOTAL_SEATS);
  const seatBaseMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.46, 0.28, 0.4), mat.woodDark, TOTAL_SEATS);
  const seatSkirtMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.08, 0.44), mat.woodPolish, TOTAL_SEATS);

  const seatMeshes = [
    cushionMesh, cushionFrontMesh, backPadMesh, backTopMesh,
    woodSideLMesh, woodSideRMesh, woodTopMesh,
    armWoodLMesh, armWoodRMesh, armPadLMesh, armPadRMesh, leatherMesh,
    seatBaseMesh, seatSkirtMesh,
  ];
  for (const m of seatMeshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    root.add(m);
  }

  let idx = 0;

  for (let t = 0; t < TIER_COUNT; t++) {
    const radius = INNER_R + t * TIER_DEPTH;
    const yBase = t * TIER_RISE;
    const count = SEATS_PER_TIER[t];
    const angles = seatAnglesForTier(count);
    const rIn = radius - 0.08;
    const rOut = radius + TIER_DEPTH * 0.92;
    const solidH = Math.max(0.12, yBase + 0.1);

    /* Masse pleine du gradin (plus de vide en dessous) */
    const SOLID_SEGS = 64;
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
      root.add(block);

      /* Surface supérieure (plateforme) */
      const top = box(segW, 0.06, depth * 0.98, mat.wood);
      top.position.set(
        Math.cos(aMid) * rMid,
        solidH + 0.02,
        Math.sin(aMid) * rMid
      );
      top.rotation.y = -aMid - Math.PI / 2;
      root.add(top);
    }

    /* Face avant du gradin (contremarche vers le centre) */
    for (let i = 0; i < 56; i++) {
      const a0 = ARC_START + (ARC_END - ARC_START) * (i / 56);
      const a1 = ARC_START + (ARC_END - ARC_START) * ((i + 1) / 56);
      const aMid = (a0 + a1) / 2;
      const segLen = (a1 - a0) * rIn * 1.05;
      const riser = box(segLen, solidH, 0.1, mat.woodPolish);
      riser.position.set(
        Math.cos(aMid) * rIn,
        solidH * 0.5,
        Math.sin(aMid) * rIn
      );
      riser.rotation.y = -aMid - Math.PI / 2;
      root.add(riser);
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
      root.add(front);

      /* Panneau bas décoratif */
      const kick = box(segW, 0.12, 0.1, mat.woodDark);
      kick.position.set(
        Math.cos(aMid) * (deskFrontR + 0.02),
        solidH + 0.08,
        Math.sin(aMid) * (deskFrontR + 0.02)
      );
      kick.rotation.y = -aMid - Math.PI / 2;
      root.add(kick);

      const mould = box(segW, 0.045, 0.1, mat.woodDark);
      mould.position.set(
        Math.cos(aMid) * (deskFrontR + 0.01),
        deskTopY,
        Math.sin(aMid) * (deskFrontR + 0.01)
      );
      mould.rotation.y = -aMid - Math.PI / 2;
      root.add(mould);

      const top = box(segW, 0.05, 0.4, mat.wood);
      top.position.set(
        Math.cos(aMid) * deskTopR,
        deskTopY + 0.03,
        Math.sin(aMid) * deskTopR
      );
      top.rotation.y = -aMid - Math.PI / 2;
      root.add(top);
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
      root.add(backPanel);
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

      idx++;
    }
  }

  console.info(`Hémicycle: ${idx} sièges (cible ${TOTAL_SEATS})`);
  for (const m of seatMeshes) m.instanceMatrix.needsUpdate = true;
  return idx;
}

/* ── Helpers artistiques ───────────────────────────────────── */
function makeStatue() {
  const s = new THREE.Group();
  s.add(box(0.55, 0.28, 0.45, mat.marble, 0, 0.14, 0));
  const robe = cyl(0.2, 0.28, 1.35, mat.marble, 12);
  robe.position.y = 1.0;
  s.add(robe);
  s.add(box(0.48, 0.55, 0.28, mat.marbleWarm, 0, 1.45, 0.02));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat.marble);
  head.position.y = 1.95;
  s.add(head);
  s.add(box(0.1, 0.55, 0.1, mat.marble, -0.28, 1.4, 0));
  s.add(box(0.1, 0.55, 0.1, mat.marble, 0.28, 1.4, 0));
  return s;
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

  root.add(g);
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

  root.add(g);
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

  const artLight = new THREE.SpotLight(0xfff2e0, 40, 32, 0.7, 0.45, 1.2);
  artLight.position.set(0, 13, 5);
  artLight.target.position.set(0, 7, -6);
  g.add(artLight);
  g.add(artLight.target);

  root.add(g);
}

function addCorinthianColumn(parent, x, z, yBase, height) {
  const col = new THREE.Group();
  col.position.set(x, yBase, z);
  col.add(box(0.95, 0.22, 0.95, mat.marbleWarm, 0, 0.11, 0));
  col.add(box(0.78, 0.16, 0.78, mat.gold, 0, 0.3, 0));
  const shaft = cyl(0.28, 0.32, height - 0.9, mat.goldMuted, 20);
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
  const SEGMENTS = 42;

  const woodMat = new THREE.MeshStandardMaterial({
    map: TEX.wood,
    roughness: 0.48,
    metalness: 0.08,
  });
  /* Fond rouge des tribunes publiques */
  const redWallMat = new THREE.MeshStandardMaterial({
    color: 0x6e1520,
    roughness: 0.9,
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
    root.add(low);

    /* Mur rouge derrière les galeries visiteurs */
    const red = box(segW, 8.6, 0.16, redWallMat);
    red.position.set(x, 7.9, z);
    red.rotation.y = rotY;
    root.add(red);

    /* Corniche or */
    const cornice = box(segW, 0.2, 0.38, mat.gold);
    cornice.position.set(x, 12.3, z);
    cornice.rotation.y = rotY;
    root.add(cornice);
  }

  /* Piliers or entre les travées visiteurs */
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const a = ARC_START + (ARC_END - ARC_START) * t;
    addCorinthianColumn(root, Math.cos(a) * (WALL_R - 0.7), Math.sin(a) * (WALL_R - 0.7), 0, 11.8);
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
      root.add(floor);

      /* Tapis rouge */
      const carpet = box(segW * 0.92, 0.04, level.depth * 0.85, mat.carpet);
      carpet.position.set(Math.cos(aMid) * level.r, level.y + 0.08, Math.sin(aMid) * level.r);
      carpet.rotation.y = rotY;
      root.add(carpet);

      /* Balustrade or (ouverte sur la salle) */
      const railR = level.r - level.depth * 0.48;
      const rail = box(segW * 0.95, 0.07, 0.07, mat.goldBright);
      rail.position.set(Math.cos(aMid) * railR, level.y + 0.85, Math.sin(aMid) * railR);
      rail.rotation.y = rotY;
      root.add(rail);

      for (let k = 0; k < 4; k++) {
        const tf = (k + 0.5) / 4;
        const ak = a0 + (a1 - a0) * tf;
        const bal = cyl(0.04, 0.045, 0.75, mat.gold, 8);
        bal.position.set(Math.cos(ak) * railR, level.y + 0.42, Math.sin(ak) * railR);
        root.add(bal);
      }

      /* Rideau rouge au fond de la travée */
      const backR = level.r + level.depth * 0.35;
      const curtain = box(segW * 0.88, 1.7, 0.08, mat.curtain);
      curtain.position.set(Math.cos(aMid) * backR, level.y + 1.55, Math.sin(aMid) * backR);
      curtain.rotation.y = rotY;
      root.add(curtain);

      /* Petits sièges visiteurs (rouges) */
      for (let s = 0; s < 3; s++) {
        const sf = (s + 0.5) / 3;
        const as = a0 + (a1 - a0) * sf;
        const sr = level.r + 0.15;
        const seat = box(0.38, 0.12, 0.36, mat.velvet);
        seat.position.set(Math.cos(as) * sr, level.y + 0.28, Math.sin(as) * sr);
        seat.rotation.y = -as - Math.PI / 2;
        root.add(seat);
        const back = box(0.38, 0.4, 0.08, mat.velvetDark);
        back.position.set(Math.cos(as) * (sr + 0.18), level.y + 0.5, Math.sin(as) * (sr + 0.18));
        back.rotation.y = -as - Math.PI / 2;
        root.add(back);
      }
    }
  }
}

/* ── Plafond + verrière DEMI-CERCLE (éventail) ─────────────── */
function buildCeiling() {
  const ceilY = 13.6;
  const skyR = 6.5;
  const skyZ = -2.5;

  const ceilMat = new THREE.MeshStandardMaterial({
    map: TEX.ceiling,
    roughness: 0.45,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(26, 72), ceilMat);
  ceiling.rotation.x = -Math.PI / 2;
  ceiling.position.set(0, ceilY, 4);
  ceiling.receiveShadow = true;
  root.add(ceiling);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(25.2, 0.2, 8, 80), mat.gold);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, ceilY - 0.12, 4);
  root.add(ring);

  /* Emprise sombre sous la verrière (lit le demi-cercle) */
  const recess = new THREE.Mesh(
    new THREE.CircleGeometry(skyR + 0.15, 56, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1, side: THREE.DoubleSide })
  );
  recess.rotation.x = -Math.PI / 2;
  recess.position.set(0, ceilY - 0.08, skyZ);
  root.add(recess);

  const skyGroup = new THREE.Group();
  skyGroup.position.set(0, ceilY - 0.12, skyZ);

  const skyMat = new THREE.MeshStandardMaterial({
    color: 0xe8f0f8,
    map: TEX.skylight,
    roughness: 0.22,
    metalness: 0.04,
    emissive: new THREE.Color(0x8aa0b8),
    emissiveIntensity: 0.65,
    side: THREE.DoubleSide,
  });
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

  const skyLight = new THREE.PointLight(0xfff8ee, 45, 48, 1.2);
  skyLight.position.set(0, -1.2, skyR * 0.4);
  skyGroup.add(skyLight);
  root.add(skyGroup);

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
    root.add(chand);
  }
}

/* ── Éclairage global ──────────────────────────────────────── */
function buildLights() {
  scene.add(new THREE.AmbientLight(0xfff4e8, 0.42));
  scene.add(new THREE.HemisphereLight(0xfff8f0, 0x3a2018, 0.45));

  const key = new THREE.DirectionalLight(0xfff0dd, 1.15);
  key.position.set(-4, 24, 14);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  key.shadow.bias = -0.00025;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xd8e8ff, 0.4);
  fill.position.set(14, 12, -4);
  scene.add(fill);

  const spot = new THREE.SpotLight(0xffe8c8, 55, 40, 0.55, 0.45, 1.4);
  spot.position.set(0, 11, 2);
  spot.target.position.set(0, 1.8, -6);
  scene.add(spot);
  scene.add(spot.target);

  const seatFill = new THREE.PointLight(0xffd8b8, 70, 50, 1.3);
  seatFill.position.set(0, 8, 10);
  scene.add(seatFill);

  const seatFill2 = new THREE.PointLight(0xffe0c0, 60, 45, 1.3);
  seatFill2.position.set(0, 6, 14);
  scene.add(seatFill2);

  const seatFillL = new THREE.PointLight(0xffd0b0, 45, 35, 1.4);
  seatFillL.position.set(-10, 7, 8);
  scene.add(seatFillL);

  const seatFillR = new THREE.PointLight(0xffd0b0, 45, 35, 1.4);
  seatFillR.position.set(10, 7, 8);
  scene.add(seatFillR);
}

/* ── Assemblage ────────────────────────────────────────────── */
buildFloor();
buildSeats();
buildBureau();
buildOrator();
buildBackdrop();
buildCurvedWall();
buildGalleries();
buildCeiling();
buildLights();

/* ── UI ────────────────────────────────────────────────────── */
const btnReset = document.getElementById('btn-reset');
const btnOrbit = document.getElementById('btn-orbit');

btnReset.addEventListener('click', () => {
  camera.position.set(DEFAULT_CAM.x, DEFAULT_CAM.y, DEFAULT_CAM.z);
  controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
  controls.update();
});

btnOrbit.addEventListener('click', () => {
  autoOrbit = !autoOrbit;
  btnOrbit.classList.toggle('active', autoOrbit);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  if (autoOrbit) {
    const t = Date.now() * 0.00008;
    camera.position.x = Math.sin(t) * 6;
    camera.position.z = -7.5 + Math.cos(t) * 3;
    camera.position.y = 12 + Math.sin(t * 0.6) * 0.8;
    controls.target.set(DEFAULT_TARGET.x, DEFAULT_TARGET.y, DEFAULT_TARGET.z);
  }
  controls.update();
  renderer.render(scene, camera);
}

animate();
