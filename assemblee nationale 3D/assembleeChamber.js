/**
 * Hémicycle Assemblée nationale 3D — adapté de la maquette Sénat.
 * Géométrie d’hémicycle réutilisée ; matériaux / tribune / murs / plafond AN.
 *
 * Références : ./refs/an-hemicycle-*.png
 */

import * as THREE from 'three';
import { ASSEMBLEE_COLORS } from './theme.js';

function canvasTexture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Panneau vert sombre + ornement vertical doré (lauriers / fleurons) */
export function makeGreenPanelTexture() {
  return canvasTexture((ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, '#0f2a1e');
    g.addColorStop(0.5, '#1a3d2e');
    g.addColorStop(1, '#0f2a1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);

    /* léger motif damassé */
    ctx.strokeStyle = 'rgba(40, 90, 70, 0.35)';
    ctx.lineWidth = 1;
    for (let y = 0; y < s; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }

    const cx = s * 0.5;
    ctx.strokeStyle = '#c4a35a';
    ctx.fillStyle = '#d4b56a';
    ctx.lineWidth = 3;

    /* tige centrale */
    ctx.beginPath();
    ctx.moveTo(cx, s * 0.08);
    ctx.lineTo(cx, s * 0.92);
    ctx.stroke();

    /* fleurons / feuilles */
    for (let i = 0; i < 9; i++) {
      const y = s * (0.12 + i * 0.09);
      const w = 28 + (i % 2) * 10;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(cx - w, y - 8, cx - w * 0.3, y - 22);
      ctx.quadraticCurveTo(cx - 6, y - 4, cx, y);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.quadraticCurveTo(cx + w, y - 8, cx + w * 0.3, y - 22);
      ctx.quadraticCurveTo(cx + 6, y - 4, cx, y);
      ctx.fill();
    }

    /* rosace haute */
    ctx.beginPath();
    ctx.arc(cx, s * 0.1, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, s * 0.1, 8, 0, Math.PI * 2);
    ctx.fill();
  }, 512);
}

/** Marbre vert / blanc / brun du puits */
export function makeWellMarbleTexture() {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(0, 0, s, s);

    const cx = s / 2;
    const cy = s / 2;
    const rings = [
      ['#2d5a48', 0.48],
      ['#c8c4b4', 0.4],
      ['#3a6b55', 0.32],
      ['#ddd8c8', 0.24],
      ['#5c3a32', 0.16],
      ['#e8e4d8', 0.08],
    ];
    for (const [color, r] of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, s * r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    /* secteurs géométriques */
    ctx.strokeStyle = 'rgba(45, 90, 72, 0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * s * 0.48, cy + Math.sin(a) * s * 0.48);
      ctx.stroke();
    }
  }, 512);
}

