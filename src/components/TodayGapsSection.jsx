import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, Plus, ChevronDown, Settings, Shuffle } from 'lucide-react'
import { useFavorites, foodIdentity } from '../hooks/useFavorites'
import { useJournalFoodHistory } from '../hooks/useJournalFoodHistory'
import { useComplementFoodIds } from '../hooks/useComplementFoodIds'
import { useAuth } from '../lib/AuthContext'
import { portionGapCoverage, formatValue, findField, getClaimLevel, getPortion, rawValue } from '../lib/ciqualExplorer'
import { COMPLEMENT_CATEGORY } from '../lib/foodCategories'
import { scaleFood } from '../lib/nutrients'
import { logSuggestions } from '../lib/suggestionsLog'
import NutrientGapsBanner from './NutrientGapsBanner'
import AllGapsSheet from './AllGapsSheet'
import AddToJournalSheet from './AddToJournalSheet'

const MAX_SUGGESTIONS = 3

// Réglage "Quels aliments proposer" (icône engrenage à côté du titre). Le choix
// est mémorisé dans localStorage et rechargé au démarrage de l'app. Dans tous
// les cas on ne pioche QUE dans les favoris — voir `candidatePool` plus bas.
const FOOD_MODE_KEY = 'today-gaps-food-mode'
const FOOD_MODES = [
  { key: 'recent', label: 'Aliments récents',   hint: 'Vus dans tes 50 dernières entrées du journal' },
  { key: 'most',   label: 'Les plus consommés', hint: 'Ceux que tu notes le plus souvent' },
  { key: 'never',  label: 'Jamais consommés',   hint: "Ceux que tu n'as pas encore notés" },
]
function readFoodMode() {
  try {
    const v = localStorage.getItem(FOOD_MODE_KEY)
    return FOOD_MODES.some(m => m.key === v) ? v : 'recent'
  } catch { return 'recent' }
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

// "a", "a et b", "a, b et c"
function joinFr(items) {
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`
}

// "vitamine d", "vitamine d et calcium", "fer, zinc et magnésium"
function joinNutrients(fields) {
  return joinFr(fields.map(f => lowerFirst(f.label)))
}

// Texte de couverture d'une suggestion en mode filtré, préfixé d'une espace :
//   1 nutriment  → " couvrent 45% de ton manque en vitamine d"
//                  (ou " comblent ton manque en vitamine d" si ≥ 100%)
//   plusieurs    → " couvrent 45% de ton manque en vitamine d, 30% en calcium"
// `parts` : [{ field, pct }], au moins un élément, pct entre 0 et 100.
function coveragePhrase(parts) {
  if (parts.length === 1) {
    const { field, pct } = parts[0]
    return pct >= 100
      ? ` comblent ton manque en ${lowerFirst(field.label)}`
      : ` couvrent ${pct}% de ton manque en ${lowerFirst(field.label)}`
  }
  const segs = parts.map(({ field, pct }, i) => i === 0
    ? `couvrent ${pct}% de ton manque en ${lowerFirst(field.label)}`
    : `${pct}% en ${lowerFirst(field.label)}`)
  return ` ${joinFr(segs)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// TodayGapsSection — ramène sur la page du jour ce qui fait l'intérêt de
// l'Explorer (voir NutrientGapsBanner / ciqualExplorer.js) : les manques
// nutritionnels du jour, et des suggestions concrètes pour les combler à
// partir de ses favoris, plutôt qu'un simple constat.
//
// L'icône engrenage à côté du titre choisit QUELS favoris servent de vivier
// aux suggestions (récents / plus consommés / jamais consommés) — voir
// FOOD_MODES et `candidatePool`. Le choix est mémorisé (localStorage) et
// rechargé au démarrage.
//
// N'est monté QUE pour le jour réellement affiché (voir TodayPage.DaySlot) —
// les favoris et l'historique de consommation ne sont donc chargés qu'une
// fois, pas une fois par slot de swipe.
//
// Props :
//   dateStr    — jour concerné (yyyy-mm-dd), sert de journalDate par défaut
//                dans la feuille d'ajout rapide
//   gaps / allGaps — sortie de getNutrientGaps, déjà calculée côté DaySlot —
//                pas de second calcul ici.
//   top10Gaps  — les 10 manques les plus urgents avec leur grammage absolu
//                (voir getGapAmount), sert de vivier au moteur de suggestion
//                ci-dessous (voir `suggestions`).
//   entries    — du jour, sert juste à savoir si "rien de noté aujourd'hui"
//   remainingKcal — calories restantes du jour (objectif - consommé), sert à
//                privilégier parmi les candidats ceux qui tiennent dedans
//                (voir `suggestions`) ; null si pas d'objectif calorique réglé
//   onAddEntry(entry) — même handler que le "+" des repas (useJournal.addEntry)
//
// Taper une pastille de manque ne quitte plus la page : elle devient un
// filtre local (selectedGapKeys) qui restreint les suggestions aux favoris
// riches en ce(s) nutriment(s). Plusieurs pastilles = on privilégie les
// aliments qui en couvrent le plus à la fois (voir `suggestions`).
// ─────────────────────────────────────────────────────────────────────────────
export default function TodayGapsSection({ dateStr, gaps, allGaps, top10Gaps, entries, remainingKcal, onAddEntry }) {
  const { favorites } = useFavorites()
  const { recentKeys, countByKey } = useJournalFoodHistory()
  const complementIds = useComplementFoodIds()
  const { user } = useAuth()
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('today-gaps-collapsed')) ?? true }
    catch { return true }
  })
  const [foodMode, setFoodMode] = useState(readFoodMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Pastilles de manque tapées par l'utilisatrice : filtre local, non
  // persisté, sur les suggestions (favoris riches en ces nutriments). La
  // section est démontée dès qu'on quitte le jour réel (voir TodayPage :
  // rendue seulement si isToday), donc le filtre repart à zéro tout seul.
  const [selectedGapKeys, setSelectedGapKeys] = useState([])
  const toggleGapKey = (key) => setSelectedGapKeys(
    keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key],
  )
  // Incrémenté par le bouton "aléatoire" : sert uniquement à forcer un
  // recalcul de `suggestions` (qui pioche déjà au hasard), pour re-tirer 3
  // aliments sans changer de jour ni de réglage.
  const [shuffleNonce, setShuffleNonce] = useState(0)
  const [gapsSheetOpen, setGapsSheetOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(null) // { food, qty, date, meal, saving } | null

  const chooseFoodMode = (m) => {
    setFoodMode(m)
    try { localStorage.setItem(FOOD_MODE_KEY, m) } catch {}
    setSettingsOpen(false)
  }

  const toggleOpen = () => setOpen(o => {
    const next = !o
    try { localStorage.setItem('today-gaps-collapsed', JSON.stringify(next)) } catch {}
    return next
  })

  // Vivier de candidats pour le moteur de suggestion : toujours les favoris,
  // filtrés/ordonnés selon le réglage choisi. On garde `food_data` (l'objet
  // aliment complet stocké au moment du favori) : c'est lui qui porte les
  // valeurs nutritionnelles dont portionGapCoverage a besoin.
  const candidatePool = useMemo(() => {
    // Les compléments alimentaires sont exclus : le moteur raisonne en grammes
    // (portion habituelle, "X g couvrent Y%"), ce qui n'a pas de sens pour des
    // gélules/comprimés. Ils restent gérés dans la section Compléments dédiée.
    // On recoupe la catégorie du snapshot figé du favori (`food_data`, parfois
    // périmé) avec la liste réelle des compléments (voir useComplementFoodIds).
    const favFoods = favorites
      .filter(f => !(f.food_source === 'custom' && complementIds.has(f.food_ref_id)))
      .map(f => f.food_data)
      .filter(f => f && f.categorie !== COMPLEMENT_CATEGORY)
    if (foodMode === 'most') {
      return favFoods
        .map(f => ({ f, n: countByKey.get(foodIdentity(f).key) || 0 }))
        .filter(x => x.n > 0)
        .sort((a, b) => b.n - a.n)
        .map(x => x.f)
    }
    if (foodMode === 'never') {
      return favFoods.filter(f => !countByKey.has(foodIdentity(f).key))
    }
    return favFoods.filter(f => recentKeys.has(foodIdentity(f).key))
  }, [favorites, foodMode, recentKeys, countByKey, complementIds])

  // Champs (nutriments) correspondant aux pastilles tapées, dans l'ordre où
  // elles ont été tapées.
  const selectedFields = useMemo(
    () => selectedGapKeys.map(findField).filter(f => f && !f.virtual),
    [selectedGapKeys],
  )

  // On parcourt les manques dans leur ordre d'urgence (top10Gaps est déjà
  // trié du plus urgent au moins urgent, voir getNutrientGaps) et, pour
  // CHAQUE manque, on cherche l'aliment qu'elle mange déjà dont SA PORTION
  // HABITUELLE (voir portionGapCoverage) le couvre le mieux — un aliment
  // déjà retenu pour un manque n'est pas réutilisé pour un autre, pour avoir
  // des suggestions variées plutôt que 3 fois le même aliment/nutriment.
  //
  // Choisir systématiquement le meilleur aliment TOUS MANQUES CONFONDUS (au
  // lieu, comme ici, du meilleur PAR manque pris dans l'ordre d'urgence)
  // faisait converger toutes les suggestions vers le même nutriment : un
  // manque presque comblé (donc trivialement couvert à 100 % par n'importe
  // quel aliment qui en contient un peu) gagnait systématiquement face aux
  // manques réellement importants.
  //
  // Le grammage n'est jamais inventé/plafonné : c'est la portion réelle de
  // l'aliment (déclarée, ou 100 g par défaut), donc il varie naturellement
  // d'un aliment à l'autre au lieu de converger vers un même chiffre.
  //
  // Pour ne pas montrer toujours le même aliment pour un manque donné, on
  // pioche au hasard parmi les meilleurs candidats plutôt que de toujours
  // prendre le premier — recalculé à chaque montage de la section (ouverture
  // de l'app, changement de jour), donc ça varie d'une fois à l'autre.
  //
  // Parmi ces meilleurs candidats, on priorise ceux dont la portion tient
  // dans les calories qu'il reste à la journée (remainingKcal) — inutile de
  // suggérer 40 g d'amandes pour le magnésium si ça fait dépasser l'objectif
  // du jour. Si AUCUN candidat ne tient dedans, on retombe sur les meilleurs
  // quand même plutôt que de ne rien suggérer : combler un manque reste
  // pertinent même en dépassement, et un léger dépassement calorique est un
  // moindre mal face à l'absence totale de suggestion.
  const suggestions = useMemo(() => {
    if (!top10Gaps.length) return []
    const candidates = candidatePool
    const seen = new Set()
    const uniqueCandidates = []
    for (const food of candidates) {
      const key = foodIdentity(food).key
      if (seen.has(key)) continue
      seen.add(key)
      uniqueCandidates.push(food)
    }

    // ── Mode "filtré sur des nutriments choisis" ────────────────────────────
    // L'utilisatrice a tapé une ou plusieurs pastilles de manque : on ne
    // montre que des favoris qui apportent ces nutriments, en priorité ceux
    // qui en sont « riches » (seuil UE ≥ 30 % VNR/100 g) et qui en couvrent
    // le plus à la fois. Un aliment seulement « source de » (≥ 15 %) compte
    // pour la description mais passe après les « riches » au classement, et
    // ne sert de suggestion que s'il n'y a pas assez de « riches ».
    if (selectedFields.length) {
      const missingByKey = new Map(allGaps.map(g => [g.field.key, g.missing]))
      // % du manque du jour que la portion habituelle de `food` couvre sur
      // `field` (même calcul que portionGapCoverage) — null si on ne connaît
      // pas le manque en valeur absolue pour ce nutriment.
      const coverPct = (food, field, portionG) => {
        const missing = missingByKey.get(field.key)
        const per100 = rawValue(food, field)
        if (!missing || per100 == null || per100 <= 0) return null
        return Math.round(Math.min(100, ((per100 * portionG) / 100 / missing) * 100))
      }

      const rows = []
      for (const food of uniqueCandidates) {
        const portionG = getPortion(food).g
        let riche = 0
        const parts = []           // { field, pct } pour chaque nutriment couvert, dans l'ordre des pastilles
        for (const field of selectedFields) {
          const lvl = getClaimLevel(food, field)
          if (lvl !== 'riche' && lvl !== 'source') continue
          if (lvl === 'riche') riche++
          parts.push({ field, pct: coverPct(food, field, portionG) })
        }
        if (!parts.length) continue
        const kcal = ((food.energie_kcal || 0) * portionG) / 100
        rows.push({ food, parts, riche, portionG, kcal })
      }
      const richRows = rows.filter(r => r.riche > 0)
      const pool = richRows.length ? richRows : rows
      if (!pool.length) return []

      pool.sort((a, b) => {
        if (b.riche !== a.riche) return b.riche - a.riche
        if (b.parts.length !== a.parts.length) return b.parts.length - a.parts.length
        const aFits = remainingKcal != null && a.kcal <= remainingKcal ? 1 : 0
        const bFits = remainingKcal != null && b.kcal <= remainingKcal ? 1 : 0
        if (aFits !== bFits) return bFits - aFits
        return Math.random() - 0.5 // variété + réponse au bouton "aléatoire"
      })

      return pool.slice(0, MAX_SUGGESTIONS).map(({ food, parts, portionG, kcal }) => {
        // Ne garde pour le texte que les nutriments dont on connaît le % ;
        // repli sur tous si aucun (manque en valeur absolue indisponible).
        const withPct = parts.filter(p => p.pct != null)
        const shown = withPct.length ? withPct : parts.map(p => ({ ...p, pct: 100 }))
        return {
          food,
          gap: { field: shown[0].field },
          coverage: { grams: portionG, kcal, pct: shown[0].pct },
          parts: shown,
        }
      })
    }

    const used = new Set()
    const out = []
    for (const gap of top10Gaps) {
      if (out.length >= MAX_SUGGESTIONS) break
      const matches = []
      for (const food of uniqueCandidates) {
        const key = foodIdentity(food).key
        if (used.has(key)) continue
        const c = portionGapCoverage(food, gap)
        if (c && c.pct > 0) matches.push({ food, coverage: c })
      }
      if (!matches.length) continue
      const fitting = remainingKcal != null
        ? matches.filter(m => m.coverage.kcal <= remainingKcal)
        : matches
      const ranked = fitting.length ? fitting : matches
      ranked.sort((a, b) => b.coverage.pct - a.coverage.pct)
      const pool = ranked.slice(0, Math.min(3, ranked.length))
      const pick = pool[Math.floor(Math.random() * pool.length)]
      used.add(foodIdentity(pick.food).key)
      out.push({ food: pick.food, gap, coverage: pick.coverage })
    }
    return out
    // shuffleNonce : non lu dans le corps, présent en dépendance pour que le
    // bouton "aléatoire" relance le tirage au hasard ci-dessus.
  }, [top10Gaps, allGaps, candidatePool, remainingKcal, shuffleNonce, selectedFields])

  // Trace ce qui a réellement été montré : c'est la matière première de la
  // section "Suggestions" de la liste de courses (voir
  // useGroceriesSuggestions.js), qui fait remonter les aliments les plus
  // fréquents parmi ceux suggérés ici au fil du temps.
  useEffect(() => { logSuggestions(suggestions, user?.id) }, [suggestions, user?.id])

  const handleQuickAdd = (suggestion) => {
    setQuickAdd({
      food: suggestion.food,
      qty: String(Math.max(1, Math.round(suggestion.coverage.grams))),
      date: dateStr,
      meal: 'Déjeuner',
      saving: false,
    })
  }

  const confirmQuickAdd = async () => {
    const q = parseFloat(quickAdd.qty)
    if (!q || q <= 0) return
    setQuickAdd(qa => ({ ...qa, saving: true }))
    await onAddEntry({ meal: quickAdd.meal, ...scaleFood(quickAdd.food, q) })
    setQuickAdd(null)
  }


  return (
    <>
      {/* Fond blanc et repliable comme "Détail nutritionnel" (NutrientPanel) —
          même pattern d'en-tête cliquable + chevron, pour que les deux
          sections de la page se comportent pareil. */}
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        {/* En-tête : titre + engrenage de réglages + chevron. Le titre et le
            chevron replient la section ; l'engrenage ouvre le choix "Quels
            aliments proposer" (boutons distincts pour ne pas imbriquer). */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={toggleOpen}
            style={{ flex: 1, textAlign: 'left', padding: '13px 8px 13px 16px', fontWeight: 600, fontSize: 14 }}
          >
            À combler aujourd'hui
          </button>
          {open && suggestions.length > 0 && (
            <button
              onClick={() => setShuffleNonce(n => n + 1)}
              className="btn-icon"
              aria-label="Proposer 3 autres aliments"
              style={{ flexShrink: 0, width: 32, height: 32, color: 'var(--text-muted)' }}
            >
              <Shuffle size={15} />
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="btn-icon"
            aria-label="Réglages des suggestions"
            aria-pressed={settingsOpen}
            style={{ flexShrink: 0, width: 32, height: 32, color: settingsOpen ? 'var(--green)' : 'var(--text-muted)' }}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={toggleOpen}
            aria-label={open ? 'Replier' : 'Déplier'}
            style={{ flexShrink: 0, padding: '13px 16px 13px 8px' }}
          >
            <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </button>
        </div>

        {settingsOpen && (
          <div style={{ padding: '2px 16px 12px', borderTop: '1px solid var(--border)' }}>
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.5px', margin: '10px 0 6px',
            }}>
              Quels aliments proposer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {FOOD_MODES.map(m => {
                const active = foodMode === m.key
                return (
                  <button
                    key={m.key}
                    onClick={() => chooseFoodMode(m.key)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 2px', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                      border: `2px solid ${active ? 'var(--green)' : 'var(--border-md)'}`,
                      background: active ? 'var(--green)' : 'transparent',
                      boxShadow: active ? 'inset 0 0 0 2.5px var(--white)' : 'none',
                    }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{m.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.35 }}>{m.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 6 }}>
              Toujours uniquement parmi tes favoris.
            </div>
          </div>
        )}

        {open && (
          <div style={{ padding: '0 16px 14px' }}>
            <NutrientGapsBanner
              gaps={gaps}
              // "…" toujours proposé dès qu'il y a au moins un manque : c'est
              // l'accès à la liste complète des vitamines/minéraux manquants
              // (AllGapsSheet) pour en choisir un qui n'est pas dans les 3
              // pastilles visibles.
              hasMoreGaps={allGaps.length > 0}
              onShowAllGaps={() => setGapsSheetOpen(true)}
              hasEntries={entries.length > 0}
              // Pas de "tient dans mes calories restantes" ici : ce toggle filtre
              // une liste de résultats, qui n'existe pas sur cette page — seule
              // l'Explorer en a l'usage.
              remainingKcal={null}
              activeClaims={selectedGapKeys}
              onPickGap={toggleGapKey}
              // Le titre "À combler aujourd'hui" est déjà porté par l'en-tête
              // repliable ci-dessus — éviter de le répéter deux fois.
              hideTitle
            />

            {selectedFields.length > 0 && suggestions.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text-hint)', margin: '-4px 0 8px' }}>
                Aucun de tes favoris n'est riche en {joinNutrients(selectedFields)}.
              </div>
            )}

            {suggestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.map(s => (
                  <div
                    key={foodIdentity(s.food).key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      background: 'var(--green-light)', borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <Lightbulb size={15} style={{ color: 'var(--green-dark)', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--green-dark)', lineHeight: 1.4 }}>
                      <strong>{formatValue(s.coverage.grams, 'g')}</strong> de <em>{s.food.alim_nom}</em>
                      {s.parts
                        ? coveragePhrase(s.parts)
                        : s.coverage.pct >= 100
                          ? ` comblent ton manque en ${lowerFirst(s.gap.field.label)}`
                          : ` couvrent ${s.coverage.pct}% de ton manque en ${lowerFirst(s.gap.field.label)}`}
                    </div>
                    <button
                      onClick={() => handleQuickAdd(s)}
                      className="btn-icon"
                      style={{ width: 24, height: 24, flexShrink: 0, background: 'var(--white)', color: 'var(--green-dark)' }}
                      aria-label={`Ajouter ${s.food.alim_nom} au journal`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Portals obligatoires : cette section vit dans le slider de jours de
          TodayPage (conteneur en transform: translateX). Une feuille en
          position: fixed rendue ici se calerait sur ce conteneur transformé
          (3x large, décalée) au lieu du viewport — feuille coupée sur les
          côtés, bouton hors écran. Voir CLAUDE.md. */}
      {gapsSheetOpen && createPortal(
        <AllGapsSheet
          gaps={allGaps}
          activeClaims={selectedGapKeys}
          onPick={toggleGapKey}
          onClose={() => setGapsSheetOpen(false)}
        />,
        document.body,
      )}

      {quickAdd && createPortal(
        <AddToJournalSheet
          nom={quickAdd.food.alim_nom}
          qty={quickAdd.qty}
          onQtyChange={v => setQuickAdd(q => ({ ...q, qty: v }))}
          journalDate={quickAdd.date}
          onDateChange={v => setQuickAdd(q => ({ ...q, date: v }))}
          journalMeal={quickAdd.meal}
          onMealChange={v => setQuickAdd(q => ({ ...q, meal: v }))}
          onConfirm={quickAdd.saving ? () => {} : confirmQuickAdd}
          onClose={() => setQuickAdd(null)}
        />,
        document.body,
      )}
    </>
  )
}
