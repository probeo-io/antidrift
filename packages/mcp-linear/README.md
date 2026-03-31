# @antidrift/mcp-linear

Linear connector for [antidrift](https://antidrift.io) — issues, projects, cycles, teams, and comments.

## Install

```bash
npx @antidrift/cli connect linear
```

## Tools (12)

### Issues
- `linear_search_issues` — filter by team, assignee, status, priority
- `linear_get_issue` — full details with comments
- `linear_create_issue` — title, team, description, priority, assignee
- `linear_update_issue` — modify any field
- `linear_change_status` — move between states (Todo → In Progress → Done)
- `linear_assign_issue` — assign or reassign

### Projects
- `linear_list_projects` — all projects with status and progress
- `linear_get_project` — details with linked issues

### Cycles
- `linear_current_cycle` — active sprint for a team with all issues

### Teams
- `linear_list_teams` — all teams in your workspace

### Comments
- `linear_add_comment` — add a comment to an issue

### Search
- `linear_search` — full-text search across all issues

## Auth

Personal API key. Create one at Linear → Settings → Account → API.

## License

MIT
