interface Env {
  BUCKET: R2Bucket
}

interface Meta {
  expiresAt: number
  hasVideo: boolean
  videoType?: string
  videoExt?: string
}

const MAX_PHOTO = 12 * 1024 * 1024
const MAX_VIDEO = 30 * 1024 * 1024
const MAX_BODY = MAX_PHOTO + MAX_VIDEO + 1024 * 1024
const HOUR = 3600 * 1000

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_') // 16 URL-safe chars
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

async function deleteShare(env: Env, id: string) {
  await env.BUCKET.delete([`${id}/photo`, `${id}/video`, `${id}/meta.json`])
}

async function loadMeta(env: Env, id: string): Promise<'missing' | 'expired' | Meta> {
  const obj = await env.BUCKET.get(`${id}/meta.json`)
  if (!obj) return 'missing'
  const meta = await obj.json<Meta>()
  if (Date.now() > meta.expiresAt) {
    await deleteShare(env, id)
    return 'expired'
  }
  return meta
}

async function handleUpload(request: Request, env: Env, url: URL) {
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  const hours = Number(url.searchParams.get('hours'))
  if (hours !== 48 && hours !== 72) return json({ error: 'hours' }, 400)

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
    return json({ error: 'too_large' }, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'bad_form' }, 400)
  }

  const photo = form.get('photo')
  if (!(photo instanceof File) || photo.type !== 'image/jpeg') {
    return json({ error: 'photo' }, 400)
  }
  if (photo.size > MAX_PHOTO) return json({ error: 'too_large' }, 413)

  const videoEntry = form.get('video')
  let video: File | null = null
  if (videoEntry instanceof File && videoEntry.size > 0) {
    const okType = videoEntry.type === 'video/mp4' || videoEntry.type === 'video/webm'
    if (!okType) return json({ error: 'video' }, 400)
    if (videoEntry.size > MAX_VIDEO) return json({ error: 'too_large' }, 413)
    video = videoEntry
  }

  const id = newId()
  const expiresAt = Date.now() + hours * HOUR

  await env.BUCKET.put(`${id}/photo`, await photo.arrayBuffer(), {
    httpMetadata: { contentType: 'image/jpeg' },
  })
  if (video) {
    await env.BUCKET.put(`${id}/video`, await video.arrayBuffer(), {
      httpMetadata: { contentType: video.type },
    })
  }

  const meta: Meta = {
    expiresAt,
    hasVideo: !!video,
    videoType: video?.type,
    videoExt: video?.type === 'video/webm' ? 'webm' : 'mp4',
  }
  // meta is written last, so a share only exists once its files are stored
  await env.BUCKET.put(`${id}/meta.json`, JSON.stringify(meta), {
    customMetadata: { expiresAt: String(expiresAt) },
  })

  return json({ id, expiresAt })
}

async function handleFile(
  request: Request,
  env: Env,
  url: URL,
  id: string,
  kind: 'photo' | 'video',
) {
  const meta = await loadMeta(env, id)
  if (meta === 'expired') return new Response('Expired', { status: 410 })
  if (meta === 'missing' || (kind === 'video' && !meta.hasVideo)) {
    return new Response('Not found', { status: 404 })
  }

  // Range support is required for video playback on iPhone
  const obj = await env.BUCKET.get(`${id}/${kind}`, { range: request.headers })
  if (!obj) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('accept-ranges', 'bytes')
  headers.set('cache-control', 'private, no-store')
  headers.set('x-content-type-options', 'nosniff')

  if (url.searchParams.get('dl') === '1') {
    const name = kind === 'photo' ? 'photobooth.jpg' : `photobooth.${meta.videoExt ?? 'mp4'}`
    headers.set('content-disposition', `attachment; filename="${name}"`)
  }

  let status = 200
  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined
  if (r) {
    const offset = r.offset ?? (r.suffix !== undefined ? obj.size - r.suffix : 0)
    const length = r.length ?? r.suffix ?? obj.size - offset
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`)
    headers.set('content-length', String(length))
    status = 206
  } else {
    headers.set('content-length', String(obj.size))
  }

  return new Response(obj.body, { status, headers })
}

const PAGE_STYLE = `
  *{box-sizing:border-box} body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#fdf2f8;color:#831843}
  main{max-width:480px;margin:0 auto;padding:20px;display:flex;flex-direction:column;gap:16px}
  h1{font-size:22px;margin:8px 0 0} p{margin:0;font-size:14px}
  img,video{width:100%;border-radius:12px;background:#000;display:block}
  a.btn{display:block;text-align:center;padding:14px;border-radius:999px;background:#ec4899;color:#fff;text-decoration:none;font-weight:600}
  a.alt{background:#fff;color:#be185d;border:1px solid #f472b6}
  .note{opacity:.7;font-size:13px}
`

function page(body: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Photobooth</title>
<style>${PAGE_STYLE}</style></head><body><main>${body}</main></body></html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-robots-tag': 'noindex',
    },
  })
}

async function handleSharePage(env: Env, id: string) {
  const meta = await loadMeta(env, id)
  if (meta === 'expired') {
    return page('<h1>This link has expired</h1><p>Photos are deleted automatically after 48 or 72 hours.</p>', 410)
  }
  if (meta === 'missing') {
    return page('<h1>Not found</h1><p>This link does not exist.</p>', 404)
  }

  const photo = `/api/file/${id}/photo`
  const video = `/api/file/${id}/video`
  const body = `
    <h1>📸 Your photobooth</h1>
    <p id="left" data-exp="${meta.expiresAt}"></p>
    <img src="${photo}" alt="Photo strip">
    <a class="btn" href="${photo}?dl=1" download>Download photo</a>
    <p class="note">iPhone: press and hold the photo, then tap Add to Photos.</p>
    ${
      meta.hasVideo
        ? `<video src="${video}" controls playsinline loop muted autoplay></video>
           <a class="btn alt" href="${video}?dl=1" download>Download video</a>`
        : ''
    }
    <p class="note">Files are deleted automatically when the timer ends.</p>
    <script>
      var el=document.getElementById('left'),exp=Number(el.dataset.exp);
      function t(){var m=Math.max(0,Math.floor((exp-Date.now())/60000)),h=Math.floor(m/60);
        el.textContent='Expires in '+h+'h '+(m%60)+'m';}
      t();setInterval(t,30000);
    </script>`
  return page(body)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/api/share') return handleUpload(request, env, url)

    let m = path.match(/^\/api\/file\/([A-Za-z0-9_-]{16})\/(photo|video)$/)
    if (m && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleFile(request, env, url, m[1], m[2] as 'photo' | 'video')
    }

    m = path.match(/^\/s\/([A-Za-z0-9_-]{16})$/)
    if (m) return handleSharePage(env, m[1])

    return new Response('Not found', { status: 404 })
  },

  // Runs every hour: deletes expired shares
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    let cursor: string | undefined
    do {
      const list = await env.BUCKET.list({ cursor, limit: 500, include: ['customMetadata'] })
      for (const obj of list.objects) {
        if (!obj.key.endsWith('/meta.json')) continue
        const exp = Number(obj.customMetadata?.expiresAt)
        if (exp && Date.now() > exp) await deleteShare(env, obj.key.split('/')[0])
      }
      cursor = list.truncated ? list.cursor : undefined
    } while (cursor)
  },
}