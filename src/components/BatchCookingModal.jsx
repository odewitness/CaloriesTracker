import React, { useMemo, useState } from 'react'
import { X, Plus, Trash2, ChefHat, Search, Check, ChevronRight } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useBatchCooking } from '../hooks/useBatchCooking'
import { useRecipes } from '../hooks/useRecipes'
import { useToast } from '../lib/toast'
import { getRecipeCategoryIcon } from '../lib/categoryIcons'
import RecipeDetailWrapper from './RecipeDetailWrapper'
import Loader from './Loader'
import EmptyState from './EmptyState'

// ─────────────────────────────────────────────────────────────────────────────
// BatchCookingModal — page « Ma fournée » (roadmap §M9). Check-list unique des
// recettes à cuisiner lors d'une session de meal prep, cochables « faite / à
// faire », indépendante du planificateur (données propres dans
// batch_cooking_items, voir useBatchCooking). Ouverte depuis Calendrier →
// Menus.
//
// Props : onClose()
// ─────────────────────────────────────────────────────────────────────────────

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// Panneau d'ajout : recherche + cases à cocher sur les recettes pas encore
// dans la fournée.
function RecipePicker({ recettes, loading, excludeIds, onAdd, onCancel }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [adding, setAdding] = useState(false)

  const list = useMemo(() => {
    const nq = normalize(q)
    return recettes
      .filter(r => !excludeIds.has(r.id))
      .filter(r => !nq || normalize(r.nom).includes(nq))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [recettes, excludeIds, q])

  const toggle = (id) => setSel(s => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const confirm = async () => {
    if (!sel.size || adding) return
    setAdding(true)
    // On n'envoie que l'identité : pas de préremplissage des portions (champ
    // optionnel, laissé vide tant que l'utilisatrice ne le renseigne pas).
    await onAdd(recettes.filter(r => sel.has(r.id)).map(r => ({ id: r.id, nom: r.nom })))
    setAdding(false)
  }

  return (
    <div className="card" style={{ padding: '10px 12px', marginBottom: 12 }}>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }} />
        <input
          className="input"
          placeholder="Rechercher une recette"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ paddingLeft: 28, fontSize: 12.5 }}
          autoFocus
        />
      </div>

      {loading ? (
        <Loader />
      ) : list.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', padding: '6px 2px' }}>
          {recettes.length ? 'Toutes tes recettes sont déjà dans la fournée.' : 'Aucune recette pour l’instant.'}
        </div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: 'auto', margin: '0 -2px' }}>
          {list.map(r => (
            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
              <span style={{ flexShrink: 0 }}>{getRecipeCategoryIcon(r.categories?.[0])}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nom}</span>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button
          onClick={confirm}
          disabled={!sel.size || adding}
          className="btn-primary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: !sel.size || adding ? 0.5 : 1 }}
        >
          <Plus size={15} /> {adding ? 'Ajout…' : `Ajouter${sel.size ? ` (${sel.size})` : ''}`}
        </button>
        <button
          onClick={onCancel}
          style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--gray-bg)', border: 'none', borderRadius: 8, padding: '0 14px', fontFamily: 'var(--font)' }}
        >
          Fermer
        </button>
      </div>
    </div>
  )
}

