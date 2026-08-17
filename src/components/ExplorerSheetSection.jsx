import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ExplorerSheetSection — un bloc titré des feuilles « Trier » et « Filtrer »,
// repliable au besoin.
//
// Pourquoi replier : les vitamines (12), les minéraux (11) et les catégories
// (12) représentent à eux seuls une trentaine de pastilles, soit plusieurs
// écrans de défilement AVANT d'atteindre les réglages les plus utilisés
// (macros, cuisson, sens du tri). Repliés, tout tient dans une feuille qu'on
// lit d'un coup d'œil, et chaque groupe reste à un seul appui.
//
// Deux garde-fous pour qu'un groupe replié ne cache jamais un réglage actif :
//   - `count` affiche le nombre de réglages actifs du groupe sur son en-tête ;
//   - `defaultOpen` permet à l'appelant d'ouvrir d'office le groupe qui
//     contient le réglage courant.
//
// Props :
//   title        — intitulé du bloc
//   count        — nombre de réglages actifs dans ce bloc (0 = pas de pastille)
//   collapsible  — false : bloc toujours ouvert, sans chevron
//   defaultOpen  — état d'ouverture initial d'un bloc repliable
// ─────────────────────────────────────────────────────────────────────────────

const CAPTION = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '.5px',
}

export default function ExplorerSheetSection({ title, count = 0, collapsible = false, defaultOpen = false, children }) {
  const [open, setOpen] = useState(!collapsible || defaultOpen)

  return (
    <div style={{ marginBottom: 14 }}>
      {collapsible ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            textAlign: 'left', padding: '2px 0', marginBottom: open ? 6 : 0,
            ...CAPTION,
          }}
        >
          <span style={{ display: 'flex', color: 'var(--text-hint)' }}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>{title}</span>
          {count > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9,
              background: 'var(--green)', color: 'var(--white)', fontSize: 10, fontWeight: 700,
            }}>
              {count}
            </span>
          )}
        </button>
      ) : (
        <div style={{ ...CAPTION, marginBottom: 8 }}>{title}</div>
      )}

      {open && children}
    </div>
  )
}
