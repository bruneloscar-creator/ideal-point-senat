#!/usr/bin/env python3
"""Extract senators.json ONLY from senat_ideal_point_model_R_simple.ipynb outputs."""

from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB = ROOT / "notebooks" / "senat_ideal_point_model_R_simple.ipynb"
OUT = ROOT / "public" / "data" / "senators.json"
SCHEMA = ROOT / "public" / "data" / "SCHEMA.md"

GROUP_COLORS = {
    "CRC": "#B2182B",
    "GEST": "#D6604D",
    "SOC": "#EF8A62",
    "RDSE": "#FDB863",
    "LREM": "#A6D96A",
    "NI": "#999999",
    "UC": "#67A9CF",
    "RTLI": "#2166AC",
    "UMP": "#762A83",
}
GROUP_ORDER = ["CRC", "GEST", "SOC", "RDSE", "LREM", "NI", "UC", "RTLI", "UMP"]
DIM1_MULT = 1.000
DIM2_MULT = 0.564

NAME_MAT = {
    "Patricia Schillinger": "04045F",
    "François Patriat": "08061X",
    "Mikaele Kulimoetoke": "20016T",
    "Didier Rambaud": "19349W",
    "Xavier Iacovelli": "19591F",
    "Samantha Cazebonne": "19057M",
}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.cur = None
        self.in_cell = False
        self.buf = ""

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.cur = []
        if tag in ("td", "th"):
            self.in_cell = True
            self.buf = ""

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cur is not None:
            self.cur.append(re.sub(r"\s+", " ", self.buf).strip())
            self.in_cell = False
        if tag == "tr" and self.cur is not None:
            if any(self.cur):
                self.rows.append(self.cur)
            self.cur = None

    def handle_data(self, d):
        if self.in_cell:
            self.buf += d


def slugify(name: str) -> str:
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    n = re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
    return "NAME:" + n


def is_type_row(row):
    return row and all(re.fullmatch(r"<[^>]+>", c) for c in row)


def tables_in_cell(nb, i):
    out = []
    for o in nb["cells"][i].get("outputs", []):
        html = o.get("data", {}).get("text/html")
        if not html:
            continue
        html = "".join(html) if isinstance(html, list) else html
        p = TableParser()
        p.feed(html)
        if len(p.rows) >= 2:
            out.append(p.rows)
    return out


def plain_in_cell(nb, i):
    chunks = []
    for o in nb["cells"][i].get("outputs", []):
        pl = o.get("data", {}).get("text/plain")
        if pl:
            chunks.append("".join(pl) if isinstance(pl, list) else pl)
    return "\n".join(chunks)


def force(store, sid, **kwargs):
    sid = (sid or "").upper() if not str(sid).startswith("NAME:") else sid
    if str(sid).startswith("NAME:"):
        pass
    else:
        sid = sid.upper()
    rec = store.setdefault(sid, {"id": sid})
    rec.update({k: v for k, v in kwargs.items() if v is not None})


def write_schema():
    SCHEMA.write_text(
        """# Schéma `senators.json`

Source **unique** : notebook exécuté  
`notebooks/senat_ideal_point_model_R_simple.ipynb`  
(modèle `pscl::ideal` sur les **sénateurs actifs** courants = législature **2023–2026**, 348 sénateurs / 3558 scrutins dans le modèle).

## Important — couverture

Le notebook calcule Ideal Point pour **348** sénateurs, mais les sorties sauvegardées dans le `.ipynb` ne contiennent que des **tables tronquées** (`head(points_ideal)`, voisins de Samantha, focus Samantha, loyauté RDPI).  
Ce fichier n’exporte donc **que les sénateurs explicitement présents dans ces sorties**.

## Racine

| Champ | Signification |
| --- | --- |
| `meta` | Provenance, écarts, couleurs, multiplicateurs. |
| `senators` | Sénateurs extraits des sorties du notebook. |

## Champs sénateur

| Champ | Signification |
| --- | --- |
| `id` | Matricule Sénat, ou `NAME:…` si le matricule n’apparaît pas dans le notebook. |
| `name` / `nom` / `prenom` | Identité. |
| `parti` / `groupe` | Libellé court de groupe. |
| `groupe_code` | Code notebook (CRC…UMP). |
| `partyColor` | Couleur hex (`group_colors` du notebook). |
| `idealX` / `idealY` | Coordonnées Ideal Point pondérées (× multiplicateurs APRE) si disponibles. |
| `abstentionPct` | Taux d’abstention (0–100). |
| `distToGroup` | Distance au centroïde du groupe (pondérée). |
| `closeToGroup` / `farFromGroup` | Proximité au groupe. |
| `distanceToGroupLabel` | `proche` / `intermédiaire` / `éloigné`. |
| `groupLoyaltyPct` | Fidélité au groupe (0–100). |
| `distanceToSamantha1d` | Distance à Samantha sur la dimension 1. |
| `legislature` | `2023-2026`. |
| `coordsSource` | Cellule notebook d’origine. |
| `idealImputed` | Toujours `false` (pas d’imputation hors notebook). |

## Écarts

- Pas d’export CSV des 348 points dans le notebook.
- Pour obtenir les 348 lignes : ré-exécuter le notebook et `write.csv(points_ideal_weighted, …)`.
""",
        encoding="utf-8",
    )


