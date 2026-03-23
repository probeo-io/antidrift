# Company Brain

## Onboarding
If someone says **"onboard me"**, run `/onboard`.

## Skills
Skills are loaded automatically based on what you ask. Each lives in `.claude/skills/`.

| Skill | Slash Command | Triggers |
|---|---|---|
| Onboarding | `/onboard` | "onboard me", "I'm new" |
| Customer | `/customer [name]` | "tell me about [customer]", "customer status" |
| Marketing | `/marketing` | "what's our positioning?", "what campaigns are running?" |
| Sales | `/sales` | "what's our ICP?", "what's in the pipeline?" |
| Finance | `/finance` | "what's our cost structure?", "revenue?" |
| Decisions | `/decisions` | "why did we do X?", "why did we kill Y?" |
| Deploy | `/deploy` | "how do I deploy?", "new machine setup" |
| Refresh | `/refresh` | "refresh the brain", "pull latest", "sync brain" |
| Push | `/push` | "push the brain", "save to remote", "push changes" |

## What This Repo Is
This is your organizational brain. It exists to:
- Give Claude Code full context on any machine, instantly
- Onboard new employees or contractors without hand-holding
- Serve as the decision-making reference for the team

Clone this repo. Read this file. You're oriented.

## Company
- **Name:** _[Your company name]_
- **What you do:** _[One paragraph]_
- **Stage:** _[Pre-revenue / Early revenue / Growth / etc.]_
- **Team:** _[Solo founder / Small team / etc.]_

## How to Navigate This Repo
Each subdirectory has its own `CLAUDE.md` with domain-specific context. Claude Code loads these dynamically as you work in each area.

| Directory | What's In It |
|---|---|
| `product/` | What you're building, roadmap, decisions |
| `customers/` | Account context per customer |
| `marketing/` | Positioning, ICPs, campaigns, brand voice |
| `sales/` | CRM, pipeline, outbound strategy |
| `engineering/` | Architecture, coding standards, tech stacks |
| `devops/` | Infrastructure, deployments |
| `ops/` | Dev setup, recurring workflows |
| `finance/` | Revenue, expenses, structure |
| `projects.md` | All active projects and tools |
| `scratch/` | Gitignored. Local notes, machine-specific stuff |

## Active Priorities
> Keep this section updated. This is the first thing to read when resuming work.

- [ ] _[Add your current priorities]_

## Stack Overview
See `projects.md` for full detail.

## Conventions
- Decisions go in `product/decisions/` as ADRs
- Customer work goes in `customers/[name]/`
- When something is deprecated or dead, mark it clearly — don't delete context
