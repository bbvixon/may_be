# may.be — Mobile Experience System

## Product

may.be is not a dashboard and does not deliver a block of advice. It turns a spoken human situation into a living map of possible choices.

**Promise:** See where every choice could take you.

## Experience rules

1. Mobile first. One thought, object, or action owns the screen at a time.
2. Voice is primary; typing is a quiet fallback.
3. Never present futures as Jira-style cards, carousels, or reports.
4. Exploring a path is not committing to it.
5. AI interpretation must remain connected to the words the user supplied.
6. Motion carries the explanation, so interface copy stays minimal.

## Core journey

1. **Invitation** — “Hi, there. Tell me where you’re stuck.” Large microphone; small text field.
2. **Listening** — one breathing orb and the words “I’m listening.”
3. **Meaning** — selected keywords rise from a shallow bowl, enlarge, settle rhythmically, then dissolve.
4. **Passage** — “You’ve told me the story. Now, let me find the paths.” The sentence fades naturally.
5. **Transformation** — the `may.be` wordmark appears. `may` and `be` fade; the dot remains.
6. **Decision seed** — the dot expands and contains the distilled decision.
7. **Branching** — lines grow organically from the decision seed toward however many meaningful choices the AI finds; the interface must not assume two.
8. **Selection** — unselected choices dissolve. The chosen node moves continuously into the next parent position without replacing the scene.
9. **Continuation** — new branches grow from the chosen node while the earlier connection remains part of the same spatial tree.
10. **Reversal** — Undo restores the previous fork and its alternatives.

## Visual system

- Canvas: `#F5F0E7`
- Surface: `#FFFAF2`
- Primary ink/action: `#332119`
- Muted text: `#7E7067`
- Warm accent: `#B47B54`
- Hairline: `rgba(51, 33, 25, .25)`
- Typeface: native Apple/system sans stack
- Shapes: circles, fine organic paths, soft bowls
- Shadows: low-contrast and broad; never card-heavy

### Logo construction

- `may`, the dot, and `be` use the same solid dark brown.
- The small header wordmark remains conventional and filled.
- In the cinematic wordmark, position the dot independently at the mathematical centre; the unequal word widths must never move it.
- During transformation, `may` and `be` fade outward while the pinned dot slowly expands in place.
- Reveal the decision text only after the dot has reached its full size.

## Motion

Use `cubic-bezier(.22, 1, .36, 1)` for spatial movement.

### Spatial engine

- Render nodes and connectors inside one SVG world coordinate system.
- Navigate the tree by animating the SVG camera (`viewBox`), never by moving HTML nodes separately from their paths.
- A selected side branch remains at its world position; the camera pans horizontally and vertically to centre it.
- Undo reverses the camera to the previous coordinates and restores sibling branches in place. It must not reconstruct or refresh the screen.
- Use subtle scale, blur, shadows, and parallax as “2.5D” depth. Full 3D is unnecessary unless a future usability test proves spatial rotation adds value.
- Branch explanations appear in a fixed, centred caption region so text can never overflow the mobile viewport.

### Keyword rhythm

- Extracted words arrive individually, 430 ms apart.
- Each rises from the bowl, overshoots to 118%, settles to 94%, then rests at 100%.
- After a short reading pause, bubbles dissolve one by one with blur, lift, and expansion.
- The rhythm should feel like breathing: emerge, settle, pause, disappear.

### Logo-to-decision transformation

- The full wordmark holds long enough to be recognized.
- `may` moves left and blurs; `be` moves right and blurs.
- The dot remains and expands into the decision seed.
- Decision text appears only after the seed has enough space to contain it.

### Branch movement

- The trunk grows first, then alternatives split with a slight stagger.
- Choice nodes appear only when their paths reach them.
- On selection, the rejected choice moves outward, shrinks, blurs, and disappears.
- The selected choice centres, rises, and becomes the parent of the next decision.
- Existing lines remain visible during the shift so each level feels like one continuous tree.
- Hovering or focusing an alternative reveals a concise explanation in a stable, centred caption area.
- After selection, the abandoned sibling nodes, previous parent, and previous connectors dissolve together with a slow blur instead of remaining below the active path.
- When a level contains four or more alternatives, widen their world-space positions and zoom the SVG camera out slightly. Do not shrink or overlap the labels to force them into the default framing.

## AI branch contract

The local AI should return a structured decision object rather than prose:

```json
{
  "decision": "Move to Bangalore?",
  "context": "A better role offers growth but creates distance from family.",
  "branches": [
    { "label": "Go", "detail": "Accept and relocate." },
    { "label": "Stay", "detail": "Remain and search locally." },
    { "label": "Negotiate", "detail": "Change the conditions first." }
  ]
}
```

Generate only distinct, credible branches. Two may be enough; some decisions may need three or four. Avoid creating extra branches merely to fill the screen.

## Language

Short, human, and calm:

- “Hi, there.”
- “Tell me where you’re stuck.”
- “I’m listening.”
- “You’ve told me the story.”
- “Now, let me find the paths.”
- “Touch a path to follow it.”
- “Every path opens another may.be.”

Avoid: optimal, recommendation, prediction, analysis complete, dashboard, result.

## Accessibility

- All paths remain tappable buttons.
- Minimum primary tap size: 44 px.
- Meaning is not communicated through animation alone.
- `prefers-reduced-motion` reduces every staged animation to near-instant transitions.
