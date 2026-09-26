import React, { useMemo, useState } from 'react'
import { X, Search, Pin, Ban, AlertTriangle } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { recipePortionMacros, templateServingMacros, recipeCookMinutes } from '../lib/mealPlanner'
import { getRecipeCategoryIcon } from '../lib/categoryIcons'
import { RECIPE_CATEGORIES } from '../lib/recipeCategories'

// ─────────────────────────────────────────────────────────────────────────────
// PlannerRecipeRulesSheet — page « Imposer ou interdire des recettes » du
// planificateur. UN seul endroit pour les deux règles, recette par recette :
// 📌 imposée (forcément dans le plan, même hors filtres) / 🚫 interdite
// (jamais tirée) / rien (libre). Chaque ligne dit aussi si la recette est
// écartée par les filtres du moment, et pourquoi.
//
// Props : recettes, repasTypes, config (filtres + pinnedIds + bannedIds),
// plannedCategories (Set des catégories des briques prévues), onSetRule(id,
// 'pinned' | 'banned' | null), onClearAll(), onClose()
// ─────────────────────────────────────────────────────────────────────────────

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// Pourquoi une recette ne sortirait pas d'elle-même. `blocking` : même
// imposée, elle ne peut pas entrer dans le plan.
function exclusionReason(entity, kind, config, plannedCategories) {
  const macros = kind === 'recette' ? recipePortionMacros(entity) : templateServingMacros(entity)
  if (!macros || !(macros.kcal > 0)) {
    return { text: kind === 'recette' ? 'Sans poids ou sans valeurs nutritionnelles : ne peut pas être planifiée' : 'Sans aliment : ne peut pas être planifié', blocking: true }
  }
  const cats = entity.categories || []
  if (!cats.length) return { text: 'Sans catégorie : ne peut pas être planifiée', blocking: true }
  if (!cats.some(c => plannedCategories.has(c))) {
    return { text: `Aucune brique « ${cats[0]} » dans tes repas`, blocking: true }
  }
  if (kind === 'repas_type' && config.includeRepasTypes === false) return { text: 'Repas types non inclus', blocking: false }
  if (config.season && config.seasonMode === 'filter' && !(entity.saisons || []).includes(config.season)) {
    return { text: 'Hors saison', blocking: false }
  }
  if (kind === 'recette' && config.maxCookMinutes) {
    const t = recipeCookMinutes(entity)
    if (t > config.maxCookMinutes) return { text: `${t} min de cuisine`, blocking: false }
  }
  return null
}

