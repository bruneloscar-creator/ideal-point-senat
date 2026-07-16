/**
 * Palette Assemblée nationale (Palais Bourbon) — d’après les photos de référence.
 * Rouge velours vif, panneaux vert sombre + or, colonnes blanc/crème, marbre du puits.
 */

export const CHAMBER_STORAGE_KEY = 'hemicycle-chamber';

export const SENAT_COLORS = {
  velvet: 0x8b1c2b,
  velvetDark: 0x681522,
  velvetDeep: 0x31090f,
  wood: 0x57311d,
  woodDark: 0x28150d,
  woodPolish: 0x6b3b22,
  woodLight: 0x7b4a2b,
  gold: 0xb38a43,
  goldBright: 0xd2ad62,
  goldMuted: 0x806331,
  carpet: 0x8b2231,
  carpetDark: 0x661520,
  marble: 0xf2ebe0,
  marbleWarm: 0xe8dcc8,
  curtain: 0x570b18,
  deskTop: 0x1a1210,
  deskLeather: 0x173327,
  marbleRed: 0x6b3a3a,
  marbleCream: 0xe8dcc8,
  paintWarm: 0x8b6a4a,
  paintSky: 0x6a8aaa,
  glass: 0xc8d8e8,
  flagBlue: 0x002395,
  flagRed: 0xed2939,
  flagEuBlue: 0x003399,
  sceneBg: 0x1b0d0b,
  wallGallery: 0x5b1220,
  ceilingTint: 0x8b6338,
};

/** Couleurs AN — rouge plus vif, vert sombre, or plus discret */
export const ASSEMBLEE_COLORS = {
  velvet: 0xc41e3a,
  velvetDark: 0x9a1830,
  velvetDeep: 0x5c0e1c,
  wood: 0x6b4423,
  woodDark: 0x3a2414,
  woodPolish: 0x8a5a32,
  woodLight: 0xa07048,
  gold: 0xc4a35a,
  goldBright: 0xe0c078,
  goldMuted: 0x9a7a3e,
  carpet: 0xb81e36,
  carpetDark: 0x8a1528,
  marble: 0xf5f0e6,
  marbleWarm: 0xefe6d6,
  curtain: 0xa01528,
  deskTop: 0x1a1210,
  deskLeather: 0x1a3d2e,
  marbleRed: 0x7a3a3a,
  marbleCream: 0xf2ebe0,
  paintWarm: 0x7a6a4a,
  paintSky: 0x6a8aaa,
  glass: 0xd0e0f0,
  flagBlue: 0x002395,
  flagRed: 0xed2939,
  flagEuBlue: 0x003399,
  sceneBg: 0x140c0a,
  /* Panneaux muraux vert forêt */
  wallGreen: 0x1a3d2e,
  wallGreenDeep: 0x0f2a1e,
  wallGallery: 0x1a3d2e,
  ceilingTint: 0xa88848,
  marbleGreen: 0x2d5a48,
  marbleBrown: 0x5c3a32,
  screenBlack: 0x111111,
  basRelief: 0xf0ebe3,
};

export function readStoredChamber() {
  try {
    const q = new URLSearchParams(window.location.search).get('chamber');
    if (q === 'assemblee' || q === 'an' || q === 'assemblee-nationale') return 'assemblee';
    if (q === 'senat' || q === 'senate') return 'senat';
    const stored = localStorage.getItem(CHAMBER_STORAGE_KEY);
    if (stored === 'assemblee' || stored === 'senat') return stored;
  } catch {
    /* ignore */
  }
  return 'senat';
}

export function storeChamber(id) {
  try {
    localStorage.setItem(CHAMBER_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

/**
 * Applique une palette sur les matériaux partagés (mutables).
 * @param {Record<string, import('three').Material>} mat
 * @param {typeof SENAT_COLORS} colors
 * @param {'senat'|'assemblee'} chamber
 */
export function applyPaletteToMaterials(mat, colors, chamber) {
  const set = (m, hex, extras = {}) => {
    if (!m?.color) return;
    m.color.setHex(hex);
    if (extras.sheenColor && m.sheenColor) m.sheenColor.setHex(extras.sheenColor);
    if (extras.emissive != null && m.emissive) m.emissive.setHex(extras.emissive);
    m.needsUpdate = true;
  };

  set(mat.velvet, colors.velvet, {
    sheenColor: chamber === 'assemblee' ? 0xe04058 : 0x9d3442,
  });
  set(mat.velvetDark, colors.velvetDark, {
    sheenColor: chamber === 'assemblee' ? 0xc03048 : 0x75202d,
  });
  set(mat.velvetDeep, colors.velvetDeep);
  set(mat.wood, colors.wood);
  set(mat.woodDark, colors.woodDark);
  set(mat.woodPolish, colors.woodPolish);
  set(mat.woodLight, colors.woodLight);
  set(mat.gold, colors.gold);
  set(mat.goldBright, colors.goldBright);
  set(mat.goldMuted, colors.goldMuted);
  set(mat.carpet, colors.carpet);
  set(mat.carpetDark, colors.carpetDark);
  set(mat.marble, colors.marble);
  set(mat.marbleWarm, colors.marbleWarm);
  set(mat.curtain, colors.curtain);
  set(mat.deskTop, colors.deskTop);
  set(mat.deskLeather, colors.deskLeather);
  set(mat.marbleRed, colors.marbleRed);
  set(mat.marbleCream, colors.marbleCream);
  set(mat.paintWarm, colors.paintWarm);
  set(mat.paintSky, colors.paintSky);
  set(mat.glass, colors.glass);
}
