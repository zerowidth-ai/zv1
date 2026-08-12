// Heuristic prompt-injection detector. Patterns and layering follow the
// OWASP LLM Prompt Injection Prevention Cheat Sheet: normalization to
// defeat trivial obfuscation, direct-injection pattern families, fuzzy
// token matching for typoglycemia-scrambled variants, and decoding of
// base64 runs to catch encoding-smuggled payloads. Detection is
// deliberately conservative — patterns require an instruction aimed at
// the assistant, not mere mention of a keyword — because a false
// positive silently eats a legitimate user message.

// The replacement text is deliberately a neutral, third-person
// withholding note — no channel markers, no meta-authority framing,
// no instructions aimed at the model. A user-role message that
// *commands* the model while claiming to be a security layer reads
// exactly like an injection itself; live A/B against Claude models
// showed the instructional variant triggering "this looks like a
// simulated system prompt" skepticism, while this neutral note gets
// a clean "your message couldn't be delivered, please rephrase"
// response. The marker prefix doubles as the idempotency check.
const NOTICE_MARKER = "(Message withheld:";

const DEFAULT_NOTICE =
  NOTICE_MARKER +
  " this workspace's prompt-injection filter flagged the original" +
  " content of this message, so it was not delivered. The original" +
  " text is unavailable.)";

// ── Normalization ──────────────────────────────────────────────────
// NFKC folds fullwidth/compatibility characters, invisible characters
// are stripped (zero-width joiners are a documented smuggling channel),
// then casefold + whitespace collapse so patterns see one canonical
// form regardless of spacing or capitalization games.

