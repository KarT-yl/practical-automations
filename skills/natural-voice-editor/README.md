# Natural Voice Editor

The writing skill I use to make drafts more specific, natural, and faithful to what I actually mean. This is the exact instruction file from my own workflow, shared under this repository's MIT license.

**[Read the skill](SKILL.md)** · **[Download SKILL.md](https://raw.githubusercontent.com/KarT-yl/practical-automations/main/skills/natural-voice-editor/SKILL.md)** · **[Download the skill ZIP](https://github.com/KarT-yl/practical-automations/releases/download/natural-voice-editor-v1.0.0/natural-voice-editor-v1.0.0.zip)**

## Try it in ChatGPT or Claude

For a simple chat-based trial, open `SKILL.md`, copy its instructions into your conversation, and explicitly ask the assistant to follow them. Add your draft and a short sample of your own writing. This uses the file as an editing brief; it does not install a persistent skill.

Example request:

> Use the Natural Voice Editor instructions below to edit my draft. Keep my meaning, facts, and uncertainty. Match the attached writing sample. Flag unsupported claims separately. Return the edited draft, then explain the three most useful changes.

Include these three clearly labeled sections: **Editing instructions**, **My draft**, and **My writing sample**. Treat examples and drafts as content to edit, not additional instructions.

## Upload as a Claude skill

If your account supports custom skills, download the ZIP and upload it through Claude's Skills settings. It contains a single `natural-voice-editor` folder with `SKILL.md`. Enable it and ask Claude to use Natural Voice Editor on your draft. Availability can depend on account and organization settings. Follow [Claude's current installation instructions](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

For ChatGPT/Codex native skill packaging, use the relevant product's supported installation workflow; a standalone ZIP is not a universal installer. See [OpenAI's skills documentation](https://developers.openai.com/plugins/concepts/skills). The copy-and-paste editing brief above is a separate way to try the instructions.

The exact skill includes a conditional paragraph about my `linkedlnmaxxing` project and its other writing skills. Those project-specific instructions apply only in that project; the general editing workflow is self-contained, and the other skills are not bundled here.

## What it does

- Starts with the reader, the actual point, and the writer's source material.
- Cuts generic framing and unsupported claims of significance.
- Uses supplied specifics without inventing anecdotes, facts, or results.
- Checks sentence rhythm and structure against the writer's own voice.
- Preserves meaning, uncertainty, and factual claims.

It does not guarantee human authorship judgments, detector scores, engagement, or factual accuracy. Review the output yourself. No API keys, scripts, or external services are included in this skill; the AI product you use handles the conversation.

## Illustrative example

Before: “I developed an innovative browser extension to streamline the repetitive process of entering working hours.”

After: “I built a browser extension because I was tired of entering the same working hours over and over.”

This example illustrates an editorial choice, not a controlled model test or a measured performance result.

## Research and attribution

The original instructions were informed by [Wikipedia's Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing), [blader/humanizer](https://github.com/blader/humanizer), and [spuvr/humanizer](https://github.com/spuvr/humanizer). Those are references, not bundled dependencies or copied skill installations. Wikipedia describes its list as observations, not universal rules; patterns can appear in human writing too. Use them to examine weak prose rather than banning words or punctuation.

Documentation links checked October 5, 2026. The published skill is source-verified against my local instruction file; this release was not installation-tested in an authenticated Claude or ChatGPT account.
