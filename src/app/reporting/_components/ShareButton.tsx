'use client'

import { useState } from 'react'

export default function ShareButton({ playerId }: { playerId: string }) {
  const [copied, setCopied] = useState(false)

  function handleClick() {
    const url = `${window.location.origin}/reporting/parents/${playerId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: '#FFFFFF', color: copied ? '#16A34A' : '#111111',
        border: `1px solid ${copied ? '#16A34A' : '#E5E7EB'}`,
        borderRadius: '8px', padding: '8px 14px',
        fontSize: '13px', fontWeight: 500,
        cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {copied ? 'Copied!' : 'Share with Parents'}
    </button>
  )
}
