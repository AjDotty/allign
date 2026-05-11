'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        background: '#111111', color: '#FFFFFF',
        border: 'none', borderRadius: '8px',
        padding: '9px 18px', fontSize: '13px', fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      Print Report
    </button>
  )
}
