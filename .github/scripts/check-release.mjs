// Rules every published change must pass, whatever produced it. The release
// pipeline in Upcut's private repository checks the same things before it opens
// a pull request here; this is the second lock on the door.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const failures = []
const published = git('ls-files', '.claude-plugin', 'plugins').split('\n').filter(Boolean)

for (const file of published) {
  if (/(^|\/)hooks\//.test(file) || file.endsWith('update-skill.mjs')) failures.push(`${file}: hooks and the local skill updater are not published`)
  const text = readFileSync(file, 'utf8')
  if (/staging\.upcut\.ai/i.test(text)) failures.push(`${file}: references the staging endpoint`)
  if (/upcut-admin/i.test(text)) failures.push(`${file}: mentions private admin content`)
}

const base = process.env.GITHUB_BASE_REF
for (const name of existsSync('plugins') ? readdirSync('plugins') : []) {
  const manifest = join('plugins', name, '.claude-plugin', 'plugin.json')
  if (!existsSync(manifest)) { failures.push(`${manifest}: missing`); continue }
  const { version, hooks } = JSON.parse(readFileSync(manifest, 'utf8'))
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? '')) failures.push(`${manifest}: version must be semantic, found ${version}`)
  if (hooks) failures.push(`${manifest}: declares hooks`)
  // Hosts update an installed plugin only when this string changes, so a
  // content change under the same version would never reach anyone.
  if (base && git('diff', '--name-only', `origin/${base}...HEAD`, '--', join('plugins', name))) {
    let previous = null
    try { previous = JSON.parse(git('show', `origin/${base}:${manifest}`)).version } catch { /* a new plugin has no previous version */ }
    if (previous === version) failures.push(`${name}: content changed but version is still ${version}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Published content checks passed for ${published.length} files.`)
