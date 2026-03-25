'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
    const inStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    if (inStandalone) {
      setInstalled(true)
      return
    }

    if (isIos) {
      setShowIosHelp(true)
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }

    function handleInstalled() {
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }

  if (installed) {
    return <p className="text-xs text-brand-300">Installed on this device</p>
  }

  if (showIosHelp) {
    return (
      <div className="rounded-xl border border-brand-300 bg-brand-50 p-3 text-xs text-brand-800">
        <p className="font-semibold">Install on iPhone</p>
        <p className="mt-1 leading-5">
          In Safari, tap <span className="font-medium">Share</span> and then <span className="font-medium">Add to Home Screen</span>.
        </p>
      </div>
    )
  }

  if (!promptEvent) return null

  return (
    <button onClick={install} className="btn-secondary w-full justify-center text-xs !bg-brand-50 !text-brand-700 !border-brand-400">
      Install on Phone
    </button>
  )
}
