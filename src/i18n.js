/**
 * FR / EN i18n for Ideal Point Sénat.
 * Storage key: hemicycle-lang = 'fr' | 'en'
 *
 * Add strings: dictionaries.fr / dictionaries.en, then use
 *   t('key') in JS, or data-i18n / data-i18n-html / data-i18n-placeholder /
 *   data-i18n-title / data-i18n-aria on HTML. Call applyI18n() after DOM edits.
 */

export const LANG_STORAGE_KEY = 'hemicycle-lang';

const dictionaries = {
  fr: {
    'meta.title': 'Ideal Point Sénat — Hémicycle 3D',
    'meta.description':
      'Explorez les positions de vote des 348 sénateurs dans une maquette 3D de l’hémicycle, estimées par un modèle Ideal Point.',
    'meta.ogTitle': 'Ideal Point Sénat — Hémicycle 3D',
    'meta.ogDescription': '348 sénateurs · 3 558 scrutins · Une cartographie 3D des positions de vote.',

    'lang.label': 'Langue',
    'lang.fr': 'Français',
    'lang.en': 'English',

    'intro.brand': 'Ideal Point · Sénat',
    'intro.eyebrow': 'Modèle Ideal Point · Votes publics',
    'intro.title': 'Visualisation<br /><em>Sénat</em>',
    'intro.pitch':
      'Un modèle entraîné sur 698&nbsp;455 votes publics estime en 2D la position idéologique révélée de chaque sénateur.',
    'intro.guidanceStrong': 'Les sièges suivent les votes, pas les groupes',
    'intro.guidanceSmall':
      'Dans cet hémicycle, les sénateurs sont placés par proximité de vote — pas à leur place officielle.',
    'intro.axisLeft': 'Gauche',
    'intro.axisRight': 'Droite',
    'intro.statsLabel': 'Chiffres clés',
    'intro.statSenators': 'sénateurs',
    'intro.statVotes': 'scrutins retenus',
    'intro.statDims': 'positions estimées',
    'intro.enter': 'Explorer l’hémicycle des votes <span aria-hidden="true">↗</span>',
    'intro.skip': 'Accès direct',
    'intro.about': 'Découvrir la méthode <span aria-hidden="true">→</span>',
    'intro.idealHead': 'Idéologie révélée par les votes',
    'intro.modelStatus': 'Modèle entraîné',
    'intro.loading': 'Chargement de la projection…',
    'intro.scatterAria': 'Projection en 2D des positions de vote estimées des sénateurs',
    'intro.captionX': 'Position estimée · gauche ↔ droite',
    'intro.captionTerm': 'Mandature 2023—2026',

    'coach.title': 'Cliquez sur un sénateur',
    'coach.sub': 'pour découvrir sa position et ses indicateurs',

    'header.eyebrow': 'Visualisation politique · 2023—2026',
    'header.title': 'Ideal Point <span>Sénat</span>',
    'header.metaLive': 'Modèle actif',
    'header.metaSeats': '348 sièges',
    'header.metaDims': '2 dimensions',
    'header.hint': 'Survolez un siège · cliquez pour analyser · glissez pour explorer',
    'header.hintLoaded': '{n} sénateurs · Ideal Point 2023–2026{nb} · Survol / clic sur un siège',
    'header.hintPlaceholder':
      'Données temporaires — chargement des sénateurs · Survol / clic',
    'header.about': 'À propos <span aria-hidden="true">↗</span>',

    'search.label': 'Rechercher un sénateur',
    'search.placeholder': 'Nom ou département…',
    'search.empty': 'Aucun sénateur trouvé',
    'search.unnamed': 'Sans nom',

    'controls.label': 'Caméra',
    'controls.reset': '<i aria-hidden="true">⌂</i> Vue globale',
    'controls.resetTitle': 'Réinitialiser la caméra',
    'controls.orbit': '<i aria-hidden="true">◉</i> Orbite guidée',
    'controls.orbitTitle': 'Vue depuis les bancs, vers la tribune',

    'panel.close': 'Fermer',
    'panel.eyebrow': 'Profil parlementaire',
    'panel.idealAria': 'Carte Ideal Point',
    'panel.idealTitle': 'Position Ideal Point',
    'panel.idealSub': 'Nuage des 348 sénateurs · axes du modèle',
    'panel.scatterAria': 'Nuage Ideal Point des sénateurs',
    'panel.metricsAria': 'Indicateurs comparatifs',
    'panel.comparisons': 'Repères statistiques',
    'panel.comparisonSub': 'Comparaison descriptive avec les 348 sénateurs',
    'panel.unnamed': 'Sans nom',
    'panel.partyUnknown': 'Parti inconnu',

    'chart.distribution': 'Distribution de {label}',
    'chart.distributionDesc':
      'Boîte du premier au troisième quartile, médiane et moustaches du 5e au 95e percentile. Le sénateur est à {value}.',
    'chart.senator': 'Sénateur',
    'chart.senateMedian': 'Médiane Sénat',
    'chart.groupMedian': 'Médiane groupe',

    'metric.abstention': 'Taux d’abstention',
    'metric.abstentionReadout':
      '<em>{pct} %</em> des sénateurs ont un taux inférieur.{groupBit}',
    'metric.abstentionHint':
      'Part des votes publics pour lesquels le sénateur a voté « abstention ».',
    'metric.abstentionLow': 'Faible',
    'metric.abstentionHigh': 'Élevée',
    'metric.typical': 'Dans la norme',
    'metric.groupMedianBit': ' Médiane {party} : <em>{value}</em>.',

    'metric.distGroup': 'Distance au groupe',
    'metric.distReadout':
      'Plus éloigné de son groupe que <em>{pct} %</em> des sénateurs.{groupBit}',
    'metric.distHint':
      'Distance dans l’espace Ideal entre le sénateur et le centroïde de son groupe parlementaire.',
    'metric.distNear': 'Très proche',
    'metric.distTypical': 'Distance courante',
    'metric.distFar': 'Plus isolé',
    'metric.toneFar': 'loin du groupe',
    'metric.toneClose': 'proche du groupe',
    'metric.toneMid': 'intermédiaire',

    'metric.loyalty': 'Fidélité au groupe',
    'metric.loyaltyReadout':
      'Taux supérieur à celui de <em>{pct} %</em> des sénateurs.{groupBit}',
    'metric.loyaltyHint':
      'Part des votes pour/contre identiques à la position majoritaire du groupe.',
    'metric.loyaltyLow': 'Moins aligné',
    'metric.loyaltyTypical': 'Niveau courant',
    'metric.loyaltyHigh': 'Très aligné',
    'metric.loyaltyMissing': 'Donnée absente pour ce sénateur.',
    'metric.loyaltyMissingHint':
      'Aucun proxy calculé : le champ groupLoyaltyPct n’est pas renseigné.',

    'metric.seatGap': 'Cohérence avec le siège',
    'metric.seatGapReadout':
      'Écart local plus grand que celui de <em>{pct} %</em> des sièges.',
    'metric.seatGapHint':
      'Distance standardisée entre sa position Ideal et la médiane de ses {n} voisins physiques. Les axes X et Y sont ramenés à leur dispersion robuste. Comparaison descriptive, pas test d’hypothèse.',
    'metric.seatValueUnit': 'écart standardisé',
    'metric.seatVeryAligned': 'Très bien aligné',
    'metric.seatTypical': 'Dans la norme',
    'metric.seatMarked': 'Décalage marqué',
    'metric.seatVeryMarked': 'Décalage très marqué',

    'field.officialSeat': 'Siège officiel',
    'field.idealRank': 'Rang Ideal (G→D)',
    'field.idealImputed': 'Ideal imputé',
    'field.idealImputedYes': 'Oui (centroïde de groupe)',
    'field.nonVoting': 'Non-participation',
    'field.senatePage': 'Fiche Sénat',

    'scatter.left': 'Gauche',
    'scatter.right': 'Droite',
    'scatter.top': 'Haut',
    'scatter.topFull': 'Haut · loin',
    'scatter.bottom': 'Bas',
    'scatter.bottomFull': 'Bas · proche',
    'scatter.senator': 'Sénateur',

    'about.meta.title': 'À propos — Ideal Point Sénat · Oscar Brunel',
    'about.meta.description':
      'Note de recherche et maquette 3D : estimation des positions de vote au Sénat par modèle IDEAL (législature 2023–2026).',
    'about.meta.ogTitle': 'Ideal Point Sénat — Méthode & données',
    'about.meta.ogDescription':
      'Comment 482 544 votes exploitables révèlent la géométrie politique du Sénat.',

    'about.navLabel': 'Navigation principale',
    'about.navBackSmall': 'Sénat · 2023—2026',
    'about.navProject': 'Projet',
    'about.navMethod': 'Méthode',
    'about.navLimits': 'Limites',
    'about.navContact': 'Contact <span aria-hidden="true">↗</span>',

    'about.hero.eyebrow': 'Note de recherche · Législature 2023–2026',
    'about.hero.title': 'Visualisation<br /><em>Sénat</em>',
    'about.hero.lede':
      'Où se situent les sénateurs les uns par rapport aux autres, d’après leurs seuls votes publics — estimé par un modèle Ideal Point, puis placé dans l’hémicycle.',
    'about.hero.ctaPrimary': 'Explorer la maquette 3D <span aria-hidden="true">↗</span>',
    'about.hero.ctaGhost': 'Comprendre le modèle',
    'about.hero.statsLabel': 'Chiffres clés du modèle',
    'about.hero.stat1': 'sénateurs actifs',
    'about.hero.stat2': 'scrutins retenus',
    'about.hero.stat3': 'votes exploitables',
    'about.hero.stat4': 'dimensions latentes',

    'about.who.title': 'Qui je suis',
    'about.who.body':
      'Je suis <strong>Oscar Brunel</strong>. Cette note documente un travail de recherche sur les positions de vote au Sénat : un modèle Ideal Point bayésien, et une maquette 3D qui place chaque siège à sa position estimée à partir des scrutins publics.',

    'about.project.title': 'Le projet',
    'about.project.p1':
      'Cette application croise deux objets : une <strong>maquette 3D</strong> des 348 sièges du Palais du Luxembourg, et une <strong>carte Ideal Point</strong> issue de l’analyse des votes depuis le renouvellement de 2023.',
    'about.project.p2':
      'Le principe relève de l’apprentissage statistique : à partir de la matrice des votes (sénateurs × scrutins, « pour » / « contre »), un modèle place chaque sénateur dans un espace à deux dimensions — sans étiquette de parti. Deux sénateurs qui votent de façon similaire se retrouvent proches ; ceux qui s’opposent souvent sont éloignés.',
    'about.project.note':
      'Le résultat mesure une <em>position de vote révélée</em> sur un ensemble de votes publics sélectionnés. Ce n’est pas une mesure d’idéologie au sens large : un vote au Sénat dépend aussi de la discipline de groupe, de la nature des textes et du calendrier parlementaire.',

    'about.map.title': 'La carte Ideal Point',
    'about.map.body':
      'Chaque point est un sénateur. L’axe horizontal suit le clivage gauche–droite qui émerge des votes ; l’axe vertical place plus haut les profils éloignés du banc de la présidence (dont le RDPI).',
    'about.map.scatterAria': 'Nuage Ideal Point des 348 sénateurs',
    'about.map.caption': 'Carte Ideal Point · législature 2023–2026',
    'about.map.legendAria': 'Légende des groupes',
    'about.map.error': 'Carte temporairement indisponible',

    'about.method.title': 'Ce qui a été fait',
    'about.method.dataTitle': 'Données',
    'about.method.dataBody':
      'Les données brutes rassemblent <strong>698&nbsp;455</strong> votes individuels pour les <strong>348</strong> sénateurs actifs, répartis sur <strong>4&nbsp;759</strong> scrutins. Après filtres — votes exprimés uniquement, scrutins déséquilibrés écartés (minorité &lt;&nbsp;10&nbsp;%), seuil de présence (≥&nbsp;25 votes exprimés) — le modèle porte sur <strong>3&nbsp;558</strong> scrutins et <strong>482&nbsp;544</strong> votes exploitables (54&nbsp;% contre, 46&nbsp;% pour).',
    'about.method.howTitle': 'Comment Ideal Point marche',
    'about.method.howP1':
      'On part d’une matrice votes : sénateurs × scrutins. Chaque case est «&nbsp;pour&nbsp;» ou «&nbsp;contre&nbsp;» ; abstention ou absence → case manquante.',
    'about.method.howP2':
      'Chaque sénateur a une position latente <em>x<sub>i</sub></em> (ici en 2D) ; chaque scrutin a ses paramètres de discrimination et de difficulté. Style spatial / réponse à l’item (famille IDEAL / Clinton–Jackman–Rivers)&nbsp;: la probabilité de voter «&nbsp;oui&nbsp;» monte quand la position du sénateur s’aligne avec le côté proposé — schématiquement&nbsp;: <code>P(oui) ≈ Φ(β′x<sub>i</sub> − α)</code>.',
    'about.method.howP3':
      'L’estimation MCMC (<code>pscl::ideal</code>) récupère les coordonnées ; les axes sont ensuite orientés (gauche–droite, etc.) pour la lecture.',
    'about.method.idealTitle': 'Modèle IDEAL (mise en œuvre)',
    'about.method.idealBody':
      'Ici&nbsp;: 2 dimensions, 1&nbsp;000 itérations, 500 de rodage, thin 25. Votes codés 1&nbsp;=&nbsp;pour, 0&nbsp;=&nbsp;contre ; abstentions et absences = manquantes. L’orientation de l’axe gauche–droite est fixée après estimation à partir des groupes de référence.',
    'about.method.readTitle': 'Lecture de l’espace',
    'about.method.read1':
      'La <strong>dimension 1</strong> correspond à un clivage gauche–droite qui émerge des votes eux-mêmes, sans avoir été imposé.',
    'about.method.read2':
      'La <strong>dimension 2</strong> capte des différences secondaires ; elle semble pouvoir représenter le soutien au gouvernement (haut = plus proche du bloc gouvernemental).',
    'about.method.read3':
      'Les groupes forment des blocs distincts le long de l’axe horizontal, confirmant que le modèle reconstitue la structure politique de l’assemblée à partir des seuls votes.',
    'about.method.read4':
      'Les non-inscrits (RN, Reconquête) apparaissent près du centre : artefact lié aux abstentions fréquentes, traitées comme données manquantes — le modèle manque alors de votes exprimés pour les situer.',
    'about.method.vizTitle': 'Visualisation',
    'about.method.vizBody':
      'La maquette 3D place chaque sénateur sur son siège et expose, au clic, sa position Ideal Point dans le nuage de l’hémicycle — pour relier le plancher du Sénat à la géométrie des votes.',

    'about.limits.title': 'Portée et limites',
    'about.limits.1':
      'Position de vote révélée sur scrutins publics sélectionnés — pas une idéologie complète ni l’activité hors hémicycle.',
    'about.limits.2': 'La nature des textes mis au vote public influence les positions estimées.',
    'about.limits.3':
      'La discipline de groupe, structurellement forte, comprime les écarts internes et peut exagérer la cohésion apparente.',
    'about.limits.4':
      'La zone centrale mêle profils centristes et profils peu positionnables (faibles votants).',

    'about.refs.title': 'Références',
    'about.refs.intro': 'La méthodologie s’appuie notamment sur&nbsp;:',

    'about.contact.title': 'Contact',
    'about.contact.body': 'Pour toute question sur la méthode, les données ou la maquette :',
    'about.contact.linkedin': 'LinkedIn — Oscar Brunel',

    'about.footer.copy': 'Oscar Brunel · Ideal Point Sénat · Maquette hémicycle 3D',
    'about.footer.back': 'Retour à l’hémicycle',
  },

  en: {
    'meta.title': 'Senate Ideal Point — 3D Hemicycle',
    'meta.description':
      'Explore the voting positions of 348 senators in a 3D hemicycle model, estimated with an Ideal Point model.',
    'meta.ogTitle': 'Senate Ideal Point — 3D Hemicycle',
    'meta.ogDescription': '348 senators · 3,558 roll calls · A 3D map of voting positions.',

    'lang.label': 'Language',
    'lang.fr': 'French',
    'lang.en': 'English',

    'intro.brand': 'Ideal Point · Senate',
    'intro.eyebrow': 'Ideal Point model · Public votes',
    'intro.title': 'Senate<br /><em>Visualization</em>',
    'intro.pitch':
      'A model trained on 698,455 public votes estimates each senator’s revealed ideological position in 2D.',
    'intro.guidanceStrong': 'Seats follow votes, not political groups',
    'intro.guidanceSmall':
      'In this hemicycle, senators are placed by voting similarity — not in their official seats.',
    'intro.axisLeft': 'Left',
    'intro.axisRight': 'Right',
    'intro.statsLabel': 'Key figures',
    'intro.statSenators': 'senators',
    'intro.statVotes': 'roll calls kept',
    'intro.statDims': 'estimated positions',
    'intro.enter': 'Explore the voting hemicycle <span aria-hidden="true">↗</span>',
    'intro.skip': 'Skip intro',
    'intro.about': 'Discover the method <span aria-hidden="true">→</span>',
    'intro.idealHead': 'Ideology revealed by votes',
    'intro.modelStatus': 'Trained model',
    'intro.loading': 'Loading projection…',
    'intro.scatterAria': '2D projection of senators’ estimated voting positions',
    'intro.captionX': 'Estimated position · left ↔ right',
    'intro.captionTerm': 'Term 2023—2026',

    'coach.title': 'Click a senator',
    'coach.sub': 'to discover their position and indicators',

    'header.eyebrow': 'Political visualization · 2023—2026',
    'header.title': 'Ideal Point <span>Senate</span>',
    'header.metaLive': 'Model live',
    'header.metaSeats': '348 seats',
    'header.metaDims': '2 dimensions',
    'header.hint': 'Hover a seat · click to analyse · drag to explore',
    'header.hintLoaded': '{n} senators · Ideal Point 2023–2026{nb} · Hover / click a seat',
    'header.hintPlaceholder':
      'Temporary data — loading senators · Hover / click',
    'header.about': 'About <span aria-hidden="true">↗</span>',

    'search.label': 'Search for a senator',
    'search.placeholder': 'Name or département…',
    'search.empty': 'No senator found',
    'search.unnamed': 'Unnamed',

    'controls.label': 'Camera',
    'controls.reset': '<i aria-hidden="true">⌂</i> Overview',
    'controls.resetTitle': 'Reset camera',
    'controls.orbit': '<i aria-hidden="true">◉</i> Guided orbit',
    'controls.orbitTitle': 'View from the benches, toward the tribune',

    'panel.close': 'Close',
    'panel.eyebrow': 'Parliamentary profile',
    'panel.idealAria': 'Ideal Point map',
    'panel.idealTitle': 'Ideal Point position',
    'panel.idealSub': 'Cloud of 348 senators · model axes',
    'panel.scatterAria': 'Ideal Point scatter of senators',
    'panel.metricsAria': 'Comparative indicators',
    'panel.comparisons': 'Statistical benchmarks',
    'panel.comparisonSub': 'Descriptive comparison with all 348 senators',
    'panel.unnamed': 'Unnamed',
    'panel.partyUnknown': 'Unknown party',

    'chart.distribution': 'Distribution of {label}',
    'chart.distributionDesc':
      'Box from the first to third quartile, median, and whiskers from the 5th to 95th percentile. The senator is at {value}.',
    'chart.senator': 'Senator',
    'chart.senateMedian': 'Senate median',
    'chart.groupMedian': 'Group median',

    'metric.abstention': 'Abstention rate',
    'metric.abstentionReadout':
      '<em>{pct}%</em> of senators have a lower rate.{groupBit}',
    'metric.abstentionHint':
      'Share of public votes on which the senator cast an abstention.',
    'metric.abstentionLow': 'Low',
    'metric.abstentionHigh': 'High',
    'metric.typical': 'Typical range',
    'metric.groupMedianBit': ' {party} median: <em>{value}</em>.',

    'metric.distGroup': 'Distance to group',
    'metric.distReadout':
      'Farther from their group than <em>{pct}%</em> of senators.{groupBit}',
    'metric.distHint':
      'Distance in Ideal space between the senator and their parliamentary group centroid.',
    'metric.distNear': 'Very close',
    'metric.distTypical': 'Typical distance',
    'metric.distFar': 'More isolated',
    'metric.toneFar': 'far from the group',
    'metric.toneClose': 'close to the group',
    'metric.toneMid': 'intermediate',

    'metric.loyalty': 'Group loyalty',
    'metric.loyaltyReadout':
      'Rate higher than that of <em>{pct}%</em> of senators.{groupBit}',
    'metric.loyaltyHint':
      'Share of yea/nay votes matching the group majority position.',
    'metric.loyaltyLow': 'Less aligned',
    'metric.loyaltyTypical': 'Typical range',
    'metric.loyaltyHigh': 'Highly aligned',
    'metric.loyaltyMissing': 'No data for this senator.',
    'metric.loyaltyMissingHint': 'No proxy computed: groupLoyaltyPct is missing.',

    'metric.seatGap': 'Fit with seat neighbourhood',
    'metric.seatGapReadout':
      'Local gap larger than that of <em>{pct}%</em> of seats.',
    'metric.seatGapHint':
      'Standardised distance between the senator’s Ideal position and the median of their {n} physical neighbours. X and Y are scaled by their robust dispersion. Descriptive comparison, not a hypothesis test.',
    'metric.seatValueUnit': 'standardised gap',
    'metric.seatVeryAligned': 'Very well aligned',
    'metric.seatTypical': 'Typical range',
    'metric.seatMarked': 'Marked offset',
    'metric.seatVeryMarked': 'Very marked offset',

    'field.officialSeat': 'Official seat',
    'field.idealRank': 'Ideal rank (L→R)',
    'field.idealImputed': 'Imputed Ideal',
    'field.idealImputedYes': 'Yes (group centroid)',
    'field.nonVoting': 'Non-participation',
    'field.senatePage': 'Senate page',

    'scatter.left': 'Left',
    'scatter.right': 'Right',
    'scatter.top': 'Top',
    'scatter.topFull': 'Top · far',
    'scatter.bottom': 'Bottom',
    'scatter.bottomFull': 'Bottom · near',
    'scatter.senator': 'Senator',

    'about.meta.title': 'About — Senate Ideal Point · Oscar Brunel',
    'about.meta.description':
      'Research note and 3D model: estimating Senate voting positions with an IDEAL model (2023–2026 legislature).',
    'about.meta.ogTitle': 'Senate Ideal Point — Method & data',
    'about.meta.ogDescription':
      'How 482,544 usable votes reveal the political geometry of the Senate.',

    'about.navLabel': 'Main navigation',
    'about.navBackSmall': 'Senate · 2023—2026',
    'about.navProject': 'Project',
    'about.navMethod': 'Method',
    'about.navLimits': 'Limits',
    'about.navContact': 'Contact <span aria-hidden="true">↗</span>',

    'about.hero.eyebrow': 'Research note · 2023–2026 legislature',
    'about.hero.title': 'Senate<br /><em>Visualization</em>',
    'about.hero.lede':
      'Where senators stand relative to one another, from public votes alone — estimated with an Ideal Point model, then placed in the hemicycle.',
    'about.hero.ctaPrimary': 'Explore the 3D model <span aria-hidden="true">↗</span>',
    'about.hero.ctaGhost': 'Understand the model',
    'about.hero.statsLabel': 'Model key figures',
    'about.hero.stat1': 'active senators',
    'about.hero.stat2': 'roll calls kept',
    'about.hero.stat3': 'usable votes',
    'about.hero.stat4': 'latent dimensions',

    'about.who.title': 'Who I am',
    'about.who.body':
      'I am <strong>Oscar Brunel</strong>. This note documents research on Senate voting positions: a Bayesian Ideal Point model, and a 3D mock-up that places each seat at its estimated position from public roll calls.',

    'about.project.title': 'The project',
    'about.project.p1':
      'This app brings together two objects: a <strong>3D model</strong> of the 348 seats in the Palais du Luxembourg, and an <strong>Ideal Point map</strong> from vote analysis since the 2023 renewal.',
    'about.project.p2':
      'The idea is statistical learning: from the vote matrix (senators × roll calls, yea / nay), a model places each senator in a two-dimensional space — with no party labels. Senators who vote alike end up close; those who often oppose sit far apart.',
    'about.project.note':
      'The result measures a <em>revealed voting position</em> on a selected set of public votes. It is not ideology in a broad sense: a Senate vote also depends on group discipline, the nature of bills, and the parliamentary calendar.',

    'about.map.title': 'The Ideal Point map',
    'about.map.body':
      'Each point is a senator. The horizontal axis follows the left–right cleavage that emerges from the votes; the vertical axis places higher the profiles farther from the presidential bench (including RDPI).',
    'about.map.scatterAria': 'Ideal Point cloud of 348 senators',
    'about.map.caption': 'Ideal Point map · 2023–2026 legislature',
    'about.map.legendAria': 'Group legend',
    'about.map.error': 'Map temporarily unavailable',

    'about.method.title': 'What was done',
    'about.method.dataTitle': 'Data',
    'about.method.dataBody':
      'Raw data gather <strong>698,455</strong> individual votes for the <strong>348</strong> active senators across <strong>4,759</strong> roll calls. After filters — expressed votes only, lopsided roll calls dropped (minority &lt;&nbsp;10%), attendance threshold (≥&nbsp;25 expressed votes) — the model covers <strong>3,558</strong> roll calls and <strong>482,544</strong> usable votes (54% nay, 46% yea).',
    'about.method.howTitle': 'How Ideal Point works',
    'about.method.howP1':
      'Start from a vote matrix: senators × roll calls. Each cell is yea or nay; abstention or absence → missing.',
    'about.method.howP2':
      'Each senator has a latent position <em>x<sub>i</sub></em> (here in 2D); each roll call has discrimination and difficulty parameters. Spatial / item-response style (IDEAL family / Clinton–Jackman–Rivers): the probability of voting yea rises when the senator’s position aligns with the proposed side — schematically: <code>P(yea) ≈ Φ(β′x<sub>i</sub> − α)</code>.',
    'about.method.howP3':
      'MCMC estimation (<code>pscl::ideal</code>) recovers the coordinates; axes are then oriented (left–right, etc.) for reading.',
    'about.method.idealTitle': 'IDEAL model (implementation)',
    'about.method.idealBody':
      'Here: 2 dimensions, 1,000 iterations, 500 burn-in, thin 25. Votes coded 1 = yea, 0 = nay; abstentions and absences = missing. Left–right axis orientation is fixed after estimation from reference groups.',
    'about.method.readTitle': 'Reading the space',
    'about.method.read1':
      '<strong>Dimension 1</strong> matches a left–right cleavage that emerges from the votes themselves, without being imposed.',
    'about.method.read2':
      '<strong>Dimension 2</strong> captures secondary differences; it may reflect government support (top = closer to the governing bloc).',
    'about.method.read3':
      'Groups form distinct blocks along the horizontal axis, confirming that the model rebuilds the chamber’s political structure from votes alone.',
    'about.method.read4':
      'Non-inscrits (RN, Reconquête) appear near the centre: an artefact of frequent abstentions treated as missing data — the model then lacks expressed votes to place them.',
    'about.method.vizTitle': 'Visualization',
    'about.method.vizBody':
      'The 3D model places each senator on their seat and, on click, shows their Ideal Point in the hemicycle cloud — linking the Senate floor to the geometry of votes.',

    'about.limits.title': 'Scope and limits',
    'about.limits.1':
      'Revealed voting position on selected public roll calls — not a full ideology, nor activity outside the chamber.',
    'about.limits.2': 'The nature of bills put to public vote shapes estimated positions.',
    'about.limits.3':
      'Strong group discipline compresses within-group gaps and can exaggerate apparent cohesion.',
    'about.limits.4':
      'The centre mixes centrist profiles and hard-to-place ones (low voters).',

    'about.refs.title': 'References',
    'about.refs.intro': 'The methodology draws notably on:',

    'about.contact.title': 'Contact',
    'about.contact.body': 'For questions on the method, data, or model:',
    'about.contact.linkedin': 'LinkedIn — Oscar Brunel',

    'about.footer.copy': 'Oscar Brunel · Senate Ideal Point · 3D hemicycle model',
    'about.footer.back': 'Back to the hemicycle',
  },
};

