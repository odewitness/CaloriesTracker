import React, { useState, useEffect } from 'react'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../lib/toast'
import { Settings, Target, Flame, Dumbbell, Wheat, Droplets, Leaf } from 'lucide-react'

const PRESETS = [
  { label: 'Perte de poids (femme)', kcal: 1400, prot: 100, gluc: 130, lip: 50, fib: 30 },
  { label: 'Perte de poids (homme)', kcal: 1700, prot: 130, gluc: 160, lip: 60, fib: 35 },
  { label: 'Maintien (femme)',        kcal: 1900, prot: 90,  gluc: 210, lip: 70, fib: 30 },
  { label: 'Maintien (homme)',        kcal: 2400, prot: 110, gluc: 270, lip: 85, fib: 35 },
  { label: 'Prise de muscle (homme)', kcal: 2800, prot: 170, gluc: 320, lip: 90, fib: 35 },
]

function GoalField({ icon, label, value, unit, color, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
      <div style={{ color, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>Objectif quotidien</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          style={{ width: 72, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', color, background: 'var(--gray-bg)', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{unit}</span>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const toast = useToast()
  const { settings, loading, update } = useSettings()
  const [local, setLocal] = useState(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (settings && !local) setLocal({ ...settings })
  }, [settings])

  const set = (k, v) => { setLocal(s => ({ ...s, [k]: v })); setDirty(true) }

  const save = async () => {
    await update(local)
    setDirty(false)
    toast('✓ Objectifs sauvegardés !')
  }

  const applyPreset = (p) => {
    setLocal(s => ({ ...s, goal_kcal: p.kcal, goal_proteines: p.prot, goal_glucides: p.gluc, goal_lipides: p.lip, goal_fibres: p.fib }))
    setDirty(true)
  }

  if (loading || !local) return <div className="loader"><div className="spinner" /> Chargement...</div>

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Settings size={22} color="var(--green)" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 20 }}>Paramètres</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tes objectifs nutritionnels</div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 16 }}>
        <div className="section-title">Profils rapides</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.label} className="chip" onClick={() => applyPreset(p)} style={{ fontSize: 11 }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <GoalField icon={<Flame size={18} />}    label="Calories"   value={local.goal_kcal}      unit="kcal" color="var(--coral)"  onChange={v => set('goal_kcal', v)} />
        <GoalField icon={<Dumbbell size={18} />} label="Protéines"  value={local.goal_proteines} unit="g"    color="var(--green)"  onChange={v => set('goal_proteines', v)} />
        <GoalField icon={<Wheat size={18} />}    label="Glucides"   value={local.goal_glucides}  unit="g"    color="var(--amber)"  onChange={v => set('goal_glucides', v)} />
        <GoalField icon={<Droplets size={18} />} label="Lipides"    value={local.goal_lipides}   unit="g"    color="var(--coral)"  onChange={v => set('goal_lipides', v)} />
        <GoalField icon={<Leaf size={18} />}     label="Fibres"     value={local.goal_fibres}    unit="g"    color="var(--blue)"   onChange={v => set('goal_fibres', v)} />
      </div>

      {dirty && (
        <button className="btn-primary" onClick={save}>💾 Sauvegarder les objectifs</button>
      )}

      <div className="card" style={{ padding: '14px 16px', marginTop: 16 }}>
        <div className="section-title">À propos</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Données nutritionnelles : <strong>Table Ciqual 2025</strong> (ANSES) + <strong>Open Food Facts</strong><br/>
          Base de données : <strong>Supabase</strong><br/>
          Version : 1.0.0
        </div>
      </div>
    </div>
  )
}
