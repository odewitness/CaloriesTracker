import React, { useEffect, useRef, useState } from 'react'
import Quagga from '@ericblade/quagga2'
import { X, CameraOff } from 'lucide-react'

// Validates EAN-13 / EAN-8 / UPC-A check digit to reject misreads
function isValidChecksum(code) {
  if (!/^\d+$/.test(code)) return false
  const digits = code.split('').map(Number)
  const checkDigit = digits.pop()
  // EAN-13 / EAN-8 / UPC-A all use the same weighted mod-10 algorithm,
  // alternating weights 3/1 from the rightmost digit before the check digit.
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    const weight = (digits.length - i) % 2 === 0 ? 1 : 3
    sum += digits[i] * weight
  }
  const expected = (10 - (sum % 10)) % 10
  return expected === checkDigit
}

// Le checksum (voir isValidChecksum) filtre déjà quasiment tous les
// mauvais scans : la probabilité qu'une lecture erronée tombe pile sur
// un checksum valide est très faible. Demander plusieurs lectures
// identiques d'affilée n'apporte donc pas grand-chose en fiabilité,
// mais ajoute beaucoup de latence perçue. 1 = scan quasi instantané
// (comme Yazio). Remonte à 2 si jamais tu observes des faux positifs.
const REQUIRED_MATCHES = 1

export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const detectedRef = useRef(false)
  const candidatesRef = useRef({}) // code -> consecutive count
  const lastCodeRef = useRef(null)

  useEffect(() => {
    detectedRef.current = false
    candidatesRef.current = {}
    lastCodeRef.current = null

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
            width: { min: 480, ideal: 720, max: 1280 },
            height: { min: 480, ideal: 720, max: 1280 },
            advanced: [{ focusMode: 'continuous' }, { zoom: 1 }],
          },
        },
        locator: { patchSize: 'large', halfSample: true },
        numOfWorkers: navigator.hardwareConcurrency || 2,
        frequency: 30,
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
          multiple: false,
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
      if (!code) return

      // Reject codes that fail the standard checksum — these are misreads
      if (!isValidChecksum(code)) {
        candidatesRef.current = {}
        lastCodeRef.current = null
        return
      }

      // Require the same valid code to be read several times in a row
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