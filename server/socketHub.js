import {
  USER_LIST,
  BOT_PROFILES,
  storage,
  signToken,
  verifyToken,
} from "./storage.js";
import {
  inspectAttachment,
  selectRespondingBots,
  generateBotReply,
  generateAutonomousTeamTurn,
  maybeGenerateRequestedBotAttachment,
} from "./aiEngine.js";

export { USER_LIST };

/**
 * Parses JSON body from raw Node http.IncomingMessage (used in Vite middleware)
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      return resolve(req.body);
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      // Allow up to 25MB payloads for PDF / high-res image attachments
      if (raw.length > 25 * 1024 * 1024) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

/**
 * API Router middleware compatible with both Express and Vite's Connect server
 */
export function createApiMiddleware() {
  return async (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (!url.startsWith("/api/")) {
      return next();
    }

    try {
      // GET /api/health & /api/config/status
      if (req.method === "GET" && (url === "/api/health" || url === "/api/config/status")) {
        return sendJson(res, 200, {
          ok: true,
          ...storage.getStatus(),
          employees: storage.getAllEmployees(),
        });
      }

      // POST /api/config/update (Configure MongoDB Atlas URI & Gemini API Key live)
      if (req.method === "POST" && url === "/api/config/update") {
        const body = await parseJsonBody(req);
        let mongoResult = null;
        if (typeof body.mongoUri === "string") {
          mongoResult = await storage.connectMongo(body.mongoUri);
        }
        if (typeof body.geminiApiKey === "string") {
          storage.setGeminiKey(body.geminiApiKey);
        }
        return sendJson(res, 200, {
          ok: true,
          mongoResult,
          status: storage.getStatus(),
        });
      }

      // GET /api/employees
      if (req.method === "GET" && url === "/api/employees") {
        return sendJson(res, 200, {
          ok: true,
          employees: storage.getAllEmployees(),
        });
      }

      // POST /api/auth/register
      if (req.method === "POST" && url === "/api/auth/register") {
        const body = await parseJsonBody(req);
        const employee = await storage.registerEmployee(body);
        const token = signToken(employee);
        return sendJson(res, 201, {
          ok: true,
          employee,
          token,
          dbStatus: storage.getStatus(),
        });
      }

      // POST /api/auth/login
      if (req.method === "POST" && url === "/api/auth/login") {
        const body = await parseJsonBody(req);
        const employee = await storage.authenticateEmployee(body);
        const token = signToken(employee);
        return sendJson(res, 200, {
          ok: true,
          employee,
          token,
          dbStatus: storage.getStatus(),
        });
      }

      // GET /api/auth/me
      if (req.method === "GET" && url === "/api/auth/me") {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const decoded = verifyToken(token);
        if (!decoded) {
          return sendJson(res, 401, { ok: false, error: "Invalid session" });
        }
        const all = storage.getAllEmployees();
        const employee = all.find(
          (e) =>
            e.employeeId === decoded.employeeId || e.email === decoded.email
        );
        if (!employee) {
          return sendJson(res, 404, { ok: false, error: "Employee not found" });
        }
        return sendJson(res, 200, {
          ok: true,
          employee,
          dbStatus: storage.getStatus(),
        });
      }

      return next();
    } catch (err) {
      return sendJson(res, 400, {
        ok: false,
        error: err.message || "Request failed",
      });
    }
  };
}

