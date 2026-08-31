import React, { useState, useEffect, useCallback } from 'react'
import { Bell, Pill, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/AuthContext'
import { COMPLEMENT_CATEGORY } from '../../lib/foodCategories'
import { describeReminder } from '../../lib/complementReminders'
import { SectionScreen, ToggleSwitch } from './primitives'
import ComplementReminderEditor from '../ComplementReminderEditor'
import Loader from '../Loader'

// Écran « Rappels compléments » (Profil › Notifications › Rappels compléments).
// Interrupteur maître + une carte dépliable par complément, sauvegarde immédiate.
export default function ComplementRemindersSection({ enabled, onToggleEnabled, pushGranted, onBack }) {
  const { user } = useAuth()
  const [aliments, setAliments] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) { setAliments([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('aliments_custom')
      .select('id, nom, marque, rappel')
      .eq('user_id', user.id)
      .eq('categorie', COMPLEMENT_CATEGORY)
      .order('nom', { ascending: true })
    setAliments(data || [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  const saveRappel = async (id, rappel) => {
    setAliments(list => list.map(a => (a.id === id ? { ...a, rappel } : a)))
    await supabase.from('aliments_custom').update({ rappel }).eq('id', id).eq('user_id', user.id)
  }

  return (
    <SectionScreen title="Rappels compléments" onBack={onBack}>
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '13px 16px', gap: 12 }}>
          <div style={{ color: 'var(--purple, #8b5cf6)', flexShrink: 0 }}><Bell size={18} /></div>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Recevoir les rappels de compléments</div>
          <ToggleSwitch checked={enabled} onClick={onToggleEnabled} />
        </div>
        {enabled && !pushGranted && (
          <div style={{ padding: '0 16px 13px', fontSize: 12, color: 'var(--coral)', lineHeight: 1.5 }}>
            Active d'abord les notifications dans l'écran « Notifications » pour recevoir ces rappels.
          </div>
        )}
      </div>

      {loading ? (
        <Loader />
      ) : aliments.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-hint)', lineHeight: 1.5, padding: '4px 2px' }}>
          Aucun complément pour l'instant. Ajoute-en un dans « Mes aliments » (catégorie
          « Compléments alimentaires ») pour lui programmer un rappel.
        </div>
      ) : (
        aliments.map(a => {
          const open = openId === a.id
          const on = !!a.rappel?.enabled
          return (
            <div key={a.id} className="card" style={{ marginBottom: 8, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(open ? null : a.id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left', background: 'none' }}
              >
                <Pill size={15} color={on ? 'var(--purple, #8b5cf6)' : 'var(--text-hint)'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</div>
                  <div style={{ fontSize: 11.5, color: on ? 'var(--text-muted)' : 'var(--text-hint)', marginTop: 1 }}>
                    {describeReminder(a.rappel)}
                  </div>
                </div>
                <ChevronDown size={16} color="var(--text-hint)" style={{ flexShrink: 0, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
              </button>
              {open && (
                <div style={{ padding: '4px 14px 16px' }}>
                  <ComplementReminderEditor
                    value={a.rappel}
                    onChange={(next) => saveRappel(a.id, next)}
                    pushGranted={pushGranted}
                  />
                </div>
              )}
            </div>
          )
        })
      )}
    </SectionScreen>
  )
}
