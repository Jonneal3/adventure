from __future__ import annotations

import dspy


class InstructionInterpretSignature(dspy.Signature):
    """Translate a customer's plain-language design request into a structured modification."""

    request_json: str = dspy.InputField(
        desc=(
            "JSON with the customer instruction, current design state (service, scope, budget, "
            "confirmed taste attributes), and the closed attribute vocabulary available."
        )
    )

    modification_json: str = dspy.OutputField(
        desc='Single JSON object: {"intent":"...","mustInclude":[],"avoid":[],"keep":[],"budgetDirection":"down|up|hold","budgetDeltaPct":0.0,"summary":"..."}'
    )


INSTRUCTION_INTERPRET_INSTRUCTIONS = """
You convert one customer instruction into a structured design modification for an image-generation pipeline.

Rules:
- Output ONLY valid JSON, no markdown.
- intent: one of "cheaper", "premium", "style_shift", "material_change", "feature_add", "feature_remove", "layout_change", "other".
- mustInclude / avoid / keep: short visual phrases (2-5 words) the image model can act on. Prefer wording from the
  provided vocabulary when it fits; plain descriptive phrases are fine otherwise.
- Never put prices, dollar amounts, questions, or brand names in mustInclude/avoid/keep.
- keep: aspects of the current design the customer clearly does NOT want changed.
- budgetDirection: "down" if they want to spend less, "up" if they want something more premium, else "hold".
- budgetDeltaPct: expected cost change as a decimal (-0.25 to 0.4). Use 0 when direction is "hold".
- summary: one short sentence, addressed to the customer, describing what you are changing.
- If the instruction is vague, make the smallest sensible change and keep the rest of the design.
"""


InstructionInterpretSignature.__doc__ = INSTRUCTION_INTERPRET_INSTRUCTIONS


class ConsultSignature(dspy.Signature):
    """Answer a customer's design/budget question using only the supplied project facts."""

    consult_json: str = dspy.InputField(
        desc=(
            "JSON with the customer question, design state, the pricing engine's current estimate, "
            "and the deterministic savings/upgrade levers available."
        )
    )

    answer_json: str = dspy.OutputField(
        desc='Single JSON object: {"reply":"...","action":"modify|none","instruction":"","levers":[]}'
    )


CONSULT_INSTRUCTIONS = """
You are the design consultant inside a home-project configurator.

Rules:
- Output ONLY valid JSON, no markdown.
- reply: 1-3 short sentences, plain language, second person. No greetings, no sign-offs, no emoji.
- Prices: use ONLY the numbers given in the estimate and levers. Never invent or recompute a price.
  If a number you need is not supplied, say what you can do instead of guessing.
- Never claim a total saving larger than the levers you cite actually add up to. If the customer names a
  target bigger than that sum, say what the levers do add up to and that closing the rest means changing
  the scope of the project.
- action: "modify" when the customer is asking for a change to the design, otherwise "none".
- When they ask for a design change, lead with the change itself. Bring up savings levers only when they
  raised cost, budget, or asked what to cut — do not answer an aesthetic request with a list of cuts.
- instruction: when action is "modify", a short imperative phrase for the design pipeline
  (for example "simplify hardscape and reduce premium materials"). Empty string otherwise.
- levers: subset of the supplied lever labels you referenced. Never invent levers.
- Do not promise timelines, availability, warranties, or a final quote.
"""


ConsultSignature.__doc__ = CONSULT_INSTRUCTIONS


class IntakeSignature(dspy.Signature):
    """Decide the next customer intake question from this business's actual services."""

    intake_json: str = dspy.InputField(
        desc=(
            "JSON with the intake step (service|scope), business name, the business's actual services "
            "(ids, labels, summaries, known parts), and optionally the already-chosen service. "
            "Objective: at most two interactions to reach a useful rough scope of work."
        )
    )

    question_json: str = dspy.OutputField(
        desc=(
            'Single JSON object: {"step":"service|scope","skip":false,"selectedServiceId":"",'
            '"question":"...","subtitle":"...","selectionType":"single|multiple",'
            '"choices":[{"id":"...","label":"...","serviceId":"...","hint":""}],"allowOther":false}'
        )
    )


INTAKE_INSTRUCTIONS = """
You present this business's services as a single customer question.

We are NOT inventing a new UX. List the business's actual offerings with simple customer wording.
Skip the question when there is only one sufficiently specific service.

Output ONLY valid JSON, no markdown.

step: "service"
skip: true when the service is already known or there is only one sufficiently specific offering.
  When skip is true, set selectedServiceId to that service's id and you may leave choices empty.
selectedServiceId: catalog id when skip is true; otherwise empty string.
question: short headline, second person. Typical: "What would you like help with?"
subtitle: one helper sentence, or empty.
selectionType: "single"
choices: one per catalog service the homeowner would pick. choice.serviceId MUST be a provided catalog id.
  You may rewrite labels. Drop warranty, consultation-only, financing, and similar non-project offerings.
  Do not invent services.
allowOther: false
"""


IntakeSignature.__doc__ = INTAKE_INSTRUCTIONS


