// ─────────────────────────────────────────────────────────────────────────────
// fodmapData.js — table de référence FODMAP, curatée à la main (voir
// docs/fodmap.md §4). Complète les colonnes de `ciqual` (lactose, fructose,
// glucose, polyols) avec ce que Ciqual ne mesure pas : fructanes, GOS,
// sorbitol, mannitol. Clé = alim_code Ciqual. Valeurs en g/100 g d'aliment
// tel que saisi dans le journal (cru si l'aliment Ciqual est cru, etc.).
//
// Règles de remplissage :
//   - valeur mesurée (publication, base de composition) en priorité ;
//   - `derived` = déduite d'une portion « verte » publiée (seuil / portion),
//     donc une borne haute, pas une mesure ;
//   - `estimated` = raisonnement explicite dans `note`, à vérifier ;
//   - `ABSENT` = sous-groupe biologiquement absent de ce type d'aliment
//     (ex. lactose d'un fruit, fructanes d'un produit laitier) ;
//   - groupe plausible mais jamais mesuré → on n'écrit rien (= inconnu),
//     JAMAIS 0 : un inconnu ne doit pas s'afficher « vert ».
//   - `ignoreCiqualPolyols` : ne pas se rabattre sur la colonne Ciqual
//     `polyols` (valeur douteuse, ou « < 0,5 » converti en 0 alors que le
//     sorbitol de l'aliment est en question).
//   - `fructose` / `glucose` / `lactose` ici REMPLACENT les colonnes Ciqual
//     (codes anciens absents de Ciqual 2025, ou valeur Ciqual contredite par
//     une deuxième source mesurée — raison dans `note`).
//
// Pas de vérification possible dans un livre de référence (il ne donne pas de
// grammages) : les valeurs `derived` / `estimated` restent telles quelles,
// leur niveau de confiance est affiché à l'utilisatrice.
//
// Sources des données (mention obligatoire pour l'AFCD, licence CC BY 4.0) :
// voir FODMAP_SOURCES. Constituée le 2026-09-26 à partir des ~60 aliments les
// plus utilisés dans les journaux et recettes des deux comptes.
// ─────────────────────────────────────────────────────────────────────────────

export const FODMAP_SOURCES = {
  CIQUAL: 'Table Ciqual 2025, ANSES (Licence Ouverte Etalab 2.0)',
  SLO24: 'Fructanes des aliments courants en Slovénie, 2024 — méthode AOAC 999.03 (PMC11327153)',
  AFCD: 'Australian Food Composition Database, Release 3, FSANZ, 2025 (CC BY 4.0)',
  MUIR07: 'Muir et al., Fructan and free fructose content of common Australian vegetables and fruit, J Agric Food Chem, 2007',
  USDA: 'USDA FoodData Central, SR Legacy',
  ISP20: 'Ispiryan et al., FODMAP contents of common wheat and rye breads, Eur Food Res Technol, 2020',
}

const measured = (value, source, note) => ({ value, confidence: 'measured', source, note })
const derived = (value, note) => ({ value, confidence: 'derived', note })
const estimated = (value, note) => ({ value, confidence: 'estimated', note })
const ABSENT = { value: 0, confidence: 'absent' }

// Aliments sans glucides fermentescibles (eau, huiles, sel, œufs, viandes,
// poissons) : tous les sous-groupes à 0, sans ambiguïté.
const NO_FODMAP = {
  fructans: ABSENT, gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT,
}
// Idem, et sans aucun sucre : fructose / glucose / lactose forcés à 0 (Ciqual
// les laisse souvent non mesurés pour ces aliments).
const NO_CARBS = { ...NO_FODMAP, fructose: 0, glucose: 0, lactose: 0 }
// Produits laitiers nature : seul le lactose compte (colonne Ciqual).
const DAIRY = NO_FODMAP
// Fruits : pas de GOS ni de lactose ; fructanes et polyols à renseigner.
const FRUIT_BASE = { gos: ABSENT }

