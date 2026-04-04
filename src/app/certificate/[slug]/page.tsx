'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams, useParams } from 'next/navigation'
import { Download, Printer, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const NAME_Y_FRAC = 0.50
const NAME_X_FRAC = 0.575
const NAME_FONT_SIZE_FRAC = 0.048

function CertificatePage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const name = searchParams.get('name') ?? ''

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null)
  const [templateSrc, setTemplateSrc] = useState<string | null>(null)

  // Resolve template URL from the API
  useEffect(() => {
    fetch('/api/certificates/templates')
      .then((r) => r.json())
      .then((map: Record<string, string>) => {
        const src = map[params.slug.toLowerCase()]
        if (src) {
          setTemplateSrc(src)
        } else {
          setError(`No template found for "${params.slug}". Add a file named ${params.slug}-template.{png|jpeg} to public/certificates/.`)
        }
      })
      .catch(() => setError('Failed to load certificate templates.'))
  }, [params.slug])

  // Load image once template URL is known
  useEffect(() => {
    if (!templateSrc) return
    const img = new Image()
    img.src = templateSrc
    img.onload = () => { setImgEl(img); setReady(true) }
    img.onerror = () => setError(`Template image not found at ${templateSrc}`)
  }, [templateSrc])

  // Render name onto canvas
  useEffect(() => {
    if (!ready || !imgEl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = imgEl.naturalWidth
    canvas.height = imgEl.naturalHeight
    ctx.drawImage(imgEl, 0, 0)

    const fontSize = Math.round(imgEl.naturalHeight * NAME_FONT_SIZE_FRAC)
    ctx.font = `bold ${fontSize}px "Times New Roman", Georgia, serif`
    ctx.fillStyle = '#1a3a2a'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(name, imgEl.naturalWidth * NAME_X_FRAC, imgEl.naturalHeight * NAME_Y_FRAC)
  }, [ready, imgEl, name])

  const handleDownload = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `certificate-${name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const handlePrint = () => {
    if (!canvasRef.current) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const win = window.open('', '_blank', 'width=1200,height=900')
    if (!win) return
    win.document.write(`<!doctype html>
<html><head><title>Certificate — ${name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: white; }
  img { width: 100%; height: auto; display: block; }
  @page { size: landscape; margin: 0; }
</style></head>
<body><img src="${dataUrl}" /></body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const label = params.slug.charAt(0).toUpperCase() + params.slug.slice(1)

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <Link
          href="/dashboard/leaderboard"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leaderboard
        </Link>

        <span className="text-sm font-medium text-slate-300">{label} Certificate — {name}</span>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!ready}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleDownload}
            disabled={!ready}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-700 hover:bg-amber-600 text-white disabled:opacity-40 transition"
          >
            <Download className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      </div>

      {/* Certificate */}
      <div className="flex-1 flex items-center justify-center p-8">
        {error && (
          <p className="text-red-400 text-sm text-center whitespace-pre-line">{error}</p>
        )}
        {!ready && !error && (
          <p className="text-slate-400 text-sm">Loading…</p>
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto rounded-xl shadow-2xl"
          style={{ display: ready ? 'block' : 'none', maxHeight: 'calc(100vh - 120px)' }}
        />
      </div>
    </div>
  )
}

export default function CertificateSlugPage() {
  return (
    <Suspense>
      <CertificatePage />
    </Suspense>
  )
}
