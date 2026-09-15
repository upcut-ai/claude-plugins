# Upcut for Claude

The Claude plugin for [Upcut](https://upcut.ai), the browser-based CNC CAD/CAM
app. It connects Claude to your Upcut workspaces so Claude can create and edit
components while you watch them change in the Upcut editor.

> [!NOTE]
> **Not yet released.** This marketplace doesn't list a plugin yet. The steps
> below work from the first release.

## What the plugin contains

- A connection to Upcut's hosted MCP server. You sign in to Upcut to approve it,
  and you choose its workspaces and permissions in Upcut → Settings → Agents.
- The `upcut-workspace` skill, which teaches Claude how to work in Upcut.

It has no hooks and runs no code on your computer.

## Install

### Claude Code

```bash
claude plugin marketplace add upcut-ai/claude-plugins
claude plugin install upcut@upcut
```

Then run `/mcp` and sign in to Upcut when asked.

### Claude apps (web, Desktop and Cowork)

In Claude's plugin settings, choose **Add from a repository**, enter
`upcut-ai/claude-plugins`, and install **upcut**. Plugins in the Claude apps
need a paid plan.

### Beta

Beta releases bring the next version early, for testing in Claude Code. Beta
and stable are the same plugin, so install one or the other. If you have the
stable plugin, uninstall it first:

```bash
claude plugin uninstall upcut@upcut
claude plugin marketplace add upcut-ai/claude-plugins#beta
claude plugin install upcut@upcut-beta
```

Beta versions are always pre-releases, such as `1.2.0-beta.1`, so they never
match a stable version. To return to stable, uninstall `upcut@upcut-beta` and
install `upcut@upcut`.

## Updates

Claude Code doesn't update third-party plugins automatically unless you turn it
on. Run `/plugin`, open **Marketplaces**, choose **upcut** (or **upcut-beta**),
and select **Enable auto-update**. To update by hand:

```bash
claude plugin marketplace update upcut
claude plugin update upcut@upcut
```

Restart Claude Code, or run `/reload-plugins`, to load the new version.

## Uninstall

```bash
claude plugin uninstall upcut@upcut
```

Then disable the agent in Upcut → Settings → Agents.

## About this repository

Each release channel is a branch. `main` is the stable `upcut` marketplace and
`beta` is `upcut-beta`. `internal` carries a build for Upcut's own staging
servers and isn't for customers.

Upcut's release pipeline generates everything under `.claude-plugin/` and
`plugins/`. Changes arrive only as reviewed pull requests from that pipeline, so
outside pull requests aren't merged.

Every release is tagged `<marketplace>/v<version>`, such as `upcut/v1.2.0`, and
tags never move. A bad release is replaced by a higher version, never by moving
a channel back to an older one.

To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
