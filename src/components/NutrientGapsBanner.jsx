import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// NutrientGapsBanner — en-tête de l'explorateur : les nutriments les plus en
// retard sur la journée en cours, cliquables pour filtrer directement la liste.
//
// C'est ce qui différencie l'explorateur d'un simple navigateur de base de
// données : au lieu de partir d'une liste vide à régler soi-même, on part de
// ce qui manque réellement aujourd'hui. Les données viennent de computeTotals()
// (déjà calculé pour la page Aujourd'hui) et des RNP de VITAMIN_FIELDS /
// MINERAL_FIELDS — rien de nouveau à saisir.
//
// Props :
//   gaps              — sortie de getNutrientGaps() : [{ field, pct }]
//   hasEntries        — false si rien n'est encore noté aujourd'hui
//   remainingKcal     — calories restantes sur l'objectif du jour (null si pas d'objectif)
//   activeClaims      — clés de nutriments déjà filtrées (pour l'état actif des pastilles)
//   onPickGap(key)    — bascule le filtre « riche en <nutriment> » + le tri dessus
//   fitsRemainingKcal / onToggleFits — filtre « tient dans mes calories restantes »
// ─────────────────────────────────────────────────────────────────────────────
export default function NutrientGapsBanner({
  gaps, hasEntries, remainingKcal, activeClaims, onPickGap, fitsRemainingKcal, onToggleFits,
}) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
        Ce qui te manque aujourd'hui
      </div>

      {!hasEntries ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Tu n'as encore rien noté aujourd'hui — explore librement, ou reviens ici
          après ton premier repas pour voir ce qu'il te reste à combler.
        </div>
      ) : gaps.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--green-dark)' }}>
          Tous tes apports sont au niveau. Rien à combler pour l'instant 👏
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {gaps.map(({ field, pct }) => {
              const active = activeClaims.includes(field.key)
              return (
                <button
                  key={field.key}
                  className="chip"
                  onClick={() => onPickGap(field.key)}
                  style={active ? { background: 'var(--green)', color: 'var(--white)' } : undefined}
                >
                  {field.label} <span style={{ opacity: 0.75, fontWeight: 500 }}>{pct} %</span>
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>
            Touche un nutriment pour ne voir que les aliments qui en sont riches.
          </div>
        </>
      )}

      {remainingKcal != null && remainingKcal > 0 && (
        <button
          className="chip"
          onClick={onToggleFits}
          style={{
            marginTop: 10,
            background: fitsRemainingKcal ? 'var(--green)' : 'var(--gray-bg)',
            color:      fitsRemainingKcal ? 'var(--white)' : 'var(--text-muted)',
          }}
        >
          {fitsRemainingKcal ? '✓ ' : ''}Tient dans mes {Math.round(remainingKcal)} kcal restantes
        </button>
      )}
    </div>
  )
}
