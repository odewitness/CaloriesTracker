import React, { useState, useEffect } from 'react'
import { Users, UtensilsCrossed, Search, UserPlus, Check, X, UserMinus, Clock, Bell, MessageCircle } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { useFriends } from '../hooks/useFriends'
import { useFeed } from '../hooks/useFeed'
import { usePartageDetail } from '../hooks/usePartageDetail'
import { useJournalPartageDetail } from '../hooks/useJournalPartageDetail'
import { useSportPartageDetail } from '../hooks/useSportPartageDetail'
import { saveRecette } from '../hooks/useRecipes'
import { scaleFood } from '../lib/nutrients'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useToast } from '../lib/toast'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import PartageCard from '../components/PartageCard'
import PartageDetailModal from '../components/PartageDetailModal'
import JournalPartageCard from '../components/JournalPartageCard'
import JournalPartageDetailModal from '../components/JournalPartageDetailModal'
import SportPartageCard from '../components/SportPartageCard'
import SportPartageDetailModal from '../components/SportPartageDetailModal'
import ReactionBar from '../components/ReactionBar'
import CommentsList from '../components/CommentsList'

const PSEUDO_RE = /^[a-zA-Z0-9_]{3,20}$/

// ─────────────────────────────────────────────────────────────────────────────
// PseudoCard — définir/modifier son pseudo public, condition pour que ses
// amies puissent la retrouver (voir find_profile_by_pseudo côté SQL).
// ─────────────────────────────────────────────────────────────────────────────
function PseudoCard() {
  const toast = useToast()
  const { profile, loading, updateProfile } = useProfile()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setValue(profile?.pseudo || '') }, [profile?.pseudo])

  const dirty = value !== (profile?.pseudo || '')
  const valid = value === '' || PSEUDO_RE.test(value)

  const save = async () => {
    if (!valid) return
    setSaving(true)
    const { error } = await updateProfile({ pseudo: value.trim() || null })
    setSaving(false)
    if (!error) toast('✓ Pseudo mis à jour !')
    else if (error.code === '23505') toast('Ce pseudo est déjà pris')
    else toast('Erreur lors de la sauvegarde')
  }

  if (loading) return null

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Ton pseudo</div>
      <div style={{ fontSize: 11.5, color: 'var(--text-hint)', marginBottom: 10, lineHeight: 1.4 }}>
        C'est ce que tes amies cherchent pour te trouver et t'envoyer une demande. 3 à 20 caractères, lettres/chiffres/underscore uniquement.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={value}
          onChange={e => setValue(e.target.value.trim())}
          placeholder="ex: julie_92"
          style={{ flex: 1 }}
        />
        {dirty && (
          <button className="btn-primary" onClick={save} disabled={!valid || saving} style={{ width: 'auto', padding: '0 16px', opacity: (!valid || saving) ? 0.6 : 1 }}>
            {saving ? '...' : 'Valider'}
          </button>
        )}
      </div>
      {!valid && <div style={{ fontSize: 11, color: 'var(--coral)', marginTop: 6 }}>Format invalide.</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FriendSearch — recherche par pseudo exact + envoi de demande
// ─────────────────────────────────────────────────────────────────────────────
function FriendSearch({ friends, incomingRequests, outgoingRequests, searchByPseudo, sendRequest }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState(undefined) // undefined = pas cherché, null = aucun résultat, objet = trouvé
  const [sending, setSending] = useState(false)

  const doSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    const { data } = await searchByPseudo(query.trim())
    setResult(data)
    setSearching(false)
  }

  const existingStatus = result && (
    friends.some(f => f.friendId === result.id) ? 'amie'
      : outgoingRequests.some(r => r.friendId === result.id) ? 'envoyee'
      : incomingRequests.some(r => r.friendId === result.id) ? 'recue'
      : null
  )

  const doSend = async () => {
    setSending(true)
    const { error } = await sendRequest(result)
    setSending(false)
    if (!error) { toast('✓ Demande envoyée !'); setResult(null); setQuery('') }
    else toast('Erreur lors de l\'envoi')
  }

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Trouver une amie</div>
      <form onSubmit={doSearch} style={{ display: 'flex', gap: 8, marginBottom: result !== undefined ? 12 : 0 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="var(--text-hint)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            placeholder="Pseudo exact"
            value={query}
            onChange={e => { setQuery(e.target.value); setResult(undefined) }}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={searching || !query.trim()} style={{ width: 'auto', padding: '0 16px' }}>
          {searching ? '...' : 'Chercher'}
        </button>
      </form>

      {result === null && (
        <div style={{ fontSize: 12.5, color: 'var(--text-hint)' }}>Aucun compte avec ce pseudo.</div>
      )}

      {result && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>
            {result.pseudo}{result.prenom ? <span style={{ color: 'var(--text-hint)', fontWeight: 500 }}> · {result.prenom}</span> : null}
          </div>
          {existingStatus === 'amie' && <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Déjà amies</span>}
          {existingStatus === 'envoyee' && <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Demande envoyée</span>}
          {existingStatus === 'recue' && <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>T'a déjà envoyé une demande</span>}
          {!existingStatus && (
            <button
              onClick={doSend}
              disabled={sending}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--green)', color: 'white', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font)', flexShrink: 0, opacity: sending ? 0.7 : 1 }}
            >
              <UserPlus size={14} /> Ajouter
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PersonRow({ pseudo, prenom, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pseudo || '(pseudo supprimé)'}</div>
        {prenom && <div style={{ fontSize: 11.5, color: 'var(--text-hint)' }}>{prenom}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

const ACTION_BTN = { width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

// ─────────────────────────────────────────────────────────────────────────────
// AmisTab — recherche/demande/liste d'amies
// ─────────────────────────────────────────────────────────────────────────────
function AmisTab() {
  const { friends, incomingRequests, outgoingRequests, loading, searchByPseudo, sendRequest, acceptRequest, removeOrDecline } = useFriends()

  if (loading) return <Loader />

  return (
    <>
      <PseudoCard />
      <FriendSearch
        friends={friends}
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        searchByPseudo={searchByPseudo}
        sendRequest={sendRequest}
      />

      {incomingRequests.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title">Demandes reçues</div>
          <div className="card" style={{ padding: '0 16px' }}>
            {incomingRequests.map(r => (
              <PersonRow key={r.id} pseudo={r.pseudo} prenom={r.prenom}>
                <button onClick={() => acceptRequest(r.id)} style={{ ...ACTION_BTN, background: 'var(--green-light)', color: 'var(--green-dark)' }} aria-label="Accepter">
                  <Check size={15} />
                </button>
                <button onClick={() => removeOrDecline(r.id)} style={{ ...ACTION_BTN, background: 'var(--coral-light)', color: 'var(--coral)' }} aria-label="Refuser">
                  <X size={15} />
                </button>
              </PersonRow>
            ))}
          </div>
        </div>
      )}

      {outgoingRequests.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-title">Demandes envoyées</div>
          <div className="card" style={{ padding: '0 16px' }}>
            {outgoingRequests.map(r => (
              <PersonRow key={r.id} pseudo={r.pseudo} prenom={r.prenom}>
                <span style={{ fontSize: 11.5, color: 'var(--text-hint)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> En attente</span>
                <button onClick={() => removeOrDecline(r.id)} style={{ ...ACTION_BTN, background: 'var(--gray-bg)', color: 'var(--text-hint)' }} aria-label="Annuler">
                  <X size={15} />
                </button>
              </PersonRow>
            ))}
          </div>
        </div>
      )}

      <div className="section-title">Mes amies {friends.length > 0 && `(${friends.length})`}</div>
      {friends.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Aucune amie pour l'instant"
          description="Cherche une amie par son pseudo ci-dessus pour commencer à partager tes recettes."
        />
      ) : (
        <div className="card" style={{ padding: '0 16px', marginBottom: 20 }}>
          {friends.map(f => (
            <PersonRow key={f.id} pseudo={f.pseudo} prenom={f.prenom}>
              <button onClick={() => removeOrDecline(f.id)} style={{ ...ACTION_BTN, background: 'var(--gray-bg)', color: 'var(--text-hint)' }} aria-label="Retirer">
                <UserMinus size={15} />
              </button>
            </PersonRow>
          ))}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PartageDetailContainer — charge un partage par id et affiche son détail
// ─────────────────────────────────────────────────────────────────────────────
function PartageDetailContainer({ partageId, onClose, onDeleted, deletePartage }) {
  const toast = useToast()
  const { user } = useAuth()
  const { partage, ingredients, reactions, comments, loading, toggleReaction, addComment, deleteComment } = usePartageDetail(partageId)
  const isOwn = partage?.auteur_id === user.id

  // Copie la recette partagée dans les recettes de l'utilisatrice courante.
  // Pour les ingrédients Ciqual (base publique), on recharge le détail
  // nutritionnel complet (vitamines/minéraux) depuis `ciqual` par
  // food_ref_id — le partage n'a snapshotté que les 5 macros de base, donc
  // sans ça la copie perdrait tous les micronutriments. Pour un ingrédient
  // personnalisé/une recette imbriquée de l'auteure (food_source
  // 'custom'/'recette'), impossible d'aller lire sa base privée : on retombe
  // sur les macros déjà snapshottées (dégradé mais pas d'erreur).
  const addToMyRecipes = async () => {
    let degraded = false
    const enrichedIngredients = await Promise.all(ingredients.map(async ing => {
      if (ing.food_source === 'ciqual' && ing.food_ref_id) {
        const { data: ciqualRow } = await supabase.from('ciqual').select('*').eq('alim_code', ing.food_ref_id).maybeSingle()
        if (ciqualRow) return scaleFood(ciqualRow, ing.qty_g)
      }
      degraded = true
      // On garde le lien Ciqual d'origine même sans avoir pu recharger le
      // détail : ça permet au moins de classer l'ingrédient par rayon dans la
      // liste de courses (et de le ré-enrichir plus tard). Un ingrédient
      // custom/recette de l'auteure (base privée) reste sans référence.
      const keepCiqualRef = ing.food_source === 'ciqual' && ing.food_ref_id
      return {
        food_name: ing.food_name,
        food_source: keepCiqualRef ? 'ciqual' : null,
        food_ref_id: keepCiqualRef ? ing.food_ref_id : null,
        qty_g: ing.qty_g,
        energie_kcal: ing.energie_kcal,
        proteines: ing.proteines,
        glucides: ing.glucides,
        lipides: ing.lipides,
        fibres: ing.fibres,
      }
    }))

    const { error } = await saveRecette({
      userId: user.id,
      recetteId: null,
      nom: partage.nom,
      portions: partage.portions,
      poidsReferenceG: partage.poids_cuit_g || partage.poids_cru_g,
      poidsCuitG: partage.poids_cuit_g,
      poidsCruG: partage.poids_cru_g,
      tareG: partage.tare_g,
      categories: partage.categories,
      saisons: partage.saisons,
      instructions: partage.instructions,
      tempsPreparationMin: partage.temps_preparation_min,
      tempsCuissonMin: partage.temps_cuisson_min,
      tempsReposMin: partage.temps_repos_min,
      sourceType: null,
      sourceValeur: null,
      sourcePage: null,
      ingredients: enrichedIngredients,
    })
    if (!error) toast(degraded ? '✓ Recette ajoutée (certains ingrédients personnalisés sans détail complet)' : '✓ Recette ajoutée à tes recettes !')
    else toast("Erreur lors de l'ajout")
  }

  return (
    <PartageDetailModal
      partage={partage}
      ingredients={ingredients}
      loading={loading}
      isOwn={isOwn}
      onDelete={async () => { await deletePartage({ id: partageId, _type: 'recette' }); onDeleted() }}
      onAddToMyRecipes={!isOwn && partage ? addToMyRecipes : undefined}
      onClose={onClose}
      reactionsSlot={partage && <ReactionBar reactions={reactions} userId={user.id} onToggle={toggleReaction} />}
      commentsSlot={partage && <CommentsList comments={comments} userId={user.id} onAdd={addComment} onDelete={deleteComment} />}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// JournalPartageDetailContainer — charge un partage de journée/repas par id
// et affiche son détail
// ─────────────────────────────────────────────────────────────────────────────
function JournalPartageDetailContainer({ partageId, onClose, onDeleted, deletePartage }) {
  const { user } = useAuth()
  const { partage, aliments, reactions, comments, loading, toggleReaction, addComment, deleteComment } = useJournalPartageDetail(partageId)
  const isOwn = partage?.auteur_id === user.id

  return (
    <JournalPartageDetailModal
      partage={partage}
      aliments={aliments}
      loading={loading}
      isOwn={isOwn}
      onDelete={async () => { await deletePartage({ id: partageId, _type: 'journal' }); onDeleted() }}
      onClose={onClose}
      reactionsSlot={partage && <ReactionBar reactions={reactions} userId={user.id} onToggle={toggleReaction} />}
      commentsSlot={partage && <CommentsList comments={comments} userId={user.id} onAdd={addComment} onDelete={deleteComment} />}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SportPartageDetailContainer — charge un partage de sport (séance / semaine)
// ─────────────────────────────────────────────────────────────────────────────
function SportPartageDetailContainer({ partageId, onClose, onDeleted, deletePartage }) {
  const { user } = useAuth()
  const { partage, reactions, comments, loading, toggleReaction, addComment, deleteComment } = useSportPartageDetail(partageId)
  const isOwn = partage?.auteur_id === user.id

  return (
    <SportPartageDetailModal
      partage={partage}
      loading={loading}
      isOwn={isOwn}
      onDelete={async () => { await deletePartage({ id: partageId, _type: 'sport' }); onDeleted() }}
      onClose={onClose}
      reactionsSlot={partage && <ReactionBar reactions={reactions} userId={user.id} onToggle={toggleReaction} />}
      commentsSlot={partage && <CommentsList comments={comments} userId={user.id} onAdd={addComment} onDelete={deleteComment} />}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FilTab — liste des recettes partagées par soi-même et ses amies. Reçoit les
// données de useFeed() en props (chargées une seule fois au niveau
// SocialPage) pour que l'onglet Activité puisse ouvrir le même détail sans
// dupliquer les requêtes.
// ─────────────────────────────────────────────────────────────────────────────
function FilTab({ partages, reactionsByPartage, commentCounts, loading, onDelete, toggleReaction, onOpen }) {
  const { user } = useAuth()

  if (loading) return <Loader />

  if (partages.length === 0) {
    return (
      <EmptyState
        icon={<UtensilsCrossed size={40} />}
        title="Ton fil est vide"
        description="Partage une recette (menu ⋮), une journée/un repas ou une séance de sport pour que tes amies les voient ici."
      />
    )
  }

  return partages.map(p => {
    const common = {
      key: p.id,
      partage: p,
      isOwn: p.auteur_id === user.id,
      reactions: reactionsByPartage[p.id] || [],
      userId: user.id,
      onToggleReaction: toggleReaction,
      commentCount: commentCounts[p.id] || 0,
      onOpen,
      onDelete,
    }
    if (p._type === 'recette') return <PartageCard {...common} />
    if (p._type === 'sport') return <SportPartageCard {...common} />
    return <JournalPartageCard {...common} />
  })
}

const NOTIF_ICON = { reaction: null, comment: <MessageCircle size={14} />, reply: <MessageCircle size={14} /> }

function formatWhen(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffJ = Math.floor(diffH / 24)
  if (diffJ < 7) return `il y a ${diffJ} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function describeNotif(item) {
  const name = item.pseudo || item.prenom || 'Une amie'
  const target = item.partageType === 'recette' ? 'ta recette' : 'ton partage'
  if (item.type === 'reaction') {
    return <>{name} a réagi {item.emoji} à {target}{item.targetLabel ? <> « {item.targetLabel} »</> : null}</>
  }
  if (item.type === 'comment') {
    return <>{name} a commenté {target}{item.targetLabel ? <> « {item.targetLabel} »</> : null} : « {item.contenu} »</>
  }
  return <>{name} a répondu à ton commentaire{item.targetLabel ? <> sur « {item.targetLabel} »</> : null} : « {item.contenu} »</>
}

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsTab — fil d'activité sur mes propres partages : réactions,
// commentaires reçus, réponses à mes commentaires. Un tap ouvre le partage
// concerné (même détail que l'onglet Fil).
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab({ items, loading, onOpen }) {
  if (loading) return <Loader />

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={40} />}
        title="Aucune activité pour l'instant"
        description="Les réactions et commentaires de tes amies sur tes partages apparaîtront ici."
      />
    )
  }

  return (
    <div className="card" style={{ padding: '0 16px' }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onOpen({ id: item.partageId, _type: item.partageType })}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
            padding: '11px 0', borderBottom: '0.5px solid var(--border)', fontFamily: 'var(--font)',
          }}
        >
          <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-hint)', marginTop: 1 }}>
            {NOTIF_ICON[item.type]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{describeNotif(item)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 2 }}>{formatWhen(item.createdAt)}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SocialPage — onglets internes "Fil" / "Activité" / "Amies". Les données
// d'activité (items, hasUnseen, markSeen) viennent d'App.jsx : c'est là
// qu'elles pilotent aussi la pastille de l'icône du header, et il faut la
// MÊME instance du hook pour que "marquer vu" ici se répercute là-bas.
// ─────────────────────────────────────────────────────────────────────────────
export default function SocialPage({ hasUnseenActivity, activityItems, activityLoading, markActivitySeen }) {
  const [tab, setTab] = useState('fil')
  const toast = useToast()
  const { partages, reactionsByPartage, commentCounts, loading, deletePartage, toggleReaction } = useFeed()
  const [selected, setSelected] = useState(null) // partage complet ({ id, _type }) | null

  const handleDelete = async (partage) => {
    await deletePartage(partage)
    toast('Partage retiré')
  }

  const openActivite = () => {
    setTab('activite')
    if (hasUnseenActivity) markActivitySeen()
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', background: 'var(--gray-bg)', borderRadius: 'var(--radius-sm)', padding: 3, marginBottom: 16 }}>
        {[
          { key: 'fil',       label: 'Fil',       icon: <UtensilsCrossed size={14} />, onClick: () => setTab('fil'), dot: false },
          { key: 'activite',  label: 'Activité',  icon: <Bell size={14} />,            onClick: openActivite,        dot: hasUnseenActivity },
          { key: 'amies',     label: 'Amies',     icon: <Users size={14} />,           onClick: () => setTab('amies'), dot: false },
        ].map(t => (
          <button
            key={t.key}
            onClick={t.onClick}
            style={{
              position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font)',
              background: tab === t.key ? 'var(--white)' : 'transparent',
              color:      tab === t.key ? 'var(--text)'  : 'var(--text-muted)',
              boxShadow:  tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .15s',
            }}
          >
            {t.icon} {t.label}
            {t.dot && <span style={{ position: 'absolute', top: 6, right: '22%', width: 7, height: 7, borderRadius: '50%', background: 'var(--coral)' }} />}
          </button>
        ))}
      </div>

      {tab === 'fil' && (
        <FilTab
          partages={partages}
          reactionsByPartage={reactionsByPartage}
          commentCounts={commentCounts}
          loading={loading}
          onDelete={handleDelete}
          toggleReaction={toggleReaction}
          onOpen={setSelected}
        />
      )}
      {tab === 'activite' && <NotificationsTab items={activityItems} loading={activityLoading} onOpen={setSelected} />}
      {tab === 'amies' && <AmisTab />}

      {selected?._type === 'recette' && (
        <PartageDetailContainer
          partageId={selected.id}
          deletePartage={deletePartage}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); toast('Partage retiré') }}
        />
      )}
      {selected?._type === 'journal' && (
        <JournalPartageDetailContainer
          partageId={selected.id}
          deletePartage={deletePartage}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); toast('Partage retiré') }}
        />
      )}
      {selected?._type === 'sport' && (
        <SportPartageDetailContainer
          partageId={selected.id}
          deletePartage={deletePartage}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); toast('Partage retiré') }}
        />
      )}
    </div>
  )
}
