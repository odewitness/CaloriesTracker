import React, { useState, useMemo } from 'react'
import { RotateCcw, Pill, Info, Coffee, Sun, Moon, Cookie } from 'lucide-react'
import { computeMealTargets, MEALS_ORDER, MEAL_ENABLED_DEFAULTS } from '../../lib/nutrients'
import { SectionScreen, SaveBar } from './primitives'

const MEAL_ICONS = { 'Petit-déjeuner': Coffee, 'Déjeuner': Sun, 'Dîner': Moon, 'Collation': Cookie }

function MealTargetCard({ meal, target, allTargets, goalKcal, onChange, onReset, onToggleEnabled }) {
  const Icon = MEAL_ICONS[meal]
  const hasOverride = target.enabled && (!target.isAuto.kcal || !target.isAuto.prot || !target.isAuto.gluc || !target.isAuto.lip)

  const totalAllocated = Object.values(allTargets).reduce((s, t) => s + (t.enabled ? t.kcal : 0), 0)
  const kcalRemaining = goalKcal - totalAllocated

  const field = (key, label, color) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <input
        type="number"
        value={target[key]}
        disabled={!target.enabled}
        onChange={e => onChange(key, e.target.value)}
        style={{
          width: 56, textAlign: 'center',
          border: `1.5px solid ${!target.enabled ? 'var(--border)' : target.isAuto[key] ? 'var(--border)' : color}`,
          borderRadius: 6, padding: '6px 4px', fontSize: 13, fontWeight: 700,
          color: !target.enabled ? 'var(--text-hint)' : color,
          background: !target.enabled ? 'var(--gray-bg)' : target.isAuto[key] ? 'var(--gray-bg)' : 'var(--white)',
          fontFamily: 'var(--font)', outline: 'none', opacity: target.enabled ? 1 : 0.5,
        }}
      />
      <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>{label}</span>
    </div>
  )

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: 8, opacity: target.enabled ? 1 : 0.6, transition: 'opacity .2s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: target.enabled ? 9 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {Icon && <Icon size={15} color={target.enabled ? 'var(--green)' : 'var(--text-hint)'} />}
          <div style={{ fontWeight: 700, fontSize: 13, color: target.enabled ? 'var(--text)' : 'var(--text-hint)' }}>{meal}</div>
          {!target.enabled && (
            <span style={{ fontSize: 10, color: 'var(--text-hint)', background: 'var(--gray-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>désactivé</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasOverride && target.enabled && (
            <button onClick={onReset} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text-hint)', fontFamily: 'var(--font)' }}>
              <RotateCcw size={11} /> Auto
            </button>
          )}
          <button
            onClick={onToggleEnabled}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
              background: target.enabled ? 'var(--green)' : 'var(--border-md)',
              transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: target.enabled ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      </div>

      {target.enabled && (
        <>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {field('kcal', 'kcal', 'var(--text)')}
            {field('prot', 'Prot.', 'var(--green)')}
            {field('gluc', 'Gluc.', 'var(--amber)')}
            {field('lip',  'Lip.',  'var(--coral)')}
          </div>
          {!target.isAuto.kcal && (
            <div style={{ marginTop: 7, fontSize: 11, color: Math.abs(kcalRemaining) < 2 ? 'var(--green)' : kcalRemaining < 0 ? 'var(--coral)' : 'var(--amber)' }}>
              {Math.abs(kcalRemaining) < 2
                ? '✓ Budget calorique équilibré'
                : kcalRemaining < 0
                  ? `⚠ ${Math.abs(Math.round(kcalRemaining))} kcal en trop au total`
                  : `${Math.round(kcalRemaining)} kcal non attribuées (réparties automatiquement)`}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Écran de détail « Répartition par repas ».
export default function MealSplitSection({ goals, setGoals, setGoalsDirty, dirty, saving, onSave, onBack }) {
  const [showHow, setShowHow] = useState(false)
  const mealTargets = useMemo(() => computeMealTargets(goals), [goals])

  const setMealOverride = (meal, key, rawValue) => {
    setGoals(g => {
      const overrides = { ...(g.meal_overrides || {}) }
      const mealOv = { ...(overrides[meal] || {}) }
      if (rawValue === '') {
        delete mealOv[key]
      } else {
        const num = parseFloat(rawValue)
        if (!isNaN(num)) mealOv[key] = num
      }
      if (Object.keys(mealOv).length === 0) delete overrides[meal]
      else overrides[meal] = mealOv
      return { ...g, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const resetMealOverrides = (meal) => {
    setGoals(g => {
      const overrides = { ...(g.meal_overrides || {}) }
      delete overrides[meal]
      return { ...g, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const toggleMealEnabled = (meal) => {
    setGoals(g => {
      const enabled = { ...MEAL_ENABLED_DEFAULTS, ...(g.meal_enabled || {}) }
      enabled[meal] = !enabled[meal]
      const overrides = { ...(g.meal_overrides || {}) }
      if (!enabled[meal]) delete overrides[meal]
      return { ...g, meal_enabled: enabled, meal_overrides: overrides }
    })
    setGoalsDirty(true)
  }

  const complementsOn = goals.meal_enabled?.['Compléments'] !== false

  return (
    <SectionScreen title="Répartition par repas" onBack={onBack}>
      <button
        onClick={() => setShowHow(s => !s)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font)', marginBottom: showHow ? 8 : 14 }}
      >
        <Info size={14} /> Comment c'est calculé
      </button>
      {showHow && (
        <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5, marginBottom: 14 }}>
          Calculée automatiquement à partir de tes objectifs (calories réparties selon les repères nutritionnels usuels, protéines réparties à parts égales entre les 3 repas principaux pour mieux soutenir la synthèse musculaire). Modifie une valeur pour la fixer manuellement, ou appuie sur « Auto » pour revenir au calcul automatique. Désactive un repas pour rendre son budget aux autres.
        </div>
      )}

      {MEALS_ORDER.map(meal => (
        <MealTargetCard
          key={meal}
          meal={meal}
          target={mealTargets[meal]}
          allTargets={mealTargets}
          goalKcal={goals.goal_kcal}
          onChange={(key, val) => setMealOverride(meal, key, val)}
          onReset={() => resetMealOverrides(meal)}
          onToggleEnabled={() => toggleMealEnabled(meal)}
        />
      ))}

      {/* Compléments alimentaires — pas un repas, pas de calcul kcal/macros */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 8, opacity: complementsOn ? 1 : 0.6, transition: 'opacity .2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Pill size={15} color={complementsOn ? 'var(--purple)' : 'var(--text-hint)'} />
            <div style={{ fontWeight: 700, fontSize: 13, color: complementsOn ? 'var(--text)' : 'var(--text-hint)' }}>Compléments</div>
            {!complementsOn && (
              <span style={{ fontSize: 10, color: 'var(--text-hint)', background: 'var(--gray-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>désactivé</span>
            )}
          </div>
          <button
            onClick={() => toggleMealEnabled('Compléments')}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', flexShrink: 0,
              background: complementsOn ? 'var(--green)' : 'var(--border-md)',
              transition: 'background .2s',
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: complementsOn ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: 'white',
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
        </div>
      </div>

      <SaveBar visible={dirty} onSave={onSave} saving={saving} label="Enregistrer la répartition" />
    </SectionScreen>
  )
}
