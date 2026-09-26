// ─────────────────────────────────────────────────────────────────────────────
// stool.js — suivi du transit (table `selles`, une ligne = un passage). Voir
// src/hooks/useSelles.js et src/components/Stool*.
//
// Tout en fonctions pures + chaînes 'YYYY-MM-DD' (mêmes dates que Supabase).
// ─────────────────────────────────────────────────────────────────────────────

// ── Échelle de Bristol ─────────────────────────────────────────────────────
// 1-2 = constipation, 3-4 = idéal, 5-7 = tendance diarrhéique. `color` sert de
// repère visuel rapide sur le sélecteur (pas un jugement médical).
export const BRISTOL_TYPES = [
  { value: 1, desc: 'Morceaux durs séparés, comme des noisettes', color: 'var(--coral)' },
  { value: 2, desc: 'En forme de saucisse, mais grumeleuse', color: 'var(--amber)' },
  { value: 3, desc: 'Comme une saucisse avec des fissures en surface', color: 'var(--green)' },
  { value: 4, desc: 'Comme une saucisse ou un serpent, lisse et souple', color: 'var(--green)' },
  { value: 5, desc: 'Morceaux mous avec bords nets', color: 'var(--green)' },
  { value: 6, desc: 'Morceaux pâteux, bords déchiquetés, spongieux', color: 'var(--amber)' },
  { value: 7, desc: 'Entièrement liquide, aucun morceau solide', color: 'var(--coral)' },
]
export function bristolType(value) {
  return BRISTOL_TYPES.find(t => t.value === Number(value)) || null
}

// ── Couleur ─────────────────────────────────────────────────────────────────
export const STOOL_COULEURS = [
  { key: 'marron_clair', label: 'Marron clair', hex: '#A9714B' },
  { key: 'marron_moyen', label: 'Marron moyen', hex: '#6F4A2E' },
  { key: 'marron_fonce', label: 'Marron foncé', hex: '#4A2F1D' },
  { key: 'jaune', label: 'Jaune', hex: '#D9B23C' },
  { key: 'vert', label: 'Vert', hex: '#4C7A3A' },
  { key: 'noir', label: 'Noir', hex: '#262626' },
  { key: 'rouge', label: 'Rouge', hex: '#B03A2E' },
  { key: 'gris_pale', label: 'Gris / pâle', hex: '#B9B4AC' },
]
export function stoolCouleur(key) {
  return STOOL_COULEURS.find(c => c.key === key) || null
}
export function stoolCouleurLabel(key) {
  return stoolCouleur(key)?.label || null
}

// ── Effort à l'évacuation ────────────────────────────────────────────────────
export const STOOL_EFFORTS = [
  { key: 'facile', label: 'Facile' },
  { key: 'normal', label: 'Normal' },
  { key: 'difficile', label: 'Difficile' },
]
export function stoolEffortLabel(key) {
  return STOOL_EFFORTS.find(e => e.key === key)?.label || null
}

// ── Remarques (multi-sélection, même pattern que regles.symptomes) ─────────
export const STOOL_REMARQUES = [
  { key: 'restes_nourriture', label: 'Restes de nourriture non digérés' },
  { key: 'douleur', label: 'Douleur' },
  { key: 'ballonnement', label: 'Ballonnement' },
  { key: 'odeur', label: 'Odeur forte' },
  { key: 'sang', label: 'Sang' },
  { key: 'mucus', label: 'Mucus' },
]
export function stoolRemarqueLabel(key) {
  return STOOL_REMARQUES.find(r => r.key === key)?.label || key
}

// '13:30:00' ou '13:30' → '13:30' ; vide → null.
export function formatHeureSelle(t) {
  if (!t) return null
  const m = String(t).match(/^(\d{1,2}):(\d{2})/)
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// Tri d'affichage des passages d'un jour : par heure (les sans-heure en
// dernier), puis par date de création.
export function sortSelles(list) {
  return [...(list || [])].sort((a, b) => {
    const ha = a.heure || '99:99'
    const hb = b.heure || '99:99'
    if (ha !== hb) return ha < hb ? -1 : 1
    return (a.created_at || '') < (b.created_at || '') ? -1 : 1
  })
}

// Heure actuelle 'HH:MM', pour préremplir la feuille de saisie.
export function nowHeure() {
  return new Date().toTimeString().slice(0, 5)
}

// ── Symptômes sans passage (table `symptomes_digestifs`, chantier FODMAP
// Palier 4). Une ligne = un épisode, multi-sélection de symptômes + intensité.
export const DIGESTIVE_SYMPTOMS = [
  { key: 'ballonnement', label: 'Ballonnement' },
  { key: 'douleur', label: 'Douleur au ventre' },
  { key: 'gaz', label: 'Gaz' },
  { key: 'urgence', label: 'Urgence' },
]
export function digestiveSymptomLabel(key) {
  return DIGESTIVE_SYMPTOMS.find(s => s.key === key)?.label || key
}

export const SYMPTOM_INTENSITIES = [
  { value: 1, label: 'Légère' },
  { value: 2, label: 'Moyenne' },
  { value: 3, label: 'Forte' },
]
export function symptomIntensityLabel(value) {
  return SYMPTOM_INTENSITIES.find(i => i.value === Number(value))?.label || null
}

// Remarques de passage qui comptent aussi comme un symptôme digestif dans
// les corrélations (onglet Digestion).
export const STOOL_SYMPTOM_REMARQUES = ['douleur', 'ballonnement']
