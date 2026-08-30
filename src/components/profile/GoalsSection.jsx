import React, { useState } from 'react'
import { Flame, Dumbbell, Wheat, Droplets, Leaf, Calculator, ChevronRight, ChevronDown, TrendingDown } from 'lucide-react'
import { computeCalorieNeeds, ACTIVITY_LEVELS, CALORIE_OBJECTIVES } from '../../lib/nutrients'
import { GoalField, SectionScreen, SaveBar, Row, ToggleSwitch } from './primitives'

// ── Calculateur de besoins caloriques ────────────────────────────────────────
// Déplié à la demande depuis l'écran Objectifs (bouton « Calculer mes besoins »).
function CalorieCalculatorCard({ sexe, tailleCm, niveauActivite, onActivite, objective, onObjective, targetWeight, onTargetWeight, weeks, onWeeks, poidsKg, age, onOpenMeasurements, onApply }) {
  const missing = []
  if (!sexe) missing.push('sexe')
  if (!age) missing.push('âge')
  if (!tailleCm) missing.push('taille')
  if (!poidsKg) missing.push('poids')
  const missingLabel = missing.length > 1
    ? missing.slice(0, -1).join(', ') + ' et ' + missing[missing.length - 1]
    : missing[0]

  const needsWeightGoal = objective !== 'maintien'
  const objectiveWeightKg = targetWeight ? parseFloat(targetWeight) : null
  const objectiveWeeks = weeks ? parseFloat(weeks) : null

  // Pour la perte, le poids objectif doit être inférieur au poids actuel (et
  // inversement pour la prise) — sinon le calcul donnerait un ajustement dans
  // le mauvais sens (ex. un surplus alors qu'on a choisi « Perte de poids »).
  const wrongDirection = needsWeightGoal && poidsKg != null && objectiveWeightKg != null && (
    (objective === 'perte' && objectiveWeightKg >= poidsKg) ||
    (objective === 'prise' && objectiveWeightKg <= poidsKg)
  )

  const needs = wrongDirection ? null : computeCalorieNeeds({
    sexe,
    age: age ? parseInt(age, 10) : null,
    tailleCm: tailleCm ? parseFloat(tailleCm) : null,
    poidsKg,
    activityKey: niveauActivite,
    objectiveKey: objective,
    objectiveWeightKg: needsWeightGoal ? objectiveWeightKg : null,
    objectiveWeeks: needsWeightGoal ? objectiveWeeks : null,
  })

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 20 }}>
      {missing.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 12, lineHeight: 1.5 }}>
          Il manque : {missingLabel}, pour voir l'estimation (sexe, âge et taille se règlent dans « Mes informations »).
        </div>
      )}

      <div onClick={onOpenMeasurements} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: 'pointer' }}>
        <div style={{ flex: 1, fontSize: 13 }}>Poids</div>
        <span style={{ fontSize: 13, color: poidsKg != null ? 'var(--text)' : 'var(--coral)', fontWeight: 600 }}>
          {poidsKg != null ? `${poidsKg} kg` : 'à renseigner'}
        </span>
        <ChevronRight size={14} color="var(--text-hint)" />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>Niveau d'activité</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACTIVITY_LEVELS.map(a => (
            <button key={a.key} onClick={() => onActivite(a.key)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontFamily: 'var(--font)',
              border: `1.5px solid ${niveauActivite === a.key ? 'var(--green)' : 'var(--border)'}`,
              background: niveauActivite === a.key ? 'var(--green-light)' : 'var(--white)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: niveauActivite === a.key ? 'var(--green-dark)' : 'var(--text)' }}>{a.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: needsWeightGoal ? 10 : 14 }}>
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 6 }}>Objectif</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {CALORIE_OBJECTIVES.map(o => (
            <button key={o.key} onClick={() => onObjective(o.key)} style={{
              flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
              background: objective === o.key ? 'var(--green)' : 'var(--green-light)',
              color: objective === o.key ? 'white' : 'var(--green-dark)',
            }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {needsWeightGoal && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>Poids objectif</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" value={targetWeight} onChange={e => onTargetWeight(e.target.value)} placeholder="—"
                style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 4 }}>En combien de temps</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" value={weeks} onChange={e => onWeeks(e.target.value)} placeholder="—"
                style={{ width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)', color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none' }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>sem.</span>
            </div>
          </div>
        </div>
      )}

      {wrongDirection && (
        <div style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 12, lineHeight: 1.5 }}>
          {objective === 'perte'
            ? 'Ton poids objectif doit être inférieur à ton poids actuel pour une perte de poids.'
            : 'Ton poids objectif doit être supérieur à ton poids actuel pour une prise de muscle.'}
        </div>
      )}

      {needs && needs.macros ? (
        <div style={{ background: 'var(--gray-bg)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Métabolisme de base : <strong style={{ color: 'var(--text)' }}>{needs.bmr} kcal</strong></div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>Dépense totale (maintien) : <strong style={{ color: 'var(--text)' }}>{needs.tdee} kcal</strong></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--coral)', marginTop: 6 }}>
            Objectif estimé : {needs.targetKcal} kcal/jour
          </div>
          {needs.paceKgPerWeek != null && (
            <div style={{ fontSize: 11, color: needs.unsafePace ? 'var(--coral)' : 'var(--text-hint)', marginTop: 2 }}>
              Rythme : ≈ {needs.paceKgPerWeek > 0 ? '+' : ''}{needs.paceKgPerWeek.toFixed(2)} kg/semaine
              {needs.unsafePace && (objective === 'perte'
                ? ' — plus rapide que recommandé (max ~1 kg/semaine), risque de fonte musculaire et de reprise'
                : ' — plus rapide que recommandé (max ~0,5 kg/semaine), au-delà c\'est surtout du gras')}
            </div>
          )}
        </div>
      ) : (missing.length === 0 && needsWeightGoal && !wrongDirection && (!targetWeight || !weeks)) ? (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', marginBottom: 12, lineHeight: 1.5 }}>
          Renseigne ton poids objectif et la durée pour voir l'estimation.
        </div>
      ) : null}

      <button className="btn-primary" disabled={!needs || !needs.macros} onClick={() => onApply(needs)} style={{ opacity: (needs && needs.macros) ? 1 : 0.5 }}>
        Appliquer ces valeurs aux objectifs
      </button>
    </div>
  )
}

