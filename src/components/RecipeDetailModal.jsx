import React, { useState, useEffect, useMemo } from 'react'
import { X, Pencil, Trash2, Minus, Plus, CalendarPlus, Clock, Flame, Hourglass, Link2, BookOpen } from 'lucide-react'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
import FoodDetailModal from './FoodDetailModal'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { useBackButton } from '../hooks/useBackButton'
import { sumIngredients, calcPer100g } from '../hooks/useRecipes'
import { parseInstructionSteps, annotateInstructionSteps } from '../lib/recipeInstructions'

// ─────────────────────────────────────────────────────────────────────────────
// MacroGrid — grille 5 colonnes kcal / P / G / L / F
// ─────────────────────────────────────────────────────────────────────────────
function MacroGrid({ totals }) {
  const items = [
    { label: 'kcal',   val: Math.round(totals.energie_kcal || 0), color: 'var(--text)'  },
    { label: 'Prot.',  val: `${(totals.proteines || 0).toFixed(1)}g`, color: 'var(--green)' },
    { label: 'Gluc.',  val: `${(totals.glucides  || 0).toFixed(1)}g`, color: 'var(--amber)' },
    { label: 'Lip.',   val: `${(totals.lipides   || 0).toFixed(1)}g`, color: 'var(--coral)' },
    { label: 'Fibres', val: `${(totals.fibres    || 0).toFixed(1)}g`, color: 'var(--blue)'  },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginBottom: 16 }}>
      {items.map(({ label, val, color }) => (
        <div key={label} style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}

// Ajoute https:// si l'utilisateur a saisi une URL sans protocole (ex: "monsite.com")
function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PortionsStepper — augmente/diminue le nombre de portions souhaité.
// N'affecte pas la recette en base : c'est juste un multiplicateur d'affichage
// qui recalcule en temps réel le grammage de chaque ingrédient et les totaux
// du plat entier (les valeurs /100g et /portion restent, elles, inchangées).
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

// ─────────────────────────────────────────────────────────────────────────────
// CustomPortionCard — calcule les valeurs nutritionnelles pour un grammage
// choisi librement par l'utilisateur (ni 100g, ni le plat entier).
// Basé sur les valeurs /100g de la recette (indépendant du nb de portions).
// ─────────────────────────────────────────────────────────────────────────────
function CustomPortionCard({ per100, defaultQty }) {
  const [qty, setQty] = useState(String(defaultQty || 100))

  useEffect(() => { setQty(String(defaultQty || 100)) }, [defaultQty])

  const totals = useMemo(() => {
    const q = parseFloat(qty)
    if (!per100 || !q || q <= 0) return null
    const factor = q / 100
    const t = {}
    t.energie_kcal = per100.energie_kcal * factor
    t.proteines    = per100.proteines    * factor
    t.glucides     = per100.glucides     * factor
    t.lipides      = per100.lipides      * factor
    t.fibres       = per100.fibres       * factor
    for (const key of ALL_NUTRIENT_KEYS) {
      t[key] = per100[key] != null ? per100[key] * factor : null
    }
    return t
  }, [per100, qty])

  if (!per100) return null

  return (
    <div className="card" style={{ padding: 16, marginBottom: 12 }}>
      <div className="section-title">Portion personnalisée</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <input
          className="input-sm"
          type="text"
          inputMode="decimal"
          value={qty}
          onChange={e => setQty(e.target.value)}
          style={{ width: 90 }}
        />
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>grammes</span>
      </div>
      {totals ? (
        <MacroGrid totals={totals} />
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Indique un grammage valide.</div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetailModal
// Props :
//   recette            — objet recette (ligne Supabase)
//   ingredients        — tableau des ingrédients (lignes recette_ingredients)
//   onEdit()           — ouvre RecipeFormModal en mode édition
//   onDelete()         — supprime la recette
//   onClose()          — ferme la modal
//   onUpdateIngredient(id, patch) — optionnel, persiste l'ajustement du
//                                   grammage d'un ingrédient (cf. useRecetteDetail)
// ─────────────────────────────────────────────────────────────────────────────
export default function RecipeDetailModal({ recette, ingredients, onEdit, onDelete, onClose, onUpdateIngredient, onPlan }) {
  useBackButton(onClose)
  const [selectedIngredient, setSelectedIngredient] = useState(null)

  // Totaux bruts (plat entier, à l'échelle de base de la recette)
  const totaux = useMemo(() => sumIngredients(ingredients), [ingredients])

  // Instructions découpées en étapes numérotées (une ligne = une étape)
  const instructionSteps = useMemo(() => parseInstructionSteps(recette.instructions), [recette.instructions])

  // Référence de poids (cuit si renseigné, sinon cru) — à l'échelle de base
  const poidsCruG  = ingredients.reduce((s, i) => s + (parseFloat(i.qty_g) || 0), 0)
  const poidsCuitG = parseFloat(recette.poids_cuit_g) || 0
  const poidsRef   = poidsCuitG > 0 ? poidsCuitG : poidsCruG
  const estCuit    = poidsCuitG > 0

  // Valeurs /100g — indépendantes du nombre de portions
  const per100 = useMemo(() => calcPer100g(totaux, poidsRef), [totaux, poidsRef])

  // Nombre de portions de base (celui enregistré sur la recette)
  const nbPortionsBase = parseInt(recette.portions, 10) || 1

  // Nombre de portions SOUHAITÉ — modifiable via le stepper. Par défaut 1
  // portion (pas le nb de portions de la recette de base) : c'est la valeur
  // la plus utile aussi bien pour consulter "ce que je mange vraiment" que
  // pour planifier — réinitialisé à 1 à chaque fois qu'on ouvre une recette
  // différente.
  const [portionsSouhaitees, setPortionsSouhaitees] = useState(1)
  useEffect(() => { setPortionsSouhaitees(1) }, [recette.id])

  // Facteur d'échelle appliqué au plat entier et à la liste d'ingrédients.
  // La taille d'UNE portion (grammesParPortion, kcalParPortion) ne change
  // pas : seul le nombre de portions — donc la quantité totale — varie.
  const factor = nbPortionsBase > 0 ? portionsSouhaitees / nbPortionsBase : 1
  const scaled = factor !== 1

  const grammesParPortion = poidsRef > 0 ? Math.round(poidsRef / nbPortionsBase) : null
  const kcalParPortion    = per100 && grammesParPortion ? Math.round(per100.energie_kcal * grammesParPortion / 100) : null

  // Totaux mis à l'échelle pour le nombre de portions souhaité
  const totauxScaled = useMemo(() => {
    const t = {}
    for (const key of Object.keys(totaux)) {
      t[key] = totaux[key] != null ? totaux[key] * factor : totaux[key]
    }
    return t
  }, [totaux, factor])
  const poidsRefScaled = poidsRef * factor

  // Totaux /100g sous forme "totals" pour VitaminPanel et NutrientDetails
  // (toujours à l'échelle 100g, jamais mis à l'échelle des portions)
  const totals100 = per100 || {}

  // Ingrédients mis à l'échelle du nb de portions souhaité, TOUS champs
  // nutritionnels compris (pas seulement qty_g) — utilisé pour "Planifier",
  // qui a besoin d'items nutritionnellement corrects, pas juste d'un
  // grammage réaffiché.
  const scaledIngredientsForPlan = useMemo(() => ingredients.map(ing => {
    const scaled = {
      food_name:    ing.food_name,
      food_source:  ing.food_source,
      food_ref_id:  ing.food_ref_id,
      qty_g:        (ing.qty_g || 0) * factor,
      energie_kcal: (ing.energie_kcal || 0) * factor,
      proteines:    (ing.proteines || 0) * factor,
      glucides:     (ing.glucides || 0) * factor,
      lipides:      (ing.lipides || 0) * factor,
      fibres:       (ing.fibres || 0) * factor,
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      scaled[key] = ing[key] != null ? ing[key] * factor : null
    }
    return scaled
  }), [ingredients, factor])

  // Instructions annotées : grammage (mis à l'échelle du nb de portions
  // souhaité) inséré entre parenthèses à la 1ʳᵉ mention de chaque ingrédient
  // — recherche uniquement dans les ingrédients DE la recette, jamais dans
  // tout Ciqual (cf. annotateInstructionSteps).
  const annotatedSteps = useMemo(
    () => annotateInstructionSteps(instructionSteps, scaledIngredientsForPlan),
    [instructionSteps, scaledIngredientsForPlan]
  )

  return (
    <div className="page-modal">
      {/* Header */}
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recette.nom}</h2>
        <div style={{ display: 'flex', gap: 2 }}>
          {onPlan && (
            <button
              className="btn-icon"
              onClick={() => onPlan({ nom: recette.nom, items: scaledIngredientsForPlan, sourceType: 'recette', sourceId: recette.id })}
              style={{ color: 'var(--purple, #8b5cf6)' }}
              aria-label="Planifier"
              title="Planifier"
            >
              <CalendarPlus size={18} />
            </button>
          )}
          {onEdit && (
            <button className="btn-icon" onClick={onEdit} style={{ color: 'var(--text-hint)' }}><Pencil size={18} /></button>
          )}
          {onDelete && (
            <button className="btn-icon" onClick={onDelete} style={{ color: 'var(--text-hint)' }}><Trash2 size={18} /></button>
          )}
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
      </div>

      <div className="page-modal-body">
        {/* Meta recette + sélecteur de portions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Portions :</span>
          <PortionsStepper value={portionsSouhaitees} onChange={setPortionsSouhaitees} />
        </div>
        {scaled && (
          <div style={{ fontSize: 12, color: 'var(--green-dark)', marginBottom: 10 }}>
            × {factor.toFixed(2).replace(/\.?0+$/, '')} par rapport à la recette de base ({nbPortionsBase} portion{nbPortionsBase > 1 ? 's' : ''})
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {grammesParPortion && (
            <span style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              ~{grammesParPortion} g / portion
            </span>
          )}
          {estCuit && (
            <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              ⚖️ pesé cuit
            </span>
          )}
          {recette.temps_preparation_min > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              <Clock size={12} /> Prépa {recette.temps_preparation_min} min
            </span>
          )}
          {recette.temps_cuisson_min > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              <Flame size={12} /> Cuisson {recette.temps_cuisson_min} min
            </span>
          )}
          {recette.temps_repos_min > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
              <Hourglass size={12} /> Repos {recette.temps_repos_min} min
            </span>
          )}
        </div>

        {/* ── Valeurs /100g ── */}
        {per100 ? (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="section-title">Pour 100 g de plat {estCuit ? 'cuit' : 'cru'}</div>
            <MacroGrid totals={per100} />
            {kcalParPortion && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                → <strong style={{ color: 'var(--text)' }}>{kcalParPortion} kcal</strong> par portion ({grammesParPortion} g)
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-hint)' }}>Aucun ingrédient renseigné.</div>
          </div>
        )}

        {/* ── Valeurs plat entier (mises à l'échelle du nb de portions choisi) ── */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div className="section-title">
            Plat entier ({Math.round(poidsRefScaled)} g) {scaled && <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>· pour {portionsSouhaitees} portions</span>}
          </div>
          <MacroGrid totals={totauxScaled} />
        </div>

        {/* ── Portion personnalisée ── */}
        <CustomPortionCard per100={per100} defaultQty={grammesParPortion || 100} />

        {/* ── Liste ingrédients (grammages mis à l'échelle pour affichage) ── */}
        <div className="section-title" style={{ marginTop: 4 }}>
          Ingrédients ({ingredients.length}) {scaled && <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>· pour {portionsSouhaitees} portions</span>}
        </div>
        {ingredients.map((ing, idx) => {
          const qtyScaled  = (ing.qty_g || 0) * factor
          const kcalScaled = (ing.energie_kcal || 0) * factor
          const protScaled = (ing.proteines || 0) * factor
          const glucScaled = (ing.glucides || 0) * factor
          const lipScaled  = (ing.lipides || 0) * factor
          return (
            <button
              key={ing.id || idx}
              onClick={() => setSelectedIngredient(ing)}
              className="card"
              style={{ width: '100%', marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ing.food_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {Math.round(qtyScaled)}g&nbsp;·&nbsp;
                  <span className="c-prot">P {protScaled.toFixed(1)}g</span>&nbsp;
                  <span className="c-gluc">G {glucScaled.toFixed(1)}g</span>&nbsp;
                  <span className="c-lip">L {lipScaled.toFixed(1)}g</span>
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{Math.round(kcalScaled)} kcal</span>
            </button>
          )
        })}

        {/* ── Instructions ── */}
        {instructionSteps.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 12, marginBottom: 12 }}>
            <div className="section-title">Instructions</div>
            {annotatedSteps.map((segments, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: idx < annotatedSteps.length - 1 ? 10 : 0 }}>
                <div style={{
                  flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                  background: 'var(--green-light)', color: 'var(--green-dark)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {idx + 1}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text)', paddingTop: 2 }}>
                  {segments.map((seg, i) => seg.highlight
                    ? <strong key={i} style={{ color: 'var(--green-dark)' }}>{seg.text}</strong>
                    : <React.Fragment key={i}>{seg.text}</React.Fragment>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Source ── */}
        {recette.source_valeur && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="section-title">Source</div>
            {recette.source_type === 'lien' ? (
              <a
                href={normalizeUrl(recette.source_valeur)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--green-dark)', wordBreak: 'break-all' }}
              >
                <Link2 size={14} style={{ flexShrink: 0 }} />
                {recette.source_valeur}
              </a>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text)' }}>
                <BookOpen size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                {recette.source_valeur}
                {recette.source_page > 0 && <span style={{ color: 'var(--text-muted)' }}>· p. {recette.source_page}</span>}
              </div>
            )}
          </div>
        )}

        {/* ── Vitamines / minéraux / sucres / gras (basés sur /100g) ── */}
        {per100 && (
          <>
            <div style={{ marginTop: 12 }}>
              <VitaminPanel totals={totals100} hasEntries={true} />
            </div>
            <NutrientDetails totals={totals100} hasEntries={true} />
          </>
        )}
      </div>

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