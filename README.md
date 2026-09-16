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

### Organizations

On a Team or Enterprise plan, an owner can install Upcut for everyone:

1. Open **Organization settings → Plugins**, choose **Add plugins**, pick
   **GitHub** and enter `upcut-ai/claude-plugins`.
2. Set Upcut to **Required** to install it for every member with no option to
   remove it. **Installed by default** and **Available for install** leave
   the choice to members.

The organization's copy syncs when a release merges into this repository, and
**Update** on the marketplace syncs it by hand. It reaches web chat, the Desktop
app's chat and Cowork, but not Claude Code. Changes take effect in each member's
next session.

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
and select **Enable auto-update**. Claude Code then checks for updates within
ten minutes of each session starting. To update by hand:

```bash
claude plugin marketplace update upcut
claude plugin update upcut@upcut
```

For beta, use `upcut-beta` and `upcut@upcut-beta` instead.

Then start a new Claude Code session. `/reload-plugins` reloads the skill, but
the connection to Upcut, which tells Upcut which version you run, reconnects
only in a new session. In the Claude apps, update Upcut in the plugin settings
and start a new chat.

When Upcut needs a newer plugin, Claude tells you and gives these steps. A
withdrawn release can still read your components, but it can't change them
until you update.

## Uninstall

```bash
claude plugin uninstall upcut@upcut
```

Then disable the agent in Upcut → Settings → Agents.

## About this repository

Each release channel is a branch. `main` is the stable `upcut` marketplace and
`beta` is `upcut-beta`. `internal` carries a build for Upcut's own staging
servers and isn't for customers: those servers are protected, so that build only
works for people who set `UPCUT_STAGING_BYPASS` in their environment.

Upcut's release pipeline generates everything under `.claude-plugin/` and
`plugins/`. Changes arrive only as reviewed pull requests from that pipeline, so
outside pull requests aren't merged.

Every release is tagged `<marketplace>/v<version>`, such as `upcut/v1.2.0`, and
tags never move. A bad release is replaced by a higher version, never by moving
a channel back to an older one.

To report a security problem, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