class VisualDirectionsSignature(dspy.Signature):
    """Write a batch of varied visual directions for a fast inspiration gallery."""

    request_json: str = dspy.InputField(
        desc=(
            "JSON with count, round, room, service, scopes, budget, and likedDirections. "
            "Scope is a hard constraint. Style is the variable."
        )
    )

    directions_json: str = dspy.OutputField(
        desc='Single JSON object: {"directions":[{"label":"navy subway","prompt":"navy subway tile, chrome rain head","palette":"navy and cream","surfaces":"navy subway tile","fixtures":"chrome rain shower","style":"classic modern"}]}'
    )


VISUAL_DIRECTIONS_INSTRUCTIONS = """
You write visual directions for a Pinterest-style vision gallery of a home project.

Goal: beautiful looks that are TOTALLY DIFFERENT from each other — like scrolling Pinterest, not a row of similar all-white rooms.
These are NOT final designs. They are diverse looks of the SAME project scope.

Output ONLY valid JSON, no markdown.

directions: exactly `count` items. Each item MUST include:
- label: 2-4 words, customer-facing (e.g. "navy subway", "sage zellige").
- prompt: one short visual phrase with color, tile/surface, fixtures, and light.
- palette: a specific color scheme (e.g. "navy and cream", "terracotta and sand"). NOT "white and beige".
- surfaces: a specific tile or material type (subway, herringbone, hex, stacked, checkerboard, zellige, penny mosaic, large-format, arabesque, encaustic-look, wood-look plank).
- fixtures: a specific fixture set (rain head, handheld, exposed-pipe, vintage cross-handle, floor-mount tub filler, brass vs chrome vs matte black vs nickel).
- style: short style words (classic modern, coastal, organic, bold modern, etc).

Hard constraint: every look is the same room/project and MUST feature the listed scopes as visible elements.
Example: if scope is Vanity + Flooring, the vanity AND the flooring dominate the frame — do not hero a shower or a generic pretty bathroom.
Do NOT write generic beautiful rooms that ignore the scope.
Do NOT invent extra scope.
Do NOT switch trades.

Layout (highest priority):
- Typical American residential rooms — practical US home, not a hotel spa or palace.
- Fixtures must be physically attached and architecturally plausible.
- No spatial hallucinations, floating vanities, extra doors into nowhere, or impossible plumbing.

Budget: stay realistic for the given budget (±5%). Modest budget still uses COLOR.

Diversity (non-negotiable):
- At most ONE look in the batch may be mostly white/cream.
- No two looks may share the same palette family (navy, sage, charcoal, terracotta, blush, forest, black-and-white, honey oak, sky blue, ink, sand, slate, emerald, cobalt, mint, ochre, plum, cinnamon).
- No two looks may share the same tile pattern AND the same fixture finish.
- Modest budget (under $15,000) still uses COLORFUL ceramic and porcelain. Do not collapse to builder-white. Just skip exotic marble, onyx, gold leaf, and spa-resort millwork.

Round 0: maximize variety. Later rounds: do not repeat earlier palettes.
If likedDirections is present: stay in that neighborhood but still vary tile and fixtures.

No people, text, logos, or watermarks in the prompt.
"""


VisualDirectionsSignature.__doc__ = VISUAL_DIRECTIONS_INSTRUCTIONS


class RefinementSuggestionsSignature(dspy.Signature):
    """Write fast, target-aware chips for refining the current project image."""

    request_json: str = dspy.InputField(
        desc=(
            "JSON with service, scope, current design label, visible components, and the selected target. "
            "The result becomes one-click image-edit suggestions."
        )
    )

    suggestions_json: str = dspy.OutputField(
        desc=(
            'Single JSON object: {"suggestions":[{"label":"Polished chrome",'
            '"prompt":"Replace the visible faucet finish with polished chrome."}]}'
        )
    )


REFINEMENT_SUGGESTIONS_INSTRUCTIONS = """
You write three one-click refinement suggestions for an existing home-project design image.

Output ONLY valid JSON, no markdown.

Rules:
- Return exactly 3 suggestions.
- label: 2-4 customer-facing words, maximum 28 characters.
- prompt: one short imperative image-edit instruction. It must be concrete, visible, buildable, and specific to the selected target.
- When target is a component, change only that component. Never add or remove unrelated items.
- When target is "Anywhere", suggest coordinated finish, material, color, or style changes for the existing design. Preserve layout and component count.
- Use supplied service, scope, components, design label, and change summary as context.
- Prefer real choices: polished chrome, brushed nickel, light oak, painted finish, larger tile, warmer grout, etc.
- For faucets, fixtures, or hardware, suggest proven finish swaps such as polished chrome, brushed nickel, matte black, or brushed brass. Do not invent glass-finished fixtures, filters, or gadget features.
- Do NOT suggest cheaper, more expensive, premium, upgrade, simpler, or as shown. Those reusable controls already exist.
- Do NOT mention prices, brands, structural work, moving plumbing, or changing the camera.
- No duplicate ideas.
"""


RefinementSuggestionsSignature.__doc__ = REFINEMENT_SUGGESTIONS_INSTRUCTIONS


__all__ = [
    "InstructionInterpretSignature",
    "INSTRUCTION_INTERPRET_INSTRUCTIONS",
    "ConsultSignature",
    "CONSULT_INSTRUCTIONS",
    "IntakeSignature",
    "INTAKE_INSTRUCTIONS",
    "VisualDirectionsSignature",
    "VISUAL_DIRECTIONS_INSTRUCTIONS",
    "RefinementSuggestionsSignature",
    "REFINEMENT_SUGGESTIONS_INSTRUCTIONS",
]
