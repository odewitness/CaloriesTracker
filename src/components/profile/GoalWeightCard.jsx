import React, { useState, useEffect } from 'react'
import { Target } from 'lucide-react'
import { useWeightProjection } from '../../hooks/useWeightProjection'
import { goalWeightProgress, goalKcalDeltaForPace } from '../../lib/poidsObjectif'
import { computeCalorieNeeds } from '../../lib/nutrients'
import { amenorrheaNotice } from '../../lib/cycle'
import { fmt, todayStr } from '../../lib/dates'

// ─────────────────────────────────────────────────────────────────────────────
// GoalWeightCard (chantier « Objectif de poids » — voir docs/objectif-poids.md)
// — poids désiré + date visée, PERSISTANTS (contrairement au calculateur
// ponctuel plus bas sur cet écran, qui redemande les mêmes infos pour un
// calcul jetable). Compare le rythme qu'il faudrait tenir pour arriver à
// temps au rythme réel déjà calculé par useWeightProjection (page
// Mensurations), et permet d'appliquer directement le calcul à `goal_kcal` /
// aux macros (même formule que le calculateur, via `calc.onApply`).
// L'ajustement hebdo continu qui affine ce chiffre avec la vraie tendance
// est dans useGoalAdjustment.js (Palier 2).
//
// Palier 3 : jamais de recalcul silencieux à l'échéance — statut atteint /
// échéance dépassée propose explicitement garder (sans date) / décaler /
// clore. Garde-fou croisé : signal d'aménorrhée (déjà suivi par le chantier
// cycle) + rythme visé agressif ici = avertissement spécifique, jamais un
// diagnostic (voir docs/objectif-poids.md §3, §7).
// ─────────────────────────────────────────────────────────────────────────────

const n1 = (v) => v.toFixed(1).replace('.', ',')

function longDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function addWeeksStr(n) {
  const d = new Date()
  d.setDate(d.getDate() + n * 7)
  return fmt(d)
}

const choiceBtnStyle = {
  flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)',
  background: 'var(--green-light)', color: 'var(--green-dark)',
}

// Jamais de recalcul silencieux à l'échéance (garde-fou §7 de la conception) :
// toujours un choix explicite. 'Garder' = poursuivre le même poids désiré
// sans date précise (statut 'sans_echeance' ensuite) ; 'Décaler' propose une
// nouvelle échéance concrète ; 'Clore' réinitialise l'objectif.
function renderChoices(progress, onPatch) {
  if (progress?.status === 'atteint') {
    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => onPatch({ date_objectif: null })} style={choiceBtnStyle}>Garder ce poids</button>
        <button onClick={() => onPatch({ poids_desire: null, date_objectif: null })} style={{ ...choiceBtnStyle, background: 'var(--gray-bg)', color: 'var(--text-muted)' }}>Nouvel objectif</button>
      </div>
    )
  }
  if (progress?.status === 'echeance_depassee') {
    return (
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => onPatch({ date_objectif: null })} style={choiceBtnStyle}>Garder (sans date)</button>
        <button onClick={() => onPatch({ date_objectif: addWeeksStr(4) })} style={choiceBtnStyle}>Décaler de 4 sem.</button>
        <button onClick={() => onPatch({ poids_desire: null, date_objectif: null })} style={{ ...choiceBtnStyle, background: 'var(--gray-bg)', color: 'var(--text-muted)' }}>Clore</button>
      </div>
    )
  }
  return null
}

