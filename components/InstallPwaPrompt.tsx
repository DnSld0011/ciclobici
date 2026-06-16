'use client'

import { useEffect, useState } from 'react'
import { Download, X, Share, PlusSquare } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'sbbici-install-dismissed'

export function InstallPwaPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [esIos, setEsIos]       = useState(false)
  const [visible, setVisible]   = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const iOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
    if (iOS) { setEsIos(true); setVisible(true) }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  function descartar() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  async function instalar() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') descartar()
    else setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50">
      <div className="bg-white rounded-2xl shadow-xl border border-outline-variant/30 p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#003527' }}>
          <Download size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-on-surface">Instala San Borja en Bici</p>
          {esIos ? (
            <p className="text-xs text-outline mt-1 leading-relaxed">
              Toca <Share size={11} className="inline -mt-0.5" strokeWidth={2.2} /> y luego &quot;Agregar a inicio&quot; <PlusSquare size={11} className="inline -mt-0.5" strokeWidth={2.2} />
            </p>
          ) : (
            <>
              <p className="text-xs text-outline mt-1">Accede más rápido desde tu pantalla de inicio</p>
              <button
                onClick={instalar}
                className="mt-2 h-9 px-4 rounded-xl font-bold text-xs active:scale-[.97] transition-all"
                style={{ background: '#b2f746', color: '#002117' }}
              >
                Instalar
              </button>
            </>
          )}
        </div>
        <button onClick={descartar} className="text-outline shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