function RuleButton({ active, color, bg, onClick, disabled, label, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${active ? color : 'var(--border)'}`,
        background: active ? bg : 'var(--white)',
        color: active ? color : 'var(--text-hint)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function PlannerRecipeRulesSheet({ recettes, repasTypes, config, plannedCategories, onSetRule, onClearAll, onClose }) {
  useBackButton(onClose)
  const [q, setQ] = useState('')
  const [view, setView] = useState('all') // 'all' | 'pinned' | 'banned'
  const [cat, setCat] = useState(null)

  const pinned = useMemo(() => new Set(config.pinnedIds || []), [config.pinnedIds])
  const banned = useMemo(() => new Set(config.bannedIds || []), [config.bannedIds])

  const rows = useMemo(() => [
    ...recettes.map(e => ({ kind: 'recette', entity: e, macros: recipePortionMacros(e) })),
    ...repasTypes.map(e => ({ kind: 'repas_type', entity: e, macros: templateServingMacros(e) })),
  ]
    .map(r => ({ ...r, reason: exclusionReason(r.entity, r.kind, config, plannedCategories) }))
    .sort((a, b) => a.entity.nom.localeCompare(b.entity.nom, 'fr')),
  [recettes, repasTypes, config, plannedCategories])

  const availableCats = useMemo(() => {
    const present = new Set(rows.flatMap(r => r.entity.categories || []))
    return RECIPE_CATEGORIES.filter(c => present.has(c))
  }, [rows])

  const list = useMemo(() => {
    const nq = normalize(q.trim())
    return rows
      .filter(r => view === 'all' || (view === 'pinned' ? pinned.has(r.entity.id) : banned.has(r.entity.id)))
      .filter(r => !cat || (r.entity.categories || []).includes(cat))
      .filter(r => !nq || normalize(r.entity.nom).includes(nq))
  }, [rows, view, cat, q, pinned, banned])

  const tab = (key, label, count) => (
    <button
      onClick={() => setView(key)}
      style={{
        flex: 1, padding: '8px 4px', borderRadius: 9, fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', border: 'none',
        background: view === key ? 'var(--white)' : 'transparent',
        color: view === key ? 'var(--text)' : 'var(--text-muted)',
        boxShadow: view === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      {label}{count != null && <span style={{ color: 'var(--text-hint)', fontWeight: 600 }}> ({count})</span>}
    </button>
  )

  const chip = (active) => ({
    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
    fontSize: 11.5, fontWeight: 700, fontFamily: 'var(--font)', padding: '5px 10px', borderRadius: 999,
    border: `1px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'var(--green-light)' : 'var(--white)',
    color: active ? 'var(--green-dark)' : 'var(--text-muted)',
  })

  return (
    <div className="page-modal" style={{ zIndex: 65 }}>
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Imposer ou interdire</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Fermer"><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Pin size={14} color="var(--green-dark)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span><strong style={{ color: 'var(--text)' }}>Imposée</strong> : elle sera forcément dans le plan, même si elle ne passe pas tes filtres.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Ban size={14} color="var(--coral)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span><strong style={{ color: 'var(--text)' }}>Interdite</strong> : elle ne sortira jamais, même en remplacement dans l’aperçu.</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: 'var(--gray-bg)', marginBottom: 10 }}>
          {tab('all', 'Toutes', null)}
          {tab('pinned', 'Imposées', pinned.size)}
          {tab('banned', 'Interdites', banned.size)}
        </div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={16} color="var(--text-hint)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            placeholder="Rechercher une recette ou un repas type..."
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: q ? 36 : 12 }}
          />
          {q && (
            <button onClick={() => setQ('')} aria-label="Effacer la recherche" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }}>
              <X size={16} />
            </button>
          )}
        </div>

        {availableCats.length > 1 && (
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 4, marginBottom: 8 }}>
            <button onClick={() => setCat(null)} style={chip(!cat)}>Toutes</button>
            {availableCats.map(c => (
              <button key={c} onClick={() => setCat(cat === c ? null : c)} style={chip(cat === c)}>
                {getRecipeCategoryIcon(c)} {c}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text-hint)', textAlign: 'center', padding: '28px 8px' }}>
            {view === 'pinned' ? 'Aucune recette imposée.'
              : view === 'banned' ? 'Aucune recette interdite.'
              : 'Aucun résultat.'}
          </div>
        ) : list.map(({ kind, entity, macros, reason }) => {
          const isPinned = pinned.has(entity.id)
          const isBanned = banned.has(entity.id)
          const firstCat = entity.categories?.[0]
          return (
            <div
              key={`${kind}:${entity.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', marginBottom: 6, borderRadius: 12,
                border: '1px solid var(--border)',
                background: isPinned ? 'var(--green-light)' : isBanned ? 'var(--coral-light)' : 'var(--white)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: isBanned ? 'var(--text-muted)' : 'var(--text)', textDecoration: isBanned ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entity.nom}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>
                  {firstCat ? `${getRecipeCategoryIcon(firstCat)} ${firstCat}` : 'Sans catégorie'}
                  {kind === 'repas_type' && ' · repas type'}
                  {macros && macros.kcal > 0 && ` · ${Math.round(macros.kcal)} kcal · ${Math.round(macros.prot)} g P`}
                </div>
                {reason && !isBanned && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 3, fontWeight: 600, color: reason.blocking ? 'var(--text-hint)' : 'var(--amber)' }}>
                    <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                    {reason.text}{!reason.blocking && (isPinned ? ' — imposée, elle passera quand même' : ' — ne sortira que si tu l’imposes')}
                  </div>
                )}
              </div>
              <RuleButton
                active={isPinned}
                color="var(--green-dark)" bg="var(--white)"
                disabled={reason?.blocking && !isPinned}
                label={isPinned ? `Ne plus imposer ${entity.nom}` : `Imposer ${entity.nom}`}
                onClick={() => onSetRule(entity.id, isPinned ? null : 'pinned')}
              >
                <Pin size={16} />
              </RuleButton>
              <RuleButton
                active={isBanned}
                color="var(--coral)" bg="var(--white)"
                label={isBanned ? `Autoriser de nouveau ${entity.nom}` : `Interdire ${entity.nom}`}
                onClick={() => onSetRule(entity.id, isBanned ? null : 'banned')}
              >
                <Ban size={16} />
              </RuleButton>
            </div>
          )
        })}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '10px 16px calc(12px + env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--border)', background: 'var(--white)' }}>
        {(pinned.size > 0 || banned.size > 0) && (
          <button
            onClick={onClearAll}
            style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--coral)', background: 'none', border: 'none', fontFamily: 'var(--font)', padding: '0 8px' }}
          >
            Tout effacer
          </button>
        )}
        <button className="btn-primary" onClick={onClose} style={{ flex: 1 }}>
          Terminé
        </button>
      </div>
    </div>
  )
}
