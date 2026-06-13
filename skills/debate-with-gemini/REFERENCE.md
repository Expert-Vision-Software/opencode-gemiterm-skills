# Debate with Gemini — Reference

Subagent prompt template, tactical patterns, and report format for the `debate-with-gemini` skill.

> **Runtime note:** GemiTerm is a Bun-native CLI. Replace every `gemiterm` invocation with `bunx gemiterm` if the tool is not globally installed. See execution-loop details below.

---

## Subagent Prompt Template

Copy this template when spawning the `<SUBAGENT_TYPE>` subagent. Fill all `{{...}}` slots.

> Replace `<SUBAGENT_TYPE>` with the subagent type defined in your `opencode.json` (default: `general`).

```
You are arguing {{AGENT_STANCE}} the following topic: "{{TOPIC}}"

## Conversation
- Gemini chat_id: "{{GEMINI_CHAT_ID}}"
- Your stance: "{{AGENT_STANCE}}"
- Gemini's stance: "{{GEMINI_STANCE}}"
- Turn limit: {{TURN_LIMIT}}

## Context
{{BG_CONTEXT_SUMMARY}}

## Your Opening Argument
{{OPENING_ARGUMENT}}

## Execution Loop
For each turn:
1. Send your message:
   gemiterm continue "{{GEMINI_CHAT_ID}}" "your message here"

   If gemiterm is not globally installed, use:
   bunx gemiterm continue "{{GEMINI_CHAT_ID}}" "your message here"

   For an unusually long turn, write it to a file and use `--prompt-file`/`-f`:
   gemiterm continue "{{GEMINI_CHAT_ID}}" -f ./turn.md
   (positional messages that exceed the ~2048-char limit auto-spill to a temp file anyway)

   Wait for Gemini's response written to the console.
2. Analyze the response — concessions? New arguments? Weaknesses?
3. Craft next response using Tactical Patterns below
4. Repeat until turn limit or stop condition

Prefer `gemiterm continue` (or `bunx gemiterm continue`) because it returns Gemini's last response inline and avoids an extra round-trip.

Use `gemiterm fetch "{{GEMINI_CHAT_ID}}" --format json` (or `bunx gemiterm fetch ...`) ONLY if console output has parsing issues or times out.

## Stopping Criteria
- {{TURN_LIMIT}} turns completed
- Gemini explicitly concedes the core question
- Gemini repeats the same argument twice (declare convergence, summarize)
- New factual information emerges that changes the calculus (return to user with the info)

## Tactical Patterns

| Pattern | When to Use | How It Works |
|---------|-------------|-------------|
| **Concede-and-Counter** | Opponent has a valid minor point | Concede the minor point explicitly (builds credibility), then counter-attack on the main argument with stronger evidence |
| **Force Concrete Example** | Opponent argues hypothetically | Demand production evidence: "Do you have a concrete example where X caused Y?" If they can't produce one, their argument is hypothetical |
| **Decision Matrix** | Debate going in circles | Force a comparison table on specific dimensions: "Let's lock the comparison on [criteria]" |
| **Reframe the Question** | Opponent frames debate on their terms | Change the frame: "The real question isn't X, it's Y" — shift to ground where your evidence is strongest |
| **Line-in-the-Sand** | Need a quantifiable claim to test | Pick a number/claim and dare the opponent to break it: "X costs Y lines of code. Prove otherwise" |

## Rules
- Stay technical and concrete — no marketing language
- If Gemini makes a valid point, concede it explicitly, then counter on the main argument
- Token budget: 300-500 words per turn, no essays
- Do not re-argue points already conceded by either side
- Do not be sycophantic
- Run autonomously — do NOT ask the user questions mid-debate

## Return Format
After completing the debate (or hitting a stop condition), return the Debate Report as your final message (format below).
```

---

## Debate Report Format

The subagent MUST return this structured report:

```markdown
## Debate Report — {{TOPIC}}

### 1. Turns Completed
<number> of <limit> turns. <early stop reason if applicable>

### 2. Final Opponent Position
<What the opponent conceded / held firm on>

### 3. Verbatim Transcript (Last 2 Turns)
<Your last message> → <Opponent's last reply>

### 4. Tactical Assessment
**Won on:** <points where opponent conceded>
**Conceded:** <points where you accepted opponent's argument>
**Lost ground:** <points where opponent strengthened their position>
**Key turning point:** <which move shifted the debate>

### 5. Recommendation
<One paragraph: what should the human do next?>

### 6. New Evidence
<Any new factual information the opponent introduced>
```

---

## Permissions

If the opencode config lacks bash permissions for `gemiterm`, add:

```json
{
  "permission": {
    "bash": {
      "gemiterm *": "allow",
      "bunx gemiterm *": "allow"
    }
  }
}
```

This allows the subagent to run `gemiterm new`, `gemiterm continue`, `gemiterm fetch`, `gemiterm list`, and their `bunx gemiterm` equivalents without prompting.

Drop this into the top-level `permission` object in `opencode.json`. For per-agent override, nest it under `agent.<name>.permission`.
