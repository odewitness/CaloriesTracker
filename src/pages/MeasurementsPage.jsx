import React, { useState, useEffect, useRef } from 'react'
import { Scale, Ruler, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useMeasurements } from '../hooks/useMeasurements'
import { useCycle } from '../hooks/useCycle'
import { useSettings } from '../hooks/useSettings'
import { useToast } from '../lib/toast'
import { todayStr } from '../lib/dates'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import MetricChart from '../components/MetricChart'

const MEASURE_FIELDS = [
  { key: 'poitrine_cm',      label: 'Poitrine',      color: 'var(--blue)' },
  { key: 'taille_cm',        label: 'Taille',        color: 'var(--amber)' },
  { key: 'hanches_cm',       label: 'Hanches',       color: 'var(--coral)' },
  { key: 'cuisse_droite_cm', label: 'Cuisse droite', color: 'var(--green)' },
  { key: 'cuisse_gauche_cm', label: 'Cuisse gauche', color: 'var(--blue)' },
  { key: 'bras_droit_cm',    label: 'Bras droit',    color: 'var(--amber)' },
  { key: 'bras_gauche_cm',   label: 'Bras gauche',   color: 'var(--coral)' },
]

// Un seul graphique à la fois (jamais poids + mensurations mélangés) — cette
// liste alimente le sélecteur de métrique au-dessus du graphique.
const METRICS = [
  { key: 'poids_kg', label: 'Poids', unit: 'kg', color: 'var(--green)' },
  ...MEASURE_FIELDS.map(f => ({ ...f, unit: 'cm' })),
]

function emptyForm(date) {
  const f = { date, poids_kg: '' }
  for (const { key } of MEASURE_FIELDS) f[key] = ''
  return f
}

function MeasureInput({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, color: 'var(--text-hint)' }}>{label}</label>
      <input
        type="number"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="—"
        style={{
          width: '100%', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8,
          padding: '7px 4px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
          color: 'var(--text)', background: 'var(--gray-bg)', outline: 'none',
        }}
      />
    </div>
  )
}

function HistoryCard({ entry, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const d = new Date(entry.date + 'T12:00:00')
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const filledMeasures = MEASURE_FIELDS.filter(f => entry[f.key] != null)

  return (
    <div className="card" style={{ padding: '13px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{label}</div>
          {entry.poids_kg != null && (
            <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{entry.poids_kg} kg</div>
          )}
        </div>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setMenuOpen(o => !o)} className="btn-icon" style={{ color: 'var(--text-hint)' }}>
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setMenuOpen(false)} />
              <div className="card" style={{ position: 'absolute', top: 30, right: 0, zIndex: 10, padding: 4, minWidth: 140 }}>
                <button
                  onClick={() => { setMenuOpen(false); onEdit(entry) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Pencil size={14} /> Modifier
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(entry.id) }}
                  style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--coral)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {filledMeasures.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {filledMeasures.map(f => (
            <span key={f.key} style={{ background: 'var(--gray-bg)', color: 'var(--text-muted)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
              {f.label} {entry[f.key]} cm
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MeasurementsPage() {
  const toast = useToast()
  const { entries, loading, save, deleteEntry } = useMeasurements()
  const { days: cycleDays } = useCycle()
  const { settings } = useSettings()
  const [form, setForm] = useState(() => emptyForm(todayStr()))
  const [saving, setSaving] = useState(false)
  const formTopRef = useRef(null)
  const [selectedMetric, setSelectedMetric] = useState('poids_kg')

  // Si la métrique affichée n'a aucune donnée (ex. seulement des mensurations
  // ont été loggées, jamais le poids), on bascule automatiquement sur la
  // première métrique qui en a — évite un graphique vide au premier chargement.
  useEffect(() => {
    if (entries.length === 0) return
    if (entries.some(e => e[selectedMetric] != null)) return
    const firstWithData = METRICS.find(m => entries.some(e => e[m.key] != null))
    if (firstWithData) setSelectedMetric(firstWithData.key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  // Précharge le relevé existant quand la date sélectionnée en a un déjà
  useEffect(() => {
    const existing = entries.find(e => e.date === form.date)
    if (existing) {
      const next = { date: form.date, poids_kg: existing.poids_kg ?? '' }
      for (const { key } of MEASURE_FIELDS) next[key] = existing[key] ?? ''
      setForm(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.date, entries.length])

  const setField = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    const payload = { date: form.date, poids_kg: form.poids_kg !== '' ? parseFloat(form.poids_kg) : null }
    for (const { key } of MEASURE_FIELDS) payload[key] = form[key] !== '' ? parseFloat(form[key]) : null
    const { error } = await save(payload)
    setSaving(false)
    if (!error) toast('✓ Relevé enregistré !')
    else toast('Erreur lors de la sauvegarde')
  }

  const handleEdit = (entry) => {
    setForm(emptyForm(entry.date))
    formTopRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    const { error } = await deleteEntry(id)
    if (!error) toast('Supprimé')
  }

  if (loading) return <Loader />

  return (
    <div className="page-content" ref={formTopRef}>
      <div className="section-title">Nouveau relevé</div>
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <input
            type="date"
            max={todayStr()}
            value={form.date}
            onChange={e => setField('date', e.target.value)}
            className="input-sm"
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Scale size={18} color="var(--green)" />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Poids</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={form.poids_kg}
              onChange={e => setField('poids_kg', e.target.value)}
              placeholder="—"
              style={{ width: 72, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 6px', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--green)', background: 'var(--gray-bg)', outline: 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kg</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Ruler size={16} color="var(--text-muted)" />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Mensurations (facultatif)</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
          {MEASURE_FIELDS.map(f => (
            <MeasureInput key={f.key} label={f.label} value={form[f.key]} onChange={v => setField(f.key, v)} />
          ))}
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Enregistrement...' : '💾 Enregistrer le relevé'}
        </button>
      </div>

      <div className="section-title">Évolution</div>
      {entries.length === 0 ? (
        <div className="card" style={{ padding: '18px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-hint)', marginBottom: 16 }}>
          Ajoute ton premier relevé ci-dessus pour voir apparaître tes courbes ici.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 12 }}>
            {METRICS.map(m => {
              const hasData = entries.some(e => e[m.key] != null)
              const active = selectedMetric === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => hasData && setSelectedMetric(m.key)}
                  className="chip"
                  style={{
                    flexShrink: 0,
                    background: active ? 'var(--green)' : 'var(--green-light)',
                    color: active ? 'white' : 'var(--green-dark)',
                    opacity: hasData ? 1 : 0.4,
                    cursor: hasData ? 'pointer' : 'default',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          {(() => {
            const m = METRICS.find(x => x.key === selectedMetric)
            return (
              <MetricChart
                entries={entries} fieldKey={m.key} label={m.label} unit={m.unit} color={m.color}
                showCyclePhases={m.key === 'poids_kg'}
                cycleDays={cycleDays}
                cycleSettings={settings.cycle}
              />
            )
          })()}
        </>
      )}

      <div className="section-title">Historique</div>
      {entries.length === 0
        ? <EmptyState icon={<Scale size={40} />} title="Aucun relevé pour l'instant" description="Ajoute ton premier relevé ci-dessus pour commencer le suivi" />
        : entries.map(e => <HistoryCard key={e.id} entry={e} onEdit={handleEdit} onDelete={handleDelete} />)
      }
    </div>
  )
}
