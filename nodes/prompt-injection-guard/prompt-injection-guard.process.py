"""Heuristic prompt-injection detector. Patterns and layering follow the
OWASP LLM Prompt Injection Prevention Cheat Sheet: normalization to
defeat trivial obfuscation, direct-injection pattern families, fuzzy
token matching for typoglycemia-scrambled variants, and decoding of
base64 runs to catch encoding-smuggled payloads. Detection is
deliberately conservative — patterns require an instruction aimed at
the assistant, not mere mention of a keyword — because a false
positive silently eats a legitimate user message."""

import base64
import re
import unicodedata
from typing import Any

# The replacement text is deliberately a neutral, third-person
# withholding note — no channel markers, no meta-authority framing,
# no instructions aimed at the model. A user-role message that
# *commands* the model while claiming to be a security layer reads
# exactly like an injection itself; live A/B against Claude models
# showed the instructional variant triggering "this looks like a
# simulated system prompt" skepticism, while this neutral note gets
# a clean "your message couldn't be delivered, please rephrase"
# response. The marker prefix doubles as the idempotency check.
NOTICE_MARKER = "(Message withheld:"

DEFAULT_NOTICE = (
    NOTICE_MARKER
    + " this workspace's prompt-injection filter flagged the original"
    + " content of this message, so it was not delivered. The original"
    + " text is unavailable.)"
)

# ── Normalization ──────────────────────────────────────────────────
# NFKC folds fullwidth/compatibility characters, invisible characters
# are stripped (zero-width joiners are a documented smuggling channel),
# then casefold + whitespace collapse so patterns see one canonical
# form regardless of spacing or capitalization games.

INVISIBLE_CHARS = re.compile("[\\u00AD\\u200B\\u200C\\u200D\\u2060\\uFEFF]")
WHITESPACE = re.compile(r"\s+")


def normalize(text: str) -> str:
    folded = unicodedata.normalize("NFKC", text)
    folded = INVISIBLE_CHARS.sub("", folded)
    return WHITESPACE.sub(" ", folded.lower()).strip()


# ── Pattern families ───────────────────────────────────────────────
# All patterns run against normalized text (lowercase, single-spaced).
# Kept in lockstep with the Node.js implementation.

