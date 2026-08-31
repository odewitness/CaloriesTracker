import React from 'react'
import { Bell, Users, Pill, ChevronRight } from 'lucide-react'
import { Row, ToggleSwitch, SectionScreen } from './primitives'

// Écran de détail « Notifications ». Sauvegarde immédiate.
export default function NotificationsSection({
  pushSupported, pushPermission, pushLoading, enablingPush, onEnablePush,
  reminderEnabled, socialEnabled, onToggleReminder, onToggleSocial,
  complementsSummary, onOpenComplementReminders,
  onBack,
}) {
  return (
    <SectionScreen title="Notifications" onBack={onBack}>
      <div className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        {!pushSupported ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--text-hint)' }}>
            Non disponible sur ce navigateur.
          </div>
        ) : pushPermission !== 'granted' ? (
          <div style={{ padding: '13px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Reçois un rappel si tu n'as rien noté, et sois prévenue de l'activité de tes amies. Fonctionne mieux si l'app est ajoutée à l'écran d'accueil.
            </div>
            <button className="btn-primary" onClick={onEnablePush} disabled={enablingPush || pushLoading}>
              {enablingPush ? '...' : 'Activer les notifications'}
            </button>
            {pushPermission === 'denied' && (
              <div style={{ fontSize: 12, color: 'var(--coral)', marginTop: 8 }}>
                Permission refusée — à réactiver dans les réglages du navigateur pour ce site.
              </div>
            )}
          </div>
        ) : (
          <>
            <Row icon={<Bell size={18} />} label="Rappel si rien noté">
              <ToggleSwitch checked={reminderEnabled} onClick={onToggleReminder} />
            </Row>
            <Row icon={<Users size={18} />} label="Activité sociale">
              <ToggleSwitch checked={socialEnabled} onClick={onToggleSocial} />
            </Row>
          </>
        )}
      </div>

      <button
        onClick={onOpenComplementReminders}
        className="card"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', marginBottom: 20, fontFamily: 'var(--font)', textAlign: 'left' }}
      >
        <div style={{ color: 'var(--purple, #8b5cf6)', flexShrink: 0, display: 'flex' }}><Pill size={18} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Rappels compléments</div>
          <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 1 }}>{complementsSummary}</div>
        </div>
        <ChevronRight size={16} color="var(--text-hint)" style={{ flexShrink: 0 }} />
      </button>

      <div style={{ fontSize: 12, color: 'var(--text-hint)', lineHeight: 1.5 }}>
        Les rappels pour penser à boire se règlent dans l'écran « Hydratation ».
      </div>
    </SectionScreen>
  )
}
