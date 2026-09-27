import React, { useMemo } from 'react'
import { Moon, Target, Sparkles } from 'lucide-react'
import { Row, ToggleSwitch, Stepper, SectionScreen } from './primitives'
import { useSleepRange } from '../../hooks/useSleep'
import { todayStr } from '../../lib/dates'
import { suggestSleepGoal, formatDureeSommeil } from '../../lib/sleep'

// Écran de détail « Sommeil » (Profil) : carte de la page du jour, objectif
// de sommeil + suggestion personnalisée (nuits sans alarme où l'on se sent en
// forme, voir suggestSleepGoal). Sauvegarde immédiate, comme HydrationSection.
export default function SleepSection({ sommeil, onPatch, onBack }) {
  const today = todayStr()
  const from = useMemo(() => todayStr(-60), [])
  const { nights } = useSleepRange(from, today)
  const suggestion = useMemo(() => suggestSleepGoal(nights, today), [nights, today])

  const objectif = Number(sommeil?.objectif_min) || 480
  const setObjectif = (m) => onPatch({ objectif_min: Math.min(600, Math.max(300, m)) })

  return (
    <SectionScreen title="Sommeil" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <Row icon={<Moon size={18} />} label="Carte Sommeil sur la page du jour">
          <ToggleSwitch
            checked={sommeil?.card_visible !== false}
            onClick={() => onPatch({ card_visible: sommeil?.card_visible === false })}
          />
        </Row>
        <Row icon={<Target size={18} />} label="Objectif de sommeil">
          <Stepper
            value={objectif}
            display={formatDureeSommeil(objectif)}
            onDec={() => setObjectif(objectif - 15)}
            onInc={() => setObjectif(objectif + 15)}
            min={300}
            max={600}
            wide
          />
        </Row>
      </div>

      {suggestion && suggestion.minutes !== objectif && (
        <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderLeft: '3px solid var(--purple)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
            <Sparkles size={14} color="var(--purple)" /> Un objectif à ta mesure
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Les nuits où tu te réveilles sans alarme et en forme durent en moyenne{' '}
            <strong>{formatDureeSommeil(suggestion.minutes)}</strong> (sur {suggestion.n} nuits ces 2 derniers mois).
            C'est sans doute ton vrai besoin.
          </div>
          <button
            onClick={() => setObjectif(suggestion.minutes)}
            style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: 'var(--purple)', background: 'var(--purple-light)', borderRadius: 8, padding: '6px 12px' }}
          >
            Viser {formatDureeSommeil(suggestion.minutes)}
          </button>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.6, margin: '4px 4px 16px' }}>
        Une nuit est notée au jour de ton réveil : la nuit du 26 au 27 apparaît sur la page du 27.
        Les adultes ont en général besoin de 7 à 9 h. Coche « sans alarme » quand tu te réveilles
        seule : ces nuits-là permettent de connaître ton vrai besoin et ton rythme naturel.
      </div>
    </SectionScreen>
  )
}
