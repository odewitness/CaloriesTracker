import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { VITAMIN_FIELDS, MINERAL_FIELDS, SUGAR_FIELDS, FAT_FIELDS, SUCRES_ANSES_REF, KCAL_PER_G_LIPIDES, LIPIDES_AE_TARGET, AGS_AE_MAX } from '../lib/nutrients'
import { getNutrientStatus as getStatus, NUTRIENT_STATUS_COLOR as STATUS_COLOR } from '../lib/nutrientStatus'
import NutrientBreakdownModal from './NutrientBreakdownModal'

const TABS = [
  { key: 'vitamines', label: 'Vitamines' },
  { key: 'mineraux',  label: 'Minéraux' },
  { key: 'sucres',    label: 'Sucres' },
  { key: 'gras',      label: 'Acides gras' },
]

function fmtVal(val, unit) {
  if (val == null) return '—'
  return `${val < 1 && val > 0 ? val.toFixed(2) : Math.round(val * 10) / 10} ${unit}`
}

// ── Ligne "jauge" vitamines/minéraux — % du RNP, marqueur LSS/seuil ────────
// `suppTotals` (optionnel) : part de `totals` apportée par des compléments
// (meal='Compléments'). Fournie → la barre se scinde en deux segments
// alimentation / complément (violet). Absente → rendu mono-couleur inchangé.
function GaugeRow({ v, totals, suppTotals, hasEntries, onClick, highlight }) {
  const keys = v.sumKeys || [v.key]
  const val = keys.reduce((s, k) => s + (totals[k] ?? 0), 0)
  const suppVal = suppTotals ? keys.reduce((s, k) => s + (suppTotals[k] ?? 0), 0) : 0
  const foodVal = Math.max(0, val - suppVal)
  const foodShare = val > 0 ? foodVal / val : 1
  const suppShare = val > 0 ? suppVal / val : 0
  const hasData = hasEntries // N/D uniquement si aucune entrée loggée — 0 sur un aliment loggé est une vraie donnée

  const pct = Math.round((val / v.ref) * 100)
  const barPct = Math.min(100, pct)

  const lssMarkerPct = v.lss !== null
    ? Math.min(100, (v.lss / v.ref) * 100)
    : null

  const status = hasData ? getStatus(val, v.ref, v.lss, v.limite) : 'low'
  const badgeColor = STATUS_COLOR[status]

  const refLabel = v.limite ? 'Objectif max' : 'RNP'
  const lssLabel = v.limite ? 'Seuil' : 'LSS'
  const tooltip = hasData
    ? `${val.toFixed(val < 1 ? 3 : 1)} ${v.unit} / ${refLabel} ${v.ref} ${v.unit}${v.lss ? ` / ${lssLabel} ${v.lss} ${v.unit}` : ''}${suppVal > 1e-6 ? ` · dont ${suppVal.toFixed(suppVal < 1 ? 3 : 1)} ${v.unit} de compléments` : ''}`
    : 'Données non disponibles'

  const Wrapper = onClick ? 'button' : 'div'

  return (
    <Wrapper
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, width: '100%', textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}
      title={tooltip}
    >
      <span style={{ fontSize: 12, color: 'var(--text)', width: 90, flexShrink: 0, fontWeight: highlight ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
        {highlight && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--purple)', flexShrink: 0 }} title="Intéressant dans ta phase actuelle" />}
        {v.label}
      </span>

      <div style={{ flex: 1, position: 'relative', height: 6 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            display: 'flex',
            width: hasData ? `${barPct}%` : '0%',
            height: '100%',
            transition: 'width .4s',
          }}>
            <div style={{ width: `${foodShare * 100}%`, height: '100%', background: STATUS_COLOR[status] }} />
            {suppShare > 0 && (
              <div style={{ width: `${suppShare * 100}%`, height: '100%', background: 'var(--purple)' }} />
            )}
          </div>
        </div>

        {lssMarkerPct !== null && lssMarkerPct < 100 && (
          <div style={{
            position: 'absolute',
            top: -1,
            bottom: -1,
            left: `${lssMarkerPct}%`,
            width: 2,
            background: 'var(--coral)',
            borderRadius: 1,
            opacity: 0.55,
            transform: 'translateX(-50%)',
          }} />
        )}
      </div>

      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: hasData ? badgeColor : 'var(--text-hint)',
        width: 38,
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {hasData ? `${status === 'excess' ? '⚠︎ ' : ''}${pct}%` : 'N/D'}
      </span>
    </Wrapper>
  )
}

// ── Bandeau « d'où viennent tes vitamines & minéraux » ────────────────────
// Résumé global alimentation vs compléments, chaque nutriment pondéré par son
// RNP (mise à l'échelle sans unité). Ne s'affiche que si des compléments ont
// réellement apporté des vitamines/minéraux sur la période.
function SourceSplitStrip({ totals, suppTotals }) {
  if (!suppTotals) return null
  let sumFood = 0, sumSupp = 0
  const contributors = []
  for (const v of [...VITAMIN_FIELDS, ...MINERAL_FIELDS]) {
    const keys = v.sumKeys || [v.key]
    const tot = keys.reduce((s, k) => s + (totals[k] ?? 0), 0)
    const sup = keys.reduce((s, k) => s + (suppTotals[k] ?? 0), 0)
    if (sup <= 1e-6 || !v.ref) continue
    sumFood += Math.max(0, tot - sup) / v.ref
    sumSupp += sup / v.ref
    contributors.push({ label: v.label, w: sup / v.ref })
  }
  if (sumSupp <= 0) return null

  const suppPct = Math.round((sumSupp / (sumFood + sumSupp)) * 100)
  const names = contributors.sort((a, b) => b.w - a.w).map(c => c.label)
  const shown = names.slice(0, 6).join(', ') + (names.length > 6 ? '…' : '')

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--gray-bg)' }}>
      <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6, lineHeight: 1.45 }}>
        ≈ <strong style={{ color: 'var(--purple)' }}>{suppPct}&nbsp;%</strong> de tes vitamines &amp; minéraux viennent de compléments sur cette période
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${100 - suppPct}%`, background: '#1D9E75' }} />
        <div style={{ width: `${suppPct}%`, background: 'var(--purple)' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-hint)', lineHeight: 1.4 }}>
        Compléments : {shown} · pondéré par le RNP de chaque nutriment
      </div>
    </div>
  )
}

// ── Liste simple valeur/objectif — sucres & acides gras détaillés ─────────
function NutrientList({ fields, totals, hasEntries, entries, onSelectField }) {
  const canBreakdown = entries && entries.length > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {fields.map(f => {
        const val = hasEntries ? (totals[f.key] ?? 0) : null
        const Wrapper = canBreakdown ? 'button' : 'div'
        return (
          <Wrapper
            key={f.key}
            onClick={canBreakdown ? () => onSelectField(f) : undefined}
            style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, width: '100%', textAlign: 'left', cursor: canBreakdown ? 'pointer' : 'default' }}
          >
            <span style={{ color: 'var(--text)' }}>{f.label}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{hasEntries ? fmtVal(val, f.unit) : 'N/D'}</span>
          </Wrapper>
        )
      })}
    </div>
  )
}

function SucresAnsesGauge({ totals, hasEntries }) {
  const sucresTotal = totals.sucres ?? 0
  const lactose = totals.lactose ?? 0
  const galactose = totals.galactose ?? 0
  const pertinent = Math.max(0, sucresTotal - lactose - galactose)
  const pct = Math.round((pertinent / SUCRES_ANSES_REF) * 100)
  const barPct = hasEntries ? Math.min(100, pct) : 0
  const excess = hasEntries && pertinent >= SUCRES_ANSES_REF
  const color = excess ? 'var(--coral)' : pct >= 80 ? 'var(--amber)' : '#1D9E75'

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--gray-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Sucres (recommandation Anses)</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: hasEntries ? color : 'var(--text-hint)' }}>
          {hasEntries ? `${excess ? '⚠︎ ' : ''}${pertinent.toFixed(1)} / ${SUCRES_ANSES_REF} g` : 'N/D'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Sucres totaux hors lactose et galactose · max recommandé 100 g/j
      </div>
    </div>
  )
}

function GaugeBar({ barPct, color, bandMarkers }) {
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--gray-bg)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s' }} />
      {bandMarkers && bandMarkers.map((pct, i) => (
        <div key={i} style={{
          position: 'absolute', top: -1, bottom: -1, left: `${pct}%`, width: 2,
          background: 'var(--text-muted)', opacity: 0.5, transform: 'translateX(-50%)',
        }} />
      ))}
    </div>
  )
}

// Lipides totaux : l'Anses recommande une zone cible de 35-40% de l'apport
// énergétique (AE) du jour, pas un simple plafond — en dessous = sous-couverture
// des besoins, au-dessus = excès. On affiche donc une bande cible plutôt qu'un seuil.
function LipidesTotauxGauge({ totals, hasEntries }) {
  const hasKcal = hasEntries && totals.kcal > 0
  const aePct = hasKcal ? (totals.lip * KCAL_PER_G_LIPIDES / totals.kcal) * 100 : 0
  const { min, max } = LIPIDES_AE_TARGET
  const SCALE = 50 // échelle visuelle du graphique (0-50% AE)
  const barPct = hasKcal ? Math.min(100, (aePct / SCALE) * 100) : 0
  const bandMarkers = [(min / SCALE) * 100, (max / SCALE) * 100]

  const inRange = aePct >= min && aePct <= max
  const color = !hasKcal ? 'var(--text-hint)' : inRange ? '#1D9E75' : aePct > max ? 'var(--coral)' : 'var(--amber)'
  const note = !hasKcal ? '' : inRange ? '' : aePct > max ? ' (au-dessus de la cible)' : ' (en dessous de la cible)'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Lipides totaux</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {hasKcal ? `${aePct.toFixed(1)}% AE${note}` : 'N/D'}
        </span>
      </div>
      <GaugeBar barPct={barPct} color={color} bandMarkers={bandMarkers} />
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Cible Anses : {min}-{max}% de l'apport énergétique du jour
      </div>
    </div>
  )
}

// AG saturés totaux : seuil maximal (≤12% AE), pas une zone cible.
function AGSGauge({ totals, hasEntries }) {
  const hasKcal = hasEntries && totals.kcal > 0
  const ags = totals.acides_gras_satures ?? 0
  const aePct = hasKcal ? (ags * KCAL_PER_G_LIPIDES / totals.kcal) * 100 : 0
  const SCALE = AGS_AE_MAX * 1.5
  const barPct = hasKcal ? Math.min(100, (aePct / SCALE) * 100) : 0
  const excess = hasKcal && aePct >= AGS_AE_MAX
  const color = !hasKcal ? 'var(--text-hint)' : excess ? 'var(--coral)' : aePct >= AGS_AE_MAX * 0.8 ? 'var(--amber)' : '#1D9E75'

  return (
    <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--gray-bg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>AG saturés totaux</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>
          {hasKcal ? `${excess ? '⚠︎ ' : ''}${aePct.toFixed(1)}% AE` : 'N/D'}
        </span>
      </div>
      <GaugeBar barPct={barPct} color={color} bandMarkers={[(AGS_AE_MAX / SCALE) * 100]} />
      <div style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>
        Max recommandé Anses : {AGS_AE_MAX}% de l'apport énergétique du jour
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// NutrientPanel — fusion de l'ancien "Vitamines & Minéraux" et "Détail
// sucres & acides gras" en une seule carte à 4 pills, pour économiser une
// carte entière sur la page du jour (et partout où les deux s'affichaient
// déjà côte à côte : historique, fiches aliment/recette).
// ─────────────────────────────────────────────────────────────────────────
export default function NutrientPanel({ totals, suppTotals, hasEntries, defaultOpen = false, entries, onUpdate, highlightKeys = [] }) {
  const [open, setOpen] = useState(defaultOpen)
  const [tab, setTab] = useState('vitamines')
  const [selectedField, setSelectedField] = useState(null)
  const hl = new Set(highlightKeys)
  const isHl = (v) => hl.has(v.key) || (v.sumKeys || []).some(k => hl.has(k))

  // La liste détaillée par aliment n'a de sens que si on dispose des entrées
  // individuelles (ex: page d'accueil) — pas dans les contextes où le panneau
  // affiche déjà un seul aliment (FoodDetailModal) ou un /100g de recette.
  const canBreakdown = entries && entries.length > 0
  const isGauge = tab === 'vitamines' || tab === 'mineraux'

  return (
    <div className="card" style={{ marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>Détail nutritionnel</span>
        <ChevronDown size={18} color="var(--text-muted)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="chip"
                style={{
                  background: tab === t.key ? 'var(--green)' : 'var(--green-light)',
                  color: tab === t.key ? 'white' : 'var(--green-dark)',
                  // Réduits par rapport au chip par défaut : à 4 dans la
                  // largeur d'une carte, "Acides gras" fait déborder sur deux
                  // lignes sur un écran de téléphone étroit sinon.
                  padding: '4px 8px',
                  fontSize: 11,
                  flex: '1 1 0',
                  textAlign: 'center',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isGauge && <SourceSplitStrip totals={totals} suppTotals={suppTotals} />}

          {tab === 'vitamines' && VITAMIN_FIELDS.map(v => (
            <GaugeRow key={v.key} v={v} totals={totals} suppTotals={suppTotals} hasEntries={hasEntries} highlight={isHl(v)} onClick={canBreakdown ? () => setSelectedField(v) : undefined} />
          ))}
          {tab === 'mineraux' && MINERAL_FIELDS.map(v => (
            <GaugeRow key={v.key} v={v} totals={totals} suppTotals={suppTotals} hasEntries={hasEntries} highlight={isHl(v)} onClick={canBreakdown ? () => setSelectedField(v) : undefined} />
          ))}

          {tab === 'sucres' && (
            <>
              <SucresAnsesGauge totals={totals} hasEntries={hasEntries} />
              <NutrientList fields={SUGAR_FIELDS} totals={totals} hasEntries={hasEntries} entries={entries} onSelectField={setSelectedField} />
            </>
          )}

          {tab === 'gras' && (
            <>
              <LipidesTotauxGauge totals={totals} hasEntries={hasEntries} />
              <AGSGauge totals={totals} hasEntries={hasEntries} />
              <NutrientList fields={FAT_FIELDS} totals={totals} hasEntries={hasEntries} entries={entries} onSelectField={setSelectedField} />
            </>
          )}

          {isGauge && (
            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 2, height: 10, background: 'var(--coral)', borderRadius: 1, opacity: 0.55 }} />
                <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>LSS / Seuil</span>
              </div>
              {suppTotals && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 6, background: 'var(--purple)', borderRadius: 2 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>apporté par un complément</span>
                </div>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-hint)' }}>
                <span style={{ color: '#1D9E75', fontWeight: 600 }}>vert</span> = bien &nbsp;·&nbsp;
                <span style={{ color: 'var(--amber)', fontWeight: 600 }}>orange</span> = à surveiller &nbsp;·&nbsp;
                <span style={{ color: 'var(--coral)', fontWeight: 600 }}>rouge</span> = trop bas ou trop haut
              </span>
            </div>
          )}
        </div>
      )}

      {selectedField && (
        <NutrientBreakdownModal
          field={selectedField}
          entries={entries}
          onUpdate={onUpdate}
          onClose={() => setSelectedField(null)}
        />
      )}
    </div>
  )
}