export default function BatchCookingModal({ onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const { items, loading, addRecipes, toggleFait, setPortions, removeItem, clearDone } = useBatchCooking()
  const { recettes, loading: loadingRecipes } = useRecipes()
  const [picking, setPicking] = useState(false)
  const [detailRecette, setDetailRecette] = useState(null) // recette dont on affiche la fiche

  const recetteById = useMemo(() => new Map(recettes.map(r => [r.id, r])), [recettes])
  const excludeIds = useMemo(() => new Set(items.map(i => i.recette_id).filter(Boolean)), [items])
  const doneCount = items.filter(i => i.fait).length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0

  const handleAdd = async (recettesToAdd) => {
    const { error, added } = await addRecipes(recettesToAdd)
    if (error) { toast('Erreur à l’ajout'); return }
    if (added) toast(`✓ ${added} recette${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`)
    setPicking(false)
  }

  const handleClearDone = async () => {
    const { error } = await clearDone()
    if (error) { toast('Erreur'); return }
    toast('Recettes faites retirées')
  }

  return (
    <>
    <div className="page-modal" style={{ zIndex: 60 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Ma fournée</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>
      <div className="page-modal-body">
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
          Ta liste de recettes à cuisiner, à cocher au fur et à mesure. Elle vit à part : rien à
          voir avec un plan de repas généré, tu peux t’en servir seule pour un meal prep.
        </div>

        {items.length > 0 && (
          <div className="card" style={{ padding: '10px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, fontSize: 12.5, fontWeight: 700 }}>
              <span style={{ color: 'var(--text-muted)' }}>Avancement</span>
              <span style={{ color: 'var(--green-dark)' }}>{doneCount} / {items.length}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--gray-bg)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--green)', transition: 'width .2s' }} />
            </div>
          </div>
        )}

        {loading ? (
          <Loader />
        ) : items.length === 0 && !picking ? (
          <EmptyState
            icon={<ChefHat size={28} />}
            title="Aucune recette dans la fournée"
            description="Ajoute les recettes que tu comptes préparer."
          />
        ) : (
          <div style={{ marginBottom: 12 }}>
            {items.map(it => {
              const rec = it.recette_id ? recetteById.get(it.recette_id) : null
              return (
              <div
                key={it.id}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6 }}
              >
                <input
                  type="checkbox"
                  checked={it.fait}
                  onChange={e => toggleFait(it.id, e.target.checked)}
                  style={{ width: 18, height: 18, flexShrink: 0 }}
                />
                {rec ? (
                  <button
                    onClick={() => setDetailRecette(rec)}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4,
                      background: 'none', border: 'none', padding: 0, fontFamily: 'var(--font)',
                      fontSize: 13, fontWeight: 600, textAlign: 'left',
                      color: it.fait ? 'var(--text-hint)' : 'var(--text)',
                      textDecoration: it.fait ? 'line-through' : 'none',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nom}</span>
                    <ChevronRight size={13} style={{ flexShrink: 0, color: 'var(--text-hint)' }} />
                  </button>
                ) : (
                  <span
                    style={{
                      flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: loadingRecipes && !it.fait ? 'var(--text)' : 'var(--text-hint)',
                      textDecoration: it.fait ? 'line-through' : 'none',
                    }}
                    title={loadingRecipes ? undefined : 'Recette supprimée'}
                  >
                    {it.nom}
                  </span>
                )}
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  defaultValue={it.portions ?? ''}
                  onBlur={e => {
                    const v = e.target.value
                    if (String(it.portions ?? '') !== v) setPortions(it.id, v)
                  }}
                  placeholder="—"
                  aria-label={`Portions à préparer pour ${it.nom}`}
                  style={{
                    width: 44, flexShrink: 0, textAlign: 'center', fontSize: 12,
                    border: '1px solid var(--border)', borderRadius: 6, padding: '4px 2px',
                    fontFamily: 'var(--font)', background: 'var(--white)', color: 'var(--text)',
                  }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-hint)', flexShrink: 0 }}>portions</span>
                <button
                  onClick={() => removeItem(it.id)}
                  className="btn-icon"
                  aria-label={`Retirer ${it.nom}`}
                  style={{ width: 26, height: 26, flexShrink: 0, color: 'var(--text-hint)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              )
            })}
          </div>
        )}

        {picking ? (
          <RecipePicker
            recettes={recettes}
            loading={loadingRecipes}
            excludeIds={excludeIds}
            onAdd={handleAdd}
            onCancel={() => setPicking(false)}
          />
        ) : (
          <button
            onClick={() => setPicking(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Plus size={16} /> Ajouter des recettes
          </button>
        )}

        {doneCount > 0 && !picking && (
          <button
            onClick={handleClearDone}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)' }}
          >
            <Check size={13} /> Retirer les {doneCount} recette{doneCount > 1 ? 's' : ''} faite{doneCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>

    {detailRecette && (
      <RecipeDetailWrapper
        recetteId={detailRecette.id}
        initialRecette={detailRecette}
        onClose={() => setDetailRecette(null)}
      />
    )}
    </>
  )
}
