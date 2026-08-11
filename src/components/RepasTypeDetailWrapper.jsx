import React from 'react'
import { X } from 'lucide-react'
import EditRepasPage from './EditRepasPage'
import { useRepasTypeDetail, saveRepasType } from '../hooks/useRepasTypes'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'

// ─────────────────────────────────────────────────────────────────────────────
// RepasTypeDetailWrapper — charge un repas type par id et affiche sa "page
// dédiée" (EditRepasPage, le même formulaire que dans "Mes aliments" → onglet
// Repas). Réutilisable depuis n'importe où (ex: cliquer sur un repas type
// planifié depuis le calendrier).
// Props :
//   repasTypeId — id du repas type à afficher
//   onClose()
//   onSaved()   — optionnel, appelé après une sauvegarde réussie
// ─────────────────────────────────────────────────────────────────────────────
export default function RepasTypeDetailWrapper({ repasTypeId, onClose, onSaved }) {
  const { user } = useAuth()
  const toast = useToast()
  const { repas, loading, refetch } = useRepasTypeDetail(repasTypeId)

  if (loading || !repas) {
    return (
      <div className="page-modal">
        <div className="page-modal-header">
          <div style={{ width: 32, flexShrink: 0 }} />
          <h2>Repas type</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} color="var(--text-muted)" /></button>
        </div>
        <div className="loader"><div className="spinner" /> Chargement...</div>
      </div>
    )
  }

  const handleSave = async ({ nom, description, items, nb_portions }) => {
    const { error } = await saveRepasType({ userId: user.id, repasTypeId: repas.id, nom, description, items, nbPortions: nb_portions })
    if (!error) { toast('✓ Repas modifié !'); refetch(); onSaved?.(); onClose() }
    else toast('Erreur')
  }

  return <EditRepasPage repas={repas} onSave={handleSave} onClose={onClose} />
}
