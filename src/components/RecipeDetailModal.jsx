import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Pencil, MoreVertical, Trash2, Share2, Minus, Plus, CalendarPlus, Clock, Flame, Hourglass, Link2, BookOpen, ChefHat } from 'lucide-react'
import NutrientPanel from './NutrientPanel'
import FoodDetailModal from './FoodDetailModal'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'
import { useWakeLock } from '../hooks/useWakeLock'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { parseInstructionSteps, annotateInstructionSteps } from '../lib/recipeInstructions'

// ─────────────────────────────────────────────────────────────────────────────
// MacroGrid — grille 4 colonnes P / G / L / Fibres (les kcal sont affichées
// séparément, en grand chiffre, par le composant appelant).
// ─────────────────────────────────────────────────────────────────────────────
export function MacroGrid({ totals }) {
  const items = [
    { label: 'Prot.',  val: `${(totals.proteines || 0).toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.',  val: `${(totals.glucides  || 0).toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',   val: `${(totals.lipides   || 0).toFixed(1)}g`, color: 'var(--coral)' },
    { label: 'Fibres', val: `${(totals.fibres    || 0).toFixed(1)}g`, color: 'var(--blue)'  },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '9px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// Ajoute https:// si l'utilisateur a saisi une URL sans protocole (ex: "monsite.com")
function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const CHIP_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--white)', border: '0.5px solid var(--border-md)', color: 'var(--text-muted)',
  borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
}

// ─────────────────────────────────────────────────────────────────────────────
// PortionsStepper — augmente/diminue le nombre de portions souhaité.
// N'affecte pas la recette en base : c'est juste un multiplicateur d'affichage.
// ─────────────────────────────────────────────────────────────────────────────
function PortionsStepper({ value, onChange, min = 1 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', borderRadius: 20, padding: 3 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: value <= min ? 'var(--text-hint)' : 'var(--text)',
          border: 'none', opacity: value <= min ? 0.5 : 1,
        }}
      >
        <Minus size={13} />
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, minWidth: 22, textAlign: 'center' }}>{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--white)', color: 'var(--text)', border: 'none',
        }}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}

