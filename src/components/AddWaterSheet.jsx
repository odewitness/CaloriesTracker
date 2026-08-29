import React, { useState, useMemo, useEffect } from 'react'
import { Droplet, Plus, Minus, Star, Search, X, Trash2, Pencil, Check } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useCiqualCatalog } from '../hooks/useCiqualCatalog'
import { getComplementNutrients } from '../lib/complementNutrients'
import {
  WATER_DEFAULTS, buildWaterEntry, getWaterBeverages, pickDefaultBeverage,
  litres, newPortionId,
} from '../lib/water'

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// ─────────────────────────────────────────────────────────────────────────────
// AddWaterSheet — feuille "Ajouter de l'eau" : choix de la boisson (liste
// Ciqual "Eaux et autres boissons"), portion, quantité, puis ajout au journal.
// Gère aussi la création/édition des portions perso (settings.water.portions).
//
// Props :
//   entries        — entrées d'hydratation du jour (liste + suppression)
//   water          — settings.water
//   onUpdateWater(patch) — écrit dans settings.water (portions, boisson par défaut)
//   onAdd(entry)   — insère une entrée journal
//   onDelete(id)   — supprime une entrée journal
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function AddWaterSheet({ entries = [], water, onUpdateWater, onAdd, onDelete, onClose }) {
  useBackButton(onClose)
  const cfg = water || WATER_DEFAULTS
  const { foods, loading } = useCiqualCatalog()

  const beverages = useMemo(() => getWaterBeverages(foods), [foods])
  const defaultBev = useMemo(() => pickDefaultBeverage(foods, cfg.default_food_ref_id), [foods, cfg.default_food_ref_id])

  const [bevCode, setBevCode] = useState(null)
  const [search, setSearch] = useState('')
  const [portionId, setPortionId] = useState(cfg.portions?.[0]?.id || null)
  const [count, setCount] = useState(1)
  const [editingPortions, setEditingPortions] = useState(false)
  const [draft, setDraft] = useState(cfg.portions || WATER_DEFAULTS.portions)

  // Boisson sélectionnée : le choix explicite, sinon la boisson par défaut.
  const bev = useMemo(() => {
    if (bevCode != null) return beverages.find((f) => String(f.alim_code) === String(bevCode)) || defaultBev
    return defaultBev
  }, [bevCode, beverages, defaultBev])

  const portions = editingPortions ? draft : (cfg.portions?.length ? cfg.portions : WATER_DEFAULTS.portions)
  const portion = portions.find((p) => p.id === portionId) || portions[0]
  const totalMl = (portion?.ml || 0) * count

  useEffect(() => {
    if (!portions.find((p) => p.id === portionId)) setPortionId(portions[0]?.id || null)
  }, [portions, portionId])

  const shownBeverages = useMemo(() => {
    const q = norm(search.trim())
    if (q) return beverages.filter((f) => norm(f.alim_nom).includes(q)).slice(0, 40)
    const head = defaultBev ? [defaultBev] : []
    return [...head, ...beverages.filter((f) => f.alim_code !== defaultBev?.alim_code)].slice(0, 40)
  }, [beverages, defaultBev, search])

  // Apports vitamines/minéraux de la portion en cours (mêmes réf. que NutrientPanel).
  const contribution = useMemo(() => {
    if (!bev) return { kcal: 0, nutrients: [] }
    const scale = totalMl / 100
    return {
      kcal: Math.round((bev.energie_kcal || 0) * scale),
      nutrients: getComplementNutrients(bev, scale).slice(0, 4),
    }
  }, [bev, totalMl])

  const isDefault = bev && defaultBev && bev.alim_code === defaultBev.alim_code

  const confirm = () => {
    if (!bev || totalMl <= 0) return
    onAdd(buildWaterEntry(bev, totalMl))
  }

  const setAsDefault = () => {
    if (bev) onUpdateWater({ default_food_ref_id: String(bev.alim_code) })
  }

  // ── Édition des portions ──────────────────────────────────────────────────
  const startEditing = () => { setDraft(cfg.portions?.length ? cfg.portions : WATER_DEFAULTS.portions); setEditingPortions(true) }
  const commitPortions = () => {
    const clean = draft
      .map((p) => ({ id: p.id, label: (p.label || '').trim() || 'Portion', ml: Math.max(10, parseInt(p.ml, 10) || 0) }))
      .filter((p) => p.ml > 0)
    onUpdateWater({ portions: clean.length ? clean : WATER_DEFAULTS.portions })
    setEditingPortions(false)
  }
  const patchDraft = (id, key, val) => setDraft((d) => d.map((p) => (p.id === id ? { ...p, [key]: val } : p)))
  const removeDraft = (id) => setDraft((d) => d.filter((p) => p.id !== id))
  const addDraft = () => setDraft((d) => [...d, { id: newPortionId(), label: '', ml: 250 }])

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Droplet size={17} color="var(--blue)" />
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Ajouter de l'eau</h2>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Un seul appui suffit — la boisson et la portion sont pré-sélectionnées.
        </div>

        {/* ── Boisson ── */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
          Boisson
        </div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={15} color="var(--text-hint)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            placeholder="Filtrer les eaux et boissons…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, paddingRight: search ? 34 : 12 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)' }}>
              <X size={15} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--text-hint)', padding: '8px 0 16px' }}>Chargement des boissons…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto', marginBottom: 8 }}>
            {shownBeverages.map((f) => {
              const selected = bev && f.alim_code === bev.alim_code
              const isDflt = defaultBev && f.alim_code === defaultBev.alim_code
              return (
                <button
                  key={f.alim_code}
                  onClick={() => setBevCode(f.alim_code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    padding: '9px 11px', borderRadius: 9,
                    border: `1.5px solid ${selected ? 'var(--blue)' : 'var(--border)'}`,
                    background: selected ? 'var(--blue-light)' : 'var(--white)',
                  }}
                >
                  {isDflt && <Star size={13} color="var(--blue)" fill="var(--blue)" style={{ flexShrink: 0 }} />}
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: selected ? 'var(--blue-dark)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.alim_nom}
                  </span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-hint)', flexShrink: 0 }}>
                    {Math.round(f.energie_kcal || 0)} kcal/100 ml
                  </span>
                </button>
              )
            })}
            {shownBeverages.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-hint)', padding: '6px 2px' }}>Aucune boisson ne correspond.</div>
            )}
          </div>
        )}

        {bev && !isDefault && (
          <button
            onClick={setAsDefault}
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)', fontFamily: 'var(--font)', marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 5 }}
          >
            <Star size={12} /> Définir « {bev.alim_nom} » comme boisson par défaut
          </button>
        )}
        {(!bev || isDefault) && <div style={{ marginBottom: 8 }} />}

        {/* ── Portions ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Portion</span>
          {editingPortions ? (
            <button onClick={commitPortions} style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Check size={13} /> Terminé
            </button>
          ) : (
            <button onClick={startEditing} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Pencil size={12} /> Modifier
            </button>
          )}
        </div>

        {editingPortions ? (
          <div style={{ marginBottom: 16 }}>
            {draft.map((p) => (
              <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  placeholder="Nom (ex : Ma gourde)"
                  value={p.label}
                  onChange={(e) => patchDraft(p.id, 'label', e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  value={p.ml}
                  onChange={(e) => patchDraft(p.id, 'ml', e.target.value)}
                  style={{ width: 76 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>ml</span>
                {draft.length > 1 && (
                  <button onClick={() => removeDraft(p.id)} className="btn-icon" style={{ color: 'var(--coral)', flexShrink: 0 }} aria-label="Supprimer la portion">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={addDraft} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--blue)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)' }}>
              <Plus size={14} /> Nouvelle portion
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
              {portions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPortionId(p.id)}
                  className="chip"
                  style={p.id === portionId
                    ? { background: 'var(--blue)', color: 'white' }
                    : { background: 'var(--blue-light)', color: 'var(--blue-dark)' }}
                >
                  {p.label} · {p.ml} ml
                </button>
              ))}
            </div>

            {/* ── Quantité ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--gray-bg)', borderRadius: 12, padding: '10px 12px', marginBottom: 14 }}>
              <button onClick={() => setCount((c) => Math.max(1, c - 1))} className="btn-icon" style={{ background: 'var(--white)', border: '1px solid var(--border)' }} aria-label="Moins">
                <Minus size={16} />
              </button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}>{count} × {portion?.label?.toLowerCase() || 'portion'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>soit {totalMl} ml</div>
              </div>
              <button onClick={() => setCount((c) => Math.min(12, c + 1))} className="btn-icon" style={{ background: 'var(--white)', border: '1px solid var(--border)' }} aria-label="Plus">
                <Plus size={16} />
              </button>
            </div>

            {/* ── Apports ── */}
            <div style={{ border: '0.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Ajouté à tes stats du jour
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ background: 'var(--gray-bg)', borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 600 }}>{contribution.kcal} kcal</span>
                {contribution.nutrients.map(({ field, val }) => (
                  <span key={field.key} style={{ background: 'var(--blue-light)', borderRadius: 8, padding: '4px 9px', fontSize: 12, fontWeight: 600, color: 'var(--blue-dark)' }}>
                    {field.label} {val < 1 ? val.toFixed(2) : Math.round(val)} {field.unit}
                  </span>
                ))}
                {contribution.nutrients.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Pas de minéraux renseignés pour cette boisson.</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: 8, lineHeight: 1.5 }}>
                Une boisson compte comme un aliment : ses vitamines et minéraux remontent dans le détail nutritionnel, l'historique et les moyennes.
              </div>
            </div>

            <button className="btn-primary" style={{ background: 'var(--blue)' }} onClick={confirm} disabled={!bev || totalMl <= 0}>
              Ajouter {totalMl} ml
            </button>
          </>
        )}

        {/* ── Boissons du jour ── */}
        {entries.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              Aujourd'hui · {litres(entries.reduce((s, e) => s + (Number(e.qty_g) || 0), 0))} L
            </div>
            <div style={{ background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {entries.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: i < entries.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <Droplet size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.food_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{Math.round(e.qty_g)} ml</span>
                  <button onClick={() => onDelete(e.id)} className="btn-icon" style={{ color: 'var(--text-hint)', flexShrink: 0 }} aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 10 }} onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}
