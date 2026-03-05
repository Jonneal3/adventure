#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Replicate = require('replicate')

async function main() {
  const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN
  if (!apiKey) {
    console.error('Missing REPLICATE_API_KEY. Example:')
    console.error('  export REPLICATE_API_KEY=xxxxxxxx; node scripts/generate-homepage-af-nano-banana.js')
    process.exit(1)
  }

  const outRoot = path.resolve(process.cwd(), 'public', 'homepage')
  const model = 'google/nano-banana' // https://replicate.com/google/nano-banana

  /** Prompts tailored per service to preserve composition while enhancing scene */
  /** @type {Record<string, string>} */
  const prompts = {
    landscaping: 'Enhance this exact yard composition into a professionally landscaped backyard with stone pathways, native plants, clean edging, and natural lighting. Preserve camera angle, horizon line, and major object placement (fence, patio). Photorealistic, high detail.',
    furniture: 'Transform this exact living room composition into a styled modern space with a sectional sofa, cohesive decor, natural light, and balanced color grading. Preserve camera angle, window positions, main furniture layout and perspective. Photorealistic.',
    fashion: 'Restyle this person in the exact pose and camera angle with a coordinated outfit from an online boutique. Preserve face, body pose, skin tone, hair; update clothing style, fabric and colors. Studio-lighting, photorealistic.',
    interior: 'Redesign this exact room into a contemporary interior with warm accents and improved lighting. Preserve camera angle, walls, windows, doors, and furniture footprint; update finishes and decor. Photorealistic, magazine quality.',
    bathroom: 'Renovate this exact bathroom into a modern spa-like space. Preserve walls, window, vanity, shower/tub placement, and camera angle; update tile, fixtures, lighting. Photorealistic, high detail.',
  }

  const replicate = new Replicate({ auth: apiKey })

  async function ensureDir(dir) { await fs.promises.mkdir(dir, { recursive: true }) }
  async function downloadToFile(url, filepath) {
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    await fs.promises.writeFile(filepath, res.data)
  }

  // Some models accept base64/data URLs; attempt an upload via Replicate Files API first.
  async function toModelImageInput(localPath) {
    try {
      if (replicate.files && typeof replicate.files.upload === 'function') {
        const stream = fs.createReadStream(localPath)
        const uploaded = await replicate.files.upload(stream)
        return uploaded
      }
    } catch {}
    // Fallback: data URL
    const buf = await fs.promises.readFile(localPath)
    const b64 = buf.toString('base64')
    const ext = path.extname(localPath).toLowerCase()
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png'
    return `data:${mime};base64,${b64}`
  }

  const filters = process.argv.slice(2).map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
  const entries = Object.keys(prompts).filter(slug => filters.length === 0 || filters.includes(slug))

  for (const slug of entries) {
    const dir = path.join(outRoot, slug)
    await ensureDir(dir)
    const beforePath = path.join(dir, 'before.png')
    if (!fs.existsSync(beforePath)) {
      console.warn(`Skip ${slug}: missing ${path.relative(process.cwd(), beforePath)}`)
      continue
    }
    const prompt = prompts[slug]
    console.log(`Generating AFTER with nano-banana for ${slug}`)
    try {
      const imageInput = await toModelImageInput(beforePath)
      // Common fields: input_image or image, prompt, and optional quality/strength
      const input = {
        // Ensure the model receives the seed image (img2img)
        input_image: imageInput,
        image: imageInput,
        // Explicit edit mode + preservation hints (ignored gracefully if unsupported)
        mode: 'edit',
        edit_type: 'restyle',
        preserve_background: true,
        background_preservation: 'high',
        subject_preservation: 'high',
        keep_layout: true,
        keep_camera_angle: true,
        strength: 0.35,
        prompt,
        // Prefer larger results if supported by the model
        image_dimensions: '1536x1152',
        output_quality: 92,
      }
      let output = await replicate.run(model, { input })
      if (!output || (Array.isArray(output) && output.length === 0)) {
        // Some nano-banana endpoints return object with image url(s)
        // As a fallback, attempt predictions.create
        const prediction = await replicate.predictions.create({ model, input })
        // Poll until done
        while (prediction.status === 'starting' || prediction.status === 'processing') {
          await new Promise(r => setTimeout(r, 1200))
          const p2 = await replicate.predictions.get(prediction.id)
          Object.assign(prediction, p2)
        }
        output = prediction.output
      }
      const urls = Array.isArray(output) ? output : [output]
      if (!urls || urls.length === 0) throw new Error('No output URLs')
      const afterPath = path.join(dir, 'after.png')
      await downloadToFile(urls[0], afterPath)
      console.log('  saved →', path.relative(process.cwd(), afterPath))
    } catch (e) {
      console.error(`  error for ${slug}:`, e?.message || e)
    }
  }

  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })


