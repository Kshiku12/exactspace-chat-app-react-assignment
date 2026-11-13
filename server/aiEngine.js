import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { USER_LIST, BOT_PROFILES, storage } from "./storage.js";
import {
  getNextColleagueArtifactTurn,
  maybeGenerateRequestedBotAttachment,
} from "./botArtifacts.js";

export { maybeGenerateRequestedBotAttachment };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../.env");

// Track recent responses per bot so they never repeat the same line
const recentBotResponses = new Map();

/**
 * Inspects an uploaded attachment (Image, PDF, Code, CSV, Text) from its base64 dataUrl
 * and extracts real metadata, dimensions, page count, and text preview.
 */
export function inspectAttachment(attachment) {
  if (!attachment) return null;

  const name = attachment.name || "attachment";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const mime = (attachment.mimeType || "").toLowerCase();
  const dataUrl = attachment.dataUrl || "";

  let category = attachment.category || "document";
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)
  ) {
    category = "image";
  } else if (mime === "application/pdf" || ext === "pdf") {
    category = "pdf";
  } else if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "json",
      "html",
      "css",
      "sql",
      "sh",
      "md",
      "yml",
      "yaml",
    ].includes(ext)
  ) {
    category = "code";
  } else if (["csv", "tsv", "log", "txt"].includes(ext)) {
    category = "data";
  }

  let buffer = null;
  let base64Raw = "";
  if (dataUrl.includes(";base64,")) {
    base64Raw = dataUrl.split(";base64,")[1];
    try {
      buffer = Buffer.from(base64Raw, "base64");
    } catch {
      buffer = null;
    }
  }

  let extractedText = attachment.extractedText || "";
  let pageCount = attachment.pageCount || null;
  let dimensions = attachment.dimensions || "";

  if (buffer) {
    // 1. Parse PNG dimensions from IHDR chunk if not already provided
    if (
      category === "image" &&
      !dimensions &&
      buffer.length > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50
    ) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0 && width < 20000 && height < 20000) {
        dimensions = `${width}×${height}px`;
      }
    }

    // 2. Parse PDF page count & readable text strings from raw PDF buffer
    if (category === "pdf") {
      const latinStr = buffer.toString("latin1");
      const pageMatches = latinStr.match(/\/Type\s*\/Page\b/g);
      pageCount = pageMatches ? pageMatches.length : 1;

      const textChunks = [];
      const regex = /\(([A-Za-z0-9 ,.:;?!'"/\\\-_@#$%&*+=]{4,120})\)/g;
      let match;
      while ((match = regex.exec(latinStr)) !== null && textChunks.length < 30) {
        const cleaned = match[1].replace(/\\[nrt]/g, " ").trim();
        if (
          cleaned.length > 4 &&
          !/^(Identity|Adobe|WinAnsi|MacRoman|Helvetica|Times|Courier)/i.test(
            cleaned
          )
        ) {
          textChunks.push(cleaned);
        }
      }
      if (textChunks.length > 0 && !extractedText) {
        extractedText = textChunks.slice(0, 15).join(" · ").slice(0, 600);
      }
    }

    // 3. Parse Code / CSV / JSON / Text files
    if ((category === "code" || category === "data") && !extractedText) {
      const utf8 = buffer.toString("utf8").slice(0, 2400);
      extractedText = utf8;
    }
  }

  return {
    ...attachment,
    category,
    ext,
    dimensions: dimensions || attachment.dimensions || "",
    pageCount,
    extractedText: extractedText.slice(0, 1200),
    base64Raw,
  };
}

/**
 * Picks which colleague(s) from user_list = ["Alan", "Bob", "Carol", "Dean", "Elin"]
 * should respond and react.
 */
export function selectRespondingBots(userMessage, channelId) {
  const text = String(userMessage.text || "").trim();
  const lower = text.toLowerCase();
  const attachment = userMessage.attachment;

  // 1. Direct 1-on-1 Message with a specific colleague
  if (channelId && channelId.startsWith("dm-")) {
    const dmTarget = channelId.replace("dm-", "");
    const matchedBot = USER_LIST.find((u) => u.toLowerCase() === dmTarget);
    if (matchedBot) {
      return { primary: [matchedBot], reactors: [matchedBot], isAllMention: false };
    }
  }

  // 2. Check if @all or @everyone was used -> Notify ALL members of user_list!
  if (/@all\b|@everyone\b/i.test(text)) {
    const shuffled = [...USER_LIST].sort(() => Math.random() - 0.5);
    return {
      primary: shuffled.slice(0, 3),
      reactors: [...USER_LIST],
      isAllMention: true,
    };
  }

  const chosen = [];

  // 2. If user replied directly to a colleague's message, ONLY that colleague replies (plus any explicit @mention)
  if (userMessage.replyTo && userMessage.replyTo.user) {
    const repliedBot = USER_LIST.find(
      (u) => u.toLowerCase() === userMessage.replyTo.user.toLowerCase()
    );
    if (repliedBot) {
      chosen.push(repliedBot);
    }
  }

  // 3. Check explicit @Mentions in the message text
  for (const botName of USER_LIST) {
    const mentionRegex = new RegExp(`@${botName}\\b`, "i");
    if (mentionRegex.test(text) && !chosen.includes(botName)) {
      chosen.push(botName);
    }
  }

  // 4. If an attachment was uploaded, pick 1-2 relevant colleagues
  if (attachment && chosen.length === 0) {
    if (attachment.category === "image") {
      chosen.push("Carol", "Bob");
    } else if (attachment.category === "pdf") {
      chosen.push("Elin", "Alan");
    } else if (attachment.category === "code") {
      chosen.push("Bob", "Alan");
    } else if (attachment.category === "data") {
      chosen.push("Dean", "Elin");
    } else {
      chosen.push("Alan");
    }
  }

  // 5. Topic-based routing if no one was explicitly replied to or mentioned
  if (chosen.length === 0) {
    if (
      /mongo|database|schema|backend|server|socket|api|auth|jwt|docker|cloud|scale/i.test(
        lower
      )
    ) {
      chosen.push("Alan");
    } else if (
      /react|frontend|ui|ux|css|component|hook|state|button|layout|vite|bug|code/i.test(
        lower
      )
    ) {
      chosen.push("Bob");
    } else if (
      /design|color|font|screenshot|image|photo|look|theme|dark|workspace|style|figma/i.test(
        lower
      )
    ) {
      chosen.push("Carol");
    } else if (
      /iot|sensor|telemetry|stream|edge|pipeline|krakow|poland|metric|alert|uptime/i.test(
        lower
      )
    ) {
      chosen.push("Dean");
    } else if (
      /pdf|report|data|ai|model|analytics|chart|csv|accuracy|dataset|python/i.test(
        lower
      )
    ) {
      chosen.push("Elin");
    }
  }

  // 6. General greeting / casual chat in channel
  if (chosen.length === 0) {
    const shuffled = [...USER_LIST].sort(() => Math.random() - 0.5);
    if (/everyone|team|all|guys|folks/i.test(lower)) {
      chosen.push(shuffled[0], shuffled[1]);
    } else {
      chosen.push(shuffled[0]);
    }
  }

  const primary = chosen.slice(0, 2);
  const otherBots = USER_LIST.filter((u) => !primary.includes(u));
  const reactors = [
    primary[0],
    ...(otherBots.length > 0
      ? [otherBots[Math.floor(Math.random() * otherBots.length)]]
      : []),
  ];

  return { primary, reactors };
}

/**
 * Builds the system prompt and conversation messages so the AI talks like a real,
 * chill human coworker in a live team chat — never robotic or repetitive.
 */
function buildColleaguePrompt({
  botName,
  userMessage,
  channelHistory,
  inspectedAttachment,
}) {
  const profile = BOT_PROFILES[botName];
  const senderFirstName = (userMessage.user || "Kshitij").split(" ").pop();

  const recentTranscript = (channelHistory || [])
    .slice(-10)
    .map((m) => {
      const quoteInfo = m.replyTo
        ? ` [replying to ${m.replyTo.user}: "${m.replyTo.text?.slice(0, 50)}"]`
        : "";
      const attInfo = m.attachment
        ? ` [attached ${m.attachment.category}: ${m.attachment.name}]`
        : "";
      return `${m.user}${quoteInfo}${attInfo}: ${m.text}`;
    })
    .join("\n");

  const systemPrompt = `You are ${botName} (${profile.displayFullName}), working as a ${profile.designation} at ExactSpace.
You are chatting in a real-time company team workspace with your teammate ${userMessage.user} (call them "${senderFirstName}" or "Kshitij", or don't even use their name in every message).
Other colleagues in the workspace are: Alan (backend/architect), Bob (frontend/React), Carol (product designer), Dean (IoT/telemetry), and Elin (data science/AI).

CRITICAL RULES FOR HOW YOU TALK:
1. Talk like a REAL, friendly, normal human coworker in team chat. Keep it casual, warm, and natural (1 to 2 short sentences, usually 6 to 28 words).
2. NEVER repeat or quote ${userMessage.user}'s message inside quotation marks! Never say things like 'Jumping back to "..."' or 'Spot on with "..."'.
3. NEVER put "@Kumar" or "@${userMessage.user}" in your reply if you are already replying to them—just talk to them directly like a normal person!
4. Do NOT randomly bring up your job title, "telemetry streams", "MongoDB pools", or "Krakow" during casual small talk! If they just say "Hi", "How's it going?", "That's good to know", "Okay", "Nice", etc., respond naturally like a normal human colleague (e.g., "Hey Kshitij! Going great, just grabbing some coffee ☕ How's your day going?", "Yeah, huge relief haha. What are you working on today?", "Haha yeah, finally! Let me know if you need a hand with anything.").
5. Only give technical/engineering answers when they actually ask a technical question or share a file/image/PDF/code snippet.
6. Output ONLY ${botName}'s raw chat message text—no quotes around the response, no "${botName}:" prefix.`;

  let userPrompt = `Recent chat history:\n${recentTranscript}\n\n`;

  if (userMessage.replyTo) {
    userPrompt += `${userMessage.user} just replied directly to ${userMessage.replyTo.user}'s message ("${userMessage.replyTo.text}") and said:\n"${userMessage.text || "(Sent an attachment)"}"\n`;
  } else {
    userPrompt += `${userMessage.user} just sent:\n"${userMessage.text || "(Sent an attachment)"}"\n`;
  }

  if (inspectedAttachment) {
    userPrompt += `\nThey attached a ${inspectedAttachment.category} file named "${inspectedAttachment.name}" (${inspectedAttachment.sizeFormatted || ""}).`;
    if (inspectedAttachment.dimensions) {
      userPrompt += ` Image dimensions: ${inspectedAttachment.dimensions}.`;
    }
    if (inspectedAttachment.pageCount) {
      userPrompt += ` PDF page count: ${inspectedAttachment.pageCount} pages.`;
    }
    if (inspectedAttachment.extractedText) {
      userPrompt += `\nExtracted text/code from the file:\n${inspectedAttachment.extractedText.slice(0, 800)}\n`;
    }
    userPrompt += `\nReact naturally to their file and give helpful, human feedback on its contents.`;
  }

  userPrompt += `\nWrite ${botName}'s natural coworker reply:`;

  return { systemPrompt, userPrompt };
}

/**
 * Tier 1: Google Gemini API (when a valid AIzaSy... key is in .env)
 */
async function callGeminiAPI({
  apiKey,
  botName,
  userMessage,
  channelHistory,
  inspectedAttachment,
}) {
  const { systemPrompt, userPrompt } = buildColleaguePrompt({
    botName,
    userMessage,
    channelHistory,
    inspectedAttachment,
  });

  const parts = [];
  const supportedInlineMimes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/heic",
    "image/heif",
    "application/pdf",
  ];
  if (
    inspectedAttachment?.base64Raw &&
    inspectedAttachment.mimeType &&
    supportedInlineMimes.includes(inspectedAttachment.mimeType.toLowerCase())
  ) {
    parts.push({
      inlineData: {
        mimeType: inspectedAttachment.mimeType.toLowerCase(),
        data: inspectedAttachment.base64Raw,
      },
    });
  }
  parts.push({ text: userPrompt });

  const geminiModels = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
  ];
  let lastErr = null;

  for (const modelName of geminiModels) {
    try {
      const generationConfig = {
        temperature: 0.85,
        maxOutputTokens: 320,
      };
      if (modelName.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts }],
            generationConfig,
          }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(
          `Gemini ${modelName} HTTP ${response.status}: ${errBody.slice(0, 120)}`
        );
      }
      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "";
      if (!text) throw new Error(`Empty ${modelName} reply`);
      return cleanAiOutput(text, botName);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Gemini call failed");
}

