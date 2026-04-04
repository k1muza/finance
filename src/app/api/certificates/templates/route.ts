import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const CERTS_DIR = path.join(process.cwd(), 'public', 'certificates')
const TEMPLATE_RE = /^(.+)-template\.(png|jpe?g|webp)$/i

/**
 * Returns a map of certificate name (lowercase) → public URL path for every
 * template image found in public/certificates/.
 * e.g. { bronze: "/certificates/bronze-template.jpeg" }
 */
export async function GET() {
  try {
    if (!fs.existsSync(CERTS_DIR)) {
      return NextResponse.json({})
    }

    const files = fs.readdirSync(CERTS_DIR)
    const result: Record<string, string> = {}

    for (const file of files) {
      const m = file.match(TEMPLATE_RE)
      if (m) {
        const slug = m[1].toLowerCase()
        result[slug] = `/certificates/${file}`
      }
    }

    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
