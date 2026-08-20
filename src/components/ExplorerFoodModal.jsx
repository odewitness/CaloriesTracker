import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Star, Lightbulb, Pencil, PlusCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useBackButton } from '../hooks/useBackButton'
import { useFavorites } from '../hooks/useFavorites'
import { useJournal } from '../hooks/useJournal'
import { scaleFood, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { getPortion, getCategoryLabel, findBetterAlternative, formatValue } from '../lib/ciqualExplorer'
import { patchCachedPortions } from '../hooks/useCiqualCatalog'
import MacroPreview from './MacroPreview'
import NutrientPanel from './NutrientPanel'
import AddToJournalSheet from './AddToJournalSheet'
import Loader from './Loader'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerFoodModal — fiche d'un aliment ouvert depuis l'explorateur Ciqual :
// détail nutritionnel complet à la quantité choisie, mise en favori, et ajout
// direct au journal. Sans cette sortie vers le journal, l'explorateur ne
// servirait qu'à regarder : il faudrait ressortir chercher l'aliment dans
// l'ajout classique pour s'en servir.
//
// La ligne reçue vient du catalogue allégé (EXPLORER_SELECT ne charge que les
// colonnes utiles au tri) : on RECHARGE donc la ligne `ciqual` complète avant
// toute écriture. C'est indispensable — `favoris.food_data` est un snapshot figé
// que FoodPicker ne re-fetch jamais pour la source 'ciqual' (voir selectFood),
// donc un favori créé depuis une ligne allégée resterait amputé de ses acides
// gras et sucres détaillés à chaque réutilisation.
//
// Props `foods` (catalogue complet, pour chercher une alternative) et `gaps`
// (manques RÉELS du jour, sortie de getNutrientGaps — indépendants des
// filtres actifs sur la page) sont optionnels : sans eux, pas de section
// alternative plutôt qu'une section cassée.
// ─────────────────────────────────────────────────────────────────────────────
export default function ExplorerFoodModal({ food, onClose, foods, gaps, onPickFood }) {
  useBackButton(onClose)
  const toast = useToast()
  const { isFavorite, toggleFavorite } = useFavorites()

  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(true)
  const initialPortion = getPortion(food)
  const [qty, setQty] = useState(String(initialPortion.g))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [journalMeal, setJournalMeal] = useState('Déjeuner')
  const [saving, setSaving] = useState(false)

  // Édition des portions courantes de l'aliment CIQUAL — la base ANSES n'en
  // renseigne que pour une minorité d'aliments (voir `portions` dans
  // supabase_schema.sql), d'où la possibilité de les compléter à la main
  // depuis la fiche. `ciqual` n'a pas de RLS (table de référence partagée,
  // pas de user_id) : l'écriture se fait donc directement sur la ligne,
  // sans filtre supplémentaire.
  const [editingPortions, setEditingPortions] = useState(false)
  const [portionsDraft, setPortionsDraft] = useState([{ label: '', g: '' }])
  const [savingPortions, setSavingPortions] = useState(false)

  const { addEntry } = useJournal(journalDate)

  useEffect(() => {
    let cancelled = false
    // Remet loading à true à CHAQUE changement d'aliment, pas seulement au
    // montage : la modale reste montée en basculant sur l'alternative
    // suggérée (onPickFood change `food` sans démonter), donc sans ce reset
    // le détail du PRÉCÉDENT aliment resterait affiché le temps du fetch.
    setLoading(true)
    setFull(null)
    setEditingPortions(false)
    ;(async () => {
      const { data, error } = await supabase
        .from('ciqual')
        .select('*')
        .eq('alim_code', food.alim_code)
        .single()
      if (cancelled) return
      if (error || !data) {
        console.error('ExplorerFoodModal fetch error:', error)
        toast("Impossible de charger le détail de cet aliment")
        setLoading(false)
        return
      }
      setFull({ ...data, _source: 'ciqual' })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [food.alim_code])

  // La modale reste montée quand on bascule sur l'alternative suggérée
  // (onPickFood change juste `food` sans démonter/remonter) : sans cet
  // effet, la quantité saisie pour l'aliment précédent resterait affichée
  // telle quelle sur le nouveau, avec un libellé de portion qui ne
  // correspondrait plus à rien.
  useEffect(() => { setQty(String(initialPortion.g)) }, [food.alim_code])

  // Recalculée depuis `full.portions` une fois le détail chargé (et après
  // une éventuelle édition), pas depuis `food` : `food` reste le snapshot
  // allégé transmis par la liste et ne bouge jamais après une sauvegarde de
  // portions faite depuis cette fiche.
  const portion = useMemo(
    () => getPortion({ portions: full?.portions ?? food.portions }),
    [full?.portions, food.portions]
  )

  const startEditPortions = () => {
    const current = full?.portions
    setPortionsDraft(
      Array.isArray(current) && current.length
        ? current.map(p => ({ label: p.label || '', g: p.g != null ? String(p.g) : '' }))
        : [{ label: '', g: '' }]
    )
    setEditingPortions(true)
  }
  const addPortionDraft    = () => setPortionsDraft(p => [...p, { label: '', g: '' }])
  const removePortionDraft = (i) => setPortionsDraft(p => p.filter((_, idx) => idx !== i))
  const updatePortionDraft = (i, k, v) => setPortionsDraft(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x))

  const savePortions = async () => {
    const clean = portionsDraft
      .filter(p => p.label.trim() && parseFloat(p.g) > 0)
      .map(p => ({ label: p.label.trim(), g: parseFloat(p.g) }))
    setSavingPortions(true)
    const { error } = await supabase.from('ciqual').update({ portions: clean }).eq('alim_code', food.alim_code)
    setSavingPortions(false)
    if (error) { toast('Erreur lors de la sauvegarde des portions'); return }
    setFull(f => ({ ...f, portions: clean }))
    patchCachedPortions(food.alim_code, clean)
    setEditingPortions(false)
    toast('Portions mises à jour')
  }

  // Alternative dans la même catégorie, plus riche sur l'un des manques
  // réels du jour (voir findBetterAlternative) — indépendante des filtres
  // actifs sur la page, donc visible même en navigation libre.
  const alternative = useMemo(
    () => (foods?.length && gaps?.length ? findBetterAlternative(food, foods, gaps) : null),
    [food, foods, gaps]
  )

  // Toutes les valeurs recalculées au grammage saisi — exactement la forme
  // d'objet `totals` attendue par NutrientPanel.
  const live = useMemo(() => {
    if (!full) return null
    const f = (parseFloat(qty) || 0) / 100
    const t = {
      kcal: (full.energie_kcal || 0) * f,
      prot: (full.proteines || 0) * f,
      gluc: (full.glucides || 0) * f,
      lip:  (full.lipides || 0) * f,
      fib:  (full.fibres || 0) * f,
    }
    for (const key of ALL_NUTRIENT_KEYS) {
      const raw = full[key]
      t[key] = raw != null ? raw * f : null
    }
    return t
  }, [full, qty])

  const fav = isFavorite(food)

  const handleAdd = async () => {
    const q = parseFloat(qty)
    if (!full || !q || q <= 0) { toast('Indique une quantité'); return }
    setSaving(true)
    const { error } = await addEntry({ meal: journalMeal, ...scaleFood(full, q) })
    setSaving(false)
    if (error) { toast("Erreur à l'ajout au journal"); return }
    setSheetOpen(false)
    toast(`${food.alim_nom} ajouté à ${journalMeal}`)
    onClose()
  }

  return createPortal(
    <div className="page-modal">
      <div className="page-modal-header">
        <h2 style={{ fontSize: 15 }}>{food.alim_nom}</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px 24px' }}>
        {loading ? <Loader /> : !full ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Détail indisponible.</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <button
                className="btn-icon"
                onClick={() => toggleFavorite(full)}
                style={{ color: fav ? 'var(--amber)' : 'var(--text-hint)', flexShrink: 0 }}
                aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              >
                <Star size={18} fill={fav ? 'var(--amber)' : 'none'} />
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{getCategoryLabel(food.categorie)}</span>
            </div>

            {/* Portions courantes de l'aliment — CIQUAL n'en renseigne que pour
                une minorité d'aliments (base ANSES), d'où la possibilité de
                les ajouter/corriger ici. Sert de portion par défaut partout
                ailleurs dans l'app (getPortion()). */}
            <div className="card" style={{ padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingPortions || full.portions?.length > 0 ? 10 : 0 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Portions courantes</div>
                {!editingPortions && (
                  <button
                    onClick={startEditPortions}
                    style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Pencil size={13} /> Modifier
                  </button>
                )}
              </div>

              {!editingPortions && (
                Array.isArray(full.portions) && full.portions.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {full.portions.map((p, i) => (
                      <span key={i} style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                        {p.label} · {p.g} g
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
                    Aucune portion renseignée — la quantité par défaut retombe sur 100 g.
                  </div>
                )
              )}

              {editingPortions && (
                <>
                  {portionsDraft.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        placeholder="Ex: 1 tranche"
                        value={p.label}
                        onChange={e => updatePortionDraft(i, 'label', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <input
                        className="input"
                        type="number"
                        placeholder="g"
                        value={p.g}
                        onChange={e => updatePortionDraft(i, 'g', e.target.value)}
                        style={{ width: 70 }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-hint)', flexShrink: 0 }}>g</span>
                      {portionsDraft.length > 1 && (
                        <button onClick={() => removePortionDraft(i)} style={{ color: 'var(--coral)', flexShrink: 0, fontSize: 18, lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <button
                      onClick={addPortionDraft}
                      style={{ color: 'var(--green)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <PlusCircle size={14} /> Ajouter
                    </button>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <button onClick={() => setEditingPortions(false)} style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)' }}>
                        Annuler
                      </button>
                      <button
                        className="btn-primary"
                        onClick={savePortions}
                        disabled={savingPortions}
                        style={{ padding: '7px 16px', fontSize: 12.5, opacity: savingPortions ? 0.7 : 1 }}
                      >
                        {savingPortions ? '...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Un seul lien texte plutôt qu'une carte imposante : c'est une
                piste à explorer, pas une alerte. Cliquer bascule la fiche sur
                l'alternative (onPickFood), sans fermer la modale. */}
            {alternative && onPickFood && (
              <button
                onClick={() => onPickFood(alternative.food)}
                className="btn-ghost"
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left',
                  background: 'var(--green-light)', borderRadius: 'var(--radius-sm)', padding: '9px 11px', marginBottom: 14,
                }}
              >
                <Lightbulb size={15} style={{ color: 'var(--green-dark)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: 'var(--green-dark)', lineHeight: 1.4 }}>
                  <strong>{alternative.food.alim_nom}</strong> (même catégorie) est bien plus riche en{' '}
                  {alternative.field.label.charAt(0).toLowerCase()}{alternative.field.label.slice(1)} :{' '}
                  {formatValue(alternative.betterVal, alternative.field.unit)} contre{' '}
                  {formatValue(alternative.currentVal, alternative.field.unit)} ici, pour 100 g.
                </span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={e => setQty(e.target.value)}
                style={{ width: 110 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                g{portion.declared ? ` · portion usuelle : ${portion.label}` : ''}
              </span>
            </div>

            <MacroPreview food={full} qty={qty} />

            <NutrientPanel totals={live} hasEntries={true} defaultOpen={true} />

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 18 }}
              onClick={() => setSheetOpen(true)}
            >
              Ajouter au journal
            </button>
          </>
        )}
      </div>

      {sheetOpen && (
        <AddToJournalSheet
          nom={food.alim_nom}
          journalDate={journalDate}
          onDateChange={setJournalDate}
          journalMeal={journalMeal}
          onMealChange={setJournalMeal}
          onConfirm={saving ? () => {} : handleAdd}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>,
    document.body
  )
}