/**
 * Tier 2: Free Zero-Key Cloud LLM Fallback (OpenAI-compatible endpoint with Vision support)
 * Ensures real LLM intelligence even if GEMINI_API_KEY in .env is missing or invalid!
 */
async function callFreeCloudLLM({
  botName,
  userMessage,
  channelHistory,
  inspectedAttachment,
}) {
  const { systemPrompt, userPrompt } = buildColleaguePrompt({
    botName,
    userMessage,
    channelHistory,
    inspectedAttachment,
  });

  const userContent = [];
  userContent.push({ type: "text", text: userPrompt });

  if (
    inspectedAttachment?.category === "image" &&
    inspectedAttachment?.dataUrl
  ) {
    userContent.push({
      type: "image_url",
      image_url: { url: inspectedAttachment.dataUrl },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "openai",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloud LLM HTTP ${response.status}`);
    }
    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!reply) throw new Error("Empty Cloud LLM reply");
    return cleanAiOutput(reply, botName);
  } finally {
    clearTimeout(timeout);
  }
}

function cleanAiOutput(text, botName) {
  let cleaned = String(text || "").trim();
  // Strip leading "Dean:" or quotes if the model added them
  cleaned = cleaned.replace(new RegExp(`^${botName}\\s*:\\s*`, "i"), "");
  cleaned = cleaned.replace(/^["']|["']$/g, "").trim();
  return cleaned;
}

/**
 * Tier 3: Natural Human Colleague Fallback (if completely offline without internet)
 * Never quotes user text back, never uses robotic templates!
 */
function generateNaturalHumanFallback({
  botName,
  userMessage,
  inspectedAttachment,
}) {
  const rawText = String(userMessage.text || "").trim();
  const lower = rawText.toLowerCase();

  // 1. If they shared a file/image/PDF
  if (inspectedAttachment) {
    const { name, category, dimensions, pageCount, extractedText } =
      inspectedAttachment;

    if (category === "image") {
      return pickNonRepeating(botName, [
        `Ooh nice screenshot! The layout on ${name}${
          dimensions ? ` (${dimensions})` : ""
        } looks super clean 👌`,
        `Just opened ${name} — looks really sharp! Everything lines up nicely.`,
        `Love how clean this looks! Did you just finish styling this part?`,
      ]);
    }

    if (category === "pdf") {
      return pickNonRepeating(botName, [
        `Just went through ${name}${
          pageCount ? ` (all ${pageCount} pages)` : ""
        }!${
          extractedText
            ? " The architecture breakdown and Q&A sections are super thorough."
            : " Really well-structured doc!"
        }`,
        `Thanks for sharing ${name}! Skimmed through the sections and it reads really well 📄`,
        `Downloaded ${name} — super clear write-up, this will be great for the review!`,
      ]);
    }

    return pickNonRepeating(botName, [
      `Just checked out ${name} — the code structure looks super clean to me 👍`,
      `Took a look at ${name}, everything looks solid on my end!`,
    ]);
  }

  // 2. Casual greetings ("hi", "hello", "hey everyone", "good morning")
  if (
    /^(hi|hello|hey|yo|morning|good morning|good evening|sup|what's up|whats up)\b/i.test(
      lower
    )
  ) {
    const greetings = {
      Alan: [
        "Hey Kshitij! Morning 👋 How's it going?",
        "Hey man! Good to see you online. How's your day going so far?",
      ],
      Bob: [
        "Hey Kshitij! 👋 Just grabbing some coffee, what are you working on today?",
        "Yo! Good to have you in the channel. How's everything going?",
      ],
      Carol: [
        "Hey Kshitij! 😊 Hope you're having a good day so far!",
        "Hi there! 👋 How's the project coming along?",
      ],
      Dean: [
        "Hey Kshitij! What's up man? 👋",
        "Hey! Good to see you here, how's it going?",
      ],
      Elin: [
        "Hi Kshitij! 👋 How's your week going so far?",
        "Hey! Great to see you online 🙂",
      ],
    };
    return pickNonRepeating(botName, greetings[botName] || greetings.Bob);
  }

  // 3. How are you / how's it going
  if (
    /how are you|how's it going|hows it going|how are things|what are you up to|wyd/i.test(
      lower
    )
  ) {
    return pickNonRepeating(botName, [
      "Doing pretty good! Just wrapping up a few tasks before lunch. How about you?",
      "Pretty chill today haha, just reviewing some PRs. How's things on your end?",
      "All good here! Powered by coffee at this point ☕ How's your day going?",
    ]);
  }

  // 4. Casual acknowledgments ("that's good to know", "nice", "cool", "ok", "thanks", "got it", "great")
  if (
    /^(that's good|thats good|good to know|nice|cool|ok|okay|got it|thanks|thank you|awesome|great|sweet|alright|sounds good|true|yeah|yep|haha|lol)/i.test(
      lower
    )
  ) {
    return pickNonRepeating(botName, [
      "Haha yeah, huge relief! Let me know if you need a hand with anything today 👍",
      "For sure! Btw how's your part of the project coming along?",
      "Anytime man! Ping me whenever you want to test the next part.",
      "Yeah totally! Let me know when you're ready to push your changes.",
    ]);
  }

  // 5. Questions ("?", "can you", "what", "how", "why", "where")
  if (
    rawText.includes("?") ||
    /^(can|could|what|how|why|where|when|who|is|are|do|does)\b/i.test(lower)
  ) {
    return pickNonRepeating(botName, [
      "Yeah for sure! Give me two mins, I'll check and let you know.",
      "Good question — I think keeping it simple and modular is definitely the best call here. Want me to take a closer look?",
      "Yeah, we can definitely do that! Drop the file or snippet here if you want me to review it with you.",
      "Honestly I'd go with the cleanest approach so it's easy to explain during the walkthrough. What do you think?",
    ]);
  }

  // 6. General conversational follow-up
  return pickNonRepeating(botName, [
    "Makes sense! Let me know if you want a second pair of eyes on anything.",
    "Oh nice, that sounds super solid. How much is left on your to-do list?",
    "Totally agree with you there 👍 Let's keep rolling with that.",
    "Sounds like a plan! Ping me if anything comes up.",
  ]);
}

function pickNonRepeating(botName, candidates) {
  const history = recentBotResponses.get(botName) || [];
  const unused = candidates.filter((c) => !history.includes(c));
  const pool = unused.length > 0 ? unused : candidates;
  const chosen = pool[Math.floor(Math.random() * pool.length)];

  const updatedHistory = [chosen, ...history].slice(0, 6);
  recentBotResponses.set(botName, updatedHistory);
  return chosen;
}

/**
 * Main AI Teammate Reply Generator
 * 1. Reloads .env dynamically so key changes work immediately
 * 2. Tries Google Gemini API if GEMINI_API_KEY starts with AIza
 * 3. Tries Free Cloud LLM (OpenAI-compatible) for real LLM conversation
 * 4. Falls back to Natural Human Colleague responses if offline
 */
export async function generateBotReply({
  botName,
  userMessage,
  channelHistory,
  inspectedAttachment,
}) {
  dotenv.config({ path: ENV_PATH, override: true, quiet: true });
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    storage.geminiApiKey ||
    ""
  ).trim();

  // Tier 1: Official Google Gemini API if GEMINI_API_KEY is provided in .env
  if (apiKey) {
    try {
      return await callGeminiAPI({
        apiKey,
        botName,
        userMessage,
        channelHistory,
        inspectedAttachment,
      });
    } catch {
      // Quietly fall back to natural human colleague response if rate-limited or offline
    }
  }

  // Tier 2: Natural Human Colleague Fallback
  return generateNaturalHumanFallback({
    botName,
    userMessage,
    inspectedAttachment,
  });
}

/**
 * Curated per-colleague natural replies (used only if live AI is unavailable,
 * and strictly filtered against channelHistory so a message is NEVER repeated!)
 */
const COLLEAGUE_ORGANIC_LINES = {
  Alan: [
    "Checked the query profiler and index selectivity looks solid across all collections 👍",
    "Just reviewed the latest changes — clean separation between the socket hub and persistence layer.",
    "Everything on the backend cluster is running smoothly, let me know when we're ready to tag the release.",
    "Read through the spec and the latency numbers look great on my end.",
  ],
  Bob: [
    "Just tested the double-click side reply gesture on the message rows — feels super snappy!",
    "Pulled the latest frontend branch locally, component state transitions are super clean 👌",
    "Nice! The updated indigo-slate palette and floating reaction cards look way sharper now.",
    "Wrapped up the unit test pass on the UI components, zero console warnings.",
  ],
  Carol: [
    "Love the typography hierarchy and spacing on the new message cards ✨",
    "Just checked both Light and Dark studio themes — contrast ratios pass AAA across the board.",
    "The side popover for likes and reactions feels so much cleaner than browser tooltips!",
    "Reviewed the layout specs — the proportions and padding look spot on.",
  ],
  Dean: [
    "Edge WebSocket streams are holding steady at sub-15ms round-trip latency today ⚡",
    "Verified the heartbeat config against the Kraków test nodes, zero dropped packets.",
    "Just checked the sensor anomaly thresholds in the doc — looks good to sign off from my side.",
    "All telemetry pipelines are green, ready whenever you want to run the next test.",
  ],
  Elin: [
    "Cross-checked the validation metrics in the report — false-positive drift is well within bounds 📊",
    "Thanks for sharing! The data pipeline breakdown in Section 2 is super clear.",
    "Just finished running the verification notebook against the latest dataset, everything checks out.",
    "Reviewed the attachment metadata parser — PDF and code extraction are working great.",
  ],
};

/**
 * Curated per-colleague self-follow-up messages when a bot sent a message/file
 * and no one has replied yet — tags their own previous message just like real life!
 */
const COLLEAGUE_SELF_FOLLOWUPS = {
  Alan: [
    "Also quick follow-up on my note above ^ pushed the updated MongoDB index migration script to staging if anyone wants to test.",
    "@Kumar Kshitij no rush on this btw — whenever you get a chance to check the backend logs, let me know!",
    "One more detail on this ^ — connection pooling stayed under 4ms even during the peak load test.",
  ],
  Bob: [
    "Quick follow-up on this ^ also added a unit test for empty voter arrays so the reducer edge case is covered 👍",
    "@Kumar Kshitij @Carol just bumping my earlier message whenever you're free for a quick look — no rush!",
    "Forgot to mention on this ^ the dark mode contrast tokens are also updated in the same branch.",
  ],
  Carol: [
    "Also following up on my earlier message ^ exported the updated SVG icons to the shared assets folder if you need them!",
    "@Kumar Kshitij let me know what you think of this layout tweak whenever you get a sec ✨",
    "Quick addendum to this ^ tested the mobile drawer breakpoint at 860px and it transitions smoothly.",
  ],
  Dean: [
    "Quick update on my message above ^ Kraków edge nodes just completed another 10k-message stress test with zero drops ⚡",
    "@Kumar Kshitij ping me whenever you're around if you want to pair on the telemetry stream config!",
    "Also noting on this ^ I bumped the WebSocket ping interval to 10s so idle tabs stay connected.",
  ],
  Elin: [
    "Quick follow-up on my earlier post ^ I also attached the raw validation CSV in the notebook repo for reference 📄",
    "@Kumar Kshitij @Alan whenever you get a moment to check Section 2 of this spec, let me know your thoughts!",
    "One extra note on this ^ false-positive drift dropped another 0.08% after recalibrating the thermal window.",
  ],
};

let autonomousCursor = 0;

/**
 * Generates a realistic self-follow-up where the colleague quotes/tags (`replyTo`)
 * their own unanswered previous message (`targetMsg`), just like in real life!
 */
async function generateSelfFollowUpTurn(targetMsg, channelHistory, existingTexts) {
  const botName = targetMsg.user;
  const profile = BOT_PROFILES[botName];
  if (!profile) return null;

  const selfReplyTarget = {
    id: targetMsg.id,
    user: botName,
    text:
      targetMsg.text ||
      (targetMsg.attachment ? `📎 ${targetMsg.attachment.name}` : ""),
    attachmentName: targetMsg.attachment?.name || null,
    isSelfFollowUp: true,
  };

  dotenv.config({ path: ENV_PATH, override: true, quiet: true });
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    storage.geminiApiKey ||
    ""
  ).trim();

  if (apiKey) {
    for (const modelName of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: `You are ${botName} (${profile.designation}) in a company workspace with Kumar Kshitij, Alan, Bob, Carol, Dean, and Elin. You sent a message a moment ago ("${
                      targetMsg.text || targetMsg.attachment?.name || ""
                    }") and nobody has replied to it yet. Write a natural, friendly 1-sentence follow-up message (10 to 24 words) tagging/quoting your own previous message — either adding a small extra detail/update ("Also quick follow-up on this — ...") or casually checking in ("@Kumar Kshitij no rush on this, just let me know whenever you get a sec!"). NEVER repeat your previous message. Output ONLY the raw message text.`,
                  },
                ],
              },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Your unanswered previous message: "${
                        targetMsg.text || ""
                      }"${
                        targetMsg.attachment
                          ? ` [Attached file: ${targetMsg.attachment.name}]`
                          : ""
                      }\n\nWrite ${botName}'s natural follow-up tagging this message:`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.88,
                maxOutputTokens: 160,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawAiText =
            data?.candidates?.[0]?.content?.parts
              ?.map((p) => p.text || "")
              .join("")
              .trim() || "";
          const cleaned = cleanAiOutput(rawAiText, botName);
          if (cleaned && !existingTexts.has(cleaned.toLowerCase())) {
            return {
              botName,
              text: cleaned,
              attachment: null,
              replyTo: selfReplyTarget,
              isFollowUp: true,
            };
          }
        }
      } catch {
        // Fall back to curated self-follow-up below
      }
    }
  }

  const candidates = COLLEAGUE_SELF_FOLLOWUPS[botName] || [];
  const unused = candidates.find(
    (line) => !existingTexts.has(line.trim().toLowerCase())
  );
  if (!unused) return null;

  return {
    botName,
    text: unused,
    attachment: null,
    replyTo: selfReplyTarget,
    isFollowUp: true,
  };
}

