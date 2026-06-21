import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronRight, Check, X, Pencil, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/AuthContext'
import { ALL_NUTRIENT_KEYS } from '../lib/nutrients'
import AddFoodModal from '../components/AddFoodModal'
import { useBackButton } from '../hooks/useBackButton'

const MEALS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation']

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
              <Check size={15} /> Ajouter au journal d'aujourd'hui
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EditRepasModal({ repas, onSave, onClose }) {
  useBackButton(onClose)
  const toast = useToast()
  const [nom, setNom] = useState(repas?.nom || '')
  const [desc, setDesc] = useState(repas?.description || '')
  const [portions, setPortions] = useState(repas?.nb_portions || 1)
  const [items, setItems] = useState(repas?.items || [])
  const [showAddFood, setShowAddFood] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleAddFood = (entry) => {
    setItems(prev => [...prev, { ...entry, meal: undefined }])
    setShowAddFood(false)
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
      // Tous les autres nutriments (sucres détaillés, acides gras, vitamines,
      // minéraux...) suivent le même prorata générique.
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

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{repas ? 'Modifier le repas' : 'Nouveau repas type'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Aliments ({items.length})</div>
            <button
              onClick={() => setShowAddFood(true)}
              style={{ background: 'var(--green-light)', color: 'var(--green-dark)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={14} /> Ajouter
            </button>
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

function AddToJournalSheet({ repas, journalMeal, onMealChange, onConfirm, onClose }) {
  useBackButton(onClose)
  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Ajouter au journal</h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Quel repas pour « {repas.nom} » ?
        </div>
        <select className="input" value={journalMeal} onChange={e => onMealChange(e.target.value)} style={{ marginBottom: 16 }}>
          {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="btn-primary" onClick={onConfirm}>Ajouter</button>
        <button className="btn-ghost" style={{ width: '100%', textAlign: 'center', marginTop: 6 }} onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}

export default function MealsPage() {
  const toast = useToast()
  const { user } = useAuth()
  const [repasList, setRepasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState(null) // null = closed, {} = new, repas = edit
  const [addToJournalTarget, setAddToJournalTarget] = useState(null)
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
      // update
      const { error } = await supabase.from('repas_types').update({ nom, description, items, nb_portions, updated_at: new Date().toISOString() }).eq('id', editTarget.id).eq('user_id', user.id)
      if (!error) { toast('✓ Repas modifié !'); load() }
    } else {
      // insert
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
    setAddToJournalTarget(repas)
  }

  const confirmAddToJournal = async () => {
    if (!addToJournalTarget) return
    const today = new Date().toISOString().slice(0, 10)
    const rows = addToJournalTarget.items.map(item => ({ ...item, date: today, meal: journalMeal, user_id: user.id }))
    const { error } = await supabase.from('journal').insert(rows)
    if (!error) toast(`✓ ${addToJournalTarget.nom} ajouté au journal !`)
    else toast('Erreur')
    setAddToJournalTarget(null)
  }

  return (
    <>
      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>Mes repas types</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Groupes d'aliments sauvegardés</div>
          </div>
          <button
            onClick={() => setEditTarget({})}
            style={{ background: 'var(--green)', color: 'white', borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <Plus size={16} /> Nouveau
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
      </div>

      {editTarget !== null && (
        <EditRepasModal repas={editTarget?.id ? editTarget : null} onSave={handleSave} onClose={() => setEditTarget(null)} />
      )}

      {addToJournalTarget && (
        <AddToJournalSheet
          repas={addToJournalTarget}
          journalMeal={journalMeal}
          onMealChange={setJournalMeal}
          onConfirm={confirmAddToJournal}
          onClose={() => setAddToJournalTarget(null)}
        />
      )}
    </>
  )
}