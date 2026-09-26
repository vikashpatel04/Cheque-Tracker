import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Puts the product name into index.html and generates the web manifest, so a
 * self-hosted copy can use its own name with VITE_APP_NAME (see TRADEMARKS.md).
 * Defaults match src/config/brand.ts.
 */
function brand(env: Record<string, string>): Plugin {
  const name = env.VITE_APP_NAME || 'Cheque Tracker'
  const tagline = env.VITE_APP_TAGLINE || 'Track every cheque. Never miss a date.'
  const manifest = JSON.stringify(
    {
      name,
      short_name: name,
      description: tagline,
      start_url: '/',
      display: 'standalone',
      background_color: '#171717',
      theme_color: '#171717',
      icons: [
        { src: '/cheque.png', sizes: '192x192', type: 'image/png' },
        { src: '/cheque.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2
  )

  return {
    name: 'brand',
    transformIndexHtml: (html) =>
      html.replaceAll('%APP_NAME%', escapeHtml(name)).replaceAll('%APP_TAGLINE%', escapeHtml(tagline)),
    configureServer(server) {
      server.middlewares.use('/manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(manifest)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: manifest })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss(), brand(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