export const FODMAP_DATA = {
  // ── Sans FODMAP ──────────────────────────────────────────────────────────
  '18066': { name: 'Eau du robinet', ...NO_CARBS },
  '20100': { name: "Huile d'olive", ...NO_FODMAP, fructose: 0, glucose: 0, lactose: 0 }, // code ancien
  '17270': { name: "Huile d'olive", ...NO_CARBS },
  '11083': { name: 'Sel', ...NO_CARBS },
  '22010': { name: 'Œuf dur', ...NO_CARBS },
  '22000': { name: 'Œuf cru', ...NO_CARBS },
  '36018': { name: 'Poulet, filet', ...NO_CARBS },
  '36004': { name: 'Poulet, cuisse', ...NO_CARBS },
  '36306': { name: 'Dinde, escalope', ...NO_CARBS },
  '26181': { name: 'Thon au naturel', ...NO_CARBS },
  '16400': { name: 'Beurre', ...NO_FODMAP }, // lactose : colonne Ciqual (0,71 g/100 g)
  '11046': { name: 'Levure chimique', ...NO_CARBS },

  // ── Produits laitiers (lactose via Ciqual sauf mention) ──────────────────
  '19664': { name: 'Petit-suisse nature', ...DAIRY },
  '19865': { name: 'Kéfir de lait', ...DAIRY },
  '19041': { name: 'Lait demi-écrémé UHT', ...DAIRY },
  '12066': { name: 'Feta', ...DAIRY },
  '12110': { name: 'Comté', ...DAIRY },
  '19712': {
    name: 'Fromage blanc de brebis', ...DAIRY,
    lactose: 3.5,
    note: 'Lactose non mesuré par Ciqual pour cet aliment : valeur typique d\'un fromage blanc nature.',
  },
  '17010': {
    name: 'Skyr nature', ...DAIRY, // code ancien, absent de Ciqual 2025
    lactose: 3.5, fructose: 0, glucose: 0,
    note: 'Code Ciqual ancien : lactose repris de la valeur typique d\'un skyr (sucres ≈ lactose).',
  },
  '19400': {
    name: 'Yaourt nature', ...DAIRY, // code ancien, absent de Ciqual 2025
    lactose: 3.21, fructose: 0.092, glucose: 0.13,
    note: 'Code Ciqual ancien : valeurs de « Yaourt ou lait fermenté, nature » (Ciqual 2025, 19600).',
  },

  // ── Fruits ───────────────────────────────────────────────────────────────
  '13005': {
    name: 'Banane', ...FRUIT_BASE,
    fructans: measured(0.11, 'SLO24'),
    sorbitol: estimated(0, 'Pas de polyols dans la banane selon les listes publiées ; Ciqual : < 0,5 g/100 g.'),
    mannitol: estimated(0),
    note: 'Plus la banane est mûre, plus elle contient de fructanes : une banane très mûre est moins bien tolérée qu\'une banane ferme.',
  },
  '13044': {
    name: 'Raisin blanc', ...FRUIT_BASE,
    fructans: measured(0.06, 'SLO24'),
    sorbitol: measured(0, 'AFCD'),
    mannitol: measured(0, 'AFCD'),
    fructose: 7.7, glucose: 7.6,
    note: 'Fructose/glucose de l\'AFCD (7,7 / 7,6) plutôt que Ciqual (8,5 / 7,0) : le raisin a normalement autant de fructose que de glucose.',
  },
  '13004': {
    name: 'Avocat', ...FRUIT_BASE,
    fructans: estimated(0, 'Pas de fructanes rapportés dans l\'avocat.'),
    sorbitol: derived(0.6, 'Déduit d\'une portion « verte » d\'environ 30 g (seuil sorbitol 0,2 g).'),
    mannitol: ABSENT,
    note: 'Riche en sorbitol : bien toléré en petite quantité, beaucoup moins en demi-avocat.',
  },
  '13000': {
    name: 'Abricot', ...FRUIT_BASE,
    fructans: estimated(0),
    mannitol: ABSENT,
    // sorbitol volontairement non renseigné : sources contradictoires.
    ignoreCiqualPolyols: true,
    note: 'Sorbitol : l\'AFCD et Ciqual mesurent ≈ 0, mais les listes FODMAP classent souvent l\'abricot riche en sorbitol. Laissé inconnu.',
  },
  '13026': {
    name: 'Melon cantaloup', ...FRUIT_BASE,
    fructans: estimated(0),
    note: 'Ciqual indique 4 g/100 g de polyols, valeur inhabituelle pour un melon (les listes FODMAP le classent pauvre à portion moyenne). Polyols laissés inconnus.',
    ignoreCiqualPolyols: true,
  },
  '13191': {
    name: 'Pomme Gala', ...FRUIT_BASE,
    fructans: measured(0.09, 'SLO24'),
    sorbitol: measured(0.5, 'AFCD', 'Pomme à peau rouge, pelée, crue.'),
    mannitol: ABSENT,
    note: 'Beaucoup plus de fructose que de glucose, plus du sorbitol : peu tolérée, même en petite quantité, par les personnes sensibles au fructose.',
  },
  '13021': {
    name: 'Kiwi', ...FRUIT_BASE,
    fructans: estimated(0),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '13011': {
    name: 'Datte sèche', ...FRUIT_BASE,
    ignoreCiqualPolyols: true,
    sorbitol: measured(0, 'AFCD'),
    mannitol: estimated(0),
    // fructanes plausibles (fruits secs), non mesurés.
  },
  '31024': {
    name: 'Confiture de fraise', ...FRUIT_BASE,
    fructans: estimated(0, 'La fraise est pauvre en FODMAP.'),
    sorbitol: measured(0, 'AFCD', 'Fraise au sirop.'),
    mannitol: measured(0, 'AFCD'),
  },
  '30994': {
    name: 'Confiture de figue', ...FRUIT_BASE,
    mannitol: estimated(0),
  },

  // ── Sucres ───────────────────────────────────────────────────────────────
  '31034': { name: 'Sirop d\'érable', ...NO_FODMAP, note: 'Surtout du saccharose : pauvre en FODMAP.' },
  '16010': {
    name: 'Miel', // code ancien, absent de Ciqual 2025
    fructans: ABSENT, gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT,
    fructose: 40.4, glucose: 35.3, lactose: 0,
    note: 'Code Ciqual ancien : valeurs de « Miel » (Ciqual 2025, 31008). Le miel contient plus de fructose que de glucose.',
  },

  // ── Légumes ──────────────────────────────────────────────────────────────
  '11200': {
    name: 'Carotte crue', // code ancien, absent de Ciqual 2025
    fructans: measured(0.11, 'SLO24'),
    gos: ABSENT, sorbitol: estimated(0), mannitol: estimated(0),
    fructose: 0.55, glucose: 0.59, lactose: 0,
    note: 'Fructose/glucose de l\'USDA (0,55 / 0,59) : Ciqual 2025 donne 1,51 / 0,89, ce qui ferait de la carotte un aliment riche en fructose, contraire à toutes les listes FODMAP.',
  },
  '20192': {
    name: 'Tomate cœur de bœuf', gos: ABSENT,
    fructans: measured(0.01, 'SLO24'),
    sorbitol: estimated(0), mannitol: estimated(0),
    fructose: 1.37, glucose: 1.25,
    note: 'Fructose/glucose de l\'USDA (1,37 / 1,25) plutôt que Ciqual (1,69 / 1,25). Une grosse portion de tomate peut quand même apporter un peu de fructose en excès.',
  },
  '20172': {
    name: 'Tomate cerise', gos: ABSENT,
    fructans: measured(0.01, 'SLO24', 'Valeur de la tomate.'),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '20239': {
    name: 'Oignon jaune cru',
    fructans: measured(1.5, 'SLO24', 'Entre 1,1 (AFCD, oignon brun) et 2,0 (étude slovène) g/100 g.'),
    gos: estimated(0), sorbitol: estimated(0), mannitol: estimated(0),
    note: 'Une des principales sources de fructanes : même une petite quantité dépasse le seuil.',
  },
  '11420': {
    name: 'Ail cru', // code ancien, absent de Ciqual 2025
    fructans: measured(17.4, 'MUIR07'),
    gos: estimated(0), sorbitol: estimated(0), mannitol: estimated(0),
    fructose: 0.3, glucose: 0.2, lactose: 0,
    note: 'Aliment le plus riche en fructanes. Les fructanes ne passent pas dans l\'huile : une huile parfumée à l\'ail (ail retiré) n\'en contient pas.',
  },
  '20021': {
    name: 'Courgette cuite', gos: ABSENT,
    fructans: measured(0.01, 'SLO24', 'Valeur de la courgette crue.'),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '20020': {
    name: 'Courgette crue', gos: ABSENT,
    fructans: measured(0.01, 'SLO24'),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '20210': {
    name: 'Concombre sans peau', gos: ABSENT,
    fructans: measured(0, 'SLO24', 'Non détectable.'),
    sorbitol: estimated(0), mannitol: estimated(0),
    fructose: 0.75, glucose: 0.63,
    note: 'Fructose/glucose de l\'USDA (concombre pelé) plutôt que Ciqual (1,0 / 0,8).',
  },
  '20019': {
    name: 'Concombre', gos: ABSENT,
    fructans: measured(0, 'SLO24', 'Non détectable.'),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '20099': {
    name: 'Mâche', gos: ABSENT,
    fructans: estimated(0, 'Salades à feuilles : pauvres en FODMAP.'),
    sorbitol: estimated(0), mannitol: estimated(0),
  },
  '4102': {
    name: 'Patate douce cuite', gos: ABSENT,
    fructans: estimated(0),
    sorbitol: estimated(0),
    mannitol: derived(0.3, 'Déduit d\'une portion « verte » d\'environ 75 g (seuil mannitol 0,2 g).'),
    note: 'Contient du mannitol : bien tolérée en portion moyenne, moins en grosse portion.',
  },
  '11033': { name: 'Basilic frais', gos: ABSENT, fructans: estimated(0), sorbitol: estimated(0), mannitol: estimated(0) },

  // ── Légumineuses ─────────────────────────────────────────────────────────
  '20532': {
    name: 'Pois chiches en conserve, égouttés',
    gos: measured(0.2, 'AFCD', 'Raffinose 0 + stachyose 0,2 g/100 g.'),
    fructans: estimated(0.3, 'Pois chiches secs cuits : 0,6 g/100 g (AFCD) ; une partie passe dans le jus de conserve.'),
    sorbitol: ABSENT, mannitol: ABSENT,
    note: 'En conserve et rincés, les pois chiches perdent une bonne partie de leurs GOS dans le jus : mieux tolérés que cuits à partir de secs.',
  },

  // ── Céréales, pains, féculents ───────────────────────────────────────────
  '7106': {
    name: 'Pain complet au seigle',
    fructans: estimated(1.2, 'Pains de seigle : plus de 2,5 g de FODMAP/100 g de matière sèche, surtout des fructanes (Ispiryan 2020) ; ramené au pain frais et à un pain mélangé blé/seigle.'),
    sorbitol: ABSENT,
    note: 'Le seigle est très riche en fructanes. Un pain au levain longue fermentation en contient moins.',
  },
  '9436': {
    name: 'Farine de blé T55',
    fructans: measured(0.75, 'SLO24', 'Farine blanche T500 slovène, équivalente.'),
    sorbitol: ABSENT, mannitol: ABSENT,
  },
  '32140': {
    name: "Flocons d'avoine",
    fructans: measured(0.32, 'SLO24', 'AFCD : 0,4 g/100 g.'),
    sorbitol: ABSENT, mannitol: ABSENT,
  },
  '9100': {
    name: 'Riz blanc cru',
    fructans: estimated(0.1, 'L\'AFCD mesure 0,2 g/100 g de riz cru avec une méthode qui tend à surestimer ; le riz est classé sans FODMAP dans les listes publiées.'),
    gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT,
  },
  '9340': {
    name: 'Quinoa cru',
    fructans: measured(0.2, 'AFCD'),
    sorbitol: ABSENT, mannitol: ABSENT,
  },
  '7352': {
    name: 'Galette de riz complet soufflé',
    fructans: measured(0.1, 'AFCD', 'Valeur du riz complet cru.'),
    gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT,
  },

  // ── Oléagineux, graines ──────────────────────────────────────────────────
  // Portions habituelles petites (10-20 g) ; GOS/fructanes plausibles mais
  // non mesurés → inconnus.
  '15047': { name: 'Graines de chia', sorbitol: ABSENT, mannitol: ABSENT },
  '15008': { name: 'Noix du Brésil', sorbitol: ABSENT, mannitol: ABSENT },
  '15010': { name: 'Graines de sésame', sorbitol: ABSENT, mannitol: ABSENT },
  '15202': { name: 'Beurre de cacahuète', sorbitol: ABSENT, mannitol: ABSENT },
  '31074': {
    name: 'Chocolat noir 70 %',
    sorbitol: measured(0, 'AFCD'), mannitol: ABSENT,
  },

  // ── Condiments, épices ───────────────────────────────────────────────────
  '11104': {
    name: 'Sauce soja', sorbitol: ABSENT, mannitol: ABSENT,
    fructans: estimated(0, 'Sauce fermentée : les FODMAP du soja et du blé sont en grande partie dégradés.'),
    gos: estimated(0),
  },
  '11021': { name: "Moutarde à l'ancienne", fructans: estimated(0), gos: estimated(0), sorbitol: ABSENT, mannitol: ABSENT },
  '11025': { name: 'Cannelle', fructans: estimated(0), gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT },
  '11005': {
    name: 'Curry en poudre', gos: ABSENT, sorbitol: ABSENT, mannitol: ABSENT,
    note: 'Certains mélanges contiennent de l\'ail ou de l\'oignon en poudre : vérifier la composition.',
  },
}

export function getCuratedFodmap(alimCode) {
  return alimCode != null ? FODMAP_DATA[String(alimCode)] || null : null
}
