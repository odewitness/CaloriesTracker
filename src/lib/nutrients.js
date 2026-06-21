// Source unique de vérité pour tous les champs nutritionnels au-delà des macros
// de base (energie_kcal, proteines, glucides, lipides, fibres) et du sel.
//
// Utilisé par :
// - TodayPage.jsx     → sommer les totaux du jour
// - MealSection.jsx   → reproportionner au prorata quand le grammage change
// - MealsPage.jsx     → idem pour les repas types
// - AddFoodModal.jsx  → savoir quels champs récupérer sur l'aliment sélectionné
// - ManualPage.jsx    → générer le formulaire de saisie d'un aliment personnalisé
// - VitaminPanel.jsx  → afficher les jauges vitamines/minéraux

// ── Sucres détaillés (g / 100g) ──────────────────────────────────────────────
export const SUGAR_FIELDS = [
  { key: 'fructose',   label: 'Fructose',   unit: 'g' },
  { key: 'galactose',  label: 'Galactose',  unit: 'g' },
  { key: 'glucose',    label: 'Glucose',    unit: 'g' },
  { key: 'lactose',    label: 'Lactose',    unit: 'g' },
  { key: 'maltose',    label: 'Maltose',    unit: 'g' },
  { key: 'saccharose', label: 'Saccharose', unit: 'g' },
  { key: 'amidon',     label: 'Amidon',     unit: 'g' },
  { key: 'polyols',    label: 'Polyols',    unit: 'g' },
]

// ── Acides gras détaillés (g / 100g, cholestérol en mg) ─────────────────────
export const FAT_FIELDS = [
  { key: 'ag_monoinsatures',      label: 'Mono-insaturés',          unit: 'g' },
  { key: 'ag_polyinsatures',      label: 'Poly-insaturés',          unit: 'g' },
  { key: 'ag_4_0',                label: 'AG 4:0 (butyrique)',      unit: 'g' },
  { key: 'ag_6_0',                label: 'AG 6:0 (caproïque)',      unit: 'g' },
  { key: 'ag_8_0',                label: 'AG 8:0 (caprylique)',     unit: 'g' },
  { key: 'ag_10_0',               label: 'AG 10:0 (caprique)',      unit: 'g' },
  { key: 'ag_12_0',               label: 'AG 12:0 (laurique)',      unit: 'g' },
  { key: 'ag_14_0',               label: 'AG 14:0 (myristique)',    unit: 'g' },
  { key: 'ag_16_0',               label: 'AG 16:0 (palmitique)',    unit: 'g' },
  { key: 'ag_18_0',               label: 'AG 18:0 (stéarique)',     unit: 'g' },
  { key: 'ag_18_1_oleique',       label: 'Oméga-9 (oléique)',       unit: 'g' },
  { key: 'ag_18_2_linoleique',    label: 'Oméga-6 (linoléique)',    unit: 'g' },
  { key: 'ag_18_3_ala',           label: 'Oméga-3 (ALA)',           unit: 'g' },
  { key: 'ag_20_4_arachidonique', label: 'Oméga-6 (arachidonique)', unit: 'g' },
  { key: 'ag_20_5_epa',           label: 'Oméga-3 (EPA)',           unit: 'g' },
  { key: 'ag_22_6_dha',           label: 'Oméga-3 (DHA)',           unit: 'g' },
  { key: 'cholesterol',           label: 'Cholestérol',             unit: 'mg' },
]

