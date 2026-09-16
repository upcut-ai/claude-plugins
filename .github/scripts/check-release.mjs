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
// The only header a plugin sends: its generation, which rises only to withdraw releases. It is
// not the version because Claude Code keys a server's sign-in by its URL and headers, so a
// header that changed every release would sign everyone out on every update.
const GENERATION_HEADER = 'x-upcut-plugin-generation'
const GENERATION = /^[1-9]\d{0,3}$/
// The internal channel's host is protected, so its plugin sends one more header. It may only
// name an environment variable, which the client expands: a value here would be a credential
// published to this repository, which is public.
const PLACEHOLDER = /^\$\{[A-Z][A-Z0-9_]{2,63}\}$/

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
  let generation = null
  if (channel) {
    const servers = Object.entries(readJson(join('plugins', name, '.mcp.json'))?.mcpServers ?? {})
    if (!servers.length) failures.push(`plugins/${name}/.mcp.json: declares no MCP server`)
    for (const [key, server] of servers) {
      const where = `plugins/${name}/.mcp.json ${key}`
      if (server.url !== channel.endpoint) failures.push(`${where}: the ${branch} channel connects to ${channel.endpoint}, not ${server.url}`)
      const headers = server.headers ?? {}
      if (!GENERATION.test(headers[GENERATION_HEADER] ?? '')) failures.push(`${where}: must send ${GENERATION_HEADER}, a whole number from 1 to 9999`)
      else generation = Number(headers[GENERATION_HEADER])
      for (const [header, value] of Object.entries(headers)) {
        if (header.toLowerCase() === GENERATION_HEADER) continue
        if (!channel.staging) failures.push(`${where}: the ${branch} channel sends ${GENERATION_HEADER} and nothing else, not ${header}`)
        else if (!PLACEHOLDER.test(value)) failures.push(`${where}: ${header} must name an environment variable, such as \${UPCUT_STAGING_BYPASS}, not carry its value`)
      }
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
    let before = null
    try { before = Number(Object.values(JSON.parse(git('show', `origin/${base}:plugins/${name}/.mcp.json`)).mcpServers ?? {})[0]?.headers?.[GENERATION_HEADER]) || null } catch { /* nothing published yet */ }
    if (before && generation && generation < before) failures.push(`${name}: the plugin generation would go down from ${before} to ${generation}; it only rises, to withdraw releases`)
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
