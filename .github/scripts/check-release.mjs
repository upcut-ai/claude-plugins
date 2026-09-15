// Rules every published change must pass, whatever produced it. The release
// pipeline in Upcut's private repository checks the same things before it opens
// a pull request here; this is the second lock on the door.
//
// Each release channel is a branch holding one complete marketplace, which
// Claude Code adds as upcut-ai/claude-plugins#<branch>.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SEMVER, compareVersions } from './versions.mjs'

const PRODUCTION = 'https://upcut.ai/api/agent/mcp'
const CHANNELS = {
  main: { marketplace: 'upcut', plugin: 'upcut', endpoint: PRODUCTION, prerelease: 'forbidden' },
  beta: { marketplace: 'upcut-beta', plugin: 'upcut', endpoint: PRODUCTION, prerelease: 'required' },
  // Upcut's own team, against staging servers only Upcut can reach.
  internal: { marketplace: 'upcut-internal', plugin: 'upcut-staging', endpoint: 'https://staging.upcut.ai/api/agent/mcp', prerelease: 'allowed', staging: true },
}
// Published content arrives only in pull requests the release pipeline opens.
const PUBLISHER = 'upcut-plugin-publisher[bot]'
const VERSION_HEADER = 'x-upcut-plugin-version'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const failures = []
const readJson = path => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { failures.push(`${path}: missing or not valid JSON`); return null }
}
const published = git('ls-files', '.claude-plugin', 'plugins').split('\n').filter(Boolean)
// A pull request's base, or the branch a push landed on.
const base = process.env.GITHUB_BASE_REF
const branch = base || process.env.GITHUB_REF_NAME || git('rev-parse', '--abbrev-ref', 'HEAD')
const channel = CHANNELS[branch]
if (published.length && !channel) failures.push(`${branch} is not a release channel; publish to ${Object.keys(CHANNELS).join(', ')}`)

for (const file of published) {
  if (/(^|\/)hooks\//.test(file) || file.endsWith('update-skill.mjs')) failures.push(`${file}: hooks and the local skill updater are not published`)
  const text = readFileSync(file, 'utf8')
  if (/staging\.upcut\.ai/i.test(text) && !channel?.staging) failures.push(`${file}: references the staging endpoint`)
  if (/upcut-admin/i.test(text)) failures.push(`${file}: mentions private admin content`)
}

const plugins = existsSync('plugins') ? readdirSync('plugins') : []
if (channel && published.length) {
  const marketplace = readJson('.claude-plugin/marketplace.json')
  const entries = marketplace?.plugins ?? []
  if (marketplace && marketplace.name !== channel.marketplace) failures.push(`.claude-plugin/marketplace.json: the ${branch} branch is the "${channel.marketplace}" marketplace, not "${marketplace.name}"`)
  const listed = entries.map(entry => `${entry.name} from ${entry.source}`).join(', ')
  if (listed !== `${channel.plugin} from ./plugins/${channel.plugin}`) failures.push(`.claude-plugin/marketplace.json: must list only ${channel.plugin} from ./plugins/${channel.plugin}, found ${listed || 'nothing'}`)
  if (entries.some(entry => 'version' in entry)) failures.push('.claude-plugin/marketplace.json: declare the version once, in plugin.json')
  if (plugins.join(', ') !== channel.plugin) failures.push(`plugins/: must hold only ${channel.plugin}, found ${plugins.join(', ') || 'nothing'}`)
}

for (const name of plugins) {
  const manifest = join('plugins', name, '.claude-plugin', 'plugin.json')
  if (!existsSync(manifest)) { failures.push(`${manifest}: missing`); continue }
  const { name: declared, version, hooks } = readJson(manifest) ?? {}
  if (declared !== name) failures.push(`${manifest}: names the plugin ${declared}, not ${name}`)
  if (!SEMVER.test(version ?? '')) { failures.push(`${manifest}: version must be semantic, found ${version}`); continue }
  if (hooks) failures.push(`${manifest}: declares hooks`)
  const prerelease = version.includes('-')
  if (channel?.prerelease === 'forbidden' && prerelease) failures.push(`${manifest}: the ${branch} channel publishes release versions only, not ${version}`)
  if (channel?.prerelease === 'required' && !prerelease) failures.push(`${manifest}: the ${branch} channel needs a pre-release version, so it never shares one with main; found ${version}`)
  if (channel) {
    const servers = Object.entries(readJson(join('plugins', name, '.mcp.json'))?.mcpServers ?? {})
    if (!servers.length) failures.push(`plugins/${name}/.mcp.json: declares no MCP server`)
    for (const [key, server] of servers) {
      const where = `plugins/${name}/.mcp.json ${key}`
      if (server.url !== channel.endpoint) failures.push(`${where}: the ${branch} channel connects to ${channel.endpoint}, not ${server.url}`)
      const headers = server.headers ?? {}
      if (Object.keys(headers).some(header => header.toLowerCase() !== VERSION_HEADER) || headers[VERSION_HEADER] !== version) failures.push(`${where}: must send only ${VERSION_HEADER}: ${version}`)
      if (server.oauth && ('clientSecret' in server.oauth || 'client_secret' in server.oauth)) failures.push(`${where}: carries an OAuth client secret`)
    }
  }
  // Hosts update an installed plugin only when its version changes, and what
  // they do with a lower one is undocumented, so every content change needs a
  // higher version.
  if (base && git('diff', '--name-only', `origin/${base}...HEAD`, '--', '.claude-plugin', join('plugins', name))) {
    let previous = null
    try { previous = JSON.parse(git('show', `origin/${base}:${manifest}`)).version } catch { /* a new plugin has no previous version */ }
    if (previous === version) failures.push(`${name}: content changed but version is still ${version}`)
    else if (previous && SEMVER.test(previous) && compareVersions(version, previous) < 0) failures.push(`${name}: ${version} would move the ${branch} channel back from ${previous}; roll forward with a higher version`)
  }
}

const author = process.env.PR_AUTHOR
if (base && author && author !== PUBLISHER) {
  const touched = git('diff', '--name-only', `origin/${base}...HEAD`, '--', '.claude-plugin', 'plugins').split('\n').filter(Boolean)
  if (touched.length) failures.push(`${touched.join(', ')}: published content comes only from Upcut's release pipeline (${PUBLISHER}), not ${author}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Published content checks passed for ${published.length} files${channel ? ` on the ${branch} channel` : ''}.`)
