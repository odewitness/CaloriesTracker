import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronRight, Check, Pencil, UtensilsCrossed, CalendarPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { MEALS_ORDER as MEALS } from '../lib/nutrients'
import AddFoodModal from './AddFoodModal'
import PlanMealModal from './PlanMealModal'
import EditMealTemplatePage from './EditMealTemplatePage'
import { useBackButton } from '../hooks/useBackButton'
import { saveMealTemplate, deleteMealTemplate } from '../hooks/useMealTemplates'

// ─────────────────────────────────────────────────────────────────────────────
// Ce fichier est l'ex-MealsPage.jsx, extrait pour vivre comme 3e onglet de
// "Mes aliments" (ManualPage) plutôt que comme page indépendante. Toute la
// logique (chargement, sauvegarde, import depuis le journal, ajout au
// journal) est inchangée — seul l'habillage "page complète" a été retiré :
// plus de <div className="page-content"> ni de titre "Mes repas types" en
// double (ManualPage fournit déjà son propre header + le switch d'onglets).
// ─────────────────────────────────────────────────────────────────────────────

function MealTemplateCard({ repas, onDelete, onEdit, onAddToJournal, onPlan }) {
  const [open, setOpen] = useState(false)
  const items = repas.items || []
  const totalKcal = items.reduce((s, i) => s + (i.energie_kcal || 0), 0)
  const totalProt = items.reduce((s, i) => s + (i.proteines || 0), 0)
  const totalGluc = items.reduce((s, i) => s + (i.glucides || 0), 0)
  const totalLip  = items.reduce((s, i) => s + (i.lipides || 0), 0)

  return (
    <div className="card" style={{ marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', gap: 10 }}>
        <button onClick={() => setOpen(o => !o)} style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{repas.nom}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {items.length} aliment{items.length > 1 ? 's' : ''} · {Math.round(totalKcal)} kcal
            &nbsp;·&nbsp;<span className="c-prot">P {Math.round(totalProt)}g</span>
            &nbsp;<span className="c-gluc">G {Math.round(totalGluc)}g</span>
            &nbsp;<span className="c-lip">L {Math.round(totalLip)}g</span>
          </div>
          {repas.description && <div style={{ fontSize: 12, color: 'var(--text-hint)', marginTop: 2 }}>{repas.description}</div>}
        </button>
        <button className="btn-icon" onClick={() => onPlan(repas)} style={{ color: 'var(--purple, #8b5cf6)' }} aria-label="Planifier" title="Planifier"><CalendarPlus size={16} /></button>
        <button className="btn-icon" onClick={() => onEdit(repas)} style={{ color: 'var(--text-hint)' }}><Pencil size={16} /></button>
        <button className="btn-icon" onClick={() => onDelete(repas.id)} style={{ color: 'var(--text-hint)' }}><Trash2 size={16} /></button>
        <ChevronRight size={16} color="var(--text-hint)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: '0.5px solid var(--border)', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.food_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.qty_g}g</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(item.energie_kcal || 0)} kcal</span>
            </div>
          ))}
          <div style={{ padding: '12px 14px' }}>
            <button
              onClick={() => onAddToJournal(repas)}
              style={{ width: '100%', background: 'var(--green)', color: 'white', borderRadius: 9, padding: '11px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Check size={15} /> Ajouter au journal
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


function AddToJournalSheet({ repas, journalDate, onDateChange, journalMeal, onMealChange, onConfirm, onClose }) {
  useBackButton(onClose)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Ajouter au journal</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Pour quel jour et quel repas « {repas.nom} » ?
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Jour</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <button
            onClick={() => onDateChange(yesterdayStr)}
            className="chip"
            style={journalDate === yesterdayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Hier
          </button>
          <button
            onClick={() => onDateChange(todayStr)}
            className="chip"
            style={journalDate === todayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => onDateChange(tomorrowStr)}
            className="chip"
            style={journalDate === tomorrowStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Demain
          </button>
        </div>
        <input
          type="date"
          className="input"
          value={journalDate}
          onChange={e => onDateChange(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Repas</div>
        <select className="input" value={journalMeal} onChange={e => onMealChange(e.target.value)} style={{ marginBottom: 16 }}>
          {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <button className="btn-primary" onClick={onConfirm}>Ajouter</button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MealTemplatesSection — contenu de l'onglet "Repas types" dans ManualPage.
// Pas de <div className="page-content"> ni de gros titre : ManualPage
// fournit déjà le header + le switch d'onglets au-dessus.
// ─────────────────────────────────────────────────────────────────────────────
export default function MealTemplatesSection() {
  const toast = useToast()
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null) // null = fermé, {} = nouveau, repas = édition
  const [addToJournalTarget, setAddToJournalTarget] = useState(null)
  const [planTarget, setPlanTarget] = useState(null) // repas type en cours de planification
  const [journalDate, setJournalDate] = useState(new Date().toISOString().slice(0, 10))
  const [journalMeal, setJournalMeal] = useState('Déjeuner')

  useEffect(() => { load() }, [user])

  const load = async () => {
    if (!user) { setRepasList([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('repas_types').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRepasList(data || [])
    setLoading(false)
  }

  const handleSave = async ({ nom, description, items, nb_portions }) => {
    const { error } = await saveMealTemplate({ userId: user.id, repasTypeId: editTarget?.id, nom, description, items, nbPortions: nb_portions })
    if (!error) { toast(editTarget?.id ? '✓ Repas modifié !' : '✓ Repas créé !'); load() }
    else toast('Erreur')
    setEditTarget(null)
  }

  const handleDelete = async (id) => {
    const { error } = await deleteMealTemplate(id, user.id)
    if (!error) { setRepasList(r => r.filter(x => x.id !== id)); toast('Supprimé') }
    else toast('Erreur')
  }

  const handleAddToJournal = async (repas) => {
    setJournalDate(new Date().toISOString().slice(0, 10))
    setAddToJournalTarget(repas)
  }

  const confirmAddToJournal = async () => {
    if (!addToJournalTarget) return
    const rows = addToJournalTarget.items.map(item => ({ ...item, date: journalDate, meal: journalMeal, user_id: user.id }))
    const { error } = await supabase.from('journal').insert(rows)
    if (!error) toast(`✓ ${addToJournalTarget.nom} ajouté au journal !`)
    else toast('Erreur')
    setAddToJournalTarget(null)
  }

  return (
    <>
      {/* ── Bouton "Nouveau" local à l'onglet (contrairement à Aliments/Recettes,
           créer un repas type ouvre un formulaire multi-étapes dédié, pas le
           menu déroulant global) ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => setEditTarget({})}
          style={{ background: 'var(--green)', color: 'white', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Plus size={15} /> Nouveau repas type
        </button>
      </div>

      {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

      {!loading && repasList.length === 0 && (
        <div className="empty">
          <UtensilsCrossed size={40} />
          <div style={{ marginTop: 8, fontWeight: 600 }}>Aucun repas type</div>
          <div style={{ marginTop: 4 }}>Crée des groupes d'aliments pour les réutiliser facilement</div>
        </div>
      )}

      {repasList.map(r => (
        <MealTemplateCard
          key={r.id}
          repas={r}
          onDelete={handleDelete}
          onEdit={setEditTarget}
          onAddToJournal={handleAddToJournal}
          onPlan={setPlanTarget}
        />
      ))}

      {editTarget !== null && (
        <EditMealTemplatePage repas={editTarget?.id ? editTarget : null} onSave={handleSave} onClose={() => setEditTarget(null)} />
      )}

      {addToJournalTarget && (
        <AddToJournalSheet
          repas={addToJournalTarget}
          journalDate={journalDate}
          onDateChange={setJournalDate}
          journalMeal={journalMeal}
          onMealChange={setJournalMeal}
          onConfirm={confirmAddToJournal}
          onClose={() => setAddToJournalTarget(null)}
        />
      )}

      {planTarget && (
        <PlanMealModal
          presetSource={{ nom: planTarget.nom, items: planTarget.items || [], sourceType: 'repas_type', sourceId: planTarget.id }}
          onClose={() => setPlanTarget(null)}
          onPlanned={() => setPlanTarget(null)}
        />
      )}
    </>
  )
}
