# QA Gate

Purpose: prevent an adapter from looking ready when it missed visible evidence, captured the wrong turn, or polluted fields.

## Ground Truth Order

1. Human-visible screenshot or user-visible page description.
2. Browser snapshot visible text and DOM summaries.
3. Provider-specific raw capture artifact.
4. SBS normalized field contract.

Do not let selector output override visible truth. If screenshot-visible artifacts are missing from capture, QA fails unless the artifact is explicitly marked unsupported with manual fallback.

## Blocking Failures

- wrong current user message or wrong turn;
- current user message matched only in composer/input/sidebar/history chrome, or matched at an occurrence that is not followed by the assistant's answer;
- missing required visible final answer;
- missing required visible citations/references/query/suggestions when target field says they are required;
- final answer polluted by nav/sidebar/history/input chrome;
- source cards/query blocks/suggestion chips included in final answer without explicit mapper decision;
- hidden or inferred data claimed as captured;
- no manual fallback for unsupported fields.

## Partial Support

Partial support is allowed when:

- unsupported fields are explicitly listed;
- the UI can show the limitation;
- raw artifacts are preserved;
- required core fields still pass.

Transient thinking/process surfaces are usually partial/best-effort unless captured during generation. A human screenshot can be recorded as manually observed evidence but not as automatically captured DOM evidence.

## Recon Retry Rule

Before blocking a provider as unreadable, check whether the snapshot packet already contains enough signal to request a refined recon pass:

- provider is recognizable from URL/title/body markers;
- raw visible text clearly contains the current user prompt and answer text;
- message containers are missing or low confidence;
- the current user prompt appears multiple times and the adapter can distinguish the real turn from composer/input/sidebar echoes;
- the skill can name concrete selector hints or turn-boundary heuristics.

In that situation, prefer `partial` plus explicit `reconRetryAdvice` over a premature provider-level `blocked` judgment.

## Duplicate Prompt QA

When raw visible text contains the current user prompt more than once:

- QA must verify that `finalAnswer` comes from the occurrence followed by substantial assistant content.
- A repeated prompt near the bottom composer/input area should be excluded from the turn and may serve as an end boundary.
- Passing QA requires either stable message-container boundaries or an explicit raw-line scoping rule that survives duplicate prompt echoes.
- If the adapter chooses the wrong duplicate and returns an empty/previous-turn answer, mark `userMessage` or `finalAnswer` as `fail_wrong_turn`, not merely `fail_empty`.

## QA Output

Produce:

```json
{
  "ok": false,
  "adapterReadiness": "blocked",
  "fieldResults": {
    "finalAnswer": "pass",
    "referenceMaterials": "fail_missing_visible_field"
  },
  "blockingIssues": [
    {
      "field": "referenceMaterials",
      "code": "missing_visible_field",
      "message": "Screenshot shows references but capture has none."
    }
  ],
  "warnings": [],
  "developerInstructions": []
}
```

Engineering checks should exit non-zero when `blockingIssues` is non-empty.