export function attachSocketHub(io, expressApp = null) {
  const connectedClients = new Set();
  const clientActiveChannel = new Map();
  let lastHumanActivityAt = Date.now();

  if (expressApp) {
    expressApp.use(createApiMiddleware());
  }

  /**
   * Triggers an organic background colleague interaction (sharing code screenshots,
   * PDF verification reports, or replying to recent messages) so the workspace is
   * naturally alive even without any manual simulation toggle.
   */
  async function runOrganicCoworkerTurn(targetChannelId = "introductions") {
    if (connectedClients.size === 0) return;
    // Avoid interrupting if a human sent a message in the last 8 seconds
    if (Date.now() - lastHumanActivityAt < 8000) return;

    const channelId = targetChannelId || "introductions";
    const isDm = channelId.startsWith("dm-");
    const dmTarget = isDm ? channelId.replace("dm-", "").toLowerCase() : null;

    const history = storage.getMessagesByChannel()[channelId] || [];
    const turnResult = await generateAutonomousTeamTurn(history);
    if (!turnResult) return;

    const { botName, text, attachment, replyTo, isFollowUp } = turnResult;
    const botProfile = BOT_PROFILES[botName];
    if (!botProfile || (!text && !attachment)) return;

    // In a 1-on-1 DM, ONLY allow the DM colleague themselves to send a follow-up to their own unanswered message
    if (isDm && (botName.toLowerCase() !== dmTarget || !isFollowUp)) {
      return;
    }

    // Double-check history right before typing so a bot NEVER repeats a message or attachment
    const alreadyExists = history.some(
      (m) =>
        (text &&
          String(m.text || "").trim().toLowerCase() ===
            text.trim().toLowerCase()) ||
        (attachment?.name &&
          m.attachment?.name?.toLowerCase() === attachment.name.toLowerCase())
    );
    if (alreadyExists) return;

    io.emit("typing:status", {
      channelId,
      user: botName,
      isTyping: true,
    });

    setTimeout(async () => {
      io.emit("typing:status", {
        channelId,
        user: botName,
        isTyping: false,
      });

      const now = new Date();
      const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      const botMsg = {
        id: `msg-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        channelId,
        user: botName,
        senderEmployeeId: botProfile.employeeId,
        senderRole: botProfile.designation,
        initials: botProfile.initials,
        avatarColor: botProfile.avatarColor,
        text,
        timestamp,
        createdAtMs: Date.now(),
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: replyTo || null,
        isFollowUp: Boolean(isFollowUp),
        attachment: attachment || null,
      };

      await storage.addMessage(channelId, botMsg);
      io.emit("message:new", botMsg);

      // If the colleague shared an attachment (Code Screenshot, PDF, or Config), have 1-2 teammates react & verify it!
      if (attachment) {
        const otherBots = USER_LIST.filter((u) => u !== botName);
        const reviewer =
          otherBots[Math.floor(Math.random() * otherBots.length)] || "Alan";
        const reviewerProfile = BOT_PROFILES[reviewer];

        setTimeout(async () => {
          const updatedReaction = await storage.toggleReaction(
            channelId,
            botMsg.id,
            attachment.category === "pdf" ? "💯" : "🔥",
            reviewer,
            { onlyAdd: true }
          );
          if (updatedReaction) {
            io.emit("message:reacted", {
              channelId,
              messageId: botMsg.id,
              reactions: updatedReaction.reactions,
            });
          }

          const updatedLike = await storage.toggleSingleLike(
            channelId,
            botMsg.id,
            {
              employeeId: reviewerProfile.employeeId,
              name: reviewerProfile.fullName,
            },
            { onlyAdd: true }
          );
          if (updatedLike) {
            io.emit("message:liked", {
              channelId,
              messageId: botMsg.id,
              likes: updatedLike.likes,
              likedBy: updatedLike.likedBy,
            });
          }
        }, 2200);
      }
    }, 1800);
  }

  // Always-on background workplace heartbeat (every 30 seconds when clients are connected)
  setInterval(() => {
    if (connectedClients.size === 0) return;
    const activeChannels = Array.from(clientActiveChannel.values());
    const preferred = activeChannels[0] || "introductions";
    runOrganicCoworkerTurn(preferred);
  }, 30000);

  /**
   * Triggers intelligent AI reactions, single-likes, and contextual replies from
   * Alan, Bob, Carol, Dean, and Elin whenever a human employee posts a message or file!
   */
  async function triggerAiTeammateResponses(userMessage) {
    const channelId = userMessage.channelId || "introductions";
    const { primary, reactors, isAllMention } = selectRespondingBots(
      userMessage,
      channelId
    );

    if (isAllMention) {
      io.emit("mention:broadcast", {
        channelId,
        sender: userMessage.user,
        notifiedUsers: USER_LIST,
        messageId: userMessage.id,
      });
    }

    // 1. Have reactors react / like the message after a short human delay (850ms)
    setTimeout(async () => {
      const emojiChoices = userMessage.attachment
        ? ["🔥", "🚀", "👏", "💯"]
        : ["👍", "🚀", "❤️", "🔥"];

      const reactorSlice = isAllMention ? reactors : reactors.slice(0, 2);

      for (const reactorBot of reactorSlice) {
        const botProfile = BOT_PROFILES[reactorBot];
        if (!botProfile) continue;

        const emoji =
          emojiChoices[Math.floor(Math.random() * emojiChoices.length)];
        const updatedReactionMsg = await storage.toggleReaction(
          channelId,
          userMessage.id,
          emoji,
          reactorBot,
          { onlyAdd: true }
        );
        if (updatedReactionMsg) {
          io.emit("message:reacted", {
            channelId,
            messageId: userMessage.id,
            reactions: updatedReactionMsg.reactions,
          });
        }

        // Bot also gives a single Like if the message has an attachment, @all, or mention
        if (
          isAllMention ||
          userMessage.attachment ||
          userMessage.replyTo ||
          Math.random() > 0.35
        ) {
          const updatedLikeMsg = await storage.toggleSingleLike(
            channelId,
            userMessage.id,
            {
              employeeId: botProfile.employeeId,
              name: botProfile.fullName,
            },
            { onlyAdd: true }
          );
          if (updatedLikeMsg) {
            io.emit("message:liked", {
              channelId,
              messageId: userMessage.id,
              likes: updatedLikeMsg.likes,
              likedBy: updatedLikeMsg.likedBy,
            });
          }
        }
      }
    }, 850);

    // 2. Have each selected primary bot type and post a contextual reply (and attach a code screenshot/PDF if requested!)
    const inspectedAttachment = userMessage.attachment
      ? inspectAttachment(userMessage.attachment)
      : null;

    primary.forEach((botName, index) => {
      const startTypingDelay = 700 + index * 2400;
      const finishTypingDelay = startTypingDelay + 1500 + index * 500;

      setTimeout(() => {
        io.emit("typing:status", {
          channelId,
          user: botName,
          isTyping: true,
        });
      }, startTypingDelay);

      setTimeout(async () => {
        try {
          const history =
            storage.getMessagesByChannel()[channelId] || [];
          const replyText = await generateBotReply({
            botName,
            userMessage,
            channelHistory: history,
            inspectedAttachment,
          });

          // If the user asked for a screenshot, PDF, code snippet, or verification doc, attach it!
          const requestedBotAttachment =
            index === 0
              ? maybeGenerateRequestedBotAttachment(botName, userMessage.text)
              : null;

          io.emit("typing:status", {
            channelId,
            user: botName,
            isTyping: false,
          });

          const botProfile = BOT_PROFILES[botName];
          const now = new Date();
          const timestamp = `${String(now.getHours()).padStart(
            2,
            "0"
          )}:${String(now.getMinutes()).padStart(2, "0")}`;

          const botMessage = {
            id: `msg-ai-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 7)}`,
            channelId,
            user: botName,
            senderEmployeeId: botProfile.employeeId,
            senderRole: botProfile.designation,
            initials: botProfile.initials,
            avatarColor: botProfile.avatarColor,
            text: replyText,
            timestamp,
            createdAtMs: Date.now(),
            likes: 0,
            likedBy: [],
            reactions: {},
            pinned: false,
            replyTo: {
              id: userMessage.id,
              user: userMessage.user,
              text:
                userMessage.text ||
                (userMessage.attachment
                  ? `📎 ${userMessage.attachment.name}`
                  : ""),
              attachmentName: userMessage.attachment?.name || null,
            },
            attachment: requestedBotAttachment,
          };

          await storage.addMessage(channelId, botMessage);
          io.emit("message:new", botMessage);

          // If this is the last responder and no reply is given within 22s,
          // the bot can send a realistic follow-up tagging their own previous message!
          if (index === primary.length - 1) {
            setTimeout(() => {
              const latestList =
                storage.getMessagesByChannel()[channelId] || [];
              const latestMsg = latestList[latestList.length - 1];
              if (latestMsg && latestMsg.id === botMessage.id) {
                runOrganicCoworkerTurn(channelId);
              }
            }, 22000);
          }
        } catch (err) {
          io.emit("typing:status", {
            channelId,
            user: botName,
            isTyping: false,
          });
          console.error("[AI Reply Error]:", err.message);
        }
      }, finishTypingDelay);
    });
  }

  io.on("connection", (socket) => {
    connectedClients.add(socket.id);
    clientActiveChannel.set(socket.id, "introductions");

    socket.emit("state:init", {
      channels: storage.getChannels(),
      messagesByChannel: storage.getMessagesByChannel(),
      employees: storage.getAllEmployees(),
      onlineConnections: connectedClients.size,
      dbStatus: storage.getStatus(),
    });

    io.emit("presence:update", {
      onlineConnections: connectedClients.size,
    });

    // Trigger a natural coworker interaction 14s after joining if the channel is quiet
    if (connectedClients.size === 1) {
      setTimeout(() => {
        if (connectedClients.size > 0 && Date.now() - lastHumanActivityAt >= 8000) {
          const ch = clientActiveChannel.get(socket.id) || "introductions";
          runOrganicCoworkerTurn(ch);
        }
      }, 14000);
    }

    socket.on("channel:subscribe", (channelId) => {
      clientActiveChannel.set(socket.id, channelId || "introductions");
      socket.join(`channel:${channelId}`);
      socket.emit("channel:history", {
        channelId,
        messages: storage.getMessagesByChannel()[channelId] || [],
      });
    });

    // Publish a new chat message or file attachment
    socket.on("message:publish", async (payload, ack) => {
      lastHumanActivityAt = Date.now();
      const channelId = payload.channelId || "introductions";
      const now = new Date();
      const timestamp =
        payload.timestamp ||
        `${String(now.getHours()).padStart(2, "0")}:${String(
          now.getMinutes()
        ).padStart(2, "0")}`;

      // Enrich attachment metadata if present
      let processedAttachment = payload.attachment || null;
      if (processedAttachment) {
        const inspected = inspectAttachment(processedAttachment);
        processedAttachment = {
          name: inspected.name,
          category: inspected.category,
          mimeType: inspected.mimeType,
          sizeFormatted: inspected.sizeFormatted,
          sizeBytes: inspected.sizeBytes,
          dataUrl: inspected.dataUrl,
          extractedText: inspected.extractedText,
          dimensions: inspected.dimensions,
          pageCount: inspected.pageCount,
        };
      }

      const newMessage = {
        id:
          payload.id ||
          `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        channelId,
        user: payload.user || "Kumar Kshitij",
        senderEmployeeId: payload.senderEmployeeId || "EXS-2026-001",
        senderRole: payload.senderRole || "Software Engineer",
        initials:
          payload.initials ||
          (payload.user || "KK").slice(0, 2).toUpperCase(),
        avatarColor: payload.avatarColor || "#00a884",
        text: String(payload.text || "").trim(),
        timestamp,
        createdAtMs: Date.now(),
        likes: 0,
        likedBy: [],
        reactions: payload.reactions || {},
        pinned: Boolean(payload.pinned),
        replyTo: payload.replyTo || null,
        attachment: processedAttachment,
      };

      await storage.addMessage(channelId, newMessage);
      io.emit("message:new", newMessage);

      if (typeof ack === "function") {
        ack({ ok: true, message: newMessage });
      }

      // If this message came from a real employee (not an autonomous bot turn), trigger AI teammates!
      if (!payload.skipAiReply && !String(newMessage.senderEmployeeId).startsWith("EXS-BOT-")) {
        triggerAiTeammateResponses(newMessage);
      }
    });

    // Requirement 1: One person can only like a message once!
    socket.on("message:like", async ({ channelId, messageId, voter }) => {
      const updated = await storage.toggleSingleLike(
        channelId,
        messageId,
        voter || { employeeId: "EXS-2026-001", name: "Kumar Kshitij" }
      );
      if (updated) {
        io.emit("message:liked", {
          channelId,
          messageId,
          likes: updated.likes,
          likedBy: updated.likedBy,
        });
      }
    });

    // Toggle emoji reaction per user
    socket.on("message:react", async ({ channelId, messageId, emoji, userName }) => {
      const updated = await storage.toggleReaction(
        channelId,
        messageId,
        emoji,
        userName || "Kumar Kshitij"
      );
      if (updated) {
        io.emit("message:reacted", {
          channelId,
          messageId,
          reactions: updated.reactions,
        });
      }
    });

    // Trigger an organic AI teammate discussion turn
    socket.on("ai:autonomous-turn", async ({ channelId }) => {
      await runOrganicCoworkerTurn(channelId || "introductions");
    });

    // Pin/unpin message
    socket.on("message:pin", ({ channelId, messageId }) => {
      const list = storage.getMessagesByChannel()[channelId];
      if (!list) return;
      const target = list.find((m) => m.id === messageId);
      if (target) {
        target.pinned = !target.pinned;
        storage.saveLocalDisk();
        io.emit("message:pinned", {
          channelId,
          messageId,
          pinned: target.pinned,
        });
      }
    });

    // Edit message
    socket.on("message:edit", ({ channelId, messageId, text }) => {
      const list = storage.getMessagesByChannel()[channelId];
      if (!list) return;
      const target = list.find((m) => m.id === messageId);
      if (target && text && text.trim()) {
        target.text = text.trim();
        target.edited = true;
        storage.saveLocalDisk();
        io.emit("message:edited", {
          channelId,
          messageId,
          text: target.text,
          edited: true,
        });
      }
    });

    // Delete message
    socket.on("message:delete", ({ channelId, messageId }) => {
      const byChan = storage.getMessagesByChannel();
      const list = byChan[channelId];
      if (!list) return;
      byChan[channelId] = list.filter((m) => m.id !== messageId);
      storage.saveLocalDisk();
      io.emit("message:deleted", { channelId, messageId });
    });

    // Create channel
    socket.on("channel:create", ({ name, description }) => {
      const created = storage.createChannel({ name, description });
      if (created && created.channel) {
        io.emit("channel:created", created);
      }
    });

    socket.on("typing:update", ({ channelId, user, isTyping }) => {
      socket.broadcast.emit("typing:status", {
        channelId,
        user,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      connectedClients.delete(socket.id);
      clientActiveChannel.delete(socket.id);
      io.emit("presence:update", {
        onlineConnections: connectedClients.size,
      });
    });
  });
}
