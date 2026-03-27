# @antidrift/skills

Community skill registry for antidrift brains. Works with Claude Code, Codex, Cursor, and Antigravity.

## Browse available skills

```bash
antidrift skills list
```

## Install by pack

```bash
antidrift skills add essentials         # decision, recap, write, prep, followup, status, search
antidrift skills add engineering        # review, spec, changelog, standards, tps
antidrift skills add customer-research  # icp, voc, twins
antidrift skills add legal              # legal document generator
antidrift skills add --all              # everything
```

## Install individual skills

```bash
antidrift skills add write recap icp
```

## Remove a skill

```bash
antidrift skills remove <name>
```

## Publish your own

Built a useful skill? Share it with the community:

```
/publish <skill-name>
```

This opens a PR to the [community registry](https://github.com/probeo-io/antidrift-skills).

## Learn more

[antidrift.io](https://antidrift.io)
