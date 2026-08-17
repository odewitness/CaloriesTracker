import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Star, Lightbulb } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useBackButton } from '../hooks/useBackButton'
import { useFavorites } from '../hooks/useFavorites'
import { useJournal } from '../hooks/useJournal'
import { scaleFood, ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import { getPortion, getCategoryLabel, findBetterAlternative, formatValue } from '../lib/ciqualExplorer'
import MacroPreview from './MacroPreview'
import VitaminPanel from './VitaminPanel'
import NutrientDetails from './NutrientDetails'
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
  const portion = getPortion(food)
  const [qty, setQty] = useState(String(portion.g))
  const [sheetOpen, setSheetOpen] = useState(false)
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [journalMeal, setJournalMeal] = useState('Déjeuner')
  const [saving, setSaving] = useState(false)

  const { addEntry } = useJournal(journalDate)

  useEffect(() => {
    let cancelled = false
    // Remet loading à true à CHAQUE changement d'aliment, pas seulement au
    // montage : la modale reste montée en basculant sur l'alternative
    // suggérée (onPickFood change `food` sans démonter), donc sans ce reset
    // le détail du PRÉCÉDENT aliment resterait affiché le temps du fetch.
    setLoading(true)
    setFull(null)
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
  useEffect(() => { setQty(String(portion.g)) }, [food.alim_code])

  // Alternative dans la même catégorie, plus riche sur l'un des manques
  // réels du jour (voir findBetterAlternative) — indépendante des filtres
  // actifs sur la page, donc visible même en navigation libre.
  const alternative = useMemo(
    () => (foods?.length && gaps?.length ? findBetterAlternative(food, foods, gaps) : null),
    [food, foods, gaps]
  )

  // Toutes les valeurs recalculées au grammage saisi — exactement la forme
  // d'objet `totals` attendue par VitaminPanel / NutrientDetails.
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

            <VitaminPanel totals={live} hasEntries={true} defaultOpen={true} />
            <NutrientDetails totals={live} hasEntries={true} defaultOpen={true} />

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
