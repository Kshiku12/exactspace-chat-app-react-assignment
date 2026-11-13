/**
 * Real-Life Colleague Attachment Generator (Code Screenshots, Valid PDFs, Code Files)
 * Allows Alan, Bob, Carol, Dean, and Elin to share real, downloadable, inspectable
 * screenshots of code/dashboards, PDF documents for verification, and source files.
 */

function createCodeScreenshotDataUrl({
  windowTitle,
  badgeText,
  accentColor = "#6366f1",
  lines = [],
  footerLeft = "UTF-8 · TypeScript React",
  footerRight = "Ln 42, Col 18 · Prettier ✓",
}) {
  const escapedLines = lines.map((line, i) => {
    const y = 96 + i * 26;
    const lineNum = i + 1;
    const safeText = String(line.text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const color = line.color || "#e2e8f0";
    const indent = (line.indent || 0) * 18;
    return `
      <text x="28" y="${y}" fill="#475569" font-family="Consolas, 'JetBrains Mono', monospace" font-size="13">${String(
        lineNum
      ).padStart(2, "0")}</text>
      <text x="${68 + indent}" y="${y}" fill="${color}" font-family="Consolas, 'JetBrains Mono', monospace" font-size="13.5">${safeText}</text>
    `;
  });

  const height = Math.max(340, 130 + lines.length * 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="${height}" viewBox="0 0 880 ${height}">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e1b4b"/>
      </linearGradient>
    </defs>
    <rect width="880" height="${height}" rx="14" fill="url(#bgGrad)"/>
    <rect x="14" y="14" width="852" height="${height - 28}" rx="10" fill="#0b1120" stroke="#1e293b" stroke-width="1.5"/>
    <!-- Window Title Bar -->
    <rect x="14" y="14" width="852" height="44" rx="10" fill="#111827"/>
    <circle cx="38" cy="36" r="6" fill="#ef4444"/>
    <circle cx="58" cy="36" r="6" fill="#f59e0b"/>
    <circle cx="78" cy="36" r="6" fill="#10b981"/>
    <text x="104" y="41" fill="#cbd5e1" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600">${windowTitle}</text>
    <rect x="690" y="24" width="158" height="24" rx="6" fill="${accentColor}" fill-opacity="0.2" stroke="${accentColor}" stroke-width="1"/>
    <text x="769" y="40" text-anchor="middle" fill="#e0e7ff" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700">${badgeText}</text>
    <!-- Code Lines -->
    ${escapedLines.join("\n")}
    <!-- Status Footer -->
    <rect x="14" y="${height - 42}" width="852" height="28" rx="6" fill="#0f172a"/>
    <text x="30" y="${height - 24}" fill="#64748b" font-family="Inter, system-ui, sans-serif" font-size="11.5">${footerLeft}</text>
    <text x="848" y="${height - 24}" text-anchor="end" fill="#38bdf8" font-family="Inter, system-ui, sans-serif" font-size="11.5" font-weight="600">${footerRight}</text>
  </svg>`;

  const base64 = Buffer.from(svg, "utf8").toString("base64");
  return {
    dataUrl: `data:image/svg+xml;base64,${base64}`,
    dimensions: `880×${height}px`,
    sizeBytes: Buffer.byteLength(svg, "utf8"),
    sizeFormatted: `${Math.max(12, Math.round(Buffer.byteLength(svg, "utf8") / 100))} KB`,
  };
}

/**
 * Generates a real, downloadable PDF binary buffer encoded as base64 dataUrl
 */
function createValidPdfAttachment({ fileName, title, author, sections = [] }) {
  const textItems = [
    `${title} — Author: ${author}`,
    ...sections.map((s) => `${s.heading}: ${s.body}`),
  ];

  const streamLines = [
    "BT",
    "/F1 14 Tf",
    "50 750 Td",
    `(${title.replace(/[()\\]/g, "")}) Tj`,
    "/F1 10 Tf",
    "0 -20 Td",
    `(Prepared by ${author} - ExactSpace Engineering) Tj`,
  ];

  sections.forEach((sec) => {
    streamLines.push("0 -26 Td");
    streamLines.push(`/F1 11 Tf (${sec.heading.replace(/[()\\]/g, "")}) Tj`);
    streamLines.push("0 -16 Td");
    streamLines.push(
      `/F1 9.5 Tf (${sec.body.slice(0, 110).replace(/[()\\]/g, "")}) Tj`
    );
  });
  streamLines.push("ET");
  const contentStream = streamLines.join("\n");

  const pdfRaw = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >> endobj
4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >> endobj
5 0 obj << /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`;

  const base64 = Buffer.from(pdfRaw, "utf8").toString("base64");
  return {
    name: fileName,
    category: "pdf",
    mimeType: "application/pdf",
    sizeFormatted: "148 KB",
    sizeBytes: 151552,
    pageCount: 2,
    dataUrl: `data:application/pdf;base64,${base64}`,
    extractedText: textItems.join(" · "),
  };
}

function createCodeFileAttachment({ fileName, codeContent, lang = "code" }) {
  const base64 = Buffer.from(codeContent, "utf8").toString("base64");
  return {
    name: fileName,
    category: lang,
    mimeType: "text/plain",
    sizeFormatted: `${Math.max(2, Math.round(codeContent.length / 180))} KB`,
    sizeBytes: codeContent.length,
    dataUrl: `data:text/plain;base64,${base64}`,
    extractedText: codeContent,
  };
}

/**
 * Rich Library of Colleague Artifacts (Screenshots of Code, PDFs for Review, Configs)
 */
export const COLLEAGUE_ARTIFACT_TURNS = [
  {
    botName: "Bob",
    text: "Hey @Carol @Kumar Kshitij — took a screenshot of the new single-like state reducer in `storage.js`. Can you verify the voter deduplication check before I merge this PR?",
    buildAttachment: () => {
      const img = createCodeScreenshotDataUrl({
        windowTitle: "server/storage.js — Voter Deduplication Check",
        badgeText: "PR #142 · Ready",
        accentColor: "#10b981",
        lines: [
          { text: "async toggleSingleLike(channelId, messageId, voter) {", color: "#38bdf8", indent: 0 },
          { text: "const target = this.getChannelMessages(channelId).find(m => m.id === messageId);", color: "#cbd5e1", indent: 1 },
          { text: "const existingIdx = target.likedBy.findIndex(", color: "#a78bfa", indent: 1 },
          { text: "entry => entry.employeeId === voter.employeeId", color: "#34d399", indent: 2 },
          { text: ");", color: "#a78bfa", indent: 1 },
          { text: "// Enforce strict 1-like-per-employee rule", color: "#64748b", indent: 1 },
          { text: "if (existingIdx >= 0) target.likedBy.splice(existingIdx, 1);", color: "#fbbf24", indent: 1 },
          { text: "else target.likedBy.push({ employeeId: voter.employeeId, name: voter.name });", color: "#34d399", indent: 1 },
          { text: "target.likes = target.likedBy.length;", color: "#f472b6", indent: 1 },
          { text: "return await this.persistLikeUpdate(messageId, target);", color: "#38bdf8", indent: 1 },
          { text: "}", color: "#38bdf8", indent: 0 },
        ],
        footerLeft: "Node.js v22 · ESM Module",
        footerRight: "All 18 unit tests passing ✓",
      });
      return {
        name: "single_like_reducer_screenshot.png",
        category: "image",
        mimeType: "image/svg+xml",
        ...img,
        extractedText: "toggleSingleLike voter deduplication check in storage.js",
      };
    },
  },
  {
    botName: "Elin",
    text: "@all Uploading the Q4 Turbine Anomaly & Predictive Maintenance verification PDF. Could everyone check Section 2 on sensor drift thresholds before our afternoon sync?",
    buildAttachment: () =>
      createValidPdfAttachment({
        fileName: "Turbine_Anomaly_Verification_Spec_v2.pdf",
        title: "Q4 Industrial Turbine Anomaly Verification Spec",
        author: "Elin Emmanuel (Data Intelligence Lead)",
        sections: [
          {
            heading: "1. Executive Summary",
            body: "Validated false-positive rate down to 0.42% across 18 Kraków & Bengaluru edge telemetry nodes.",
          },
          {
            heading: "2. Vibration & Thermal Thresholds",
            body: " bearing_temp_c > 84.5C triggers Socket.io priority alert within 120ms end-to-end latency.",
          },
          {
            heading: "3. Sign-Off Checklist",
            body: "Pending architecture sign-off from Alan, Dean, and Kumar Kshitij.",
          },
        ],
      }),
  },
  {
    botName: "Alan",
    text: "Attached a screenshot of our MongoDB Atlas compound index explain plan 📊 Query execution time dropped from 48ms down to 1.8ms after indexing `channelId + createdAtMs`.",
    buildAttachment: () => {
      const img = createCodeScreenshotDataUrl({
        windowTitle: "MongoDB Atlas Profiler — exactspace_chat.messages",
        badgeText: "1.8ms IXSCAN ⚡",
        accentColor: "#0284c7",
        lines: [
          { text: "db.messages.find({ channelId: 'introductions' }).sort({ createdAtMs: 1 }).explain('executionStats')", color: "#38bdf8", indent: 0 },
          { text: "{", color: "#94a3b8", indent: 0 },
          { text: "\"winningPlan\": { \"stage\": \"FETCH\", \"inputStage\": { \"stage\": \"IXSCAN\" } },", color: "#34d399", indent: 1 },
          { text: "\"indexName\": \"channelId_1_createdAtMs_1\",", color: "#fbbf24", indent: 1 },
          { text: "\"totalKeysExamined\": 24,", color: "#cbd5e1", indent: 1 },
          { text: "\"totalDocsExamined\": 24,", color: "#cbd5e1", indent: 1 },
          { text: "\"executionTimeMillis\": 1.82,", color: "#10b981", indent: 1 },
          { text: "\"clusterRegion\": \"AWS ap-south-1 (Mumbai / Bengaluru)\"", color: "#a78bfa", indent: 1 },
          { text: "}", color: "#94a3b8", indent: 0 },
        ],
        footerLeft: "MongoDB Atlas Cluster0 · Mongoose 8.9",
        footerRight: "Zero Collection Scans ✓",
      });
      return {
        name: "mongodb_index_explain_plan.png",
        category: "image",
        mimeType: "image/svg+xml",
        ...img,
        extractedText: "MongoDB IXSCAN explain plan 1.82ms on channelId_1_createdAtMs_1",
      };
    },
  },
  {
    botName: "Carol",
    text: "Hey team, sharing the updated UI color & typography specification PDF for the workspace redesign — shifted away from heavy green to a cleaner indigo-slate studio palette ✨",
    buildAttachment: () =>
      createValidPdfAttachment({
        fileName: "ExactSpace_UI_Design_System_v3.pdf",
        title: "ExactSpace Studio Design System & UI Audit",
        author: "Carol Shaw (Staff Product Designer)",
        sections: [
          {
            heading: "1. Color Palette Architecture",
            body: "Primary Accent: Electric Indigo (#4F46E5) & Slate Graphite (#0F172A) with warm stone surfaces.",
          },
          {
            heading: "2. Side-by-Side Reaction Popover",
            body: "Hovering Likes or Reactions displays a floating contributor card right next to the badge.",
          },
        ],
      }),
  },
  {
    botName: "Dean",
    text: "Dropping the live edge WebSocket heartbeat config (`edge_stream_config.json`) here so everyone has the exact reconnect intervals we're running in Kraków 🔧",
    buildAttachment: () =>
      createCodeFileAttachment({
        fileName: "edge_stream_config.json",
        lang: "code",
        codeContent: JSON.stringify(
          {
            cluster: "krakow-telemetry-eu-central",
            websocket: {
              transport: ["websocket", "polling"],
              pingIntervalMs: 10000,
              pingTimeoutMs: 5000,
              maxPayloadBytes: 26214400,
            },
            alertRouting: {
              broadcastTag: "@all",
              primaryEngineers: ["Alan", "Bob", "Carol", "Dean", "Elin", "Kumar Kshitij"],
            },
          },
          null,
          2
        ),
      }),
  },
  {
    botName: "Bob",
    text: "Captured the React 19 profiler flamegraph after memoizing `MessageItem` — re-render time during fast typing dropped to 0.6ms ⚡",
    buildAttachment: () => {
      const img = createCodeScreenshotDataUrl({
        windowTitle: "React DevTools Profiler — MessageItem Memoization",
        badgeText: "0.6ms Commit ⚡",
        accentColor: "#8b5cf6",
        lines: [
          { text: "// src/components/MessageItem.jsx — Double-Tap Side Reply Handler", color: "#94a3b8", indent: 0 },
          { text: "const handleRowDoubleClick = (e) => {", color: "#38bdf8", indent: 0 },
          { text: "if (e.target.closest('button, input, a, .wa-like-box')) return;", color: "#fbbf24", indent: 1 },
          { text: "setReplyFlash(true);", color: "#a78bfa", indent: 1 },
          { text: "onReply(message);", color: "#34d399", indent: 1 },
          { text: "setTimeout(() => setReplyFlash(false), 450);", color: "#cbd5e1", indent: 1 },
          { text: "};", color: "#38bdf8", indent: 0 },
        ],
        footerLeft: "Vite 7.3 · React 19 Concurrent Mode",
        footerRight: "60 FPS Locked ✓",
      });
      return {
        name: "react_profiler_double_tap_reply.png",
        category: "image",
        mimeType: "image/svg+xml",
        ...img,
        extractedText: "React DevTools Profiler 0.6ms commit for MessageItem double-tap reply handler",
      };
    },
  },
  {
    botName: "Alan",
    text: "Sharing the API gateway & WebSocket pub/sub security checklist PDF for our release sign-off 🔒",
    buildAttachment: () =>
      createValidPdfAttachment({
        fileName: "ExactSpace_WebSocket_Security_Audit.pdf",
        title: "WebSocket Pub/Sub & JWT Session Security Audit",
        author: "Alan Turing (Lead Systems Architect)",
        sections: [
          {
            heading: "1. Token Verification & Scrypt Hashing",
            body: "All employee credentials use 64-byte scrypt key derivation with per-employee cryptographic salts.",
          },
          {
            heading: "2. Room Isolation & Broadcast Rate Limits",
            body: "Socket.io channels enforce payload validation and deduplicated voter arrays on every event.",
          },
        ],
      }),
  },
];

let artifactCursor = 0;

/**
 * Returns the next colleague artifact ONLY if its attachment file and text
 * have NOT already been posted in `channelHistory`. Never repeats!
 */
export function getNextColleagueArtifactTurn(channelHistory = []) {
  const existingNames = new Set(
    (channelHistory || [])
      .map((m) => m.attachment?.name?.toLowerCase())
      .filter(Boolean)
  );
  const existingTexts = new Set(
    (channelHistory || [])
      .map((m) => String(m.text || "").trim().toLowerCase())
      .filter(Boolean)
  );

  for (let i = 0; i < COLLEAGUE_ARTIFACT_TURNS.length; i++) {
    const idx = (artifactCursor + i) % COLLEAGUE_ARTIFACT_TURNS.length;
    const candidate = COLLEAGUE_ARTIFACT_TURNS[idx];
    const builtAttachment = candidate.buildAttachment();
    const attNameLower = (builtAttachment.name || "").toLowerCase();
    const textLower = candidate.text.trim().toLowerCase();

    if (!existingNames.has(attNameLower) && !existingTexts.has(textLower)) {
      artifactCursor = idx + 1;
      return {
        botName: candidate.botName,
        text: candidate.text,
        attachment: builtAttachment,
      };
    }
  }

  // All curated artifacts already exist in this channel — do not repeat any of them!
  return null;
}

/**
 * Checks if the user's message is asking a colleague to send/share a screenshot,
 * code snippet, PDF, report, or file, and returns an appropriate attachment for that bot.
 */
export function maybeGenerateRequestedBotAttachment(botName, userMessageText = "") {
  const lower = String(userMessageText || "").toLowerCase();
  const wantsFile =
    /screenshot|screen shot|image|diagram|pdf|report|document|spec|code|snippet|file|attach|share|send me|show me|verify|log|config/i.test(
      lower
    );

  if (!wantsFile) return null;

  if (/pdf|report|doc|spec|paper/i.test(lower)) {
    return createValidPdfAttachment({
      fileName: `${botName}_Engineering_Verification_Note.pdf`,
      title: `${botName}'s Engineering Verification & Spec Notes`,
      author: `${botName} (ExactSpace Engineering)`,
      sections: [
        {
          heading: "1. Verification Summary",
          body: `Prepared in response to ${userMessageText.slice(0, 70)}. All checks passed.`,
        },
        {
          heading: "2. Implementation Notes",
          body: "Verified real-time Socket.io pub/sub events, MongoDB schema indexes, and UI responsiveness.",
        },
      ],
    });
  }

  if (/code|json|config|sql|snippet/i.test(lower) && !/screenshot|image/i.test(lower)) {
    return createCodeFileAttachment({
      fileName: `${botName.toLowerCase()}_verification_snippet.js`,
      lang: "code",
      codeContent: `// Shared by ${botName} for quick team review\nexport async function verifyWorkspaceHealth(socket, db) {\n  const start = performance.now();\n  const status = await db.getStatus();\n  return {\n    ok: true,\n    mongoConnected: status.mongoConnected,\n    latencyMs: Math.round(performance.now() - start),\n    verifiedBy: "${botName}",\n  };\n}\n`,
    });
  }

  // Default to a crisp code/profiler screenshot image
  const img = createCodeScreenshotDataUrl({
    windowTitle: `${botName} — Live Verification Snapshot`,
    badgeText: `Verified by ${botName} ✓`,
    accentColor: "#6366f1",
    lines: [
      { text: `// Snapshot captured by ${botName} for @Kumar Kshitij`, color: "#94a3b8", indent: 0 },
      { text: "const socketStream = io.of('/workspace').on('connection', (client) => {", color: "#38bdf8", indent: 0 },
      { text: "client.on('message:publish', async (payload) => {", color: "#a78bfa", indent: 1 },
      { text: "await MessageModel.updateOne({ id: payload.id }, payload, { upsert: true });", color: "#34d399", indent: 2 },
      { text: "io.emit('message:new', payload); // Sub-15ms broadcast", color: "#fbbf24", indent: 2 },
      { text: "});", color: "#a78bfa", indent: 1 },
      { text: "});", color: "#38bdf8", indent: 0 },
    ],
    footerLeft: `Captured by ${botName} · ExactSpace Studio`,
    footerRight: "Status: 200 OK · 0 Errors",
  });

  return {
    name: `${botName.toLowerCase()}_code_snapshot.png`,
    category: "image",
    mimeType: "image/svg+xml",
    ...img,
    extractedText: `Code snapshot shared by ${botName}`,
  };
}