export async function generateAutonomousTeamTurn(channelHistory = []) {
  // 1. REAL COLLEAGUE PACING: Count how many autonomous bot messages are at the end
  // of this channel without any human message after them.
  let trailingAutoCount = 0;
  for (let i = channelHistory.length - 1; i >= 0; i--) {
    const m = channelHistory[i];
    if (String(m.id || "").startsWith("msg-auto-")) {
      trailingAutoCount += 1;
    } else {
      break;
    }
  }
  if (trailingAutoCount >= 2) {
    return null;
  }

  const existingTexts = new Set(
    (channelHistory || [])
      .map((m) => String(m.text || "").trim().toLowerCase())
      .filter(Boolean)
  );

  const lastMsg =
    channelHistory.length > 0
      ? channelHistory[channelHistory.length - 1]
      : null;

  // 2. REAL-LIFE SELF FOLLOW-UP: If the last message in the channel was sent by a colleague
  // (either a reply to you or an autonomous post/file) and NO ONE has replied to it yet,
  // and it wasn't already a self-follow-up, have that colleague follow up tagging their own previous message!
  const isLastFromBot = lastMsg && USER_LIST.includes(lastMsg.user);
  const isAlreadySelfFollowUp =
    lastMsg &&
    (lastMsg.isFollowUp ||
      lastMsg.replyTo?.isSelfFollowUp ||
      lastMsg.replyTo?.user === lastMsg.user);

  if (isLastFromBot && !isAlreadySelfFollowUp && trailingAutoCount >= 1) {
    const followUpTurn = await generateSelfFollowUpTurn(
      lastMsg,
      channelHistory,
      existingTexts
    );
    if (followUpTurn) {
      return followUpTurn;
    }
  }

  autonomousCursor += 1;

  // 3. If the last message was a bot reply to a human (`msg-ai-*`) and the human hasn't replied yet,
  // let that same colleague send 1 polite follow-up tagging their own message!
  if (
    isLastFromBot &&
    !isAlreadySelfFollowUp &&
    String(lastMsg.id || "").startsWith("msg-ai-")
  ) {
    const followUpTurn = await generateSelfFollowUpTurn(
      lastMsg,
      channelHistory,
      existingTexts
    );
    if (followUpTurn) {
      return followUpTurn;
    }
  }

  // 4. If no unanswered bot turn is pending, a colleague can share an unseen Code Screenshot, PDF Spec, or Config file
  if (trailingAutoCount === 0) {
    const artifactTurn = getNextColleagueArtifactTurn(channelHistory);
    if (artifactTurn) {
      return {
        botName: artifactTurn.botName,
        text: artifactTurn.text,
        attachment: artifactTurn.attachment,
        replyTo: null,
        isFollowUp: false,
      };
    }
  }

  // 3. Otherwise, have ONE colleague reply naturally to the last message/attachment, then pause!
  const availableBots = USER_LIST.filter((u) => u !== lastMsg?.user);
  const botName =
    availableBots[autonomousCursor % availableBots.length] || "Carol";
  const profile = BOT_PROFILES[botName];

  dotenv.config({ path: ENV_PATH, override: true, quiet: true });
  const apiKey = (
    process.env.GEMINI_API_KEY ||
    storage.geminiApiKey ||
    ""
  ).trim();

  const replyTarget =
    lastMsg && lastMsg.id
      ? {
          id: lastMsg.id,
          user: lastMsg.user,
          text:
            lastMsg.text ||
            (lastMsg.attachment ? `📎 ${lastMsg.attachment.name}` : ""),
          attachmentName: lastMsg.attachment?.name || null,
        }
      : null;

  if (apiKey) {
    const recentTranscript = (channelHistory || [])
      .slice(-8)
      .map((m) => {
        const attNote = m.attachment
          ? ` [attached ${m.attachment.category}: ${m.attachment.name}]`
          : "";
        return `${m.user}${attNote}: ${m.text}`;
      })
      .join("\n");

    for (const modelName of ["gemini-2.5-flash", "gemini-2.5-flash-lite"]) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: `You are ${botName} (${profile.designation}) chatting casually with your teammates (Alan, Bob, Carol, Dean, Elin, and Kumar Kshitij) in a company workspace. Reply naturally to ${
                      lastMsg?.user || "the team"
                    }'s latest message or file attachment in 1 short sentence (8 to 22 words) like a real human colleague. Never repeat any message from the recent chat history and never quote their message. Output ONLY the raw message text.`,
                  },
                ],
              },
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `Recent chat (DO NOT repeat any of these lines):\n${recentTranscript || "(No messages yet)"}\n\nWrite ${botName}'s fresh, natural coworker reply:`,
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.88,
                maxOutputTokens: 180,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const rawAiText =
            data?.candidates?.[0]?.content?.parts
              ?.map((p) => p.text || "")
              .join("")
              .trim() || "";
          const cleaned = cleanAiOutput(rawAiText, botName);
          if (cleaned && !existingTexts.has(cleaned.toLowerCase())) {
            return {
              botName,
              text: cleaned,
              attachment: null,
              replyTo: replyTarget,
            };
          }
        }
      } catch {
        // Try next model or non-repeating colleague line below
      }
    }
  }

  // 4. Non-repeating per-colleague fallback: only return a line if it has NEVER been posted in this channel!
  const botLines = COLLEAGUE_ORGANIC_LINES[botName] || [];
  const unusedLine = botLines.find(
    (line) => !existingTexts.has(line.trim().toLowerCase())
  );

  if (!unusedLine) {
    // Nothing new to say — real colleagues stay quiet instead of repeating themselves!
    return null;
  }

  return {
    botName,
    text: unusedLine,
    attachment: null,
    replyTo: replyTarget,
  };
}
