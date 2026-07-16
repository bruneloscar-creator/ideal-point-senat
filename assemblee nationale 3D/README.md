# Assemblée nationale 3D

Maquette 3D de l’hémicycle de l’Assemblée nationale (Palais Bourbon), adaptée de la scène Sénat du site Ideal Point.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `theme.js` | Palette AN, persistance `localStorage`, application des matériaux |
| `assembleeChamber.js` | Construction Three.js de l’architecture AN (murs, tribune, plafond…) |
| `refs/` | Photos de référence de l’hémicycle |

## Intégration site

Le viewer (`src/main.js` + `index.html`) charge cette maquette et propose un basculeur **Sénat ↔ Assemblée nationale**.

- Clé de stockage : `hemicycle-chamber` (`senat` \| `assemblee`)
- Query optionnelle : `?chamber=assemblee` ou `?chamber=senat`

## Lancer

Depuis la racine du dépôt :

```bash
npm install
npm run dev
```

Puis ouvrir l’URL Vite et utiliser le basculeur « Chambre » en bas de l’écran.

## Différences visuelles vs Sénat

- Velours / tapis **rouge vif** (AN)
- Panneaux muraux **vert sombre + ornement or**
- Colonnes **blanc / crème** (moins d’or massif)
- Tribune avec **bas-relief marbre blanc** + drap rouge au perchoir
- **Tapisserie centrale**, statues en niches, **écrans noirs** modernes
- Sol du puits en **marbre vert / blanc**
- Plafond **caissonné or** + verrière **éventail** à structure métallique
