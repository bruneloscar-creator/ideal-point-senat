# Sénat ↔ Assemblée — lecture des résultats (L14)

## Choix de la législature pont

Parmi les sénateurs actuels (348), **26** ont un mandat Assemblée dans AMO30. Après filtre (≥25 votes pour/contre sur la législature) :

| Législature | Mandats AN | Ponts éligibles | Données votes |
| ---: | ---: | ---: | --- |
| 12 | 9 | 0 | non |
| 13 | 14 | 0 | non (pas de dump Scrutins officiel) |
| **14** | **19** | **17** | oui |
| 15 | 7 | 6 | oui |
| 16 | 0 | 0 | oui (votes Congrès isolés seulement) |
| 17 | 0 | 0 | oui |

**Législature retenue : 14e** — maximise le chevauchement utilisable pour l’ancrage.

## Méthode d’alignement

Procrustes de similarité (translation + échelle + rotation/réflexion) estimé sur les 17 ponts, mapping **AN → espace Sénat**, coordonnées Ideal **raw** (avant APRE).

Diagnostics (`procrustes_diagnostics_l14.json`) :

- scale ≈ 1.14
- RMSE ≈ 0.27 ; LOO-RMSE ≈ 0.30
- **corr(dim1) ≈ 0.89** — l’axe gauche–droite est largement partagé
- **corr(dim2) ≈ 0** — la 2e dimension n’est pas comparable entre chambres (agendas / clivages différents)

## Lecture politique

Sur les ponts, les anciens députés SRC/SER restent à gauche au Sénat (SOC), et les anciens UMP restent à droite (UMP/UC). L’ordre relatif sur dim1 se conserve bien après alignement.

Quelques trajectoires notables (résidus élevés) :

- **Brigitte Bourguignon** : SRC à l’AN → UC au Sénat (glissement vers le centre-droit)
- **Annick Girardin** : RRDP → RDSE ; décalage surtout sur dim2
- **Valérie Boyer** / **Marc-Philippe Daubresse** : UMP des deux côtés, mais positions Sénat un peu plus extrêmes sur dim1 que la projection AN

**Conclusion :** on peut comparer raisonnablement les positions **gauche–droite (dim1)** Sénat vs AN (L14) via ce mapping ; la dim2 ne doit pas être interprétée comme un axe commun.