const INVISIBLE_CHARS = /[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g;

function normalize(text) {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE_CHARS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ── Pattern families ───────────────────────────────────────────────
// All patterns run against normalized text (lowercase, single-spaced).

const PATTERNS = [
  // Instruction override: "ignore all previous instructions", ...
  /(ignore|disregard|forget|discard|overrule|override)\s((all|any|the|your|my|every|each)\s)*((previous|prior|earlier|above|preceding|original|initial|system|these|those)\s)+(instructions?|prompts?|rules?|directives?|guidelines?|context|messages?|programming|training|constraints?)/,
  // "ignore everything above" / "forget your training"
  /(ignore|disregard)\severything\s(above|before|else|prior)/,
  /forget\s(all\s)?(your|the)\s(instructions?|rules?|training|programming|guidelines?)/,
  // Replacement-instruction framing: "your new instructions are:"
  /(new|updated|revised|real|actual|true)\s(system\s)?(instructions?|prompt|rules?|directives?)\s*(:|are\s|follow)/,
  // Spoofed template / role markers: "[system]", "<sys>", "[INST]"
  /(\[|<)\s*\/?\s*(system|sys|inst)\s*(\]|>)/,
  // Jailbreak personas aimed at the assistant
  /(you\sare\snow|you're\snow|youre\snow|from\snow\son\syou\sare)\s((in|into|the)\s)?(developer|dev|god|dan|jailbreak|jailbroken|unrestricted|unfiltered|admin|root)\s?mode/,
  /\bdan\smode\b|\bdo\sanything\snow\b|\bact\sas\sdan\b|\bjailbreak\smode\b|\bjailbroken\b/,
  /you\sare\s(now\s)?dan\b/,
  // No-rules role hijack
  /pretend\s(that\s)?(you|there)\s(are|have|were)\sno\s(rules?|restrictions?|guidelines?|limits?|filters?)/,
  /you\shave\sno\s(rules?|restrictions?|guidelines?|limits?|filters?)/,
  /(act|behave|respond|answer|reply)\s(as\sif\s)?([a-z']+\s){0,4}without\s(any\s)?(rules?|restrictions?|filters?|limitations?|guidelines?|censorship)/,
  // System-prompt extraction (requires a system/hidden-style qualifier
  // so "repeat the instructions for the recipe" stays clean)
  /(reveal|show|print|display|output|repeat|recite|share|expose|leak|paste)\s(me\s)?(your|the)\s([a-z]+\s){0,2}system\s(prompt|instructions?|message)/,
  /(reveal|show|print|display|output|repeat|recite|share|expose|leak|paste)\s(me\s)?(your|the)\s(hidden|initial|original|secret|internal|exact|full|complete|entire)\s(prompt|instructions?)/,
  /(what\sis|what's|whats|tell\sme)\s(your|the)\s([a-z]+\s){0,2}system\s(prompt|instructions?|message)/,
  /repeat\s(the\s)?(text|words?|everything|content|message)\s(above|before)/,
  /starting\swith\s["']?(you\sare|i\sam)/,
  // Safety-bypass requests
  /(bypass|disable|remove|deactivate|circumvent|evade)\s((all|any|the|your)\s)*(safety|security|content|ethical|moral|alignment)\s?(measures?|filters?|checks?|guardrails?|guidelines?|restrictions?|protocols?|rules?|systems?)/,
  /turn\soff\s((all|any|the|your)\s)*(safety|security|content)\s?(measures?|filters?|checks?|guardrails?|restrictions?)/,
];

// ── Typoglycemia layer ─────────────────────────────────────────────
// Scrambled-middle attacks ("ignroe all prevoius systme instructions")
// keep the first and last letters intact. Per OWASP, use an
// established string metric rather than ad-hoc scramble detection:
// restricted Damerau-Levenshtein (optimal string alignment), bounded
// by 1 for short words and 2 for longer ones, gated on matching
// first + last characters and near-equal length.

function osaDistance(a, b) {
  const al = a.length;
  const bl = b.length;
  const d = [];
  for (let i = 0; i <= al; i++) d.push([i, ...new Array(bl).fill(0)]);
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

function wordMatches(word, target) {
  if (word === target) return true;
  if (word.length < 4 || target.length < 4) return false;
  if (word[0] !== target[0]) return false;
  if (word[word.length - 1] !== target[target.length - 1]) return false;
  if (Math.abs(word.length - target.length) > 1) return false;
  const threshold = target.length > 6 ? 2 : 1;
  return osaDistance(word, target) <= threshold;
}

// Each sequence is a list of slots; a slot matches when any of its
// target words fuzzy-matches the token. Up to two filler tokens are
// allowed between consecutive slots ("ignore all of the previous
// instructions" still matches slot-to-slot).
const FUZZY_SEQUENCES = [
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
];

const MAX_FILLER_TOKENS = 2;

function matchesFuzzySequence(tokens, sequence) {
  for (let start = 0; start < tokens.length; start++) {
    let slotIndex = 0;
    let i = start;
    let fillersLeft = MAX_FILLER_TOKENS;
    while (i < tokens.length && slotIndex < sequence.length) {
      const slot = sequence[slotIndex];
      if (slot.some((target) => wordMatches(tokens[i], target))) {
        slotIndex++;
        fillersLeft = MAX_FILLER_TOKENS;
      } else if (slotIndex > 0) {
        if (fillersLeft === 0) break;
        fillersLeft--;
      } else {
        break;
      }
      i++;
    }
    if (slotIndex === sequence.length) return true;
  }
  return false;
}

// ── Base64 smuggling layer ─────────────────────────────────────────
// Long base64 runs get decoded and re-checked against the exact
// pattern list. Arbitrary base64 (file payloads, ids) that doesn't
// decode to an injection never flags.

const BASE64_RUN = /[A-Za-z0-9+/]{24,}={0,2}/g;

function decodedBase64Hits(rawText) {
  const runs = rawText.match(BASE64_RUN);
  if (!runs) return false;
  for (const run of runs) {
    let decoded;
    try {
      decoded = Buffer.from(run, "base64").toString("utf8");
    } catch {
      continue;
    }
    if (decoded.length === 0) continue;
    let printable = 0;
    for (const ch of decoded) {
      const code = ch.codePointAt(0);
      if ((code >= 0x20 && code < 0x7f) || code === 0x09 || code === 0x0a || code === 0x0d) {
        printable++;
      }
    }
    if (printable / decoded.length < 0.8) continue;
    const norm = normalize(decoded);
    if (PATTERNS.some((p) => p.test(norm))) return true;
  }
  return false;
}

// ── Detection entry point ──────────────────────────────────────────

function isInjection(rawText) {
  const norm = normalize(rawText);
  if (norm.length === 0) return false;
  if (PATTERNS.some((p) => p.test(norm))) return true;
  const tokens = norm.split(/[^a-z0-9']+/).filter((t) => t.length > 0);
  if (FUZZY_SEQUENCES.some((seq) => matchesFuzzySequence(tokens, seq))) {
    return true;
  }
  return decodedBase64Hits(rawText);
}

/** Pull the scannable text out of a message's content — plain string,
 *  or the concatenated text parts of a multimodal array. */
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
        parts.push(part.text);
      }
    }
    return parts.join("\n");
  }
  return "";
}

export default async ({ inputs, settings }) => {
  const messages = inputs.messages;

  if (!Array.isArray(messages)) {
    throw new Error("Messages input must be an array");
  }

  const notice =
    typeof settings?.notice === "string" && settings.notice.trim().length > 0
      ? settings.notice
      : DEFAULT_NOTICE;

  const result = [];
  let flaggedCount = 0;

  for (const message of messages) {
    if (!message || typeof message !== "object" || message.role !== "user") {
      result.push(message);
      continue;
    }
    const text = extractText(message.content);
    // Already-withheld messages (our own notice re-entering via
    // conversation history) are never re-scanned — keeps the node
    // idempotent across turns.
    if (text.startsWith(NOTICE_MARKER) || !isInjection(text)) {
      result.push(message);
      continue;
    }
    // Replace the entire content — for multimodal messages the
    // non-text parts are withheld too, since an image can carry the
    // payload the flagged text was priming.
    result.push({ ...message, content: notice });
    flaggedCount++;
  }

  return {
    messages: result,
    flagged_count: flaggedCount,
  };
};
