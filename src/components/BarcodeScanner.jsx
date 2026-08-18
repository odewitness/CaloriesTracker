import React, { useEffect, useRef, useState } from 'react'
import { X, CameraOff } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library'

// Valide le checksum EAN-13/EAN-8/UPC-A pour rejeter les mauvaises lectures
function isValidChecksum(code) {
  if (!/^\d+$/.test(code)) return false
  const digits = code.split('').map(Number)
  const checkDigit = digits.pop()
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const weight = (digits.length - i) % 2 === 0 ? 1 : 3
    sum += digits[i] * weight
  }
  const expected = (10 - (sum % 10)) % 10
  return expected === checkDigit
}

// Le checksum filtre déjà la grande majorité des mauvais scans, mais pas
// tous : un code mal lu a statistiquement ~1 chance sur 10 de retomber quand
// même sur un checksum valide. Exiger 2 lectures identiques d'affilée (quelques
// dizaines de ms à pleine fréquence) rend un faux positif quasiment impossible,
// sans ralentissement perceptible côté utilisatrice.
const REQUIRED_MATCHES = 2

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const detectedRef = useRef(false)
  const candidatesRef = useRef({}) // code -> nombre de lectures consécutives
  const lastCodeRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    detectedRef.current = false
    candidatesRef.current = {}
    lastCodeRef.current = null

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
    ])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints)
    readerRef.current = reader

    const startScanner = async () => {
      try {
        // Préférer la caméra arrière
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        const backCamera = devices.find(d =>
          /back|rear|environment/i.test(d.label)
        ) || devices[devices.length - 1]

        const deviceId = backCamera?.deviceId

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (detectedRef.current) return
            if (result) {
              const code = result.getText()

              // Rejette les codes dont le checksum est invalide (mauvaises lectures)
              if (!isValidChecksum(code)) {
                candidatesRef.current = {}
                lastCodeRef.current = null
                return
              }

              // Exige la même lecture valide plusieurs fois de suite
              if (code === lastCodeRef.current) {
                candidatesRef.current[code] = (candidatesRef.current[code] || 1) + 1
              } else {
                candidatesRef.current = { [code]: 1 }
                lastCodeRef.current = code
              }

              if (candidatesRef.current[code] >= REQUIRED_MATCHES) {
                detectedRef.current = true
                if (navigator.vibrate) navigator.vibrate(60)
                onDetected(code)
              }
              return
            }
            if (err && !(err instanceof NotFoundException)) {
              console.warn('ZXing decode error:', err)
            }
          }
        )
        setReady(true)
      } catch (err) {
        console.error('ZXing init error:', err)
        if (err.name === 'NotAllowedError' || /permission/i.test(err.message || '')) {
          setError("Accès à la caméra refusé. Autorise la caméra dans les paramètres de ton navigateur.")
        } else if (err.name === 'NotFoundError') {
          setError('Aucune caméra trouvée sur cet appareil.')
        } else {
          setError("Impossible d'ouvrir la caméra. Essaie de saisir le code-barres manuellement.")
        }
      }
    }

    startScanner()

    return () => {
      try { readerRef.current?.reset() } catch (e) {}
    }
  }, [onDetected])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#000' }}>
        <span style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>Scanner un code-barres</span>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={18} color="white" />
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          autoPlay
          muted
          playsInline
        />

        {!error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '75%', maxWidth: 320, aspectRatio: '1.6', border: '2px solid var(--green)', borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
          </div>
        )}

        {!ready && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>
            Activation de la caméra...
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', padding: 30, textAlign: 'center', gap: 12 }}>
            <CameraOff size={36} color="rgba(255,255,255,0.6)" />
            <div style={{ fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)' }}>{error}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '16px', background: '#000', textAlign: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Centre le code-barres dans le cadre</span>
      </div>
    </div>
  )
}