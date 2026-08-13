import React from 'react'

export default function Loader({ label = 'Chargement...' }) {
  return <div className="loader"><div className="spinner" /> {label}</div>
}
