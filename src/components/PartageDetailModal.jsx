import React, { useState, useMemo } from 'react'
import { ArrowLeft, X, MoreVertical, Trash2, Clock, Flame, Hourglass, BookmarkPlus } from 'lucide-react'
import { MacroGrid } from './RecipeDetailModal'
import { parseInstructionSteps, annotateInstructionSteps } from '../lib/recipeInstructions'
import { getSeasonIcon } from '../lib/seasons'
import { useBackButton } from '../hooks/useBackButton'
import Loader from './Loader'

const CHIP_STYLE = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: 'var(--white)', border: '0.5px solid var(--border-md)', color: 'var(--text-muted)',
  borderRadius: 20, padding: '4px 10px', fontSize: 11.5, fontWeight: 600,
}

// ─────────────────────────────────────────────────────────────────────────────
// PartageDetailModal — vue en lecture seule d'un partage de recette (snapshot
// figé au moment du partage, pas de scaling comme RecipeDetailModal).
// ─────────────────────────────────────────────────────────────────────────────
export default function PartageDetailModal({ partage, ingredients, loading, isOwn, onDelete, onAddToMyRecipes, onClose, reactionsSlot, commentsSlot }) {
  useBackButton(onClose)
  const [menuOpen, setMenuOpen] = useState(false)

  const instructionSteps = useMemo(() => parseInstructionSteps(partage?.instructions), [partage?.instructions])
  const annotatedSteps = useMemo(() => annotateInstructionSteps(instructionSteps, ingredients), [instructionSteps, ingredients])

  if (!partage) {
    return (
      <div className="page-modal">
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Recette partagée</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        {loading ? <Loader /> : <div style={{ padding: 20, fontSize: 13, color: 'var(--text-hint)' }}>Introuvable.</div>}
      </div>
    )
  }

  const poidsRef = partage.poids_cuit_g || partage.poids_cru_g || null
  const nbPortions = partage.portions || 1
  const poidsParPortion = poidsRef ? poidsRef / nbPortions : null
  const factor = poidsParPortion ? poidsParPortion / 100 : null

  const displayTotals = factor != null
    ? {
        energie_kcal: (partage.energie_kcal || 0) * factor,
        proteines: (partage.proteines || 0) * factor,
        glucides: (partage.glucides || 0) * factor,
        lipides: (partage.lipides || 0) * factor,
        fibres: (partage.fibres || 0) * factor,
      }
    : {
        energie_kcal: partage.energie_kcal || 0,
        proteines: partage.proteines || 0,
        glucides: partage.glucides || 0,
        lipides: partage.lipides || 0,
        fibres: partage.fibres || 0,
      }

  const totalTempsMin = (partage.temps_preparation_min || 0) + (partage.temps_cuisson_min || 0) + (partage.temps_repos_min || 0)
  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partage.nom}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Partagé par {auteurLabel}</div>
        </div>
        {isOwn && (
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button className="btn-icon" onClick={() => setMenuOpen(o => !o)} style={{ color: 'var(--text-hint)' }}><MoreVertical size={18} /></button>
            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(false)} />
                <div className="card" style={{ position: 'absolute', top: 38, right: 0, zIndex: 10, padding: 4, minWidth: 180 }}>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete() }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <Trash2 size={14} /> Retirer mon partage
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="page-modal-body">
        {partage.message && (
          <div className="card" style={{ padding: '12px 14px', marginBottom: 12, fontSize: 13.5, lineHeight: 1.4 }}>
            {partage.message}
          </div>
        )}

        <div className="card" style={{ padding: '14px 14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--green-dark)' }}>{Math.round(displayTotals.energie_kcal)}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kcal {factor != null ? `par portion (${nbPortions})` : 'pour 100 g'}</span>
          </div>
          <MacroGrid totals={displayTotals} />
        </div>

        {reactionsSlot}

        {(totalTempsMin > 0 || partage.saisons?.length > 0) && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {partage.saisons?.map(s => <span key={s} style={CHIP_STYLE}>{getSeasonIcon(s)} {s}</span>)}
            {partage.temps_preparation_min > 0 && <span style={CHIP_STYLE}><Clock size={12} /> Prépa {partage.temps_preparation_min} min</span>}
            {partage.temps_cuisson_min > 0 && <span style={CHIP_STYLE}><Flame size={12} /> Cuisson {partage.temps_cuisson_min} min</span>}
            {partage.temps_repos_min > 0 && <span style={CHIP_STYLE}><Hourglass size={12} /> Repos {partage.temps_repos_min} min</span>}
          </div>
        )}

        <div className="section-title">Ingrédients</div>
        {ingredients.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 12 }}>Aucun ingrédient renseigné.</div>
        ) : (
          ingredients.map((ing, i) => (
            <div key={i} className="card" style={{ marginBottom: 6, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{ing.food_name}</span>
              <span style={{ fontWeight: 700 }}>{Math.round(ing.qty_g)} g</span>
            </div>
          ))
        )}

        {instructionSteps.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 16 }}>Préparation</div>
            <div className="card" style={{ padding: 16, marginBottom: 12 }}>
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
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--text)', paddingTop: 2 }}>
                    {segments.map((seg, i) => seg.highlight
                      ? <strong key={i} style={{ color: 'var(--green-dark)' }}>{seg.text}</strong>
                      : <React.Fragment key={i}>{seg.text}</React.Fragment>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {commentsSlot}
      </div>

      {/* ── Barre d'action fixe ── */}
      {onAddToMyRecipes && (
        <div style={{ flexShrink: 0, padding: '10px 16px 14px', background: 'rgba(255,255,255,.96)', borderTop: '0.5px solid var(--border-md)' }}>
          <button
            className="btn-primary"
            onClick={onAddToMyRecipes}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <BookmarkPlus size={17} /> Ajouter à mes recettes
          </button>
        </div>
      )}
    </div>
  )
}
