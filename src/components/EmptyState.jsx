import React from 'react'

// Deux formes d'usage :
//   <EmptyState icon={<Apple size={40} />} title="..." description="..." />
//   <EmptyState style={{ padding: '20px 10px' }}>Message simple</EmptyState>
export default function EmptyState({ icon, title, description, style, children }) {
  if (children) {
    return <div className="empty" style={style}>{children}</div>
  }
  return (
    <div className="empty" style={style}>
      {icon}
      {title && <div style={{ marginTop: 8, fontWeight: 600 }}>{title}</div>}
      {description && <div style={{ marginTop: 4 }}>{description}</div>}
    </div>
  )
}