// ── Vitamines avec jauge (ref = RNP/AS adulte indicatif ANSES, non personnalisé ; lss = limite de sécurité si connue) ──
export const VITAMIN_FIELDS = [
  { key: 'vit_c',  label: 'Vitamine C',          ref: 110,  lss: 1000, unit: 'mg', color: 'var(--green)'  },
  { key: 'vit_d',  label: 'Vitamine D',          ref: 15,   lss: 100,  unit: 'µg', color: 'var(--amber)'  },
  { key: 'vit_e_totale', label: 'Vitamine E',    ref: 13,   lss: 300,  unit: 'mg', color: 'var(--blue)'   },
  { key: 'vit_k1', label: 'Vitamine K',          ref: 79,   lss: null, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_b1', label: 'Vitamine B1',         ref: 1.3,  lss: null, unit: 'mg', color: 'var(--coral)'  },
  { key: 'vit_b2', label: 'Vitamine B2',         ref: 1.6,  lss: null, unit: 'mg', color: 'var(--amber)'  },
  { key: 'vit_b3', label: 'Vitamine B3',         ref: 14,   lss: 900,  unit: 'mg', color: 'var(--coral)'  },
  { key: 'vit_b5', label: 'Vitamine B5',         ref: 5,    lss: null, unit: 'mg', color: 'var(--green)'  },
  { key: 'vit_b6', label: 'Vitamine B6',         ref: 1.7,  lss: 25,   unit: 'mg', color: 'var(--blue)'   },
  { key: 'folates',label: 'Folates (B9)',        ref: 330,  lss: 1000, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_b12',label: 'Vitamine B12',        ref: 4,    lss: null, unit: 'µg', color: 'var(--purple)' },
  { key: 'vit_a',  label: 'Vitamine A',          ref: 650,  lss: 3000, unit: 'µg', color: 'var(--coral)'  },
]

// ── Minéraux avec jauge ───────────────────────────────────────────────────────
export const MINERAL_FIELDS = [
  { key: 'calcium',   label: 'Calcium',   ref: 950,  lss: 2500, unit: 'mg', color: 'var(--blue)'  },
  { key: 'fer',       label: 'Fer',       ref: 16,   lss: 40,   unit: 'mg', color: 'var(--coral)' },
  { key: 'magnesium', label: 'Magnésium', ref: 300,  lss: 2500, unit: 'mg', color: 'var(--green)' },
  { key: 'potassium', label: 'Potassium', ref: 3500, lss: null, unit: 'mg', color: 'var(--amber)' },
  { key: 'zinc',      label: 'Zinc',      ref: 11,   lss: 25,   unit: 'mg', color: 'var(--coral)' },
  { key: 'sodium',    label: 'Sodium',    ref: 2000, lss: 2300, unit: 'mg', color: 'var(--amber)', limite: true },
  { key: 'sel',       label: 'Sel',       ref: 5,    lss: 8,    unit: 'g',  color: 'var(--coral)', limite: true },
  { key: 'chlorure',  label: 'Chlorure',  ref: 3100, lss: null, unit: 'mg', color: 'var(--blue)'  },
  { key: 'cuivre',    label: 'Cuivre',    ref: 1.5,  lss: 5,    unit: 'mg', color: 'var(--coral)' },
  { key: 'iode',      label: 'Iode',      ref: 150,  lss: 600,  unit: 'µg', color: 'var(--purple)'},
  { key: 'manganese', label: 'Manganèse', ref: 3,    lss: null, unit: 'mg', color: 'var(--green)' },
  { key: 'phosphore', label: 'Phosphore', ref: 550,  lss: null, unit: 'mg', color: 'var(--blue)'  },
  { key: 'selenium',  label: 'Sélénium',  ref: 70,   lss: 300,  unit: 'µg', color: 'var(--amber)' },
]

// Sous-détails sans jauge dédiée (déjà couverts par une valeur "totale" ci-dessus :
// rétinol/bêta-carotène ⊂ vit_a, D2/D3 ⊂ vit_d, K2 ⊂ vit_k1, folates intrinsèques/acide
// folique ⊂ folates) — on les stocke quand même pour qui veut le détail brut, juste
// affichés en simple liste, pas en jauge %RNP.
export const DETAIL_ONLY_FIELDS = [
  { key: 'retinol',              label: 'Rétinol',                 unit: 'µg' },
  { key: 'beta_carotene',        label: 'Bêta-carotène',           unit: 'µg' },
  { key: 'vit_d2',               label: 'Vitamine D2',             unit: 'µg' },
  { key: 'vit_d3',               label: 'Vitamine D3',             unit: 'µg' },
  { key: 'vit_k2',               label: 'Vitamine K2',             unit: 'µg' },
  { key: 'folates_intrinseques', label: 'Folates intrinsèques',    unit: 'µg' },
  { key: 'acide_folique',        label: 'Acide folique (enrichi)', unit: 'µg' },
]

// "Acides gras saturés" garde son nom historique (acides_gras_satures) pour ne pas
// casser les données déjà en base — on l'ajoute manuellement à la liste plutôt que
// dans FAT_FIELDS pour ne pas dupliquer le libellé "Saturés" géré ailleurs.
export const SATURATED_FAT_KEY = 'acides_gras_satures'

// Liste à plat de TOUS les champs nutritionnels numériques (hors macros de base,
// gérées séparément partout) — base commune pour sommer les totaux et reproportionner
// au prorata du grammage sans dupliquer la liste dans 6 fichiers.
export const ALL_NUTRIENT_KEYS = Array.from(new Set([
  'sucres', 'sel', SATURATED_FAT_KEY,
  ...SUGAR_FIELDS.map(f => f.key),
  ...FAT_FIELDS.map(f => f.key),
  ...VITAMIN_FIELDS.map(f => f.key),
  ...MINERAL_FIELDS.map(f => f.key),
  ...DETAIL_ONLY_FIELDS.map(f => f.key),
]))