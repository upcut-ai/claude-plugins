// Semantic-version rules shared by the release checks. A published version has
// no build metadata, so the pattern refuses it rather than ignoring it.
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/

/** Precedence under semver.org §11: negative when a comes first, positive when b does. */
export function compareVersions(a, b) {
  const parse = version => {
    const [core, pre] = version.split(/-(.*)/)
    return { core: core.split('.').map(Number), pre: pre === undefined ? [] : pre.split('.') }
  }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i]
  // A release follows every pre-release of the same version.
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i]
    if (p === q) continue
    if (p === undefined) return -1
    if (q === undefined) return 1
    const pNumeric = /^\d+$/.test(p), qNumeric = /^\d+$/.test(q)
    if (pNumeric && qNumeric) return Number(p) - Number(q)
    if (pNumeric !== qNumeric) return pNumeric ? -1 : 1
    return p < q ? -1 : 1
  }
  return 0
}
