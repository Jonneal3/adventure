#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const axios = require('axios')
const Replicate = require('replicate')

async function main() {
  const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN
  if (!apiKey) {
    console.error('Missing REPLICATE_API_KEY. Export it and re-run. Example:')
    console.error('  export REPLICATE_API_KEY=xxxxxxxx; npm run generate:homepage')
    process.exit(1)
  }

  const outRoot = path.resolve(process.cwd(), 'public', 'homepage')
  const model = 'black-forest-labs/flux-1.1-pro'
  const width = 768
  const height = 576
  const guidance_scale = 7.5
  const num_inference_steps = 20
  const negative_prompt = 'text, watermark, logo, artifacts, deformed, blurry'

  // Demo scenarios (align with HomepageDemo.tsx)
  /** @type {Record<string, { before: string, after: string }>} */
  const scenarios = {
    landscaping: {
      before: 'Unstyled backyard with patchy grass and scattered tools, dull lighting, realistic photo',
      after: 'Professional landscaping photo of a modern backyard with stone pathways, native plants, natural lighting, high detail'
    },
    furniture: {
      before: 'Empty living room with mismatched furniture and poor lighting, casual snapshot',
      after: 'Lifestyle photo of modern living room with sectional sofa, neutral palette, natural light, editorial product shot'
    },
    fashion: {
      before: 'Wrinkled clothing laid out on a bed, uneven lighting, casual phone photo',
      after: 'Studio fashion photo of summer outfit on mannequin, softbox lighting, clean backdrop, editorial lookbook'
    },
    interior: {
      before: 'Cluttered living room with dated decor, uneven indoor lighting, casual home photo',
      after: 'Contemporary living room interior design with warm accents, natural light, magazine quality photo'
    },
    bathroom: {
      before: 'Old bathroom with worn tiles and poor lighting, snapshot, realistic photo',
      after: 'Modern spa-like bathroom with large format tiles and walk-in shower, architectural lighting, high quality photo'
    },
  }

  const replicate = new Replicate({ auth: apiKey })

  async function ensureDir(dir) { await fs.promises.mkdir(dir, { recursive: true }) }
  async function downloadToFile(url, filepath) {
    const res = await axios.get(url, { responseType: 'arraybuffer' })
    await fs.promises.writeFile(filepath, res.data)
  }

  async function generate(prompt) {
    const input = { prompt, width, height, num_outputs: 1, guidance_scale, num_inference_steps, negative_prompt }
    const output = await replicate.run(model, { input })
    if (!output) return []
    return Array.isArray(output) ? output : [output]
  }

  const filters = process.argv.slice(2).map(s => String(s || '').trim().toLowerCase()).filter(Boolean)
  const entries = Object.entries(scenarios).filter(([slug]) => filters.length === 0 || filters.includes(slug))

  for (const [slug, { before, after }] of entries) {
    const outDir = path.join(outRoot, slug)
    await ensureDir(outDir)
    console.log(`Generating homepage images for ${slug} → ${outDir}`)
    try {
      console.log('  • BEFORE:', before)
      const b = await generate(before)
      if (b.length) {
        const bf = path.join(outDir, 'before.png')
        await downloadToFile(b[0], bf)
        console.log('    saved →', path.relative(process.cwd(), bf))
      }
    } catch (e) { console.error('    before error:', e?.message || e) }
    try {
      console.log('  • AFTER:', after)
      const a = await generate(after)
      if (a.length) {
        const af = path.join(outDir, 'after.png')
        await downloadToFile(a[0], af)
        console.log('    saved →', path.relative(process.cwd(), af))
      }
    } catch (e) { console.error('    after error:', e?.message || e) }
  }

  console.log('Done.')
}

main().catch((e) => { console.error(e); process.exit(1) })


