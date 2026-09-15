// Tags the release a channel branch now holds as <marketplace>/v<version>.
// Tags never move, so a version that is already tagged must still hold exactly
// the tagged content: any change needs a new, higher version.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { compareVersions } from './versions.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const fail = message => { console.error(message); process.exit(1) }

if (!existsSync('.claude-plugin/marketplace.json')) {
  console.log('This branch holds no marketplace yet; nothing to tag.')
  process.exit(0)
}
const { name: marketplace } = JSON.parse(readFileSync('.claude-plugin/marketplace.json', 'utf8'))
const plugins = readdirSync('plugins')
if (plugins.length !== 1) fail(`Expected one plugin, found: ${plugins.join(', ') || 'none'}`)
const { version } = JSON.parse(readFileSync(join('plugins', plugins[0], '.claude-plugin', 'plugin.json'), 'utf8'))
const tag = `${marketplace}/v${version}`
const head = git('rev-parse', 'HEAD')
const tagged = git('tag', '--list', `${marketplace}/v*`).split('\n').filter(Boolean)

if (tagged.includes(tag)) {
  // The same release again, or a change outside the published content such as the README.
  if (git('diff', '--name-only', `refs/tags/${tag}`, head, '--', '.claude-plugin', 'plugins')) {
    fail(`${tag} already holds different content. Publish the change under a higher version.`)
  }
  console.log(`${tag} already tags this content.`)
  process.exit(0)
}

const newest = tagged.map(name => name.slice(marketplace.length + 2)).sort(compareVersions).at(-1)
if (newest && compareVersions(version, newest) <= 0) fail(`${version} does not follow the published ${newest}. Roll forward with a higher version.`)
git('tag', tag, head)
git('push', 'origin', `refs/tags/${tag}`)
console.log(`Tagged ${head.slice(0, 7)} as ${tag}.`)
