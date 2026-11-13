import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { EmployeeModel, MessageModel } from "./models.js";
import { COLLEAGUE_ARTIFACT_TURNS } from "./botArtifacts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, "../.env");
dotenv.config({ path: ENV_PATH, override: true, quiet: true });
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "workspace_db.json");

const JWT_SECRET =
  process.env.JWT_SECRET || "exactspace-kshitij-workspace-jwt-secret-2026";

export const USER_LIST = ["Alan", "Bob", "Carol", "Dean", "Elin"];

export const BOT_PROFILES = {
  Alan: {
    employeeId: "EXS-BOT-ALAN",
    fullName: "Alan",
    displayFullName: "Alan Turing",
    email: "alan@exactspace.co",
    department: "Industrial AI & Systems Architecture",
    designation: "Lead Systems Architect",
    officeLocation: "Warsaw / Kraków (Poland Office)",
    phone: "+48 22 555 0191",
    about: "Distributed systems, low-latency WebSockets & MongoDB schemas.",
    initials: "AL",
    avatarColor: "#0284c7",
    isBot: true,
  },
  Bob: {
    employeeId: "EXS-BOT-BOB",
    fullName: "Bob",
    displayFullName: "Bob Martin",
    email: "bob@exactspace.co",
    department: "Full-Stack & Product Engineering",
    designation: "Principal Frontend Engineer",
    officeLocation: "Bengaluru HQ (India Office)",
    phone: "+91 80 4090 1122",
    about: "Clean React architecture, state machines & 60fps UI polish.",
    initials: "BO",
    avatarColor: "#059669",
    isBot: true,
  },
  Carol: {
    employeeId: "EXS-BOT-CAROL",
    fullName: "Carol",
    displayFullName: "Carol Shaw",
    email: "carol@exactspace.co",
    department: "Product Design & UX",
    designation: "Staff Product Designer",
    officeLocation: "Bengaluru HQ (India Office)",
    phone: "+91 80 4090 1123",
    about: "Design systems, visual clarity & human-centered micro-interactions.",
    initials: "CA",
    avatarColor: "#d97706",
    isBot: true,
  },
  Dean: {
    employeeId: "EXS-BOT-DEAN",
    fullName: "Dean",
    displayFullName: "Dean Kamen",
    email: "dean@exactspace.co",
    department: "IoT & Edge Telemetry",
    designation: "Principal Telemetry Engineer",
    officeLocation: "Warsaw / Kraków (Poland Office)",
    phone: "+48 22 555 0194",
    about: "Turbine sensors, edge pipelines & real-time industrial anomaly alerts.",
    initials: "DE",
    avatarColor: "#7c3aed",
    isBot: true,
  },
  Elin: {
    employeeId: "EXS-BOT-ELIN",
    fullName: "Elin",
    displayFullName: "Elin Emmanuel",
    email: "elin@exactspace.co",
    department: "Industrial AI & Data Science",
    designation: "Data Intelligence Lead",
    officeLocation: "Bengaluru HQ (India Office)",
    phone: "+91 80 4090 1125",
    about: "Predictive maintenance models, PDF report parsing & data pipelines.",
    initials: "EE",
    avatarColor: "#e11d48",
    isBot: true,
  },
};

export function hashPassword(password, salt = null) {
  const usedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(String(password), usedSalt, 64)
    .toString("hex");
  return { salt: usedSalt, hash };
}

