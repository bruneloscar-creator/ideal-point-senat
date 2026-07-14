# Données du modèle

Ce dossier contient les tables préparées utilisées par le pipeline Ideal Point.

## Fichiers

| Fichier | Contenu | Lignes |
| --- | --- | ---: |
| `model_ready/votes_senateurs_actifs.csv.gz` | Votes publics individuels des sénateurs actifs, CSV compressé | 698 455 votes plus l'en-tête |
| `model_ready/senateurs_actifs.csv` | Identité, groupe, circonscription et métadonnées des 348 sénateurs actifs | 348 sénateurs plus l'en-tête |
| `model_ready/scrutins_rollcalls.csv` | Métadonnées des scrutins publics | 4 759 scrutins plus l'en-tête |

## Décompression

```bash
gunzip -k data/model_ready/votes_senateurs_actifs.csv.gz
```

Le fichier CSV décompressé occupe 273 554 838 octets. La version compressée est identique au fichier utilisé par le pipeline après décompression.

## Sommes SHA-256

```text
dc2c71b13164eaa25d313d36360723b609354b075d8e6f6b62f85cc05aafd69b  scrutins_rollcalls.csv
e43deea478a1f7fbbb0dac45e836a937f9bcf86ce9750f5f47e88d67c4ec1fbc  senateurs_actifs.csv
167dbef92104daa0613c3df8f4c67fcef185686bffabe6bde359a0ae74d2c858  votes_senateurs_actifs.csv.gz
b1a761d2743bcc20472aed6b752b7ae0a5ec2b302254864bcf52db7398e76665  votes_senateurs_actifs.csv décompressé
```

## Filtrage pour le modèle

Le pipeline conserve les votes codés pour ou contre. Il écarte les scrutins dont la minorité représente moins de 10 % des suffrages exprimés et les sénateurs disposant de moins de 25 votes exprimés après ce filtre.

La matrice finale contient 348 sénateurs, 3 558 scrutins et 482 544 votes utilisables.

## Provenance

Les tables ont été préparées à partir des publications publiques du Sénat français. Les pages de référence sont indiquées dans [`../REFERENCES.md`](../REFERENCES.md).

La réutilisation des données reste soumise aux conditions du portail Open Data du Sénat.
