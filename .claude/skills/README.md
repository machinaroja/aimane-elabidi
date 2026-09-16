# Skills

## social-media-skills

14 social media skills vendored from
[blacktwist/social-media-skills](https://github.com/blacktwist/social-media-skills)
(MIT), upstream commit `4f85b07`.

Only each skill's `SKILL.md` was copied — the upstream `evals/` scaffolding,
marketplace manifest, and tooling docs were left out.

| Category | Skills |
| --- | --- |
| Foundation | `social-media-context-sms` |
| Strategy | `content-strategy-sms`, `content-calendar-sms`, `platform-strategy-sms` |
| Creation | `post-writer-sms`, `thread-writer-sms`, `carousel-writer-sms`, `caption-writer-sms`, `content-repurposer-sms`, `hook-writer-sms` |
| Analysis | `performance-analyzer-sms`, `audience-growth-tracker-sms`, `content-pattern-analyzer-sms`, `optimization-advisor-sms` |

Start with `social-media-context-sms` — it writes
`.agents/social-media-context-sms.md`, which the other skills read for brand
voice, audience, and content pillars.

The skills can publish and pull analytics through the BlackTwist MCP server
(https://blacktwist.app/mcp) when it is connected. Without it they run in
advisory mode: they draft content and give manual posting instructions.

### Updating

```sh
git clone --depth 1 https://github.com/blacktwist/social-media-skills.git /tmp/sms
for d in /tmp/sms/skills/*/; do
  n=$(basename "$d")
  mkdir -p ".claude/skills/$n" && cp "$d/SKILL.md" ".claude/skills/$n/SKILL.md"
done
```