export function signToken(employee) {
  const payload = {
    employeeId: employee.employeeId,
    email: employee.email,
    fullName: employee.fullName,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Payload)
    .digest("base64url");
  return `${base64Payload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || !token.includes(".")) return null;
  const [base64Payload, signature] = token.split(".");
  const expectedSig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(base64Payload)
    .digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf8")
    );
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sanitizeEmployee(emp) {
  if (!emp) return null;
  return {
    employeeId: emp.employeeId,
    fullName: emp.fullName,
    displayFullName: emp.displayFullName || emp.fullName,
    email: emp.email,
    department: emp.department,
    designation: emp.designation,
    officeLocation: emp.officeLocation,
    phone: emp.phone || "",
    about: emp.about || "Available on ExactSpace Workspace",
    initials: emp.initials,
    avatarColor: emp.avatarColor || "#00a884",
    isBot: Boolean(emp.isBot),
  };
}

function createSeedDatabase() {
  const defaultPass = hashPassword("exactspace123");

  const defaultUser = {
    employeeId: "EXS-2026-001",
    fullName: "Kumar Kshitij",
    email: "kshitij@exactspace.co",
    department: "Full-Stack & Product Engineering",
    designation: "Software Engineer",
    officeLocation: "Bengaluru HQ (India Office)",
    phone: "+91 98765 43210",
    about: "Building real-time industrial intelligence & collaboration tools ⚡",
    initials: "KK",
    avatarColor: "#00a884",
    isBot: false,
    passwordSalt: defaultPass.salt,
    passwordHash: defaultPass.hash,
  };

  const botEmployees = Object.values(BOT_PROFILES).map((b) => ({
    ...b,
    passwordSalt: defaultPass.salt,
    passwordHash: defaultPass.hash,
  }));

  const channels = [
    {
      id: "introductions",
      name: "Introductions",
      type: "channel",
      description: "Company-wide onboarding, announcements & team introductions",
      memberCount: 6,
      totalOrgCount: 100,
    },
    {
      id: "india-office",
      name: "India Office",
      type: "channel",
      description: "Bengaluru HQ — Full-Stack, Industrial AI & Product Engineering",
      memberCount: 42,
      totalOrgCount: 100,
    },
    {
      id: "poland-office",
      name: "Poland Office",
      type: "channel",
      description: "Warsaw & Kraków Hub — Edge Telemetry & Cloud Operations",
      memberCount: 24,
      totalOrgCount: 100,
    },
    // Direct 1-on-1 Chats with each AI colleague from user_list
    ...USER_LIST.map((botName) => ({
      id: `dm-${botName.toLowerCase()}`,
      name: botName,
      type: "dm",
      botName,
      description: `${BOT_PROFILES[botName].designation} · ${BOT_PROFILES[botName].department}`,
      avatarColor: BOT_PROFILES[botName].avatarColor,
      initials: BOT_PROFILES[botName].initials,
      memberCount: 2,
      totalOrgCount: 2,
    })),
  ];

  const messagesByChannel = {
    introductions: [
      {
        id: "msg-intro-1",
        channelId: "introductions",
        user: "Alan",
        senderEmployeeId: "EXS-BOT-ALAN",
        senderRole: "Lead Systems Architect",
        initials: "AL",
        avatarColor: "#0284c7",
        text: "Welcome to ExactSpace Connect, @Kumar Kshitij! 👋 All 5 of us from the engineering team (Alan, Bob, Carol, Dean, and Elin) are live here. Drop a message, reply to any of us, or attach an image/PDF/code file and we'll analyze it right away.",
        timestamp: "09:30",
        createdAtMs: Date.now() - 3600000 * 2,
        likes: 2,
        likedBy: [
          { employeeId: "EXS-BOT-BOB", name: "Bob" },
          { employeeId: "EXS-BOT-CAROL", name: "Carol" },
        ],
        reactions: { "👋": ["Bob", "Carol"], "🚀": ["Dean"] },
        pinned: true,
        replyTo: null,
        attachment: null,
      },
      {
        id: "msg-intro-2",
        channelId: "introductions",
        user: "Bob",
        senderEmployeeId: "EXS-BOT-BOB",
        senderRole: "Principal Frontend Engineer",
        initials: "BO",
        avatarColor: "#059669",
        text: "Hey everyone! Love the new real-time workspace layout. Notice how each person can only like a message once now—super clean state management.",
        timestamp: "09:32",
        createdAtMs: Date.now() - 3600000 * 1.8,
        likes: 1,
        likedBy: [{ employeeId: "EXS-BOT-ELIN", name: "Elin" }],
        reactions: { "💯": ["Elin"] },
        pinned: false,
        replyTo: null,
        attachment: null,
      },
      {
        id: "msg-intro-3",
        channelId: "introductions",
        user: "Elin",
        senderEmployeeId: "EXS-BOT-ELIN",
        senderRole: "Data Intelligence Lead",
        initials: "EE",
        avatarColor: "#e11d48",
        text: "Hi @Bob! @Carol and @Dean are online too. Feel free to upload any PDF report, architecture diagram, or code file here for instant review.",
        timestamp: "09:35",
        createdAtMs: Date.now() - 3600000 * 1.5,
        likes: 2,
        likedBy: [
          { employeeId: "EXS-BOT-ALAN", name: "Alan" },
          { employeeId: "EXS-BOT-DEAN", name: "Dean" },
        ],
        reactions: { "❤️": ["Carol"] },
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
    "india-office": [
      {
        id: "msg-in-1",
        channelId: "india-office",
        user: "Carol",
        senderEmployeeId: "EXS-BOT-CAROL",
        senderRole: "Staff Product Designer",
        initials: "CA",
        avatarColor: "#d97706",
        text: "Bengaluru HQ channel is up! Share UI screenshots or frontend specs here and @Bob or I will give feedback.",
        timestamp: "10:15",
        createdAtMs: Date.now() - 3600000,
        likes: 1,
        likedBy: [{ employeeId: "EXS-BOT-BOB", name: "Bob" }],
        reactions: { "🔥": ["Bob"] },
        pinned: true,
        replyTo: null,
        attachment: null,
      },
    ],
    "poland-office": [
      {
        id: "msg-pl-1",
        channelId: "poland-office",
        user: "Dean",
        senderEmployeeId: "EXS-BOT-DEAN",
        senderRole: "Principal Telemetry Engineer",
        initials: "DE",
        avatarColor: "#7c3aed",
        text: "Kraków telemetry cluster is streaming at 99.98% uptime. Ping @Alan or me if you want to test WebSocket throughput or inspect sensor logs.",
        timestamp: "08:45",
        createdAtMs: Date.now() - 5400000,
        likes: 1,
        likedBy: [{ employeeId: "EXS-BOT-ALAN", name: "Alan" }],
        reactions: { "⚡": ["Alan"] },
        pinned: true,
        replyTo: null,
        attachment: null,
      },
    ],
    "dm-alan": [
      {
        id: "msg-dm-alan-1",
        channelId: "dm-alan",
        user: "Alan",
        senderEmployeeId: "EXS-BOT-ALAN",
        senderRole: "Lead Systems Architect",
        initials: "AL",
        avatarColor: "#0284c7",
        text: "Hey! This is our direct 1-on-1 engineering thread. Ask me anything about backend architecture, MongoDB schemas, or attach a system diagram/PDF!",
        timestamp: "09:00",
        createdAtMs: Date.now() - 7200000,
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
    "dm-bob": [
      {
        id: "msg-dm-bob-1",
        channelId: "dm-bob",
        user: "Bob",
        senderEmployeeId: "EXS-BOT-BOB",
        senderRole: "Principal Frontend Engineer",
        initials: "BO",
        avatarColor: "#059669",
        text: "Hey! Ping me here whenever you want to discuss React hooks, UI/UX refinements, or share a code snippet.",
        timestamp: "09:05",
        createdAtMs: Date.now() - 7000000,
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
    "dm-carol": [
      {
        id: "msg-dm-carol-1",
        channelId: "dm-carol",
        user: "Carol",
        senderEmployeeId: "EXS-BOT-CAROL",
        senderRole: "Staff Product Designer",
        initials: "CA",
        avatarColor: "#d97706",
        text: "Hi! Drop any image, UI screenshot, or design asset here and I'll analyze the layout and visual details.",
        timestamp: "09:10",
        createdAtMs: Date.now() - 6800000,
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
    "dm-dean": [
      {
        id: "msg-dm-dean-1",
        channelId: "dm-dean",
        user: "Dean",
        senderEmployeeId: "EXS-BOT-DEAN",
        senderRole: "Principal Telemetry Engineer",
        initials: "DE",
        avatarColor: "#7c3aed",
        text: "Hey! Ready to chat about IoT telemetry, real-time streams, or CSV/log files you upload.",
        timestamp: "09:12",
        createdAtMs: Date.now() - 6600000,
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
    "dm-elin": [
      {
        id: "msg-dm-elin-1",
        channelId: "dm-elin",
        user: "Elin",
        senderEmployeeId: "EXS-BOT-ELIN",
        senderRole: "Data Intelligence Lead",
        initials: "EE",
        avatarColor: "#e11d48",
        text: "Hello! Share any PDF document, dataset, or analytics question here and I'll break it down for you.",
        timestamp: "09:15",
        createdAtMs: Date.now() - 6400000,
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ],
  };

  return {
    employees: [defaultUser, ...botEmployees],
    channels,
    messagesByChannel,
    config: {
      mongoUri: "",
      geminiApiKey: "",
    },
  };
}

class WorkspaceStorage {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.localData = this.loadLocalDisk();
    this.removedDuplicateIds = [];
    this.getMessagesByChannel();
    this.mongoConnected = false;
    this.mongoError = null;
    this.mongoUri =
      process.env.MONGODB_URI || this.localData.config?.mongoUri || "";
    this.geminiApiKey =
      process.env.GEMINI_API_KEY || this.localData.config?.geminiApiKey || "";

    const isViteBuild = process.argv.some((arg) => arg === "build");
    if (this.mongoUri && !isViteBuild) {
      this.connectMongo(this.mongoUri);
    }
  }

  loadLocalDisk() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.employees)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to seed
    }
    const seed = createSeedDatabase();
    this.saveLocalDisk(seed);
    return seed;
  }

  saveLocalDisk(data = this.localData) {
    try {
      const sanitized = {
        ...data,
        config: {
          mongoUri: "",
          geminiApiKey: "",
        },
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(sanitized, null, 2), "utf8");
    } catch (err) {
      console.error("[Storage] Disk write error:", err.message);
    }
  }

  async connectMongo(uri) {
    if (!uri || !uri.trim()) {
      this.mongoConnected = false;
      this.mongoUri = "";
      return { connected: false, message: "No MongoDB URI provided." };
    }
    try {
      const cleanUri = uri.trim();
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      await mongoose.connect(cleanUri, {
        serverSelectionTimeoutMS: 6000,
      });
      this.mongoConnected = true;
      this.mongoError = null;
      this.mongoUri = cleanUri;

      // Sync local seed employees to MongoDB Atlas if collection is empty
      for (const emp of this.localData.employees) {
        await EmployeeModel.updateOne(
          { email: emp.email.toLowerCase() },
          { $setOnInsert: emp },
          { upsert: true }
        );
      }

      // Clean any duplicate autonomous bot messages from MongoDB Atlas
      if (this.removedDuplicateIds && this.removedDuplicateIds.length > 0) {
        await MessageModel.deleteMany({
          id: { $in: this.removedDuplicateIds },
        }).catch(() => {});
      }

      console.log("[ExactSpace MongoDB] Connected to MongoDB Atlas Cluster!");
      return { connected: true, message: "Connected to MongoDB Atlas!" };
    } catch (err) {
      this.mongoConnected = false;
      this.mongoError = err.message;
      return { connected: false, message: err.message };
    }
  }

  setGeminiKey(key) {
    this.geminiApiKey = (key || "").trim();
  }

  getStatus() {
    dotenv.config({ path: ENV_PATH, override: true, quiet: true });
    if (process.env.GEMINI_API_KEY) {
      this.geminiApiKey = process.env.GEMINI_API_KEY.trim();
    }
    if (process.env.MONGODB_URI && !this.mongoUri) {
      this.connectMongo(process.env.MONGODB_URI.trim());
    }
    return {
      mongoConnected: this.mongoConnected,
      mongoError: this.mongoError,
      hasMongoUri: Boolean(this.mongoUri),
      maskedMongoUri: this.mongoUri
        ? this.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@")
        : "",
      hasGeminiKey: Boolean(this.geminiApiKey || process.env.GEMINI_API_KEY),
      employeeCount: this.localData.employees.length,
    };
  }

  async registerEmployee(payload) {
    const {
      fullName,
      email,
      employeeId,
      department,
      designation,
      officeLocation,
      phone,
      about,
      avatarColor,
      password,
    } = payload;

    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();
    const cleanEmpId =
      String(employeeId || "").trim().toUpperCase() ||
      `EXS-2026-${String(this.localData.employees.length + 1).padStart(
        3,
        "0"
      )}`;

    if (!fullName || !cleanEmail || !password) {
      throw new Error("Full Name, Work Email, and Password are required.");
    }

    const existsLocal = this.localData.employees.find(
      (e) =>
        e.email.toLowerCase() === cleanEmail ||
        e.employeeId.toUpperCase() === cleanEmpId
    );
    if (existsLocal) {
      throw new Error(
        "An employee with this Work Email or Employee ID is already registered."
      );
    }

    const parts = fullName.trim().split(/\s+/);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : fullName.trim().slice(0, 2).toUpperCase();

    const { salt, hash } = hashPassword(password);

    const newEmployee = {
      employeeId: cleanEmpId,
      fullName: fullName.trim(),
      email: cleanEmail,
      department: department || "Full-Stack & Product Engineering",
      designation: designation || "Software Engineer",
      officeLocation: officeLocation || "Bengaluru HQ (India Office)",
      phone: phone || "",
      about:
        about ||
        `${designation || "Engineer"} at ExactSpace (${
          officeLocation || "Bengaluru HQ"
        })`,
      initials,
      avatarColor: avatarColor || "#00a884",
      isBot: false,
      passwordSalt: salt,
      passwordHash: hash,
    };

    this.localData.employees.push(newEmployee);
    this.saveLocalDisk();

    if (this.mongoConnected) {
      try {
        await EmployeeModel.create(newEmployee);
      } catch (err) {
        console.warn("[MongoDB Register Sync]:", err.message);
      }
    }

    return sanitizeEmployee(newEmployee);
  }

  async authenticateEmployee({ identifier, password }) {
    const cleanId = String(identifier || "")
      .trim()
      .toLowerCase();

    let found = this.localData.employees.find(
      (e) =>
        e.email.toLowerCase() === cleanId ||
        e.employeeId.toLowerCase() === cleanId
    );

    if (!found && this.mongoConnected) {
      const doc = await EmployeeModel.findOne({
        $or: [
          { email: cleanId },
          { employeeId: cleanId.toUpperCase() },
        ],
      }).lean();
      if (doc) found = doc;
    }

    if (!found) {
      throw new Error(
        "No employee account found with that Work Email or Employee ID."
      );
    }

    const { hash } = hashPassword(password, found.passwordSalt);
    if (hash !== found.passwordHash) {
      throw new Error("Invalid password. Please check your credentials.");
    }

    return sanitizeEmployee(found);
  }

  getAllEmployees() {
    return this.localData.employees.map(sanitizeEmployee);
  }

  getChannels() {
    return this.localData.channels;
  }

  getMessagesByChannel() {
    let modified = false;
    if (!this.removedDuplicateIds) {
      this.removedDuplicateIds = [];
    }

    for (const chId of Object.keys(this.localData.messagesByChannel || {})) {
      const list = this.localData.messagesByChannel[chId] || [];
      const seenBotTexts = new Set();
      const seenAttachments = new Set();
      const cleanedList = [];

      const isDm = chId.startsWith("dm-");
      const dmTargetBot = isDm ? chId.replace("dm-", "").toLowerCase() : null;

      for (const msg of list) {
        if (
          typeof msg.text === "string" &&
          msg.text.startsWith("Jumping back to ")
        ) {
          msg.text =
            "Haha yeah, huge relief! How's your part of the project coming along today?";
          modified = true;
        }

        const isBotMessage =
          String(msg.senderEmployeeId || "").startsWith("EXS-BOT-") ||
          USER_LIST.includes(msg.user);

        // Remove stray autonomous bot messages from another bot inside a 1-on-1 DM
        if (
          isDm &&
          isBotMessage &&
          String(msg.user || "").toLowerCase() !== dmTargetBot
        ) {
          this.removedDuplicateIds.push(msg.id);
          modified = true;
          continue;
        }

        // Deduplicate repeated bot messages or repeated attachments in the same channel
        if (isBotMessage) {
          const normText = String(msg.text || "").trim().toLowerCase();
          const attName = msg.attachment?.name?.toLowerCase() || "";

          if (
            (normText && seenBotTexts.has(normText)) ||
            (attName && seenAttachments.has(attName))
          ) {
            this.removedDuplicateIds.push(msg.id);
            modified = true;
            continue;
          }

          if (normText) seenBotTexts.add(normText);
          if (attName) seenAttachments.add(attName);
        }

        cleanedList.push(msg);
      }

      if (cleanedList.length !== list.length) {
        this.localData.messagesByChannel[chId] = cleanedList;
        modified = true;
      }
    }

    // Ensure introductions has real colleague code screenshots & PDF verification docs
    const introList = this.localData.messagesByChannel?.introductions || [];
    if (!introList.some((m) => m.id === "msg-artifact-seed-1")) {
      const bobTurn = COLLEAGUE_ARTIFACT_TURNS[0];
      const elinTurn = COLLEAGUE_ARTIFACT_TURNS[1];
      const existingAtts = new Set(
        introList.map((m) => m.attachment?.name?.toLowerCase()).filter(Boolean)
      );

      const bobAtt = bobTurn.buildAttachment();
      if (!existingAtts.has(bobAtt.name.toLowerCase())) {
        introList.push({
          id: "msg-artifact-seed-1",
          channelId: "introductions",
          user: "Bob",
          senderEmployeeId: "EXS-BOT-BOB",
          senderRole: "Principal Frontend Engineer",
          initials: "BO",
          avatarColor: "#059669",
          text: bobTurn.text,
          timestamp: "10:18",
          createdAtMs: Date.now() - 180000,
          likes: 2,
          likedBy: [
            { employeeId: "EXS-BOT-CAROL", name: "Carol" },
            { employeeId: "EXS-BOT-ALAN", name: "Alan" },
          ],
          reactions: { "🔥": ["Carol", "Alan"], "👍": ["Dean"] },
          pinned: false,
          replyTo: null,
          attachment: bobAtt,
        });
        modified = true;
      }

      const elinAtt = elinTurn.buildAttachment();
      if (!existingAtts.has(elinAtt.name.toLowerCase())) {
        introList.push({
          id: "msg-artifact-seed-2",
          channelId: "introductions",
          user: "Elin",
          senderEmployeeId: "EXS-BOT-ELIN",
          senderRole: "Data Intelligence Lead",
          initials: "EE",
          avatarColor: "#e11d48",
          text: elinTurn.text,
          timestamp: "10:22",
          createdAtMs: Date.now() - 90000,
          likes: 3,
          likedBy: [
            { employeeId: "EXS-BOT-ALAN", name: "Alan" },
            { employeeId: "EXS-BOT-DEAN", name: "Dean" },
            { employeeId: "EXS-BOT-BOB", name: "Bob" },
          ],
          reactions: { "💯": ["Alan", "Dean"], "🚀": ["Bob"] },
          pinned: false,
          replyTo: null,
          attachment: elinAtt,
        });
        modified = true;
      }

      this.localData.messagesByChannel.introductions = introList;
    }

    if (modified) {
      this.saveLocalDisk();
    }
    return this.localData.messagesByChannel;
  }

  async addMessage(channelId, messageObj) {
    if (!this.localData.messagesByChannel[channelId]) {
      this.localData.messagesByChannel[channelId] = [];
    }
    const list = this.localData.messagesByChannel[channelId];
    if (!list.some((m) => m.id === messageObj.id)) {
      list.push(messageObj);
      this.saveLocalDisk();
    }

    if (this.mongoConnected) {
      try {
        await MessageModel.updateOne(
          { id: messageObj.id },
          { $setOnInsert: messageObj },
          { upsert: true }
        );
      } catch {
        // Handled by local persistence
      }
    }
    return messageObj;
  }

  /**
   * Requirement 1: One person should be able to like a message once!
   * Tracks `likedBy: [{ employeeId, name }]`.
   * If the user hasn't liked it yet -> adds their like (count + 1).
   * If the user already liked it -> toggles/removes their like (or if `onlyAdd` is true for bots, keeps it at 1).
   */
  async toggleSingleLike(
    channelId,
    messageId,
    voter,
    { onlyAdd = false } = {}
  ) {
    const list = this.localData.messagesByChannel[channelId];
    if (!list) return null;
    const target = list.find((m) => m.id === messageId);
    if (!target) return null;

    if (!Array.isArray(target.likedBy)) {
      target.likedBy = [];
    }

    const voterId = voter.employeeId || voter.name;
    const voterName = voter.fullName || voter.name || "Employee";

    const existingIdx = target.likedBy.findIndex(
      (entry) =>
        entry.employeeId === voterId ||
        entry.name.toLowerCase() === voterName.toLowerCase()
    );

    if (existingIdx >= 0) {
      if (onlyAdd) {
        return target; // Bot already liked once; do not add duplicate
      }
      // User clicked again -> remove their single like
      target.likedBy.splice(existingIdx, 1);
    } else {
      target.likedBy.push({
        employeeId: voterId,
        name: voterName,
      });
    }

    target.likes = target.likedBy.length;
    this.saveLocalDisk();

    if (this.mongoConnected) {
      try {
        await MessageModel.updateOne(
          { id: messageId },
          { $set: { likes: target.likes, likedBy: target.likedBy } }
        );
      } catch {
        // Ignore
      }
    }

    return target;
  }

  async toggleReaction(channelId, messageId, emoji, userName, { onlyAdd = false } = {}) {
    const list = this.localData.messagesByChannel[channelId];
    if (!list) return null;
    const target = list.find((m) => m.id === messageId);
    if (!target) return null;

    if (!target.reactions || typeof target.reactions !== "object") {
      target.reactions = {};
    }
    const currentUsers = Array.isArray(target.reactions[emoji])
      ? [...target.reactions[emoji]]
      : [];

    if (currentUsers.includes(userName)) {
      if (!onlyAdd) {
        target.reactions[emoji] = currentUsers.filter((u) => u !== userName);
        if (target.reactions[emoji].length === 0) {
          delete target.reactions[emoji];
        }
      }
    } else {
      target.reactions[emoji] = [...currentUsers, userName];
    }

    this.saveLocalDisk();
    return target;
  }

  createChannel({ name, description }) {
    const cleanName = String(name || "").trim();
    const id = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!id) return null;

    const existing = this.localData.channels.find((c) => c.id === id);
    if (existing) return existing;

    const newChannel = {
      id,
      name: cleanName,
      type: "channel",
      description:
        description?.trim() || `Workspace channel for #${cleanName}`,
      memberCount: 6,
      totalOrgCount: 100,
    };

    this.localData.channels.push(newChannel);
    this.localData.messagesByChannel[id] = [
      {
        id: `msg-welcome-${id}`,
        channelId: id,
        user: "Alan",
        senderEmployeeId: "EXS-BOT-ALAN",
        senderRole: "Lead Systems Architect",
        initials: "AL",
        avatarColor: "#0284c7",
        text: `Created #${cleanName}! Mention @Alan, @Bob, @Carol, @Dean, or @Elin or drop files here anytime.`,
        timestamp: new Date().toTimeString().slice(0, 5),
        createdAtMs: Date.now(),
        likes: 0,
        likedBy: [],
        reactions: {},
        pinned: false,
        replyTo: null,
        attachment: null,
      },
    ];
    this.saveLocalDisk();
    return {
      channel: newChannel,
      initialMessages: this.localData.messagesByChannel[id],
    };
  }
}

export const storage = new WorkspaceStorage();