// Écran de détail « Objectifs nutritionnels ».
export default function GoalsSection({
  goals, setGoal, dirty, saving, onSave, onBack,
  autoAdjustEnabled = false, onToggleAutoAdjust,
  calc, // { sexe, tailleCm, niveauActivite, onActivite, objective, onObjective, targetWeight, onTargetWeight, weeks, onWeeks, poidsKg, age, onOpenMeasurements, onApply }
}) {
  const [showCalc, setShowCalc] = useState(false)

  return (
    <SectionScreen title="Objectifs nutritionnels" onBack={onBack}>
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <GoalField icon={<Flame size={18} />}    label="Calories"   value={goals.goal_kcal}      unit="kcal" color="var(--coral)" onChange={v => setGoal('goal_kcal', v)} />
        <GoalField icon={<Dumbbell size={18} />} label="Protéines"  value={goals.goal_proteines} unit="g"    color="var(--green)" onChange={v => setGoal('goal_proteines', v)} />
        <GoalField icon={<Wheat size={18} />}    label="Glucides"   value={goals.goal_glucides}  unit="g"    color="var(--amber)" onChange={v => setGoal('goal_glucides', v)} />
        <GoalField icon={<Droplets size={18} />} label="Lipides"    value={goals.goal_lipides}   unit="g"    color="var(--coral)" onChange={v => setGoal('goal_lipides', v)} />
        <GoalField icon={<Leaf size={18} />}     label="Fibres"     value={goals.goal_fibres}    unit="g"    color="var(--blue)"  onChange={v => setGoal('goal_fibres', v)} />
      </div>

      <SaveBar visible={dirty} onSave={onSave} saving={saving} label="Enregistrer les objectifs" />

      {onToggleAutoAdjust && (
        <div className="card" style={{ marginTop: dirty ? 0 : 4, marginBottom: 16, overflow: 'hidden' }}>
          <Row icon={<TrendingDown size={18} />} label="Ajuster selon mon poids">
            <ToggleSwitch checked={autoAdjustEnabled} onClick={onToggleAutoAdjust} />
          </Row>
          <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5 }}>
            Une fois par semaine, si ta tendance de poids s'éloigne de ce que ton objectif calorique vise, l'app te proposera un petit ajustement (±100 kcal max). Tu valides toujours — rien ne change tout seul.
          </div>
        </div>
      )}

      <button
        onClick={() => setShowCalc(s => !s)}
        className="card"
        style={{ width: '100%', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font)', fontSize: 14, fontWeight: 600, marginTop: dirty ? 0 : 4, marginBottom: showCalc ? 10 : 20 }}
      >
        <Calculator size={16} color="var(--green)" />
        <span style={{ flex: 1, textAlign: 'left' }}>Calculer mes besoins caloriques</span>
        {showCalc ? <ChevronDown size={16} color="var(--text-hint)" /> : <ChevronRight size={16} color="var(--text-hint)" />}
      </button>

      {showCalc && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 10 }}>
            À partir de tes informations, ton poids et ton niveau d'activité, l'app estime tes besoins. « Appliquer » remplit les champs ci-dessus — pense ensuite à enregistrer.
          </div>
          <CalorieCalculatorCard {...calc} />
        </>
      )}
    </SectionScreen>
  )
}
