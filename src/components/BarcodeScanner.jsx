import React, { useEffect, useRef, useState } from 'react'
import { X, CameraOff } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library'

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const detectedRef = useRef(false)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    detectedRef.current = false

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
              detectedRef.current = true
              if (navigator.vibrate) navigator.vibrate(60)
              onDetected(result.getText())
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