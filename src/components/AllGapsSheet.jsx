import React from 'react'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// AllGapsSheet — liste complète des manques du jour, ouverte depuis le bouton
// « … » de NutrientGapsBanner. La bande du haut n'en montre qu'une poignée
// (voir la limite passée à getNutrientGaps dans ExplorerPage) pour rester sur
// une seule ligne ; cette feuille est le repli pour choisir un manque qui
// n'y tient pas, sans passer par la feuille « Filtrer » générale qui ne dit
// pas lesquels des ~28 nutriments sont réellement en retard aujourd'hui.
//
// Même geste que les pastilles de la bande : un appui bascule le filtre
// « riche en » + le tri sur ce nutriment (onPick = handlePickGap côté
// ExplorerPage) — plusieurs choix possibles avant de fermer, la feuille ne
// se referme pas toute seule au premier appui.
//
// Props :
//   gaps            — TOUS les manques du jour (pas la version plafonnée de
//                      la bande), sortie de getNutrientGaps(totals, settings, N)
//   activeClaims    — clés déjà filtrées, pour l'état actif des lignes
//   onPick(key)     — même handler que les pastilles de la bande
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────
export default function AllGapsSheet({ gaps, activeClaims, onPick, onClose }) {
  useBackButton(onClose)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Tout ce qui te manque aujourd'hui</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Du plus en retard au moins en retard. Touche un nutriment pour ne garder que les aliments qui en sont riches.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '55vh', overflowY: 'auto' }}>
          {gaps.map(({ field, pct }) => {
            const active = activeClaims.includes(field.key)
            return (
              <button
                key={field.key}
                onClick={() => onPick(field.key)}
                className="btn-ghost"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 'var(--radius-sm)',
                  background: active ? 'var(--green-light)' : 'transparent',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: active ? 'var(--green-dark)' : 'var(--text)' }}>
                  {field.label}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: active ? 'var(--green-dark)' : 'var(--text-hint)',
                }}>
                  {pct} %
                </span>
              </button>
            )
          })}
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={onClose}>
          Voir les résultats
        </button>
      </div>
    </div>
  )
}
