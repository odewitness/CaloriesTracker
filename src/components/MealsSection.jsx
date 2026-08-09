import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronRight, Check, X, Pencil, UtensilsCrossed, CalendarDays, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS, MEALS_ORDER as MEALS } from '../lib/nutrients'
import AddFoodModal from './AddFoodModal'
import { useJournal } from '../hooks/useJournal'
import { useBackButton } from '../hooks/useBackButton'

// ─────────────────────────────────────────────────────────────────────────────
// Ce fichier est l'ex-MealsPage.jsx, extrait pour vivre comme 3e onglet de
// "Mes aliments" (ManualPage) plutôt que comme page indépendante. Toute la
// logique (chargement, sauvegarde, import depuis le journal, ajout au
// journal) est inchangée — seul l'habillage "page complète" a été retiré :
// plus de <div className="page-content"> ni de titre "Mes repas types" en
// double (ManualPage fournit déjà son propre header + le switch d'onglets).
// ─────────────────────────────────────────────────────────────────────────────

function RepasCard({ repas, onDelete, onEdit, onAddToJournal }) {
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

// ─── Import des aliments d'un repas déjà journalisé un jour donné ───────────
function ImportFromDayModal({ onImport, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const [date, setDate] = useState(todayStr)
  const [selectedMeal, setSelectedMeal] = useState(MEALS[0])
  const { entries, loading } = useJournal(date)
  const [checked, setChecked] = useState({})

  const mealEntries = entries.filter(e => e.meal === selectedMeal)

  useEffect(() => {
    const next = {}
    for (const e of mealEntries) next[e.id] = true
    setChecked(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedMeal, entries])

  const toggle = (id) => setChecked(c => ({ ...c, [id]: !c[id] }))
  const toggleAll = () => {
    const allChecked = mealEntries.every(e => checked[e.id])
    const next = {}
    for (const e of mealEntries) next[e.id] = !allChecked
    setChecked(next)
  }

  const selectedEntries = mealEntries.filter(e => checked[e.id])

  const handleImport = () => {
    if (selectedEntries.length === 0) { toast('Coche au moins un aliment'); return }
    const items = selectedEntries.map(({ id, date: _d, meal: _m, user_id, created_at, ...rest }) => rest)
    onImport(items)
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <div style={{ width: 32, flexShrink: 0 }} />
        <h2>Importer un repas</h2>
        <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
      </div>

      <div className="page-modal-body">
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le jour
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            onClick={() => setDate(yesterdayStr)}
            className="chip"
            style={date === yesterdayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Hier
          </button>
          <button
            onClick={() => setDate(todayStr)}
            className="chip"
            style={date === todayStr ? { background: 'var(--green)', color: 'white' } : undefined}
          >
            Aujourd'hui
          </button>
          <input
            type="date"
            className="input"
            value={date}
            max={todayStr}
            onChange={e => setDate(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
          Choisis le repas
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {MEALS.map(m => {
            const active = selectedMeal === m
            return (
              <button
                key={m}
                onClick={() => setSelectedMeal(m)}
                style={{
                  flex: '1 1 auto',
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: active ? 'var(--green)' : 'var(--gray-bg)',
                  color: active ? 'white' : 'var(--text-muted)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: 'var(--font)',
                  transition: 'all .15s',
                }}
              >
                {m}
              </button>
            )
          })}
        </div>

        {loading && <div className="loader"><div className="spinner" /> Chargement...</div>}

        {!loading && mealEntries.length === 0 && (
          <div className="empty" style={{ padding: '20px 10px' }}>
            Aucun aliment enregistré pour « {selectedMeal} » à cette date
          </div>
        )}

        {!loading && mealEntries.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                {mealEntries.length} aliment{mealEntries.length > 1 ? 's' : ''}
              </div>
              <button onClick={toggleAll} style={{ fontSize: 12, fontWeight: 700, color: 'var(--green-dark)', fontFamily: 'var(--font)' }}>
                {mealEntries.every(e => checked[e.id]) ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </div>

            {mealEntries.map(e => {
              const isChecked = !!checked[e.id]
              return (
                <div
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '10px 2px', borderBottom: '0.5px solid var(--border)', gap: 10, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    border: `1.5px solid ${isChecked ? 'var(--green)' : 'var(--border-md)'}`,
                    background: isChecked ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .12s',
                  }}>
                    {isChecked && <Check size={13} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.food_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.qty_g}g</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{Math.round(e.energie_kcal || 0)} kcal</span>
                </div>
              )
            })}
          </>
        )}

        <button
          className="btn-primary"
          onClick={handleImport}
          disabled={selectedEntries.length === 0}
          style={{ marginTop: 16, opacity: selectedEntries.length === 0 ? 0.5 : 1 }}
        >
          Ajouter {selectedEntries.length > 0 ? `${selectedEntries.length} aliment${selectedEntries.length > 1 ? 's' : ''}` : ''} à la liste
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

// ─── Édition d'un repas type — plein écran (même pattern que AddFoodModal) ──
function EditRepasPage({ repas, onSave, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const [nom, setNom] = useState(repas?.nom || '')
  const [desc, setDesc] = useState(repas?.description || '')
  const [portions, setPortions] = useState(repas?.nb_portions || 1)
  const [items, setItems] = useState(repas?.items || [])
  const [showAddFood, setShowAddFood] = useState(false)
  const [showImportMeal, setShowImportMeal] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAddFood = (entry) => {
    setItems(prev => [...prev, { ...entry, meal: undefined }])
    setShowAddFood(false)
  }

  const handleImportMeal = (importedItems) => {
    setItems(prev => [...prev, ...importedItems])
    setShowImportMeal(false)
    toast(`✓ ${importedItems.length} aliment${importedItems.length > 1 ? 's' : ''} ajouté${importedItems.length > 1 ? 's' : ''}`)
  }

  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItemQty = (i, qty) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      const f = qty / item.qty_g
      const updated = {
        ...item,
        qty_g: qty,
        energie_kcal: parseFloat((item.energie_kcal * f).toFixed(1)),
        proteines: parseFloat((item.proteines * f).toFixed(2)),
        glucides: parseFloat((item.glucides * f).toFixed(2)),
        lipides: parseFloat((item.lipides * f).toFixed(2)),
        fibres: parseFloat(((item.fibres || 0) * f).toFixed(2)),
      }
      for (const key of ALL_NUTRIENT_KEYS) {
        const raw = item[key]
        updated[key] = raw != null ? parseFloat((raw * f).toFixed(4)) : null
      }
      return updated
    }))
  }

  const save = async () => {
    if (!nom.trim()) { toast('Donne un nom au repas'); return }
    if (items.length === 0) { toast('Ajoute au moins un aliment'); return }
    setSaving(true)
    await onSave({ nom: nom.trim(), description: desc.trim(), items, nb_portions: portions })
    setSaving(false)
  }

  if (showAddFood) {
    return (
      <AddFoodModal
        initialMeal="Déjeuner"
        onAdd={handleAddFood}
        onClose={() => setShowAddFood(false)}
      />
    )
  }

  if (showImportMeal) {
    return (
      <ImportFromDayModal
        onImport={handleImportMeal}
        onClose={() => setShowImportMeal(false)}
      />
    )
  }

  return (
    <div className="page-modal">
      <div className="page-modal-header">
        <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} />
        </button>
        <h2>{repas ? 'Modifier le repas' : 'Nouveau repas type'}</h2>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>

      <div className="page-modal-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Nom du repas *</div>
            <input className="input" placeholder="Ex: Bol protéiné du midi" value={nom} onChange={e => setNom(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Description (optionnel)</div>
            <input className="input" placeholder="Ex: Repas post-entraînement" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>Nombre de portions</div>
            <input className="input" type="number" min={1} value={portions} onChange={e => setPortions(parseInt(e.target.value) || 1)} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Aliments ({items.length})</div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => setShowImportMeal(true)}
                style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <CalendarDays size={14} /> Importer
              </button>
              <button
                onClick={() => setShowAddFood(true)}
                style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> Ajouter
              </button>
            </div>
          </div>

          {items.length === 0 && (
            <div className="empty" style={{ padding: '20px 10px' }}>Aucun aliment ajouté</div>
          )}

          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.food_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(item.energie_kcal || 0)} kcal</div>
              </div>
              <input
                type="number"
                value={item.qty_g}
                onChange={e => updateItemQty(i, parseFloat(e.target.value) || 0)}
                style={{ width: 60, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 6, padding: '5px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', outline: 'none', background: 'var(--gray-bg)' }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>g</span>
              <button className="btn-icon" onClick={() => removeItem(i)} style={{ color: 'var(--text-hint)' }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={save} disabled={saving} style={{ marginTop: 8, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Sauvegarde...' : '💾 Sauvegarder le repas'}
        </button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
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
// MealsSection — contenu de l'onglet "Repas types" dans ManualPage.
// Pas de <div className="page-content"> ni de gros titre : ManualPage
// fournit déjà le header + le switch d'onglets au-dessus.
// ─────────────────────────────────────────────────────────────────────────────
export default function MealsSection() {
  const toast = useToast()
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null) // null = fermé, {} = nouveau, repas = édition
  const [addToJournalTarget, setAddToJournalTarget] = useState(null)
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
    if (editTarget?.id) {
      const { error } = await supabase.from('repas_types').update({ nom, description, items, nb_portions, updated_at: new Date().toISOString() }).eq('id', editTarget.id).eq('user_id', user.id)
      if (!error) { toast('✓ Repas modifié !'); load() }
    } else {
      const { error } = await supabase.from('repas_types').insert([{ nom, description, items, nb_portions, user_id: user.id }])
      if (!error) { toast('✓ Repas créé !'); load() }
    }
    setEditTarget(null)
  }

  const handleDelete = async (id) => {
    await supabase.from('repas_types').delete().eq('id', id).eq('user_id', user.id)
    setRepasList(r => r.filter(x => x.id !== id))
    toast('Supprimé')
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
        <RepasCard
          key={r.id}
          repas={r}
          onDelete={handleDelete}
          onEdit={setEditTarget}
          onAddToJournal={handleAddToJournal}
        />
      ))}

      {editTarget !== null && (
        <EditRepasPage repas={editTarget?.id ? editTarget : null} onSave={handleSave} onClose={() => setEditTarget(null)} />
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
    </>
  )
}
