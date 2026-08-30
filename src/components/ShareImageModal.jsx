import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Share2, Download } from 'lucide-react'
import { useBackButton } from '../hooks/useBackButton'
import { useToast } from '../lib/toast'

// ─────────────────────────────────────────────────────────────────────────────
// ShareImageModal — génère une carte récap de la journée (calories + macros)
// en image PNG, à partager via la feuille native (Web Share) ou à enregistrer.
// 100 % client : rendu sur un <canvas>, aucune dépendance, aucune API.
//
// Monté en portal sur document.body (règle CLAUDE.md pour les modales de
// TodayPage : le slider de swipe est en transform, un position:fixed enfant s'y
// calerait).
//
// Props : date (Date), totals ({ kcal, prot, gluc, lip, fib }), goals
// ({ goal_kcal, goal_proteines, goal_glucides, goal_lipides, goal_fibres }),
// entryCount (nombre d'aliments notés), onClose.
// ─────────────────────────────────────────────────────────────────────────────

const SIZE = 1080
const GREEN = '#1D9E75'
const GREEN_DARK = '#0B6B4F'

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawCard(canvas, { dateLabel, totals, goals, entryCount }) {
  const ctx = canvas.getContext('2d')
  const F = "'DM Sans', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"

  // Fond dégradé
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE)
  grad.addColorStop(0, GREEN)
  grad.addColorStop(1, GREEN_DARK)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, SIZE)

  const PAD = 90
  ctx.textBaseline = 'alphabetic'

  // En-tête
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = `700 46px ${F}`
  ctx.fillText('NutriTrack', PAD, 132)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = `500 34px ${F}`
  ctx.fillText(dateLabel, PAD, 182)

  // Calories consommées (grand)
  const kcal = Math.round(totals.kcal || 0)
  const goalKcal = goals?.goal_kcal ? Math.round(goals.goal_kcal) : null
  ctx.fillStyle = '#fff'
  ctx.font = `700 150px ${F}`
  ctx.fillText(String(kcal), PAD, 400)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `500 40px ${F}`
  ctx.fillText(goalKcal ? `/ ${goalKcal} kcal` : 'kcal', PAD, 456)

  // Barre de progression calories
  if (goalKcal) {
    const barX = PAD, barY = 500, barW = SIZE - PAD * 2, barH = 26
    const pct = Math.max(0, Math.min(1, kcal / goalKcal))
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    roundRectPath(ctx, barX, barY, barW, barH, barH / 2)
    ctx.fill()
    if (pct > 0) {
      ctx.fillStyle = '#fff'
      roundRectPath(ctx, barX, barY, Math.max(barH, barW * pct), barH, barH / 2)
      ctx.fill()
    }
  }

  // Macros
  const rows = [
    ['Protéines', totals.prot, goals?.goal_proteines],
    ['Glucides', totals.gluc, goals?.goal_glucides],
    ['Lipides', totals.lip, goals?.goal_lipides],
    ['Fibres', totals.fib, goals?.goal_fibres],
  ]
  let y = 610
  for (const [label, valRaw, goalRaw] of rows) {
    const val = Math.round(valRaw || 0)
    const goal = goalRaw ? Math.round(goalRaw) : null
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = `600 38px ${F}`
    ctx.textAlign = 'left'
    ctx.fillText(label, PAD, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(goal ? `${val} / ${goal} g` : `${val} g`, SIZE - PAD, y)
    ctx.textAlign = 'left'

    const tX = PAD, tY = y + 20, tW = SIZE - PAD * 2, tH = 14
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    roundRectPath(ctx, tX, tY, tW, tH, tH / 2)
    ctx.fill()
    if (goal && val > 0) {
      const p = Math.max(0, Math.min(1, val / goal))
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      roundRectPath(ctx, tX, tY, Math.max(tH, tW * p), tH, tH / 2)
      ctx.fill()
    }
    y += 108
  }

  // Pied
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = `500 34px ${F}`
  ctx.textAlign = 'left'
  const n = entryCount || 0
  ctx.fillText(`${n} aliment${n > 1 ? 's' : ''} noté${n > 1 ? 's' : ''} aujourd'hui`, PAD, SIZE - 90)
}

export default function ShareImageModal({ date, totals, goals, entryCount, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const canvasRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [blob, setBlob] = useState(null)
  const [busy, setBusy] = useState(false)

  const dateLabel = capitalize(
    (date instanceof Date ? date : new Date(date)).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  )

  useEffect(() => {
    let cancelled = false
    let objectUrl = null

    const render = () => {
      const canvas = canvasRef.current
      if (!canvas || cancelled) return
      canvas.width = SIZE
      canvas.height = SIZE
      drawCard(canvas, { dateLabel, totals, goals, entryCount })
      canvas.toBlob((b) => {
        if (cancelled || !b) return
        objectUrl = URL.createObjectURL(b)
        setBlob(b)
        setUrl(objectUrl)
      }, 'image/png')
    }

    // Attendre que la police soit prête pour un rendu net (sinon fallback système).
    if (document.fonts?.ready) document.fonts.ready.then(render).catch(render)
    else render()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [dateLabel, totals, goals, entryCount])

  const fileName = `ma-journee-${(date instanceof Date ? date : new Date(date)).toISOString().slice(0, 10)}.png`

  const canShareFile =
    typeof navigator !== 'undefined' &&
    !!navigator.canShare &&
    !!navigator.share

  const handleShare = async () => {
    if (!blob) return
    const file = new File([blob], fileName, { type: 'image/png' })
    if (!navigator.canShare?.({ files: [file] })) {
      toast('Le partage direct n’est pas dispo ici — enregistre l’image')
      return
    }
    try {
      setBusy(true)
      await navigator.share({ files: [file], title: 'Ma journée', text: 'Ma journée sur NutriTrack' })
    } catch {
      /* annulé par l'utilisatrice ou non supporté — silencieux */
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Image à partager</h2>
        <button className="btn-icon" onClick={onClose} aria-label="Fermer">
          <X size={20} color="var(--text-muted)" />
        </button>
      </div>

      <div className="page-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          {url ? (
            <img
              src={url}
              alt="Aperçu de la carte de la journée"
              style={{ width: '100%', maxWidth: 360, borderRadius: 16, boxShadow: 'var(--shadow)' }}
            />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: 40 }}>Génération de l’image…</div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {canShareFile && (
            <button
              className="btn-primary"
              onClick={handleShare}
              disabled={!blob || busy}
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !blob || busy ? 0.6 : 1 }}
            >
              <Share2 size={17} /> Partager
            </button>
          )}
          <a
            href={url || undefined}
            download={fileName}
            className={canShareFile ? 'btn-ghost' : 'btn-primary'}
            style={{
              flex: 1, textAlign: 'center', display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', gap: 8, pointerEvents: url ? 'auto' : 'none', opacity: url ? 1 : 0.6,
            }}
          >
            <Download size={17} /> Enregistrer
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}