const SCALE_SEGMENTS = [
  { key: '100g',    label: '100 g' },
  { key: 'portion', label: '1 portion' },
  { key: 'plat',    label: 'Tout' },
  { key: 'libre',   label: '… g' },
]

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetailModal
// Props :
//   recette              — objet recette (ligne Supabase)
//   ingredients          — tableau des ingrédients (lignes recette_ingredients)
//   onEdit()              — optionnel ; si absent, "Modifier" est masqué
//   onDelete()            — optionnel ; si absent, "Supprimer" est masqué
//   onClose()
//   onUpdateIngredient(id, patch) — optionnel, persiste l'ajustement du
//                                   grammage d'un ingrédient (cf. useRecetteDetail)
//   onPlan(source)        — optionnel ; si absent, "Planifier" est masqué
//   onAddToJournal(items, recette) — optionnel ; si absent, "Ajouter au
//                                    journal" est masqué. items = ingrédients
//                                    mis à l'échelle actuellement affichée.
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDetailModal({ recette, ingredients, ingredientsLoading, onEdit, onDelete, onShare, onClose, onUpdateIngredient, onPlan, onAddToJournal }) {
  useBackButton(onClose)
  const [selectedIngredient, setSelectedIngredient] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('ingredients') // 'ingredients' | 'preparation' | 'nutriments'
  const { active: cookModeOn, supported: wakeLockSupported, toggle: toggleCookMode } = useWakeLock()

  // Totaux bruts (plat entier, à l'échelle de base de la recette)
  const totaux = useMemo(() => sumIngredients(ingredients), [ingredients])

  // Instructions découpées en étapes numérotées (une ligne = une étape)
  const instructionSteps = useMemo(() => parseInstructionSteps(recette.instructions), [recette.instructions])

  // Référence de poids (cuit si renseigné, sinon cru) — à l'échelle de base
  const poidsCruG  = ingredients.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0)
  const poidsCuitG = parseFloat(recette.poids_cuit_g) || 0
  const poidsRef   = poidsCuitG > 0 ? poidsCuitG : poidsCruG
  const estCuit    = poidsCuitG > 0

  // Valeurs /100g — indépendantes de l'échelle choisie, utilisées pour le
  // rappel "Autres échelles" et le pré-remplissage du grammage libre.
  const per100 = useMemo(() => calcPer100g(totaux, poidsRef), [totaux, poidsRef])

  const nbPortionsBase = parseInt(recette.portions, 10) || 1
  const grammesParPortion = poidsRef > 0 ? poidsRef / nbPortionsBase : null

  // ── Échelle de lecture unifiée : un seul multiplicateur pilote tout
  // l'écran (macros, micronutriments, grammages d'ingrédients, grammages
  // annotés dans les instructions) ────────────────────────────────────────
  const [scale, setScale] = useState('portion') // '100g' | 'portion' | 'plat' | 'libre'
  const [portionsSouhaitees, setPortionsSouhaitees] = useState(1)
  const [customQty, setCustomQty] = useState('')

  // Ajustements ponctuels de grammage, juste pour l'ajout au journal ou la
  // planification en cours — ne touchent jamais la recette enregistrée
  // (contrairement à onUpdateIngredient, déclenché en tapant le reste de la
  // ligne). { [ingredientId]: grammesSouhaités à l'échelle affichée actuelle }
  const [overrides, setOverrides] = useState({})
  const [editingQtyId, setEditingQtyId] = useState(null)

  useEffect(() => {
    setScale('portion')
    setPortionsSouhaitees(1)
    setCustomQty('')
    setActiveTab('ingredients')
    setOverrides({})
  }, [recette.id])

  // Un changement d'échelle de lecture remet tout à l'échelle : les
  // ajustements ponctuels précédents n'ont plus de sens.
  useEffect(() => {
    setOverrides({})
  }, [scale, portionsSouhaitees, customQty])

  const selectScale = (next) => {
    setScale(next)
    if (next === 'portion') setPortionsSouhaitees(1)
    else if (next === 'plat') setPortionsSouhaitees(nbPortionsBase)
    else if (next === 'libre') setCustomQty(String(Math.round(grammesParPortion || 100)))
  }

  const displayQtyG = scale === '100g' ? 100
    : scale === 'libre' ? (parseFloat(customQty) || 0)
    : poidsRef > 0 ? poidsRef * (portionsSouhaitees / nbPortionsBase) : 0

  const factor = poidsRef > 0 && displayQtyG > 0 ? displayQtyG / poidsRef : 0

  // Ingrédients mis à l'échelle affichée — nom, grammage et TOUS les
  // nutriments (macros + micronutriments). Sert à l'affichage, aux
  // instructions annotées, à "Planifier" et à "Ajouter au journal".
  const scaledIngredients = useMemo(() => ingredients.map(ing => {
    const baseQty = (ing.qty_g || 0) * factor
    const override = overrides[ing.id]
    const adjustFactor = (override != null && baseQty) ? override / baseQty : 1
    const totalFactor = factor * adjustFactor
    const s = {
      food_name:    ing.food_name,
      food_source:  ing.food_source,
      food_ref_id:  ing.food_ref_id,
      qty_g:        baseQty * adjustFactor,
      energie_kcal: (ing.energie_kcal || 0) * totalFactor,
      proteines:    (ing.proteines || 0) * totalFactor,
      glucides:     (ing.glucides || 0) * totalFactor,
      lipides:      (ing.lipides || 0) * totalFactor,
      fibres:       (ing.fibres || 0) * totalFactor,
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      s[key] = ing[key] != null ? ing[key] * totalFactor : null
    }
    return s
  }), [ingredients, factor, overrides])

  // Totaux affichés (grille macro, panneaux vitamines/nutriments, total de
  // l'onglet Ingrédients) — recalculés depuis scaledIngredients pour
  // refléter les ajustements ponctuels éventuels.
  const displayTotals = useMemo(() => sumIngredients(scaledIngredients), [scaledIngredients])

  const commitQtyOverride = (id, rawValue) => {
    setEditingQtyId(null)
    const val = parseFloat(String(rawValue).replace(',', '.'))
    if (!isFinite(val) || val <= 0) return
    setOverrides(prev => ({ ...prev, [id]: val }))
  }

  // Instructions annotées : grammage (mis à l'échelle affichée) inséré entre
  // parenthèses à la 1ʳᵉ mention de chaque ingrédient — recherche uniquement
  // dans les ingrédients DE la recette, jamais dans tout Ciqual.
  const annotatedSteps = useMemo(
    () => annotateInstructionSteps(instructionSteps, scaledIngredients),
    [instructionSteps, scaledIngredients]
  )

  const totalIngredientsQty = scaledIngredients.reduce((s, i) => s + (i.qty_g || 0), 0)

  const scaleLabel =
    scale === '100g'  ? '100 g' :
    scale === 'libre' ? `${Math.round(displayQtyG)} g` :
    `${portionsSouhaitees} portion${portionsSouhaitees > 1 ? 's' : ''}`

  const totalTempsMin = (recette.temps_preparation_min || 0) + (recette.temps_cuisson_min || 0) + (recette.temps_repos_min || 0)

  const sousTitreParts = [
    recette.categories?.length ? recette.categories.join(', ') : null,
    `${nbPortionsBase} portion${nbPortionsBase > 1 ? 's' : ''}`,
    estCuit ? 'pesé cuit' : null,
  ].filter(Boolean)

  const sourceChip = recette.source_valeur && (
    recette.source_type === 'lien' ? (
      <a
        href={normalizeUrl(recette.source_valeur)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...CHIP_STYLE, color: 'var(--green-dark)', textDecoration: 'none', maxWidth: '100%', minWidth: 0 }}
      >
        <Link2 size={12} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.source_valeur}</span>
      </a>
    ) : (
      <span style={{ ...CHIP_STYLE, maxWidth: '100%', minWidth: 0 }}>
        <BookOpen size={12} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recette.source_valeur}{recette.source_page > 0 ? ` · p. ${recette.source_page}` : ''}
        </span>
      </span>
    )
  )

  return (
    <div className="page-modal">
      {/* Header */}
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.nom}</div>
          {sousTitreParts.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sousTitreParts.join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0, position: 'relative' }}>
          {wakeLockSupported && (
            <button
              className="btn-icon"
              onClick={toggleCookMode}
              style={{
                color: cookModeOn ? 'var(--green-dark)' : 'var(--text-hint)',
                background: cookModeOn ? 'var(--green-light)' : undefined,
                borderRadius: 10,
              }}
              aria-label={cookModeOn ? 'Désactiver le mode cuisine' : 'Activer le mode cuisine'}
              title={cookModeOn ? 'Mode cuisine actif — l\'écran reste allumé' : 'Mode cuisine — garder l\'écran allumé'}
            >
              <ChefHat size={18} />
            </button>
          )}
          {onEdit && (
            <button className="btn-icon" onClick={onEdit} style={{ color: 'var(--text-hint)' }}><Pencil size={18} /></button>
          )}
          {(onDelete || onShare) && (
            <>
              <button className="btn-icon" onClick={() => setMenuOpen(o => !o)} style={{ color: 'var(--text-hint)' }}><MoreVertical size={18} /></button>
              {menuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(false)} />
                  <div className="card" style={{ position: 'absolute', top: 38, right: 0, zIndex: 10, padding: 4, minWidth: 170 }}>
                    {onShare && (
                      <button
                        onClick={() => { setMenuOpen(false); onShare() }}
                        style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <Share2 size={14} /> Partager
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => { setMenuOpen(false); onDelete() }}
                        style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="page-modal-body">

        {/* ── Carte "Je regarde" — sélecteur d'échelle (onglet Ingrédients) ── */}
        {activeTab === 'ingredients' && (
          ingredientsLoading ? (
            <div className="card" style={{ padding: 16, marginBottom: 12, textAlign: 'center', color: 'var(--text-hint)', fontSize: 13 }}>
              Chargement…
            </div>
          ) : per100 ? (
            <div className="card" style={{ padding: '14px 14px 16px', marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 9 }}>
                Je regarde
              </div>
              <div style={{ display: 'flex', gap: 4, background: 'var(--gray-bg)', borderRadius: 11, padding: 3, marginBottom: 14 }}>
                {SCALE_SEGMENTS.map(seg => (
                  <button
                    key={seg.key}
                    onClick={() => selectScale(seg.key)}
                    style={{
                      flex: 1, height: 30, borderRadius: 9, fontSize: 12, fontWeight: scale === seg.key ? 700 : 600,
                      background: scale === seg.key ? 'var(--white)' : 'transparent',
                      color: scale === seg.key ? 'var(--text)' : 'var(--text-muted)',
                      boxShadow: scale === seg.key ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                      transition: 'all .15s',
                    }}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>

              {scale === 'libre' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <input
                    className="input-sm" type="text" inputMode="decimal"
                    value={customQty} onChange={e => setCustomQty(e.target.value)}
                    style={{ width: 90 }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
                </div>
              )}

              {factor > 0 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: '-1.4px', color: 'var(--green-dark)' }}>
                          {Math.round(displayTotals.energie_kcal || 0)}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>kcal</span>
                      </div>
                      {(scale === 'portion' || scale === 'plat') && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                          {portionsSouhaitees} portion{portionsSouhaitees > 1 ? 's' : ''} = <strong style={{ color: 'var(--text)' }}>{Math.round(displayQtyG)} g</strong> de plat {estCuit ? 'cuit' : 'cru'}
                        </div>
                      )}
                    </div>
                    {(scale === 'portion' || scale === 'plat') && (
                      <PortionsStepper value={portionsSouhaitees} onChange={setPortionsSouhaitees} />
                    )}
                  </div>

                  <MacroGrid totals={displayTotals} />

                  <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 10 }}>
                    Autres échelles : {Math.round(per100.energie_kcal)} kcal / 100 g · {Math.round(totaux.energie_kcal)} kcal le plat entier ({Math.round(poidsRef)} g)
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Indique un grammage valide.</div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
            </div>
          )
        )}

        {/* ── Rappel d'échelle compact (onglet Nutriments) ── */}
        {activeTab === 'nutriments' && !ingredientsLoading && per100 && (
          <div className="card" style={{ padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {scale === '100g'
                  ? `Pour 100 g de plat ${estCuit ? 'cuit' : 'cru'}`
                  : scale === 'libre'
                  ? `Pour ${Math.round(displayQtyG)} g de plat ${estCuit ? 'cuit' : 'cru'}`
                  : `Pour ${portionsSouhaitees} portion${portionsSouhaitees > 1 ? 's' : ''} (${Math.round(displayQtyG)} g)`}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                {Math.round(displayTotals.energie_kcal || 0)} kcal · <span className="c-prot">P {(displayTotals.proteines || 0).toFixed(1)}</span>{' '}
                <span className="c-gluc">G {(displayTotals.glucides || 0).toFixed(1)}</span>{' '}
                <span className="c-lip">L {(displayTotals.lipides || 0).toFixed(1)}</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('ingredients')}
              style={{ height: 28, padding: '0 10px', borderRadius: 9, background: 'var(--gray-bg)', fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}
            >
              Changer
            </button>
          </div>
        )}

        {/* ── Ligne de chips (temps + source) — visible quel que soit l'onglet ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {activeTab === 'nutriments' ? (
            totalTempsMin > 0 && (
              <span style={CHIP_STYLE}><Clock size={12} /> {totalTempsMin} min au total</span>
            )
          ) : (
            <>
              {recette.temps_preparation_min > 0 && (
                <span style={CHIP_STYLE}><Clock size={12} /> Prépa {recette.temps_preparation_min} min</span>
              )}
              {recette.temps_cuisson_min > 0 && (
                <span style={CHIP_STYLE}><Flame size={12} /> Cuisson {recette.temps_cuisson_min} min</span>
              )}
              {recette.temps_repos_min > 0 && (
                <span style={CHIP_STYLE}><Hourglass size={12} /> Repos {recette.temps_repos_min} min</span>
              )}
            </>
          )}
          {sourceChip}
        </div>

        {/* ── Onglets ── */}
        <div style={{ display: 'flex', gap: 18, borderBottom: '0.5px solid var(--border-md)', marginBottom: 14 }}>
          {[
            { key: 'ingredients', label: 'Ingrédients', count: ingredients.length },
            { key: 'preparation', label: 'Préparation', count: null },
            { key: 'nutriments',  label: 'Nutriments',  count: null },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0 0 9px', fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 600,
                color: activeTab === tab.key ? 'var(--text)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--green)' : '2px solid transparent',
              }}
            >
              {tab.label}{tab.count != null && <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}> {tab.count}</span>}
            </button>
          ))}
        </div>

        {/* ── Onglet Ingrédients ── */}
        {activeTab === 'ingredients' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 9 }}>
              Grammages pour <strong style={{ color: 'var(--text)' }}>{scaleLabel}</strong> · touche une ligne pour modifier la recette, ou juste le grammage pour l'ajuster une seule fois
            </div>

            {ingredientsLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Chargement des ingrédients…</div>
            ) : ingredients.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
            ) : (
              <>
                {ingredients.map((ing, idx) => {
                  const s = scaledIngredients[idx]
                  const isEditingQty = editingQtyId === ing.id
                  return (
                    <div
                      key={ing.id || idx}
                      onClick={() => !isEditingQty && setSelectedIngredient(ing)}
                      className="card"
                      style={{ width: '100%', marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {isEditingQty ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              autoFocus
                              defaultValue={Math.round(s.qty_g)}
                              onClick={e => e.stopPropagation()}
                              onFocus={e => e.target.select()}
                              onBlur={e => commitQtyOverride(ing.id, e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') e.target.blur()
                                if (e.key === 'Escape') { e.target.value = Math.round(s.qty_g); e.target.blur() }
                              }}
                              style={{ width: 48, fontSize: 11, textAlign: 'right', border: '1px solid var(--border-md)', borderRadius: 5, padding: '1px 4px' }}
                            />
                          ) : (
                            <span
                              onClick={e => { e.stopPropagation(); setEditingQtyId(ing.id) }}
                              style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2, cursor: 'pointer' }}
                            >
                              {Math.round(s.qty_g)} g
                            </span>
                          )}
                          <span>·</span>
                          <span className="c-prot">P {(s.proteines || 0).toFixed(1)}</span>
                          <span className="c-gluc">G {(s.glucides || 0).toFixed(1)}</span>
                          <span className="c-lip">L {(s.lipides || 0).toFixed(1)}</span>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(s.energie_kcal || 0)} kcal</span>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 3px 0' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total ingrédients</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(totalIngredientsQty)} g crus · {Math.round(displayTotals.energie_kcal || 0)} kcal</span>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Onglet Préparation ── */}
        {activeTab === 'preparation' && (
          <div className="card" style={{ padding: 16 }}>
            {instructionSteps.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucune instruction renseignée.</div>
            ) : (
              annotatedSteps.map((segments, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: idx < annotatedSteps.length - 1 ? 10 : 0 }}>
                  <div style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                    background: 'var(--green-light)', color: 'var(--green-dark)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)', paddingTop: 2 }}>
                    {segments.map((seg, i) => seg.highlight
                      ? <strong key={i} style={{ color: 'var(--green-dark)' }}>{seg.text}</strong>
                      : <React.Fragment key={i}>{seg.text}</React.Fragment>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Onglet Nutriments ── */}
        {activeTab === 'nutriments' && (
          ingredientsLoading ? (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Chargement…</div>
            </div>
          ) : per100 ? (
            <>
              <NutrientPanel totals={displayTotals} hasEntries={true} defaultOpen />
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
          )
        )}
      </div>

      {/* ── Barre d'action fixe ── */}
      {(onAddToJournal || onPlan) && (
        <div style={{ flexShrink: 0, padding: '10px 16px 14px', background: 'rgba(255,255,255,.96)', borderTop: '0.5px solid var(--border-md)', display: 'flex', gap: 8 }}>
          {onAddToJournal && (
            <button
              className="btn-primary"
              onClick={() => onAddToJournal(scaledIngredients, recette)}
              style={{ flex: '1 1 0%', width: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={17} /> Ajouter au journal
            </button>
          )}
          {onPlan && (
            <button
              onClick={() => onPlan({ nom: recette.nom, items: scaledIngredients, sourceType: 'recette', sourceId: recette.id })}
              style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--purple-light)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              aria-label="Planifier"
              title="Planifier"
            >
              <CalendarPlus size={19} />
            </button>
          )}
        </div>
      )}

      {/* ── Détail d'un ingrédient — affiche et permet de modifier le
           grammage DE BASE (non mis à l'échelle), comme avant. ── */}
      {selectedIngredient && (
        <FoodDetailModal
          key={selectedIngredient.id}
          entry={{ ...selectedIngredient, meal: recette.nom }}
          onUpdate={async (id, patch) => {
            if (!onUpdateIngredient) return { error: null }
            return onUpdateIngredient(id, patch)
          }}
          onClose={() => setSelectedIngredient(null)}
        />
      )}
    </div>
  )
}
