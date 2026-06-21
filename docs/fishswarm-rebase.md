# FishSwarm Fish Swarm Rebase

Date: 2026-06-20

FishSwarm has been rebased onto Fish Swarm as the desktop-agent foundation.

## Source

- Upstream: https://github.com/FishSwarm/fishswarm
- Imported commit: `8e60460`
- License: MIT, preserved in `LICENSE`

## Backup

The previous FishSwarm project tree was backed up before replacement:

`D:\myProject\FishSwarm-backups\FishSwarm-pre-fishswarm-20260620-194904`

The backup includes the prior `.git` directory, source files, local artifacts, and the cloned `external-references/fishswarm` copy that was used as the source reference.

## Migration Strategy

- Kept the existing FishSwarm repository `.git` directory so history remains attached to this workspace.
- Replaced the old application source with Fish Swarm's Electron, React, MCP, skills, sandbox, memory, session, and remote-control foundation.
- Preserved `.fishswarm` because local log files were active during the migration.
- Updated the first layer of application identity to FishSwarm: package name, app id, product name, title, startup/error text, and visible UI labels.

## Next Work

- Port FishSwarm-specific multi-agent concepts into `src/main/claude`, `src/main/session`, and `src/renderer/components`.
- Decide whether to keep Fish Swarm's app-data namespace compatibility or fully migrate local storage keys to FishSwarm.
- Replace icons and public branding assets with FishSwarm visuals.
- Review packaging and updater settings before publishing installers.