const listeners = new Set();

let currentLang = 'fr';

function readStoredLang() {
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v === 'en' || v === 'fr') return v;
  } catch {
    /* private mode */
  }
  return 'fr';
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : `{${key}}`
  );
}

export function getLang() {
  return currentLang;
}

export function localeTag() {
  return currentLang === 'en' ? 'en-GB' : 'fr-FR';
}

export function t(key, vars) {
  const dict = dictionaries[currentLang] || dictionaries.fr;
  const fallback = dictionaries.fr[key];
  const raw = dict[key] ?? fallback ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

export function applyI18n(root = document) {
  const scope = root instanceof Element || root === document ? root : document;

  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  });

  scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    el.innerHTML = t(key);
  });

  scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    el.setAttribute('placeholder', t(key));
  });

  scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.setAttribute('title', t(key));
  });

  scope.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (!key) return;
    el.setAttribute('aria-label', t(key));
  });

  document.documentElement.lang = currentLang;

  const titleKey = document.body?.classList.contains('about-page')
    ? 'about.meta.title'
    : 'meta.title';
  const descKey = document.body?.classList.contains('about-page')
    ? 'about.meta.description'
    : 'meta.description';
  const ogTitleKey = document.body?.classList.contains('about-page')
    ? 'about.meta.ogTitle'
    : 'meta.ogTitle';
  const ogDescKey = document.body?.classList.contains('about-page')
    ? 'about.meta.ogDescription'
    : 'meta.ogDescription';

  if (dictionaries.fr[titleKey]) document.title = t(titleKey);
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && dictionaries.fr[descKey]) metaDesc.setAttribute('content', t(descKey));
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && dictionaries.fr[ogTitleKey]) ogTitle.setAttribute('content', t(ogTitleKey));
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc && dictionaries.fr[ogDescKey]) ogDesc.setAttribute('content', t(ogDescKey));

  syncLangToggleUI();
}