/** Tapisserie / peinture centrale stylisée derrière le président */
export function makeTapestryTexture() {
  return canvasTexture((ctx, s) => {
    const sky = ctx.createLinearGradient(0, 0, 0, s);
    sky.addColorStop(0, '#6a8aaa');
    sky.addColorStop(0.45, '#c4a888');
    sky.addColorStop(1, '#5a4030');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, s, s);

    /* figures classiques schématiques */
    for (let i = 0; i < 14; i++) {
      const x = 40 + (i % 7) * 65;
      const y = 180 + Math.floor(i / 7) * 140 + (i % 3) * 10;
      ctx.fillStyle = i % 2 ? '#e8dcc8' : '#d4c4a8';
      ctx.beginPath();
      ctx.ellipse(x, y - 50, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = i % 3 === 0 ? '#8b2a2a' : '#3a4a6a';
      ctx.fillRect(x - 18, y - 30, 36, 70);
      ctx.fillStyle = '#f0ebe3';
      ctx.beginPath();
      ctx.arc(x, y - 58, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    /* cadre intérieur or */
    ctx.strokeStyle = '#c4a35a';
    ctx.lineWidth = 14;
    ctx.strokeRect(18, 18, s - 36, s - 36);
    ctx.strokeStyle = '#e0c078';
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 32, s - 64, s - 64);
  }, 512);
}

/** Bas-relief blanc (procession de figures) */
export function makeBasReliefTexture() {
  return canvasTexture((ctx, s) => {
    ctx.fillStyle = '#efe8dc';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#d8d0c4';
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 60;
      ctx.beginPath();
      ctx.ellipse(x, s * 0.42, 14, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 12, s * 0.45, 24, 55);
      ctx.beginPath();
      ctx.arc(x, s * 0.32, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(180, 160, 130, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, s - 16, s - 16);
  }, 256);
}

/**
 * Construit l’architecture AN dans `parent` (sièges exclus — gérés par main.js).
 * @param {object} ctx helpers partagés avec la scène Sénat
 */
export function buildAssembleeArchitecture(ctx) {
  const {
    parent,
    box,
    cyl,
    mat,
    ROOF,
    HONOR_WALL,
    IS_MOBILE,
    ARC_START,
    ARC_END,
    alongArc,
    AISLE_FRAC,
    makeStatue,
    makeClock,
    makeWallSconce,
    makeFlag,
  } = ctx;

  const C = ASSEMBLEE_COLORS;
  const texGreen = makeGreenPanelTexture();
  const texWell = makeWellMarbleTexture();
  const texTapestry = makeTapestryTexture();
  const texRelief = makeBasReliefTexture();

  texGreen.wrapS = texGreen.wrapT = THREE.RepeatWrapping;
  texGreen.repeat.set(1, 1.4);

  /* Murs courbes + mur d’honneur opaques à l’intérieur.
     Le mur d’honneur est masqué depuis l’extérieur (recul caméra) via HONOR_WALL. */
  const greenMat = new THREE.MeshStandardMaterial({
    map: texGreen,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
  });
  const greenDeepMat = new THREE.MeshStandardMaterial({
    color: C.wallGreenDeep,
    roughness: 0.9,
    metalness: 0.02,
  });
  const wellMat = new THREE.MeshPhysicalMaterial({
    map: texWell,
    roughness: 0.28,
    metalness: 0.05,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
  });
  const brownMarbleMat = new THREE.MeshStandardMaterial({
    color: C.marbleBrown,
    roughness: 0.38,
    metalness: 0.08,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: C.screenBlack,
    roughness: 0.35,
    metalness: 0.4,
  });
  const tapestryMat = new THREE.MeshStandardMaterial({
    map: texTapestry,
    roughness: 0.75,
    metalness: 0.02,
  });
  const reliefMat = new THREE.MeshStandardMaterial({
    map: texRelief,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.02,
  });
  const whiteColMat = new THREE.MeshPhysicalMaterial({
    color: C.marble,
    roughness: 0.36,
    metalness: 0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.5,
  });

  /* ── Sol + puits marbré ───────────────────────────────────── */
  parent.add(box(52, 0.12, 42, mat.woodDark, 0, -0.06, 2));

  const shape = new THREE.Shape();
  shape.absarc(0, 0, 9.5, Math.PI * 0.04, Math.PI * 0.96, false);
  shape.lineTo(Math.cos(Math.PI * 0.96) * 9.5, -2.2);
  shape.lineTo(Math.cos(Math.PI * 0.04) * 9.5, -2.2);
  shape.closePath();
  const carpetGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false });
  carpetGeo.rotateX(Math.PI / 2);
  const carpet = new THREE.Mesh(carpetGeo, mat.carpet);
  carpet.position.set(0, 0.01, 0);
  carpet.receiveShadow = true;
  parent.add(carpet);

  const well = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), wellMat);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, 0.04, 0.6);
  well.receiveShadow = true;
  parent.add(well);
  parent.add(box(8.6, 0.04, 0.12, mat.goldMuted, 0, 0.05, -1.4));

  const totalArc = ARC_END - ARC_START;
  for (const f of AISLE_FRAC) {
    const a = ARC_START + totalArc * f;
    for (let r = 7.0; r < 20.5; r += 0.75) {
      const p = alongArc(r, a, 0.035);
      const strip = box(0.7, 0.02, 0.8, mat.carpet);
      strip.position.set(p.x, p.y, p.z);
      strip.rotation.y = p.rotY;
      parent.add(strip);
    }
  }

  /* ── Bureau / perchoir ───────────────────────────────────── */
  {
    const g = new THREE.Group();
    g.position.set(0, 0, -5.8);

    g.add(box(13.5, 0.85, 6.2, brownMarbleMat, 0, 0.425, 0.2));
    g.add(box(13.2, 0.04, 5.9, mat.carpet, 0, 0.88, 0.2));

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        g.add(box(1.4, 0.16, 0.55, mat.marble, side * (4.2 + i * 0.05), 0.08 + i * 0.16, 2.4 - i * 0.4));
        g.add(box(1.35, 0.02, 0.52, mat.carpet, side * (4.2 + i * 0.05), 0.17 + i * 0.16, 2.4 - i * 0.4));
      }
    }
    for (let i = 0; i < 5; i++) {
      g.add(box(3.4 - i * 0.12, 0.18, 0.48, mat.marble, 0, 0.09 + i * 0.18, 3.1 - i * 0.38));
      g.add(box(3.3 - i * 0.12, 0.02, 0.46, mat.carpet, 0, 0.19 + i * 0.18, 3.1 - i * 0.38));
    }

    g.add(box(10.5, 0.08, 1.15, mat.deskTop, 0, 1.05, 1.35));
    g.add(box(10.5, 0.55, 0.1, brownMarbleMat, 0, 0.78, 1.9));
    g.add(box(10.5, 0.06, 0.06, mat.gold, 0, 1.08, 1.95));
    for (let i = -4; i <= 4; i++) {
      g.add(box(0.48, 0.08, 0.42, mat.velvet, i * 1.1, 1.15, 0.95));
      g.add(box(0.48, 0.42, 0.07, mat.velvetDark, i * 1.1, 1.38, 0.72));
    }

    /* Plateforme président + drap rouge */
    g.add(box(6.2, 0.55, 2.4, mat.woodDark, 0, 1.2, -1.1));
    g.add(box(6.0, 0.1, 2.2, mat.carpet, 0, 1.5, -1.1));
    g.add(box(5.4, 0.1, 1.35, mat.deskTop, 0, 1.95, -0.85));
    g.add(box(5.6, 0.9, 0.14, mat.woodPolish, 0, 1.7, -0.15));
    g.add(box(5.4, 0.55, 0.04, mat.curtain, 0, 1.65, -0.02));
    g.add(box(5.5, 0.12, 0.05, mat.goldBright, 0, 2.12, -0.08));

    /* Bas-relief horizontal sous la tapisserie */
    const longRelief = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.55), reliefMat);
    longRelief.position.set(0, 2.55, -2.05);
    g.add(longRelief);
    g.add(box(5.4, 0.06, 0.08, mat.gold, 0, 2.28, -2.0));
    g.add(box(5.4, 0.06, 0.08, mat.gold, 0, 2.82, -2.0));

    g.add(box(0.72, 0.12, 0.62, mat.velvet, 0, 2.12, -1.55));
    g.add(box(0.72, 1.05, 0.1, mat.velvetDark, 0, 2.65, -1.85));

    for (const [x, kind] of [
      [-2.2, 'fr'],
      [-1.1, 'eu'],
      [1.1, 'eu'],
      [2.2, 'fr'],
    ]) {
      const fl = makeFlag(kind);
      fl.position.set(x, 2.3, -2.15);
      fl.scale.set(0.85, 0.85, 0.85);
      g.add(fl);
    }

    parent.add(g);
  }

  /* ── Tribune orateur + bas-relief ─────────────────────────── */
  {
    const g = new THREE.Group();
    g.position.set(0, 0, 1.0);

    g.add(box(2.8, 1.15, 1.5, mat.woodDark, 0, 0.575, 0));
    g.add(box(2.95, 0.08, 1.65, mat.woodPolish, 0, 1.18, 0));

    const frontRelief = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.85), reliefMat);
    frontRelief.position.set(0, 0.65, 0.78);
    g.add(frontRelief);
    g.add(box(2.55, 0.06, 0.05, mat.goldBright, 0, 1.12, 0.8));
    g.add(box(2.55, 0.06, 0.05, mat.goldBright, 0, 0.22, 0.8));

    const lectern = box(1.9, 0.07, 0.75, mat.deskTop, 0, 1.45, 0.18);
    lectern.rotation.x = -0.28;
    g.add(lectern);
    g.add(box(0.1, 1.15, 1.3, mat.wood, -1.35, 0.58, 0));
    g.add(box(0.1, 1.15, 1.3, mat.wood, 1.35, 0.58, 0));

    const mic = cyl(0.02, 0.02, 0.5, mat.gold, 8);
    mic.position.set(0, 1.6, 0.4);
    g.add(mic);

    parent.add(g);
  }

  /* ── Mur d’honneur : tapisserie, niches, écrans, vert or ─── */
  {
    const g = new THREE.Group();
    g.userData.honorWall = true;
    const wallZ = HONOR_WALL?.z ?? -7.88;
    if (HONOR_WALL) HONOR_WALL.group = g;

    /* Panneaux verts centraux */
    g.add(box(7.2, 9.8, 0.28, greenMat, 0, 6.2, wallZ));
    g.add(box(7.4, 0.12, 0.12, mat.goldBright, 0, 11.15, wallZ + 0.2));
    g.add(box(7.4, 0.1, 0.1, mat.goldMuted, 0, 1.35, wallZ + 0.2));

    /* Tapisserie centrale */
    const tapestry = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.6), tapestryMat);
    tapestry.position.set(0, 7.6, wallZ + 0.22);
    g.add(tapestry);
    g.add(box(4.7, 0.14, 0.14, mat.goldBright, 0, 5.72, wallZ + 0.28));
    g.add(box(4.7, 0.14, 0.14, mat.goldBright, 0, 9.48, wallZ + 0.28));
    g.add(box(0.14, 3.9, 0.14, mat.goldBright, -2.3, 7.6, wallZ + 0.28));
    g.add(box(0.14, 3.9, 0.14, mat.goldBright, 2.3, 7.6, wallZ + 0.28));

    /* Colonnes blanches flanquant le centre */
    for (const x of [-3.9, 3.9]) {
      const col = new THREE.Group();
      col.position.set(x, 0, wallZ + 0.55);
      col.add(box(0.85, 0.2, 0.85, mat.marble, 0, 0.1, 0));
      col.add(box(0.7, 0.12, 0.7, mat.goldMuted, 0, 0.26, 0));
      const shaft = cyl(0.26, 0.3, 10.2, whiteColMat, 22);
      shaft.position.y = 5.5;
      col.add(shaft);
      col.add(box(0.78, 0.18, 0.78, mat.gold, 0, 10.75, 0));
      col.add(box(0.95, 0.14, 0.95, mat.goldBright, 0, 10.95, 0));
      g.add(col);
    }

    /* Niches + statues */
    for (const x of [-6.4, 6.4]) {
      g.add(box(2.4, 5.2, 0.5, greenDeepMat, x, 6.8, wallZ - 0.1));
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.08, 8, 24, Math.PI),
        mat.goldMuted
      );
      arch.rotation.z = Math.PI;
      arch.position.set(x, 9.2, wallZ + 0.2);
      g.add(arch);
      const statue = makeStatue();
      statue.position.set(x, 4.35, wallZ + 0.35);
      statue.scale.set(1.05, 1.1, 1.05);
      g.add(statue);
      g.add(box(1.1, 0.35, 0.9, mat.marble, x, 4.15, wallZ + 0.35));
    }

    /* Ailes latérales vertes */
    for (const x of [-10.2, 10.2]) {
      g.add(box(4.6, 10.5, 0.32, greenMat, x, 5.8, wallZ));
      for (const y of [1.2, 4.2, 7.2, 10.8]) {
        g.add(box(4.4, 0.08, 0.1, mat.goldMuted, x, y, wallZ + 0.2));
      }
      const clock = makeClock();
      clock.position.set(x, 4.6, wallZ + 0.4);
      g.add(clock);
    }

    /* Écrans noirs modernes flanquant la tribune */
    for (const x of [-4.6, 4.6, -7.8, 7.8]) {
      const screen = box(1.55, 1.05, 0.08, screenMat, x, 2.55, -4.35);
      g.add(screen);
      g.add(box(1.65, 0.06, 0.1, mat.deskTop, x, 2.0, -4.35));
      g.add(box(1.65, 0.06, 0.1, mat.deskTop, x, 3.1, -4.35));
    }

    /* Soubassement marbre brun-rouge */
    g.add(box(22, 1.6, 0.4, brownMarbleMat, 0, 0.85, wallZ + 0.15));

    const artLight = new THREE.SpotLight(0xffe8c8, 16, 30, 0.65, 0.5, 1.4);
    artLight.position.set(0, 13, 5);
    artLight.target.position.set(0, 7.5, -6);
    g.add(artLight);
    g.add(artLight.target);

    parent.add(g);
  }

  /* ── Murs courbes : vert + or, colonnes blanches ──────────── */
  {
    const WALL_R = 24.2;
    const SEGMENTS = IS_MOBILE ? 28 : 36;
    const woodMat = new THREE.MeshStandardMaterial({
      color: C.marbleBrown,
      roughness: 0.45,
      metalness: 0.06,
    });

    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = ARC_START - 0.04 + ((ARC_END - ARC_START + 0.08) * i) / SEGMENTS;
      const a1 = ARC_START - 0.04 + ((ARC_END - ARC_START + 0.08) * (i + 1)) / SEGMENTS;
      const aMid = (a0 + a1) / 2;
      const segW = (a1 - a0) * WALL_R * 1.02;
      const rotY = -aMid + Math.PI / 2;
      const x = Math.cos(aMid) * (WALL_R - 0.1);
      const z = Math.sin(aMid) * (WALL_R - 0.1);

      const low = box(segW, 3.4, 0.22, woodMat);
      low.position.set(x, 1.7, z);
      low.rotation.y = rotY;
      parent.add(low);

      for (const y of [0.42, 1.72, 3.05]) {
        const mould = box(segW, 0.055, 0.06, y === 1.72 ? mat.goldMuted : mat.gold);
        mould.position.set(Math.cos(aMid) * (WALL_R - 0.22), y, Math.sin(aMid) * (WALL_R - 0.22));
        mould.rotation.y = rotY;
        parent.add(mould);
      }

      const green = box(segW, 8.6, 0.16, greenMat);
      green.position.set(x, 7.9, z);
      green.rotation.y = rotY;
      parent.add(green);

      const cornice = box(segW, 0.2, 0.38, mat.gold);
      cornice.position.set(x, 12.3, z);
      cornice.rotation.y = rotY;
      parent.add(cornice);
    }

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const a = ARC_START + (ARC_END - ARC_START) * t;
      /* Colonnes blanches / crème (moins d’or que Sénat) */
      const col = new THREE.Group();
      const cx = Math.cos(a) * (WALL_R - 0.7);
      const cz = Math.sin(a) * (WALL_R - 0.7);
      col.position.set(cx, 0, cz);
      col.add(box(0.95, 0.22, 0.95, mat.marble, 0, 0.11, 0));
      col.add(box(0.78, 0.12, 0.78, mat.goldMuted, 0, 0.28, 0));
      const shaft = cyl(0.28, 0.32, 10.9, whiteColMat, 22);
      shaft.position.y = 5.85;
      col.add(shaft);
      col.add(box(0.85, 0.18, 0.85, mat.gold, 0, 11.35, 0));
      col.add(box(1.05, 0.14, 1.05, mat.goldBright, 0, 11.55, 0));
      parent.add(col);
    }

    for (let i = 0; i < 10; i++) {
      const a = ARC_START + (ARC_END - ARC_START) * ((i + 0.5) / 10);
      const sconce = makeWallSconce(i % 2 === 0);
      sconce.position.set(Math.cos(a) * (WALL_R - 0.48), 2.65, Math.sin(a) * (WALL_R - 0.48));
      sconce.rotation.y = -a + Math.PI / 2;
      parent.add(sconce);
    }
  }

  /* ── Galeries visiteurs (rideaux rouges AN) ──────────────── */
  {
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

        const floor = box(segW, 0.12, level.depth, mat.woodDark);
        floor.position.set(Math.cos(aMid) * level.r, level.y, Math.sin(aMid) * level.r);
        floor.rotation.y = rotY;
        parent.add(floor);

        const carpet = box(segW * 0.92, 0.04, level.depth * 0.85, mat.carpet);
        carpet.position.set(Math.cos(aMid) * level.r, level.y + 0.08, Math.sin(aMid) * level.r);
        carpet.rotation.y = rotY;
        parent.add(carpet);

        const railR = level.r - level.depth * 0.48;
        const rail = box(segW * 0.98, 0.12, 0.12, mat.marble);
        rail.position.set(Math.cos(aMid) * railR, level.y + 0.85, Math.sin(aMid) * railR);
        rail.rotation.y = rotY;
        parent.add(rail);
        const railGold = box(segW * 0.96, 0.045, 0.09, mat.goldBright);
        railGold.position.set(Math.cos(aMid) * railR, level.y + 0.79, Math.sin(aMid) * railR);
        railGold.rotation.y = rotY;
        parent.add(railGold);

        for (let k = 0; k < 4; k++) {
          const tf = (k + 0.5) / 4;
          const ak = a0 + (a1 - a0) * tf;
          const bal = cyl(0.04, 0.045, 0.75, mat.gold, 8);
          bal.position.set(Math.cos(ak) * railR, level.y + 0.42, Math.sin(ak) * railR);
          parent.add(bal);
        }

        const backR = level.r + level.depth * 0.35;
        const curtain = box(segW * 0.88, 1.7, 0.08, mat.curtain);
        curtain.position.set(Math.cos(aMid) * backR, level.y + 1.55, Math.sin(aMid) * backR);
        curtain.rotation.y = rotY;
        parent.add(curtain);

        for (let s = 0; s < 3; s++) {
          const sf = (s + 0.5) / 3;
          const as = a0 + (a1 - a0) * sf;
          const sr = level.r + 0.15;
          const seat = box(0.38, 0.12, 0.36, mat.velvet);
          seat.position.set(Math.cos(as) * sr, level.y + 0.28, Math.sin(as) * sr);
          seat.rotation.y = -as - Math.PI / 2;
          parent.add(seat);
          const back = box(0.38, 0.4, 0.08, mat.velvetDark);
          back.position.set(Math.cos(as) * (sr + 0.18), level.y + 0.5, Math.sin(as) * (sr + 0.18));
          back.rotation.y = -as - Math.PI / 2;
          parent.add(back);
        }
      }
    }
  }

  /* ── Plafond caissonné + verrière éventail ────────────────── */
  {
    const ceilY = ROOF.y;
    const skyR = 7.8;
    const skyZ = -3.4;

    const ceilMat = new THREE.MeshStandardMaterial({
      color: C.ceilingTint,
      roughness: 0.5,
      metalness: 0.18,
      emissive: 0x1a1004,
      emissiveIntensity: 0.06,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.94,
      depthWrite: true,
    });
    ROOF.layers.push({ mat: ceilMat, inside: 0.94, outside: 0.12 });
    const ceiling = new THREE.Mesh(new THREE.CircleGeometry(26, 72), ceilMat);
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.set(0, ceilY, 4);
    ceiling.receiveShadow = true;
    parent.add(ceiling);

    /* Caissons dorés (grille) */
    for (let ring = 0; ring < 4; ring++) {
      const r0 = 9 + ring * 3.8;
      const count = 16 + ring * 6;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const coffer = box(1.4, 0.08, 1.4, mat.goldMuted);
        coffer.position.set(Math.cos(a) * r0, ceilY - 0.18, 4 + Math.sin(a) * r0);
        parent.add(coffer);
        const inset = box(1.05, 0.06, 1.05, mat.goldBright);
        inset.position.set(Math.cos(a) * r0, ceilY - 0.22, 4 + Math.sin(a) * r0);
        parent.add(inset);
      }
    }

    const ring = new THREE.Mesh(new THREE.TorusGeometry(25.2, 0.2, 8, 80), mat.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, ceilY - 0.12, 4);
    parent.add(ring);

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
    parent.add(recess);

    const skyGroup = new THREE.Group();
    skyGroup.position.set(0, ceilY - 0.12, skyZ);
    skyGroup.scale.z = 0.7;

    const metalFrame = new THREE.MeshStandardMaterial({
      color: 0x4a5560,
      roughness: 0.45,
      metalness: 0.65,
    });
    const skyMat = new THREE.MeshStandardMaterial({
      color: 0xe8f0f8,
      roughness: 0.2,
      metalness: 0.04,
      emissive: new THREE.Color(0x8aa0b8),
      emissiveIntensity: 0.48,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: true,
    });
    ROOF.layers.push({ mat: skyMat, inside: 0.9, outside: 0.18 });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(skyR, 56, 0, Math.PI), skyMat);
    glass.rotation.x = -Math.PI / 2;
    glass.position.y = 0.02;
    skyGroup.add(glass);

    skyGroup.add(box(skyR * 2 + 0.35, 0.18, 0.2, metalFrame, 0, 0.1, 0));

    const arcPts = [];
    for (let i = 0; i <= 56; i++) {
      const a = (i / 56) * Math.PI;
      arcPts.push(new THREE.Vector3(Math.cos(a) * skyR, 0.1, Math.sin(a) * skyR));
    }
    skyGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 56, 0.1, 6, false),
        metalFrame
      )
    );

    /* Grille éventail (fan / radial) */
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI;
      const rib = box(0.06, 0.07, skyR * 0.96, metalFrame);
      rib.position.set(Math.cos(a) * skyR * 0.5, 0.11, Math.sin(a) * skyR * 0.5);
      rib.rotation.y = -a;
      skyGroup.add(rib);
    }
    for (const rr of [0.28, 0.48, 0.68, 0.88]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI;
        pts.push(new THREE.Vector3(Math.cos(a) * skyR * rr, 0.11, Math.sin(a) * skyR * rr));
      }
      skyGroup.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5, false),
          metalFrame
        )
      );
    }

    const skyLight = new THREE.PointLight(0xe8f1ff, 24, 42, 1.3);
    skyLight.position.set(0, -1.2, skyR * 0.4);
    skyGroup.add(skyLight);
    parent.add(skyGroup);

    for (const [lx, lz] of [
      [-8, 10],
      [8, 10],
      [0, 15],
    ]) {
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
      parent.add(chand);
    }
  }

}