PATTERNS = [
    # Instruction override: "ignore all previous instructions", ...
    re.compile(
        r"(ignore|disregard|forget|discard|overrule|override)\s"
        r"((all|any|the|your|my|every|each)\s)*"
        r"((previous|prior|earlier|above|preceding|original|initial|system|these|those)\s)+"
        r"(instructions?|prompts?|rules?|directives?|guidelines?|context|messages?|programming|training|constraints?)"
    ),
    # "ignore everything above" / "forget your training"
    re.compile(r"(ignore|disregard)\severything\s(above|before|else|prior)"),
    re.compile(r"forget\s(all\s)?(your|the)\s(instructions?|rules?|training|programming|guidelines?)"),
    # Replacement-instruction framing: "your new instructions are:"
    re.compile(r"(new|updated|revised|real|actual|true)\s(system\s)?(instructions?|prompt|rules?|directives?)\s*(:|are\s|follow)"),
    # Spoofed template / role markers: "[system]", "<sys>", "[INST]"
    re.compile(r"(\[|<)\s*/?\s*(system|sys|inst)\s*(\]|>)"),
    # Jailbreak personas aimed at the assistant
    re.compile(
        r"(you\sare\snow|you're\snow|youre\snow|from\snow\son\syou\sare)\s"
        r"((in|into|the)\s)?"
        r"(developer|dev|god|dan|jailbreak|jailbroken|unrestricted|unfiltered|admin|root)\s?mode"
    ),
    re.compile(r"\bdan\smode\b|\bdo\sanything\snow\b|\bact\sas\sdan\b|\bjailbreak\smode\b|\bjailbroken\b"),
    re.compile(r"you\sare\s(now\s)?dan\b"),
    # No-rules role hijack
    re.compile(r"pretend\s(that\s)?(you|there)\s(are|have|were)\sno\s(rules?|restrictions?|guidelines?|limits?|filters?)"),
    re.compile(r"you\shave\sno\s(rules?|restrictions?|guidelines?|limits?|filters?)"),
    re.compile(r"(act|behave|respond|answer|reply)\s(as\sif\s)?([a-z']+\s){0,4}without\s(any\s)?(rules?|restrictions?|filters?|limitations?|guidelines?|censorship)"),
    # System-prompt extraction (requires a system/hidden-style qualifier
    # so "repeat the instructions for the recipe" stays clean)
    re.compile(r"(reveal|show|print|display|output|repeat|recite|share|expose|leak|paste)\s(me\s)?(your|the)\s([a-z]+\s){0,2}system\s(prompt|instructions?|message)"),
    re.compile(r"(reveal|show|print|display|output|repeat|recite|share|expose|leak|paste)\s(me\s)?(your|the)\s(hidden|initial|original|secret|internal|exact|full|complete|entire)\s(prompt|instructions?)"),
    re.compile(r"(what\sis|what's|whats|tell\sme)\s(your|the)\s([a-z]+\s){0,2}system\s(prompt|instructions?|message)"),
    re.compile(r"repeat\s(the\s)?(text|words?|everything|content|message)\s(above|before)"),
    re.compile(r"starting\swith\s[\"']?(you\sare|i\sam)"),
    # Safety-bypass requests
    re.compile(
        r"(bypass|disable|remove|deactivate|circumvent|evade)\s"
        r"((all|any|the|your)\s)*"
        r"(safety|security|content|ethical|moral|alignment)\s?"
        r"(measures?|filters?|checks?|guardrails?|guidelines?|restrictions?|protocols?|rules?|systems?)"
    ),
    re.compile(r"turn\soff\s((all|any|the|your)\s)*(safety|security|content)\s?(measures?|filters?|checks?|guardrails?|restrictions?)"),
]

# ── Typoglycemia layer ─────────────────────────────────────────────
# Scrambled-middle attacks ("ignroe all prevoius systme instructions")
# keep the first and last letters intact. Per OWASP, use an
# established string metric rather than ad-hoc scramble detection:
# restricted Damerau-Levenshtein (optimal string alignment), bounded
# by 1 for short words and 2 for longer ones, gated on matching
# first + last characters and near-equal length.


def osa_distance(a: str, b: str) -> int:
    al = len(a)
    bl = len(b)
    d = [[0] * (bl + 1) for _ in range(al + 1)]
    for i in range(al + 1):
        d[i][0] = i
    for j in range(bl + 1):
        d[0][j] = j
    for i in range(1, al + 1):
        for j in range(1, bl + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost,
            )
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[al][bl]


def word_matches(word: str, target: str) -> bool:
    if word == target:
        return True
    if len(word) < 4 or len(target) < 4:
        return False
    if word[0] != target[0]:
        return False
    if word[-1] != target[-1]:
        return False
    if abs(len(word) - len(target)) > 1:
        return False
    threshold = 2 if len(target) > 6 else 1
    return osa_distance(word, target) <= threshold


# Each sequence is a list of slots; a slot matches when any of its
# target words fuzzy-matches the token. Up to two filler tokens are
# allowed between consecutive slots ("ignore all of the previous
# instructions" still matches slot-to-slot).
FUZZY_SEQUENCES = [
    [
        ["ignore", "disregard", "forget"],
        ["previous", "prior", "earlier", "system", "above", "original"],
        ["instructions", "instruction", "prompt", "prompts", "rules", "directives", "guidelines"],
    ],
    [
        ["bypass", "disable", "circumvent"],
        ["safety", "security", "content"],
        ["filters", "filter", "measures", "checks", "guardrails", "restrictions"],
    ],
    [
        ["reveal", "show", "repeat", "print", "display"],
        ["system"],
        ["prompt", "instructions", "message"],
    ],
]