function syncLangToggleUI() {
  document.querySelectorAll('.lang-toggle').forEach((group) => {
    group.setAttribute('aria-label', t('lang.label'));
    group.querySelectorAll('[data-lang]').forEach((btn) => {
      const lang = btn.getAttribute('data-lang');
      const pressed = lang === currentLang;
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      btn.classList.toggle('is-active', pressed);
      if (lang === 'fr') btn.setAttribute('aria-label', t('lang.fr'));
      if (lang === 'en') btn.setAttribute('aria-label', t('lang.en'));
    });
  });
}

export function setLang(lang, { persist = true } = {}) {
  const next = lang === 'en' ? 'en' : 'fr';
  if (next === currentLang) {
    applyI18n();
    return;
  }
  currentLang = next;
  if (persist) writeStoredLang(next);
  applyI18n();
  listeners.forEach((fn) => {
    try {
      fn(currentLang);
    } catch (err) {
      console.warn('i18n listener error', err);
    }
  });
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Inline SVG flags (crisp at small sizes). */
const FLAG_FR = `<svg class="lang-flag-svg" viewBox="0 0 24 16" width="18" height="12" aria-hidden="true" focusable="false"><rect width="8" height="16" fill="#002395"/><rect x="8" width="8" height="16" fill="#fff"/><rect x="16" width="8" height="16" fill="#ED2939"/></svg>`;
const FLAG_UK = `<svg class="lang-flag-svg" viewBox="0 0 24 16" width="18" height="12" aria-hidden="true" focusable="false"><rect width="24" height="16" fill="#012169"/><path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" stroke-width="3.2"/><path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" stroke-width="1.6"/><path d="M12 0 V16 M0 8 H24" stroke="#fff" stroke-width="5"/><path d="M12 0 V16 M0 8 H24" stroke="#C8102E" stroke-width="2.6"/></svg>`;

export function langToggleHTML() {
  return `<div class="lang-toggle" role="group" aria-label="Langue">
  <button type="button" class="lang-btn" data-lang="fr" aria-pressed="true" aria-label="Français">
    ${FLAG_FR}
    <span class="lang-code">FR</span>
  </button>
  <button type="button" class="lang-btn" data-lang="en" aria-pressed="false" aria-label="English">
    ${FLAG_UK}
    <span class="lang-code">EN</span>
  </button>
</div>`;
}

export function bindLangToggles(root = document) {
  root.querySelectorAll('.lang-toggle').forEach((group) => {
    if (group.dataset.i18nBound === '1') return;
    group.dataset.i18nBound = '1';
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn || !group.contains(btn)) return;
      setLang(btn.getAttribute('data-lang'));
    });
  });
  syncLangToggleUI();
}

export function mountLangToggle(host) {
  if (!host) return;
  if (!host.querySelector('.lang-toggle')) {
    host.insertAdjacentHTML('beforeend', langToggleHTML());
  }
  bindLangToggles(host);
}

export function initI18n() {
  currentLang = readStoredLang();
  applyI18n();
  bindLangToggles();
  return currentLang;
}

/** Map French distance labels from data → localized tone. */
export function translateDistanceTone(raw, { far, close } = {}) {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (far || s.includes('eloign') || s.includes('loin')) return t('metric.toneFar');
  if (close || s.includes('proche')) return t('metric.toneClose');
  if (s.includes('intermediaire') || s.includes('intermediate')) return t('metric.toneMid');
  if (!raw) return far ? t('metric.toneFar') : close ? t('metric.toneClose') : t('metric.toneMid');
  /* Already localized or unknown custom label — return as-is if English session kept FR data label mapped above */
  return raw;
}

export { dictionaries };