function renderStatus(progress) {
  const box = (children, color) => (
    <div style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.55, color: color || 'var(--text)' }}>
      {children}
    </div>
  )

  if (!progress) {
    return box(
      "Renseigne un poids désiré et une date pour voir le rythme qu'il te faudrait tenir, comparé à ta tendance réelle.",
      'var(--text-hint)'
    )
  }

  const { status, poidsDesire, dateObjectif, trendKg, requiredKgWeek, observedKgWeek } = progress
  const dateLbl = dateObjectif ? longDate(dateObjectif) : null

  if (status === 'atteint') {
    return box(<>🎉 Tu es à peu près à ton poids désiré (~{n1(trendKg)} kg). Tu peux viser un nouveau poids, ou simplement garder ce cap.</>)
  }
  if (status === 'sans_echeance') {
    return box(observedKgWeek == null
      ? <>Tu vises {n1(poidsDesire)} kg, sans date précise. Ajoute quelques relevés de poids pour voir ta tendance réelle.</>
      : <>Tu vises {n1(poidsDesire)} kg, sans date précise. Ton rythme actuel est d'environ {n1(Math.abs(observedKgWeek))} kg/semaine{observedKgWeek < 0 ? ' (à la baisse)' : observedKgWeek > 0 ? ' (à la hausse)' : ''}.</>
    )
  }
  if (status === 'echeance_depassee') {
    return box(<>La date visée ({dateLbl}) est passée sans avoir atteint {n1(poidsDesire)} kg (tu es à ~{n1(trendKg)} kg). Rien ne change tout seul : à toi de choisir la suite ci-dessous.</>, 'var(--coral)')
  }
  if (status === 'pas_assez_de_donnees') {
    return box(<>Il te faudrait environ {n1(Math.abs(requiredKgWeek))} kg/semaine pour être à {n1(poidsDesire)} kg le {dateLbl}. Ajoute quelques relevés de poids de plus (répartis sur au moins deux semaines) pour comparer à ton rythme réel.</>)
  }

  const paceWord = requiredKgWeek < 0 ? 'perdre' : 'prendre'
  const base = (
    <>Pour être à {n1(poidsDesire)} kg le {dateLbl}, il te faudrait {paceWord} environ{' '}
      {n1(Math.abs(requiredKgWeek))} kg/semaine. Ton rythme actuel est d'environ{' '}
      {n1(Math.abs(observedKgWeek))} kg/semaine{(observedKgWeek < 0) !== (requiredKgWeek < 0) ? " (dans l'autre sens)" : ''}.</>
  )

  if (status === 'dans_les_clous') return box(<>{base} Tu es dans les clous.</>, 'var(--green-dark)')
  if (status === 'en_avance') return box(<>{base} Tu avances plus vite que nécessaire.</>, 'var(--green-dark)')
  return box(<>{base} À ce rythme, tu n'arriveras pas tout à fait à temps. Rien ne change automatiquement : à toi de voir si tu resserres un peu, ou si tu préfères repousser la date.</>, 'var(--coral)')
}

