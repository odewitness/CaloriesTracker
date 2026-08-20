import React, { createContext, useContext, useState } from 'react'

// Permet à TodayPage de pousser la date actuellement affichée (et une
// fonction de navigation jour précédent/suivant) vers l'en-tête global
// (espace à gauche du bandeau du haut), sans coupler les deux. Le Provider
// est placé au-dessus du bandeau ET des routes dans AppShell ; comme il
// reçoit `children` déjà construit par AppShell, un changement de son état
// interne (à chaque pixel de swipe) ne re-render que les composants qui
// consomment ce contexte, pas le reste de l'arbre (routes, autres pages).
const TodayHeaderContext = createContext(null)

const DEFAULT_INFO = { active: false, date: null, onNavigate: null }

export function TodayHeaderProvider({ children }) {
  const [info, setInfo] = useState(DEFAULT_INFO)
  return (
    <TodayHeaderContext.Provider value={{ info, setInfo }}>
      {children}
    </TodayHeaderContext.Provider>
  )
}

// Pour l'en-tête : lit la date à afficher (info.active === false quand on
// n'est pas sur la page du jour).
export function useTodayHeaderInfo() {
  const ctx = useContext(TodayHeaderContext)
  return ctx ? ctx.info : DEFAULT_INFO
}

// Pour TodayPage : pousse la date/nav courante, et la retire au démontage.
export function useSetTodayHeaderInfo() {
  const ctx = useContext(TodayHeaderContext)
  return ctx ? ctx.setInfo : () => {}
}
