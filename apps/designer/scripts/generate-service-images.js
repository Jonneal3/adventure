#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Replicate = require('replicate')

async function main() {
  const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN
  if (!apiKey) {
    console.error('Missing REPLICATE_API_KEY. Export it and re-run. Example:')
    console.error('  export REPLICATE_API_KEY=xxxxxxxx; npm run generate:services')
    process.exit(1)
  }

  const outRoot = path.resolve(process.cwd(), 'public', 'services')
  const model = 'black-forest-labs/flux-1.1-pro'
  const width = 768
  const height = 576
  const guidance_scale = 7.5
  const num_inference_steps = 20
  const negative_prompt = 'text, watermark, logo, artifacts, deformed, blurry'

  /** @type {Record<string, string[]>} */
  const services = {
    landscaping: [
      'Professional landscaping photo of a modern backyard with stone pathways, native plants, natural lighting, high detail',
      'Front yard redesign with garden beds, pathway lighting, and trimmed hedges, editorial outdoor photo',
      'Backyard patio with pergola, pavers and planters, golden hour photography'
    ],
    furniture: [
      'Lifestyle photo of modern living room with sectional sofa, neutral palette, natural light, editorial product shot',
      'Dining room set with wooden table and chairs, clean Scandinavian design, catalog style photo',
      'Bedroom interior with upholstered bed and side tables, soft daylight, product showcase photo'
    ],
    fashion: [
      'Studio fashion photo of summer outfit on mannequin, softbox lighting, clean backdrop, editorial lookbook',
      'Flat lay fashion photo of coordinated outfit with accessories, overhead lighting, minimal background',
      'Streetwear look portrait (no face), cropped composition focusing on outfit details, natural light'
    ],
    interior: [
      'Contemporary living room interior design with warm accents, natural light, magazine quality photo',
      'Modern kitchen interior with island, pendant lights and stools, architectural photography',
      'Minimalist home office interior with desk and shelves, soft daylight, interior design photo'
    ],
    bathroom: [
      'Modern spa-like bathroom with large format tiles and walk-in shower, architectural lighting, high quality photo',
      'Bathroom vanity with mirror and sconces, styled countertop, editorial interior photo',
      'Renovated bathroom with freestanding tub and window light, clean styling, magazine photo'
    ],
  }

  const replicate = new Replicate({ auth: apiKey })

  async function ensureDir(dir) {
    await fs.promises.mkdir(dir, { recursive: true })
  }

  async function downloadToFile(url, filepath) {
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    await fs.promises.writeFile(filepath, res.data)
  }

  async function generateOne(prompt) {
    const input = {
      prompt,
      width,
      height,
      num_outputs: 1,
      guidance_scale,
      num_inference_steps,
      negative_prompt,
    }
    // replicate.run returns output directly for many models
    const output = await replicate.run(model, { input })
    if (!output) return []
    return Array.isArray(output) ? output : [output]
  }

  const filters = process.argv.slice(2).map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
  const entries = Object.entries(services).filter(([slug]) => {
    if (filters.length === 0) return true
    return filters.includes(slug)
  })

  for (const [slug, prompts] of entries) {
    const outDir = path.join(outRoot, slug)
    await ensureDir(outDir)
    console.log(`Generating for ${slug} → ${outDir}`)
    let idx = 1
    for (const prompt of prompts) {
      try {
        console.log(`  • ${prompt}`)
        const urls = await generateOne(prompt)
        if (urls.length === 0) {
          console.warn('    (no output)')
          continue
        }
        const file = path.join(outDir, `${slug}${idx}.png`)
        await downloadToFile(urls[0], file)
        console.log(`    saved → ${path.relative(process.cwd(), file)}`)
        idx += 1
      } catch (err) {
        console.error(`    error: ${err?.message || err}`)
      }
    }
  }

  // Build manifest.json from actual files present
  const manifest = {}
  const slugs = await fs.promises.readdir(outRoot, { withFileTypes: true })
  for (const d of slugs) {
    if (!d.isDirectory()) continue
    const dir = path.join(outRoot, d.name)
    const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.png')).sort()
    manifest[d.name] = files.map(f => `/services/${d.name}/${f}`)
  }
  const manifestPath = path.join(outRoot, 'manifest.json')
  await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(`Wrote manifest → ${path.relative(process.cwd(), manifestPath)}`)
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