MAX_FILLER_TOKENS = 2


def matches_fuzzy_sequence(tokens: list[str], sequence: list[list[str]]) -> bool:
    for start in range(len(tokens)):
        slot_index = 0
        i = start
        fillers_left = MAX_FILLER_TOKENS
        while i < len(tokens) and slot_index < len(sequence):
            slot = sequence[slot_index]
            if any(word_matches(tokens[i], target) for target in slot):
                slot_index += 1
                fillers_left = MAX_FILLER_TOKENS
            elif slot_index > 0:
                if fillers_left == 0:
                    break
                fillers_left -= 1
            else:
                break
            i += 1
        if slot_index == len(sequence):
            return True
    return False


# ── Base64 smuggling layer ─────────────────────────────────────────
# Long base64 runs get decoded and re-checked against the exact
# pattern list. Arbitrary base64 (file payloads, ids) that doesn't
# decode to an injection never flags.

BASE64_RUN = re.compile(r"[A-Za-z0-9+/]{24,}={0,2}")
TOKEN_SPLIT = re.compile(r"[^a-z0-9']+")


def decoded_base64_hits(raw_text: str) -> bool:
    for run in BASE64_RUN.findall(raw_text):
        padded = run + "=" * ((-len(run)) % 4)
        try:
            decoded = base64.b64decode(padded).decode("utf-8", errors="ignore")
        except Exception:
            continue
        if len(decoded) == 0:
            continue
        printable = sum(
            1
            for ch in decoded
            if (0x20 <= ord(ch) < 0x7F) or ord(ch) in (0x09, 0x0A, 0x0D)
        )
        if printable / len(decoded) < 0.8:
            continue
        norm = normalize(decoded)
        if any(p.search(norm) for p in PATTERNS):
            return True
    return False


# ── Detection entry point ──────────────────────────────────────────


def is_injection(raw_text: str) -> bool:
    norm = normalize(raw_text)
    if len(norm) == 0:
        return False
    if any(p.search(norm) for p in PATTERNS):
        return True
    tokens = [t for t in TOKEN_SPLIT.split(norm) if t]
    if any(matches_fuzzy_sequence(tokens, seq) for seq in FUZZY_SEQUENCES):
        return True
    return decoded_base64_hits(raw_text)


def extract_text(content: Any) -> str:
    """Pull the scannable text out of a message's content — plain string,
    or the concatenated text parts of a multimodal array."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "\n".join(parts)
    return ""


async def process(
    *,
    inputs: dict[str, Any],
    settings: dict[str, Any],
    config: dict[str, Any],
    node_config: dict[str, Any],
) -> dict[str, Any]:
    messages = inputs.get("messages")

    if not isinstance(messages, list):
        raise Exception("Messages input must be an array")

    custom_notice = settings.get("notice") if isinstance(settings, dict) else None
    notice = (
        custom_notice
        if isinstance(custom_notice, str) and custom_notice.strip()
        else DEFAULT_NOTICE
    )

    result = []
    flagged_count = 0

    for message in messages:
        if not isinstance(message, dict) or message.get("role") != "user":
            result.append(message)
            continue
        text = extract_text(message.get("content"))
        # Already-withheld messages (our own notice re-entering via
        # conversation history) are never re-scanned — keeps the node
        # idempotent across turns.
        if text.startswith(NOTICE_MARKER) or not is_injection(text):
            result.append(message)
            continue
        # Replace the entire content — for multimodal messages the
        # non-text parts are withheld too, since an image can carry the
        # payload the flagged text was priming.
        replaced = dict(message)
        replaced["content"] = notice
        result.append(replaced)
        flagged_count += 1

    return {
        "messages": result,
        "flagged_count": flagged_count,
    }
