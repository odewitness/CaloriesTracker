import React, { useMemo, useState } from 'react'
import { ArrowLeft, X, MoreVertical, Trash2 } from 'lucide-react'
import { MacroGrid } from './RecipeDetailModal'
import { useBackButton } from '../hooks/useBackButton'
import { MEALS_ORDER } from '../lib/nutrients'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// JournalPartageDetailModal — vue en lecture seule d'un partage de
// journée/repas. Si include_detail est faux, seuls les totaux macro sont
// affichés (pas de liste d'aliments — l'auteure a choisi de ne pas la
// partager).
// ─────────────────────────────────────────────────────────────────────────────
export default function JournalPartageDetailModal({ partage, aliments, loading, isOwn, onDelete, onClose, reactionsSlot, commentsSlot }) {
  useBackButton(onClose)
  const [menuOpen, setMenuOpen] = useState(false)

  const groupedAliments = useMemo(() => {
    const groups = []
    const known = [...MEALS_ORDER, 'Compléments']
    for (const m of known) {
      const items = (aliments || []).filter(a => a.meal === m)
      if (items.length > 0) groups.push({ meal: m, items })
    }
    const others = (aliments || []).filter(a => !known.includes(a.meal))
    if (others.length > 0) groups.push({ meal: others[0].meal, items: others })
    return groups
  }, [aliments])

  if (!partage) {
    return (
      <div className="page-modal">
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Partage</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        {loading ? <Loader /> : <div style={{ padding: 20, fontSize: 13, color: 'var(--text-hint)' }}>Introuvable.</div>}
      </div>
    )
  }

  const label = partage.meal ? partage.meal : 'Journée complète'
  const auteurLabel = partage.auteur_pseudo || partage.auteur_prenom || 'Une amie'
  const dateLabel = new Date(partage.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  const totals = {
    energie_kcal: partage.energie_kcal || 0,
    proteines: partage.proteines || 0,
    glucides: partage.glucides || 0,
    lipides: partage.lipides || 0,
    fibres: partage.fibres || 0,
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}><ArrowLeft size={20} color="var(--text-muted)" /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{dateLabel}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            Partagé par {auteurLabel} · {label}
          </div>
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
            <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--green-dark)' }}>{Math.round(totals.energie_kcal)}</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>kcal</span>
          </div>
          <MacroGrid totals={totals} />
        </div>

        {reactionsSlot}

        {partage.include_detail ? (
          groupedAliments.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-hint)', marginBottom: 12 }}>Aucun aliment renseigné.</div>
          ) : (
            groupedAliments.map(g => (
              <div key={g.meal} style={{ marginBottom: 14 }}>
                <div className="section-title">{g.meal}</div>
                {g.items.map((a, i) => (
                  <div key={i} className="card" style={{ marginBottom: 6, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span>{a.food_name}</span>
                    <span style={{ fontWeight: 700 }}>{Math.round(a.qty_g)} g</span>
                  </div>
                ))}
              </div>
            ))
          )
        ) : (
          <div style={{ fontSize: 12.5, color: 'var(--text-hint)', marginBottom: 12, fontStyle: 'italic' }}>
            {auteurLabel} a choisi de ne partager que les macros, pas le détail des aliments.
          </div>
        )}

        {commentsSlot}
      </div>
    </div>
  )
}
