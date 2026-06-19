import React, { useEffect, useRef, useState } from 'react'
import Quagga from '@ericblade/quagga2'
import { X, CameraOff } from 'lucide-react'

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const detectedRef = useRef(false)

  useEffect(() => {
    detectedRef.current = false

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ton navigateur ne supporte pas l'accès à la caméra.")
      return
    }

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: videoRef.current,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 720 },
            height: { ideal: 480 },
          },
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('Quagga init error:', err)
          if (err.name === 'NotAllowedError' || /Permission/i.test(err.message || '')) {
            setError("Accès à la caméra refusé. Autorise la caméra dans les paramètres de ton navigateur.")
          } else if (err.name === 'NotFoundError') {
            setError('Aucune caméra trouvée sur cet appareil.')
          } else {
            setError("Impossible d'ouvrir la caméra. Essaie de saisir le code-barres manuellement.")
          }
          return
        }
        Quagga.start()
        setReady(true)
      }
    )

    const handleDetected = (result) => {
      if (detectedRef.current) return
      const code = result?.codeResult?.code
      if (code) {
        detectedRef.current = true
        onDetected(code)
      }
    }

    Quagga.onDetected(handleDetected)

    return () => {
      Quagga.offDetected(handleDetected)
      try { Quagga.stop() } catch (e) {}
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
        <div ref={videoRef} style={{ width: '100%', height: '100%' }} />

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