def main():
    nb = json.loads(NB.read_text())
    store = OrderedDict()

    for rows in tables_in_cell(nb, 11):
        header = rows[0]
        for row in rows[1:]:
            if is_type_row(row) or len(row) < 8:
                continue
            d = {header[i]: row[i] for i in range(len(header))}
            dim1, dim2 = float(d["dim1"]), float(d["dim2"])
            code = d["groupe_code"].strip()
            force(
                store,
                d["matricule"],
                name=d["full_name"].strip(),
                nom=d["nom"].strip(),
                prenom=d["prenom"].strip(),
                groupe_code=code,
                groupe=d["groupe_libelle_court"].strip(),
                parti=d["groupe_libelle_court"].strip(),
                partyColor=GROUP_COLORS.get(code, "#999999"),
                idealX=round(dim1 * DIM1_MULT, 4),
                idealY=round(dim2 * DIM2_MULT, 4),
                coordsSource="points_ideal (cell 11 head, weighted)",
                legislature="2023-2026",
                idealImputed=False,
            )

    for line in plain_in_cell(nb, 19).splitlines():
        m = re.match(
            r"^(\d{5}[A-Za-z])\s+(.+?)\s+(RDSE|RDPI|UMP|UC|SOC|CRC|GEST|RTLI|NI|LREM)\s+(-?\d+\.\d+)\s+(\d+\.\d+)",
            line.strip(),
        )
        if not m:
            continue
        mid, name, grp, dim1, dist = (
            m.group(1),
            m.group(2).strip(),
            m.group(3),
            float(m.group(4)),
            float(m.group(5)),
        )
        code = "LREM" if grp == "RDPI" else grp
        force(
            store,
            mid,
            name=name,
            groupe="RDPI" if code == "LREM" else grp,
            parti="RDPI" if code == "LREM" else grp,
            groupe_code=code,
            partyColor=GROUP_COLORS.get(code, "#999999"),
            idealX=round(dim1 * DIM1_MULT, 4),
            distanceToSamantha1d=dist,
            coordsSource=store.get(mid.upper(), {}).get("coordsSource")
            or "closest_to_samantha_1d (cell 19)",
            legislature="2023-2026",
            idealImputed=False,
        )

    force(
        store,
        "19057M",
        name="Samantha Cazebonne",
        nom="Cazebonne",
        prenom="Samantha",
        groupe_code="LREM",
        groupe="RDPI",
        parti="RDPI",
        partyColor=GROUP_COLORS["LREM"],
        circonscription="Français établis hors de France (Série 2)",
        idealX=-0.272,
        idealY=0.488,
        groupDim1Mean=-0.229,
        groupDim2Mean=0.433,
        distToGroup=0.07,
        rankInGroupLeftToRight=6,
        percentileInGroupLeftToRight=0.278,
        groupMembers=19,
        abstentionPct=8.8,
        nonVotingPct=1.1,
        yesNoSharePct=90.1,
        totalPublicVotes=1368,
        yesVotes=589,
        noVotes=644,
        abstentions=120,
        nonVoting=15,
        groupMeanAbstentionPct=8.4,
        rankAbstentionInGroup=11,
        groupLoyaltyPct=99.5,
        votesAgainstGroup=6,
        votesWithGroup=1225,
        yesNoVotesWithGroupMajority=1231,
        rankMostLoyalInGroup=6,
        distanceToGroupLabel="proche",
        closeToGroup=True,
        farFromGroup=False,
        coordsSource="points_ideal_weighted focus (cells 23–28)",
        legislature="2023-2026",
        idealImputed=False,
    )

    for rows in tables_in_cell(nb, 29):
        header = rows[0]
        for row in rows[1:]:
            if is_type_row(row):
                continue
            d = {header[i]: row[i] for i in range(min(len(header), len(row)))}
            name = d.get("full_name", "").strip()
            mid = NAME_MAT.get(name) or slugify(name)
            force(
                store,
                mid,
                name=name,
                groupe=d.get("group", "").strip() or "RDPI",
                parti=d.get("group", "").strip() or "RDPI",
                groupe_code="LREM",
                partyColor=GROUP_COLORS["LREM"],
                groupLoyaltyPct=round(float(d["group_loyalty_rate"]) * 100, 1),
                votesAgainstGroup=int(float(d["votes_against_group"])),
                yesNoVotesWithGroupMajority=int(float(d["yes_no_votes_with_group_majority"])),
                abstentionPct=round(float(d["abstention_rate"]) * 100, 1),
                loyaltyCategory=d.get("category", "").strip(),
                legislature="2023-2026",
                idealImputed=False,
            )

    gx, gy = -0.229, 0.433
    for sid, rec in store.items():
        if (
            rec.get("idealX") is not None
            and rec.get("idealY") is not None
            and rec.get("groupe_code") == "LREM"
            and sid != "19057M"
            and rec.get("distToGroup") is None
        ):
            dist = math.hypot(rec["idealX"] - gx, rec["idealY"] - gy)
            rec["distToGroup"] = round(dist, 4)
        if rec.get("distToGroup") is not None and "distanceToGroupLabel" not in rec:
            d = rec["distToGroup"]
            if d <= 0.10:
                rec["distanceToGroupLabel"] = "proche"
                rec["closeToGroup"] = True
                rec["farFromGroup"] = False
            elif d >= 0.25:
                rec["distanceToGroupLabel"] = "éloigné"
                rec["closeToGroup"] = False
                rec["farFromGroup"] = True
            else:
                rec["distanceToGroupLabel"] = "intermédiaire"
                rec["closeToGroup"] = False
                rec["farFromGroup"] = False

    export = []
    for sid, rec in store.items():
        export.append(
            {
                "id": rec["id"],
                "name": rec.get("name"),
                "nom": rec.get("nom"),
                "prenom": rec.get("prenom"),
                "parti": rec.get("parti") or rec.get("groupe"),
                "groupe": rec.get("groupe") or rec.get("parti"),
                "groupe_code": rec.get("groupe_code"),
                "groupe_libelle": rec.get("groupe_libelle") or rec.get("groupe"),
                "partyColor": rec.get("partyColor")
                or GROUP_COLORS.get(rec.get("groupe_code") or "", "#999999"),
                "idealX": rec.get("idealX"),
                "idealY": rec.get("idealY"),
                "abstentionPct": rec.get("abstentionPct"),
                "nonVotingPct": rec.get("nonVotingPct"),
                "yesNoSharePct": rec.get("yesNoSharePct"),
                "distToGroup": rec.get("distToGroup"),
                "farFromGroup": rec.get("farFromGroup"),
                "closeToGroup": rec.get("closeToGroup"),
                "distanceToGroupLabel": rec.get("distanceToGroupLabel"),
                "groupLoyaltyPct": rec.get("groupLoyaltyPct"),
                "votesAgainstGroup": rec.get("votesAgainstGroup"),
                "votesWithGroup": rec.get("votesWithGroup"),
                "yesNoVotesWithGroupMajority": rec.get("yesNoVotesWithGroupMajority"),
                "rankInGroupLeftToRight": rec.get("rankInGroupLeftToRight"),
                "percentileInGroupLeftToRight": rec.get("percentileInGroupLeftToRight"),
                "rankMostLoyalInGroup": rec.get("rankMostLoyalInGroup"),
                "rankAbstentionInGroup": rec.get("rankAbstentionInGroup"),
                "groupMembers": rec.get("groupMembers"),
                "groupDim1Mean": rec.get("groupDim1Mean"),
                "groupDim2Mean": rec.get("groupDim2Mean"),
                "distanceToSamantha1d": rec.get("distanceToSamantha1d"),
                "loyaltyCategory": rec.get("loyaltyCategory"),
                "circonscription": rec.get("circonscription"),
                "totalPublicVotes": rec.get("totalPublicVotes"),
                "yesVotes": rec.get("yesVotes"),
                "noVotes": rec.get("noVotes"),
                "abstentions": rec.get("abstentions"),
                "nonVoting": rec.get("nonVoting"),
                "coordsSource": rec.get("coordsSource"),
                "legislature": "2023-2026",
                "idealImputed": False,
            }
        )

    export.sort(
        key=lambda s: (
            s["idealX"] is None,
            s["idealX"] if s["idealX"] is not None else 0,
            s["name"] or "",
        )
    )
    for i, s in enumerate(export):
        if s["idealX"] is not None:
            s["idealRankLeftToRight"] = i + 1

    payload = {
        "meta": {
            "source": (
                "Extracted ONLY from executed cell outputs of "
                "senat_ideal_point_model_R_simple.ipynb"
            ),
            "notebook": str(NB),
            "legislature": "2023-2026",
            "model": "pscl::ideal d=2 seed=123 maxiter=1000 burnin=500 thin=25",
            "n_senators_in_model": 348,
            "n_rollcalls_in_model": 3558,
            "n_senators_exported": len(export),
            "gap": (
                "Notebook fits 348 Ideal Points but only truncated tables are stored in "
                "the .ipynb outputs (head, Samantha focus, neighbors, RDPI loyalty)."
            ),
            "group_order": GROUP_ORDER,
            "group_colors": GROUP_COLORS,
            "dimension_multipliers": {"dim1": DIM1_MULT, "dim2": DIM2_MULT},
        },
        "senators": export,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_schema()
    print(f"Wrote {OUT} ({len(export)} senators)")
    print(f"Wrote {SCHEMA}")


if __name__ == "__main__":
    main()