export default function GoalWeightCard({ poidsObjectif, onPatch, measurementEntries, calc, cycleDays, cycleSettings, currentGoal }) {
  const projection = useWeightProjection(measurementEntries)

  const [poidsText, setPoidsText] = useState(poidsObjectif?.poids_desire != null ? String(poidsObjectif.poids_desire) : '')
  useEffect(() => {
    setPoidsText(poidsObjectif?.poids_desire != null ? String(poidsObjectif.poids_desire) : '')
  }, [poidsObjectif?.poids_desire])

  const commitPoids = () => {
    if (poidsText === '') { onPatch({ poids_desire: null }); return }
    const num = parseFloat(poidsText.replace(',', '.'))
    if (!isNaN(num)) onPatch({ poids_desire: num })
    else setPoidsText(poidsObjectif?.poids_desire != null ? String(poidsObjectif.poids_desire) : '')
  }

  const trendKg = projection.ok ? projection.currentTrendKg : (calc?.poidsKg ?? null)
  const observedKgWeek = projection.ok ? projection.trendWeekKg : null

  const progress = goalWeightProgress({
    poidsDesire: poidsObjectif?.poids_desire,
    dateObjectif: poidsObjectif?.date_objectif,
    trendKg, observedKgWeek, today: todayStr(),
  })

  // Applique directement ce rythme à goal_kcal / aux macros — même formule
  // que le calculateur plus bas (computeCalorieNeeds), sans redemander poids
  // objectif/délai puisqu'ils sont déjà saisis ci-dessus. Pas de changement
  // de sens possible : 'perte' si le poids désiré est sous la tendance
  // actuelle, 'prise' au-dessus, 'maintien' si quasi égal.
  const missingProfile = []
  if (!calc?.sexe) missingProfile.push('sexe')
  if (!calc?.age) missingProfile.push('âge')
  if (!calc?.tailleCm) missingProfile.push('taille')

  // Une échéance encore valable (pas dépassée, pas déjà atteinte/sans date)
  // est nécessaire pour dériver perte/prise/maintien et une durée à donner
  // à computeCalorieNeeds.
  const hasValidHorizon = progress && progress.weeksRemaining != null && progress.weeksRemaining > 0
  const canApply = hasValidHorizon && missingProfile.length === 0
  const objective = canApply
    ? (poidsObjectif.poids_desire < trendKg - 0.3 ? 'perte' : poidsObjectif.poids_desire > trendKg + 0.3 ? 'prise' : 'maintien')
    : null

  // Correctif 2026-09-05 (retour utilisatrice : ce bouton proposait un nombre
  // différent de celui du bandeau d'ajustement hebdo sur la page du jour,
  // pour le même objectif) : dès qu'on a assez d'historique de poids pour
  // connaître un rythme réel (`observedKgWeek`), on calcule le nouveau
  // goal_kcal à partir de LÀ OÙ EST DÉJÀ `currentGoal` + l'écart réel/nécessaire
  // (`goalKcalDeltaForPace`, même formule que useGoalAdjustment, juste sans
  // le plafond ±100/semaine puisque c'est une action volontaire et pas une
  // proposition douce hebdomadaire) — pas la formule théorique de Mifflin-St
  // Jeor, qui peut diverger de plusieurs centaines de kcal si le métabolisme
  // réel de la personne s'écarte de l'estimation. La formule théorique ne
  // sert plus que de première estimation, tant qu'il n'y a pas encore de
  // tendance de poids réelle à exploiter (statut 'pas_assez_de_donnees').
  const overrideTargetKcal = (canApply && currentGoal != null && observedKgWeek != null && progress.requiredKgWeek != null)
    ? Math.max(1200, Math.round((currentGoal + goalKcalDeltaForPace({ observedKgWeek, requiredKgWeek: progress.requiredKgWeek })) / 10) * 10)
    : null

  const needs = canApply ? computeCalorieNeeds({
    sexe: calc.sexe,
    age: parseInt(calc.age, 10),
    tailleCm: parseFloat(calc.tailleCm),
    poidsKg: trendKg,
    activityKey: calc.niveauActivite,
    objectiveKey: objective,
    objectiveWeightKg: poidsObjectif.poids_desire,
    objectiveWeeks: Math.max(progress.weeksRemaining, 1),
    overrideTargetKcal,
  }) : null

  // Garde-fou croisé (Palier 3) : signal d'aménorrhée déjà suivi par le
  // chantier cycle + rythme visé agressif ici (même seuil %/semaine que
  // CALORIE_OBJECTIVES, calculé directement sur requiredKgWeek — pas besoin
  // du profil complet, contrairement à `needs`). Jamais un diagnostic,
  // seulement une invitation à en parler à un·e professionnel·le.
  const amenorrhea = amenorrheaNotice(todayStr(), cycleDays, cycleSettings)
  const maxSafePacePct = progress?.requiredKgWeek < 0 ? 1 : 0.5
  const aggressivePace = hasValidHorizon && trendKg
    ? Math.abs(progress.requiredKgWeek) > (maxSafePacePct / 100) * trendKg
    : false
  const crossWarning = amenorrhea && aggressivePace

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Target size={16} color="var(--green)" />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Poids objectif</span>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Poids désiré</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number" inputMode="decimal" value={poidsText} placeholder="—"
              onChange={e => setPoidsText(e.target.value)}
              onBlur={commitPoids}
              style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Date visée</div>
          <input
            type="date" value={poidsObjectif?.date_objectif || ''}
            onChange={e => onPatch({ date_objectif: e.target.value || null })}
            style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 6px', fontSize: 13, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
          />
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-hint)', marginTop: -4, marginBottom: 10 }}>
        Ces deux champs s'enregistrent automatiquement, pas besoin de bouton.
      </div>

      {!poidsObjectif?.date_objectif && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[4, 8, 12].map(w => (
            <button key={w} onClick={() => onPatch({ date_objectif: addWeeksStr(w) })} style={{
              flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font)',
              background: 'var(--green-light)', color: 'var(--green-dark)',
            }}>
              dans {w} sem.
            </button>
          ))}
        </div>
      )}

      {renderStatus(progress)}
      {renderChoices(progress, onPatch)}

      {crossWarning && (
        <div style={{ background: 'var(--coral-light)', border: '1px solid var(--coral)', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--coral)', lineHeight: 1.5, marginTop: 10 }}>
          ⚠️ Tu n'as pas noté de règles depuis {amenorrhea.days} jours, et le rythme qu'il faudrait tenir ici pour cet objectif est plus soutenu que recommandé. Le cumul des deux vaut la peine d'en parler à un·e professionnel·le de santé avant de continuer sur ce rythme.
        </div>
      )}

      {hasValidHorizon && missingProfile.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginTop: 10, lineHeight: 1.5 }}>
          Il manque {missingProfile.join(', ')} (dans « Mes informations ») pour calculer les calories correspondantes.
        </div>
      )}

      {needs && needs.macros && (
        <>
          {needs.unsafePace && (
            <div style={{ fontSize: 11.5, color: 'var(--coral)', marginTop: 10, lineHeight: 1.5 }}>
              {objective === 'perte'
                ? `Rythme plus rapide que recommandé (max ~1 % de ton poids/semaine, soit ≈${(trendKg * 0.01).toFixed(1).replace('.', ',')} kg ici) — risque de fonte musculaire et de reprise.`
                : `Rythme plus rapide que recommandé (max ~0,5 % de ton poids/semaine, soit ≈${(trendKg * 0.005).toFixed(1).replace('.', ',')} kg ici), au-delà c'est surtout du gras.`}
            </div>
          )}
          <button className="btn-primary" onClick={() => calc.onApply(needs)} style={{ marginTop: 10 }}>
            Appliquer à mes objectifs ({needs.targetKcal} kcal/j)
          </button>
        </>
      )}
    </div>
  )
}
