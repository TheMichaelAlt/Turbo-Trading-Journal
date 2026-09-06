// Rebuild the Windows icon from the same vector used by the app's favicon.
// PNG-backed ICO entries preserve crisp edges at Windows' different DPI scales.
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const source = await readFile(new URL('../public/turbo.svg', import.meta.url), 'utf8')
const sizes = [16, 24, 32, 48, 64, 128, 256]
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const pngs = []
  for (const size of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(`<html><style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${source}</html>`)
    pngs.push(await page.screenshot({ omitBackground: true }))
    await page.close()
  }
  const header = Buffer.alloc(6 + sizes.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16
    header[entry] = size === 256 ? 0 : size
    header[entry + 1] = size === 256 ? 0 : size
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(pngs[index].length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += pngs[index].length
  })
  await writeFile(new URL('../public/turbo.ico', import.meta.url), Buffer.concat([header, ...pngs]))
  await writeFile(new URL('../public/turbo.png', import.meta.url), pngs.at(-1))
  console.log('Created orange/teal turbo icons at 16–256px.')
} finally { await browser.close() }
