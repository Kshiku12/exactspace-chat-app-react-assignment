import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { io } from "socket.io-client";
import {
  Users,
  Smile,
  Send,
  AtSign,
  Search,
  Pin,
  Wifi,
  WifiOff,
  X,
  Paperclip,
  Menu,
  Filter,
  Heart,
  CornerDownRight,
  FileText,
  Image as ImageIcon,
  FileCode,
  PanelRight,
  Download,
  MessageSquare,
} from "lucide-react";
import {
  user_list,
  MENTION_OPTIONS,
  USER_DETAILS,
  EMOJI_LIST,
} from "./data/constants";
import EmojiPicker from "./components/EmojiPicker";
import MentionPopup from "./components/MentionPopup";
import MessageItem from "./components/MessageItem";
import Sidebar from "./components/Sidebar";
import AuthScreen from "./components/AuthScreen";
import "./App.css";

const AUTH_STORAGE_KEY = "exactspace_workspace_session_v2";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.employee || null;
      }
    } catch {
      // Ignore
    }
    return null;
  });

  const [darkMode, setDarkMode] = useState(false);

  // Workspace Channels, Employees & Messages
  const [employees, setEmployees] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeChannelId, setActiveChannelId] = useState("introductions");
  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [unreadByChannel, setUnreadByChannel] = useState({});

  // Compose & Attachment state
  const [messageInput, setMessageInput] = useState("");
  const [senderMode, setSenderMode] = useState("logged-in");
  const [replyingTo, setReplyingTo] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Emoji Picker & @Mentions
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [frequentEmojis, setFrequentEmojis] = useState(() =>
    EMOJI_LIST.filter((e) => e.frequent)
  );
  const [mentionState, setMentionState] = useState({
    isOpen: false,
    query: "",
    startIndex: -1,
    selectedIndex: 0,
  });

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUserFilter, setActiveUserFilter] = useState(null);
  const [onlyLikedFilter, setOnlyLikedFilter] = useState(false);
  const [onlyMentionsFilter, setOnlyMentionsFilter] = useState(false);
  const [onlyFilesFilter, setOnlyFilesFilter] = useState(false);
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);
  const [broadcastBanner, setBroadcastBanner] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showInspectorDrawer, setShowInspectorDrawer] = useState(false);
  const [inspectorTab, setInspectorTab] = useState("files");

  // Real-time Socket.io & Typing state
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineConnections, setOnlineConnections] = useState(1);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeChannelRef = useRef(activeChannelId);

  useEffect(() => {
    activeChannelRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    fetch("/api/employees")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.employees) {
          setEmployees(data.employees);
        }
      })
      .catch(() => {});
  }, []);

  const handleAuthenticated = (employee, token) => {
    setCurrentUser(employee);
    try {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ employee, token })
      );
    } catch {
      // Ignore
    }
    fetch("/api/employees")
      .then((r) => r.json())
      .then((d) => {
        if (d.employees) setEmployees(d.employees);
      })
      .catch(() => {});
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const activeMessages = useMemo(
    () => messagesByChannel[activeChannelId] || [],
    [messagesByChannel, activeChannelId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeChannelId, typingUsers.length]);

  // Connect to Socket.io Server
  useEffect(() => {
    const socket = io(window.location.origin, {
      reconnectionAttempts: 8,
      timeout: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("channel:subscribe", activeChannelRef.current);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("state:init", (payload) => {
      if (payload.channels) setChannels(payload.channels);
      if (payload.messagesByChannel) {
        setMessagesByChannel(payload.messagesByChannel);
      }
      if (payload.employees) setEmployees(payload.employees);
      if (payload.onlineConnections) {
        setOnlineConnections(payload.onlineConnections);
      }
    });

    socket.on("presence:update", ({ onlineConnections: count }) => {
      if (typeof count === "number") setOnlineConnections(count);
    });

    socket.on("message:new", (newMsg) => {
      setMessagesByChannel((prev) => {
        const chId = newMsg.channelId || "introductions";
        const existing = prev[chId] || [];
        if (existing.some((m) => m.id === newMsg.id)) return prev;
        return {
          ...prev,
          [chId]: [...existing, newMsg],
        };
      });

      if (newMsg.channelId && newMsg.channelId !== activeChannelRef.current) {
        setUnreadByChannel((prev) => ({
          ...prev,
          [newMsg.channelId]: (prev[newMsg.channelId] || 0) + 1,
        }));
      }
    });

    socket.on("message:liked", ({ channelId, messageId, likes, likedBy }) => {
      setMessagesByChannel((prev) => {
        const list = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: list.map((m) =>
            m.id === messageId ? { ...m, likes, likedBy } : m
          ),
        };
      });
    });

    socket.on("message:reacted", ({ channelId, messageId, reactions }) => {
      setMessagesByChannel((prev) => {
        const list = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: list.map((m) =>
            m.id === messageId ? { ...m, reactions } : m
          ),
        };
      });
    });

    socket.on("message:pinned", ({ channelId, messageId, pinned }) => {
      setMessagesByChannel((prev) => {
        const list = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: list.map((m) =>
            m.id === messageId ? { ...m, pinned } : m
          ),
        };
      });
    });

    socket.on("message:edited", ({ channelId, messageId, text, edited }) => {
      setMessagesByChannel((prev) => {
        const list = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: list.map((m) =>
            m.id === messageId ? { ...m, text, edited } : m
          ),
        };
      });
    });

    socket.on("message:deleted", ({ channelId, messageId }) => {
      setMessagesByChannel((prev) => {
        const list = prev[channelId] || [];
        return {
          ...prev,
          [channelId]: list.filter((m) => m.id !== messageId),
        };
      });
    });

    socket.on("channel:created", ({ channel, initialMessages }) => {
      setChannels((prev) =>
        prev.some((c) => c.id === channel.id) ? prev : [...prev, channel]
      );
      setMessagesByChannel((prev) => ({
        ...prev,
        [channel.id]: initialMessages || [],
      }));
    });

    socket.on("typing:status", ({ channelId, user, isTyping }) => {
      if (channelId !== activeChannelRef.current) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          return prev.includes(user) ? prev : [...prev, user];
        }
        return prev.filter((u) => u !== user);
      });
    });

    socket.on("mention:broadcast", ({ sender, notifiedUsers }) => {
      setBroadcastBanner({
        sender,
        notifiedUsers: notifiedUsers || user_list,
      });
      setTimeout(() => setBroadcastBanner(null), 5000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filteredMentionUsers = useMemo(() => {
    if (!mentionState.isOpen) return [];
    const q = mentionState.query.trim().toLowerCase();
    if (!q) return MENTION_OPTIONS;
    return MENTION_OPTIONS.filter((u) => u.toLowerCase().startsWith(q));
  }, [mentionState.isOpen, mentionState.query]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart ?? val.length;
    setMessageInput(val);

    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      const query = match[1];
      const atPosition = textBeforeCursor.lastIndexOf("@");
      setMentionState({
        isOpen: true,
        query,
        startIndex: atPosition,
        selectedIndex: 0,
      });
    } else if (mentionState.isOpen) {
      setMentionState((prev) => ({ ...prev, isOpen: false }));
    }
  };

  const handleSelectMentionUser = useCallback(
    (username) => {
      const inputEl = inputRef.current;
      if (mentionState.startIndex >= 0) {
        const beforeAt = messageInput.slice(0, mentionState.startIndex);
        const afterQuery = messageInput.slice(
          mentionState.startIndex + 1 + mentionState.query.length
        );
        const nextValue = `${beforeAt}@${username} ${afterQuery.replace(
          /^\s+/,
          ""
        )}`;
        setMessageInput(nextValue);
      } else {
        const needsSpace =
          messageInput.length > 0 && !messageInput.endsWith(" ");
        setMessageInput(
          `${messageInput}${needsSpace ? " " : ""}@${username} `
        );
      }
      setMentionState({
        isOpen: false,
        query: "",
        startIndex: -1,
        selectedIndex: 0,
      });
      setTimeout(() => inputEl?.focus(), 0);
    },
    [messageInput, mentionState]
  );

  const handleAtButtonClick = () => {
    setShowEmojiPicker(false);
    if (mentionState.isOpen) {
      setMentionState((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    const needsSpace =
      messageInput.length > 0 && !messageInput.endsWith(" ");
    const updated = `${messageInput}${needsSpace ? " " : ""}@`;
    setMessageInput(updated);
    setMentionState({
      isOpen: true,
      query: "",
      startIndex: updated.length - 1,
      selectedIndex: 0,
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (mentionState.isOpen && filteredMentionUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex + 1) % filteredMentionUsers.length,
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState((prev) => ({
          ...prev,
          selectedIndex:
            (prev.selectedIndex - 1 + filteredMentionUsers.length) %
            filteredMentionUsers.length,
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const chosen =
          filteredMentionUsers[mentionState.selectedIndex] ||
          filteredMentionUsers[0];
        if (chosen) handleSelectMentionUser(chosen);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState((prev) => ({ ...prev, isOpen: false }));
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectEmoji = (emojiItem) => {
    setMessageInput((prev) => `${prev}${emojiItem.char}`);
    setFrequentEmojis((prev) => {
      if (prev.some((e) => e.char === emojiItem.char)) return prev;
      return [emojiItem, ...prev.slice(0, 11)];
    });
    inputRef.current?.focus();
  };

  const handleFileAttach = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const mime = (file.type || "").toLowerCase();

    let category = "document";
    if (
      mime.startsWith("image/") ||
      ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)
    ) {
      category = "image";
    } else if (mime === "application/pdf" || ext === "pdf") {
      category = "pdf";
    } else if (
      ["js", "jsx", "ts", "tsx", "py", "json", "html", "css", "md"].includes(
        ext
      )
    ) {
      category = "code";
    } else if (["csv", "tsv", "log", "txt"].includes(ext)) {
      category = "data";
    }

    const sizeKB = file.size / 1024;
    const sizeFormatted =
      sizeKB >= 1024
        ? `${(sizeKB / 1024).toFixed(2)} MB`
        : `${Math.max(1, Math.round(sizeKB))} KB`;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;

      if (category === "image") {
        const img = new Image();
        img.onload = () => {
          setAttachedFile({
            name: file.name,
            category: "image",
            mimeType: file.type || "image/png",
            sizeFormatted,
            sizeBytes: file.size,
            dataUrl,
            dimensions: `${img.width}×${img.height}px`,
            extractedText: "",
          });
        };
        img.onerror = () => {
          setAttachedFile({
            name: file.name,
            category: "image",
            mimeType: file.type || "image/png",
            sizeFormatted,
            sizeBytes: file.size,
            dataUrl,
            dimensions: "",
            extractedText: "",
          });
        };
        img.src = dataUrl;
      } else if (category === "code" || category === "data") {
        const textReader = new FileReader();
        textReader.onload = () => {
          setAttachedFile({
            name: file.name,
            category,
            mimeType: file.type || "text/plain",
            sizeFormatted,
            sizeBytes: file.size,
            dataUrl,
            extractedText: String(textReader.result || "").slice(0, 1500),
          });
        };
        textReader.readAsText(file);
      } else {
        setAttachedFile({
          name: file.name,
          category,
          mimeType: file.type || "application/pdf",
          sizeFormatted,
          sizeBytes: file.size,
          dataUrl,
          extractedText: "",
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed && !attachedFile) return;

    let senderName = currentUser?.fullName || "Kumar Kshitij";
    let senderEmpId = currentUser?.employeeId || "EXS-2026-001";
    let senderRole = currentUser?.designation || "Software Engineer";
    let senderInitials = currentUser?.initials || "KK";
    let senderColor = currentUser?.avatarColor || "#00a884";

    if (senderMode === "random") {
      const randomUser =
        user_list[Math.floor(Math.random() * user_list.length)];
      const details = USER_DETAILS[randomUser];
      senderName = randomUser;
      senderEmpId = `RANDOM-${randomUser.toUpperCase()}`;
      senderRole = details.role;
      senderInitials = details.initials;
      senderColor = details.color;
    }

    const now = new Date();
    const timestamp = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channelId: activeChannelId,
      user: senderName,
      senderEmployeeId: senderEmpId,
      senderRole,
      initials: senderInitials,
      avatarColor: senderColor,
      text: trimmed,
      timestamp,
      likes: 0,
      likedBy: [],
      reactions: {},
      pinned: false,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            user: replyingTo.user,
            text: replyingTo.text,
            attachmentName: replyingTo.attachment?.name || null,
          }
        : null,
      attachment: attachedFile,
    };

    setMessagesByChannel((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), newMsg],
    }));

    if (/@all\b|@everyone\b/i.test(trimmed)) {
      setBroadcastBanner({
        sender: senderName,
        notifiedUsers: user_list,
      });
      setTimeout(() => setBroadcastBanner(null), 5000);
    }

    if (socketRef.current?.connected) {
      socketRef.current.emit("message:publish", newMsg);
    }

    setMessageInput("");
    setReplyingTo(null);
    setAttachedFile(null);
    setShowEmojiPicker(false);
    setMentionState({
      isOpen: false,
      query: "",
      startIndex: -1,
      selectedIndex: 0,
    });
    inputRef.current?.focus();
  };

  const handleLikeMessage = (messageId) => {
    const voter = {
      employeeId: currentUser?.employeeId || "EXS-2026-001",
      name: currentUser?.fullName || "Kumar Kshitij",
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit("message:like", {
        channelId: activeChannelId,
        messageId,
        voter,
      });
    } else {
      setMessagesByChannel((prev) => {
        const list = prev[activeChannelId] || [];
        return {
          ...prev,
          [activeChannelId]: list.map((m) => {
            if (m.id !== messageId) return m;
            const likedBy = Array.isArray(m.likedBy) ? [...m.likedBy] : [];
            const idx = likedBy.findIndex(
              (entry) => entry.employeeId === voter.employeeId
            );
            if (idx >= 0) {
              likedBy.splice(idx, 1);
            } else {
              likedBy.push(voter);
            }
            return { ...m, likedBy, likes: likedBy.length };
          }),
        };
      });
    }
  };

  const handleReactMessage = (messageId, emoji) => {
    const userName = currentUser?.fullName || "Kumar Kshitij";
    if (socketRef.current?.connected) {
      socketRef.current.emit("message:react", {
        channelId: activeChannelId,
        messageId,
        emoji,
        userName,
      });
    }
  };

  const handlePinMessage = (messageId) => {
    socketRef.current?.emit("message:pin", {
      channelId: activeChannelId,
      messageId,
    });
  };

  const handleEditMessage = (messageId, newText) => {
    socketRef.current?.emit("message:edit", {
      channelId: activeChannelId,
      messageId,
      text: newText,
    });
  };

  const handleDeleteMessage = (messageId) => {
    socketRef.current?.emit("message:delete", {
      channelId: activeChannelId,
      messageId,
    });
  };

  const handleCreateChannel = ({ name, description }) => {
    socketRef.current?.emit("channel:create", { name, description });
  };

  const handleSelectChannel = (channelId) => {
    setActiveChannelId(channelId);
    setUnreadByChannel((prev) => ({ ...prev, [channelId]: 0 }));
    socketRef.current?.emit("channel:subscribe", channelId);
  };

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || {
      id: "introductions",
      name: "Introductions",
      description: "Company-wide onboarding, announcements & team introductions",
      totalOrgCount: 100,
    };

  const pinnedMessages = useMemo(
    () => activeMessages.filter((m) => m.pinned),
    [activeMessages]
  );

  const displayedMessages = useMemo(() => {
    return activeMessages.filter((msg) => {
      if (
        activeUserFilter &&
        msg.user.toLowerCase() !== activeUserFilter.toLowerCase()
      ) {
        return false;
      }
      if (onlyLikedFilter && (msg.likes || 0) === 0) {
        return false;
      }
      if (onlyMentionsFilter && !/@[A-Za-z0-9_]+/.test(msg.text || "")) {
        return false;
      }
      if (onlyFilesFilter && !msg.attachment) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchText = (msg.text || "").toLowerCase().includes(q);
        const matchUser = (msg.user || "").toLowerCase().includes(q);
        const matchFile = (msg.attachment?.name || "")
          .toLowerCase()
          .includes(q);
        return matchText || matchUser || matchFile;
      }
      return true;
    });
  }, [
    activeMessages,
    activeUserFilter,
    onlyLikedFilter,
    onlyMentionsFilter,
    onlyFilesFilter,
    searchQuery,
  ]);

  const totalChannelLikes = useMemo(
    () => activeMessages.reduce((acc, m) => acc + (m.likes || 0), 0),
    [activeMessages]
  );

  const totalChannelFiles = useMemo(
    () => activeMessages.filter((m) => Boolean(m.attachment)).length,
    [activeMessages]
  );

  const channelFileMessages = useMemo(
    () => activeMessages.filter((m) => Boolean(m.attachment)),
    [activeMessages]
  );

  const handleJumpToMessage = useCallback((targetId) => {
    if (!targetId) return;
    setHighlightedMessageId(targetId);
    const el = document.getElementById(`msg-row-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedMessageId((prev) => (prev === targetId ? null : prev));
    }, 1800);
  }, []);

  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className={`wa-workspace-app ${darkMode ? "dark" : "light"}`}>
      <Sidebar
        currentUser={currentUser}
        employees={employees}
        channels={channels}
        activeChannelId={activeChannelId}
        messagesByChannel={messagesByChannel}
        onSelectChannel={handleSelectChannel}
        onCreateChannel={handleCreateChannel}
        unreadByChannel={unreadByChannel}
        senderMode={senderMode}
        onChangeSenderMode={setSenderMode}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onLogout={handleLogout}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      <main className="wa-main-chat">
        <header className="wa-chat-header">
          <div className="wa-header-left">
            <button
              type="button"
              className="wa-mobile-menu-btn"
              onClick={() => setIsMobileSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>

            <div
              className="wa-header-avatar"
              style={{
                backgroundColor: activeChannel.avatarColor || "#4f46e5",
              }}
            >
              {activeChannel.type === "dm" ? activeChannel.initials : "#"}
            </div>

            <div className="wa-header-title-block">
              <div className="wa-title-line">
                <h1>{activeChannel.name}</h1>
                <span
                  className={`wa-conn-badge ${
                    socketConnected ? "live" : "local"
                  }`}
                >
                  {socketConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
                  <span>
                    {socketConnected
                      ? `Live · ${onlineConnections} session${
                          onlineConnections === 1 ? "" : "s"
                        }`
                      : "Local"}
                  </span>
                </span>
              </div>

              {typingUsers.length > 0 ? (
                <p className="wa-header-typing-text">
                  {typingUsers.join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </p>
              ) : (
                <p className="wa-header-sub">{activeChannel.description}</p>
              )}
            </div>
          </div>

          <div className="wa-header-right">
            <div className="wa-header-search">
              <Search size={14} className="wa-hs-ic" />
              <input
                type="text"
                placeholder="Search messages or files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="wa-hs-clear"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={`wa-top-pill ${onlyFilesFilter ? "active" : ""}`}
              onClick={() => setOnlyFilesFilter((v) => !v)}
              title="Filter shared screenshots, PDFs & code files"
            >
              <Paperclip size={13} />
              <span>Files ({totalChannelFiles})</span>
            </button>

            <button
              type="button"
              className={`wa-top-pill ${onlyMentionsFilter ? "active" : ""}`}
              onClick={() => setOnlyMentionsFilter((v) => !v)}
              title="Filter messages with @mentions"
            >
              <AtSign size={13} />
              <span>Mentions</span>
            </button>

            <button
              type="button"
              className={`wa-top-pill ${onlyLikedFilter ? "active" : ""}`}
              onClick={() => setOnlyLikedFilter((v) => !v)}
              title="Filter liked messages"
            >
              <Heart size={13} />
              <span>Likes ({totalChannelLikes})</span>
            </button>

            <button
              type="button"
              className={`wa-top-pill ${showPinnedDrawer ? "active" : ""}`}
              onClick={() => setShowPinnedDrawer((v) => !v)}
              title="Pinned messages"
            >
              <Pin size={13} />
              <span>{pinnedMessages.length}</span>
            </button>

            <button
              type="button"
              className={`wa-top-pill ${showInspectorDrawer ? "active" : ""}`}
              onClick={() => setShowInspectorDrawer((v) => !v)}
              aria-label="Toggle Channel Info & Shared Files Drawer"
            >
              <PanelRight size={14} />
              <span>Inspector</span>
            </button>

            <div
              className="wa-member-counter"
              onClick={() => {
                setInspectorTab("members");
                setShowInspectorDrawer((v) => !v);
              }}
              style={{ cursor: "pointer" }}
            >
              <strong>{user_list.length}</strong>
              <span>|</span>
              <span>{activeChannel.totalOrgCount || 100}</span>
              <Users size={16} />
            </div>
          </div>
        </header>

        {broadcastBanner && (
          <div className="wa-broadcast-toast">
            <span className="wa-bt-badge">@all Broadcast</span>
            <span>
              <strong>{broadcastBanner.sender}</strong> notified everyone in this
              space ({broadcastBanner.notifiedUsers.join(", ")})
            </span>
            <button
              type="button"
              className="wa-bt-close"
              onClick={() => setBroadcastBanner(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {(activeUserFilter ||
          onlyLikedFilter ||
          onlyMentionsFilter ||
          onlyFilesFilter) && (
          <div className="wa-filter-banner">
            <Filter size={13} />
            <span>Filtering by:</span>
            {activeUserFilter && (
              <span className="wa-active-filter-chip">
                Sender: {activeUserFilter}
                <button onClick={() => setActiveUserFilter(null)}>×</button>
              </span>
            )}
            {onlyFilesFilter && (
              <span className="wa-active-filter-chip">
                Shared Files &amp; Screenshots
                <button onClick={() => setOnlyFilesFilter(false)}>×</button>
              </span>
            )}
            {onlyMentionsFilter && (
              <span className="wa-active-filter-chip">
                @Mentions
                <button onClick={() => setOnlyMentionsFilter(false)}>×</button>
              </span>
            )}
            {onlyLikedFilter && (
              <span className="wa-active-filter-chip">
                Liked Messages
                <button onClick={() => setOnlyLikedFilter(false)}>×</button>
              </span>
            )}
          </div>
        )}

        {showPinnedDrawer && pinnedMessages.length > 0 && (
          <div className="wa-pinned-banner">
            <div className="wa-pinned-top">
              <span>📌 Pinned Messages ({pinnedMessages.length})</span>
              <button onClick={() => setShowPinnedDrawer(false)}>
                <X size={14} />
              </button>
            </div>
            {pinnedMessages.map((pm) => (
              <div key={pm.id} className="wa-pinned-row">
                <strong>{pm.user}:</strong> {pm.text}
              </div>
            ))}
          </div>
        )}

        <section className="wa-message-stream" aria-live="polite">
          <div className="wa-date-divider">
            <span>TODAY</span>
          </div>

          {displayedMessages.length === 0 ? (
            <div className="wa-empty-chat">
              <p>No messages match your current filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setActiveUserFilter(null);
                  setOnlyLikedFilter(false);
                  setOnlyMentionsFilter(false);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            displayedMessages.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                currentUser={currentUser}
                isHighlighted={highlightedMessageId === msg.id}
                onLike={handleLikeMessage}
                onReact={handleReactMessage}
                onReply={(m) => {
                  setReplyingTo(m);
                  inputRef.current?.focus();
                }}
                onPin={handlePinMessage}
                onEdit={handleEditMessage}
                onDelete={handleDeleteMessage}
                onMentionClick={(u) =>
                  setActiveUserFilter((prev) => (prev === u ? null : u))
                }
                onJumpToMessage={handleJumpToMessage}
              />
            ))
          )}

          {typingUsers.length > 0 && (
            <div className="wa-typing-bubble">
              <div className="wa-typing-dots">
                <span />
                <span />
                <span />
              </div>
              <span>
                <strong>{typingUsers.join(", ")}</strong> is typing...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </section>

        <footer className="wa-composer-bar">
          {(replyingTo || attachedFile) && (
            <div className="wa-composer-preview-tray">
              {replyingTo && (
                <div className="wa-reply-preview-card">
                  <CornerDownRight size={15} className="wa-rp-icon" />
                  <div className="wa-rp-body">
                    <span className="wa-rp-author">
                      Replying to @{replyingTo.user}
                    </span>
                    <span className="wa-rp-text">
                      {replyingTo.text ||
                        `📎 ${replyingTo.attachment?.name || "Attachment"}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wa-rp-close"
                    onClick={() => setReplyingTo(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {attachedFile && (
                <div className="wa-attachment-preview-card">
                  {attachedFile.category === "image" &&
                  attachedFile.dataUrl ? (
                    <img
                      src={attachedFile.dataUrl}
                      alt={attachedFile.name}
                      className="wa-ap-thumb"
                    />
                  ) : (
                    <div className="wa-ap-badge">
                      {attachedFile.category?.toUpperCase() || "FILE"}
                    </div>
                  )}
                  <div className="wa-ap-meta">
                    <strong>{attachedFile.name}</strong>
                    <span>
                      {attachedFile.sizeFormatted}
                      {attachedFile.dimensions
                        ? ` · ${attachedFile.dimensions}`
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wa-rp-close"
                    onClick={() => setAttachedFile(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>
          )}

          {mentionState.isOpen && (
            <MentionPopup
              users={filteredMentionUsers}
              selectedIndex={mentionState.selectedIndex}
              query={mentionState.query}
              onSelectUser={handleSelectMentionUser}
              onHoverIndex={(idx) =>
                setMentionState((prev) => ({ ...prev, selectedIndex: idx }))
              }
            />
          )}

          {showEmojiPicker && (
            <EmojiPicker
              onSelectEmoji={handleSelectEmoji}
              onClose={() => setShowEmojiPicker(false)}
              frequentEmojis={frequentEmojis}
            />
          )}

          {showAttachMenu && (
            <div className="wa-attach-popover">
              <button
                type="button"
                className="wa-attach-option"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
              >
                <span className="wa-att-ic purple">
                  <ImageIcon size={17} />
                </span>
                <div>
                  <strong>Photos &amp; Images</strong>
                  <small>PNG, JPG, WebP, GIF</small>
                </div>
              </button>

              <button
                type="button"
                className="wa-attach-option"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = ".pdf,application/pdf";
                    fileInputRef.current.click();
                  }
                }}
              >
                <span className="wa-att-ic red">
                  <FileText size={17} />
                </span>
                <div>
                  <strong>PDF Document</strong>
                  <small>Reports, specs &amp; documentation</small>
                </div>
              </button>

              <button
                type="button"
                className="wa-attach-option"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "*/*";
                    fileInputRef.current.click();
                  }
                }}
              >
                <span className="wa-att-ic blue">
                  <FileCode size={17} />
                </span>
                <div>
                  <strong>Code, CSV, or File</strong>
                  <small>JS, PY, JSON, CSV, TXT</small>
                </div>
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="wa-input-row">
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileAttach}
            />

            <button
              type="button"
              data-emoji-trigger="true"
              className={`wa-composer-btn ${showEmojiPicker ? "active" : ""}`}
              onClick={() => {
                setShowAttachMenu(false);
                setMentionState((prev) => ({ ...prev, isOpen: false }));
                setShowEmojiPicker((v) => !v);
              }}
              title="Emoji Picker"
            >
              <Smile size={21} />
            </button>

            <button
              type="button"
              className={`wa-composer-btn ${showAttachMenu ? "active" : ""}`}
              onClick={() => {
                setShowEmojiPicker(false);
                setShowAttachMenu((v) => !v);
              }}
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            <button
              type="button"
              className={`wa-composer-btn ${
                mentionState.isOpen ? "active" : ""
              }`}
              onClick={handleAtButtonClick}
              title="Mention @Alan, @Bob, @Carol, @Dean, or @Elin"
            >
              <AtSign size={20} />
            </button>

            <div className="wa-textbox-wrap">
              <input
                ref={inputRef}
                type="text"
                className="wa-textbox"
                placeholder={
                  replyingTo
                    ? `Reply to @${replyingTo.user}...`
                    : "Type a message"
                }
                value={messageInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
            </div>

            <button
              type="submit"
              className="wa-send-button"
              disabled={!messageInput.trim() && !attachedFile}
              title="Send message"
            >
              <span>Send</span>
              <Send size={15} />
            </button>
          </form>
        </footer>
      </main>

      {/* Right-Side Channel & Shared Artifacts Inspector Drawer */}
      {showInspectorDrawer && (
        <aside className="wa-inspector-drawer">
          <div className="wa-inspector-header">
            <div>
              <h3>Channel Inspector</h3>
              <p>{activeChannel.name}</p>
            </div>
            <button
              type="button"
              className="wa-icon-circle-btn"
              onClick={() => setShowInspectorDrawer(false)}
              aria-label="Close Inspector"
            >
              <X size={16} />
            </button>
          </div>

          <div className="wa-inspector-hero">
            <div
              className="wa-inspector-avatar"
              style={{
                backgroundColor: activeChannel.avatarColor || "#4f46e5",
              }}
            >
              {activeChannel.type === "dm" ? activeChannel.initials : "#"}
            </div>
            <h4>{activeChannel.name}</h4>
            <p>{activeChannel.description}</p>
            <div className="wa-inspector-stats">
              <div>
                <strong>{activeMessages.length}</strong>
                <span>Messages</span>
              </div>
              <div>
                <strong>{totalChannelFiles}</strong>
                <span>Files &amp; Specs</span>
              </div>
              <div>
                <strong>{totalChannelLikes}</strong>
                <span>Likes</span>
              </div>
            </div>
          </div>

          <div className="wa-inspector-tabs">
            <button
              type="button"
              className={`wa-insp-tab ${
                inspectorTab === "files" ? "active" : ""
              }`}
              onClick={() => setInspectorTab("files")}
            >
              Shared Files ({channelFileMessages.length})
            </button>
            <button
              type="button"
              className={`wa-insp-tab ${
                inspectorTab === "members" ? "active" : ""
              }`}
              onClick={() => setInspectorTab("members")}
            >
              Team ({user_list.length + 1})
            </button>
          </div>

          <div className="wa-inspector-body">
            {inspectorTab === "files" ? (
              channelFileMessages.length === 0 ? (
                <div className="wa-insp-empty">
                  No screenshots, PDFs, or code files shared in this channel
                  yet.
                </div>
              ) : (
                <div className="wa-insp-file-list">
                  {channelFileMessages.map((m) => {
                    const att = m.attachment;
                    return (
                      <div key={m.id} className="wa-insp-file-card">
                        {att.category === "image" && att.dataUrl ? (
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="wa-insp-file-thumb"
                            onClick={() => handleJumpToMessage(m.id)}
                          />
                        ) : (
                          <div className={`wa-insp-file-badge ${att.category}`}>
                            {(att.category || "FILE").toUpperCase()}
                          </div>
                        )}
                        <div className="wa-insp-file-info">
                          <strong
                            onClick={() => handleJumpToMessage(m.id)}
                            className="wa-insp-file-title"
                          >
                            {att.name}
                          </strong>
                          <span>
                            Shared by {m.user} · {m.timestamp} ·{" "}
                            {att.sizeFormatted || "Verified"}
                          </span>
                        </div>
                        <a
                          href={att.dataUrl}
                          download={att.name}
                          className="wa-insp-dl-btn"
                          aria-label={`Download ${att.name}`}
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="wa-insp-member-list">
                {/* Logged-in Employee */}
                <div className="wa-insp-member-row">
                  <div
                    className="wa-who-avatar"
                    style={{
                      backgroundColor: currentUser.avatarColor || "#4f46e5",
                      width: 34,
                      height: 34,
                      fontSize: 12,
                    }}
                  >
                    {currentUser.initials || "KK"}
                  </div>
                  <div className="wa-who-info">
                    <span className="wa-who-name">
                      {currentUser.fullName} (You)
                    </span>
                    <span className="wa-who-role">
                      {currentUser.designation} · {currentUser.employeeId}
                    </span>
                  </div>
                </div>

                {/* Colleagues from user_list */}
                {user_list.map((botName) => {
                  const detail = USER_DETAILS[botName];
                  return (
                    <div key={botName} className="wa-insp-member-row">
                      <div
                        className="wa-who-avatar"
                        style={{
                          backgroundColor: detail.color,
                          width: 34,
                          height: 34,
                          fontSize: 12,
                        }}
                      >
                        {detail.initials}
                      </div>
                      <div className="wa-who-info">
                        <span className="wa-who-name">{botName}</span>
                        <span className="wa-who-role">{detail.role}</span>
                      </div>
                      <button
                        type="button"
                        className="wa-insp-dm-btn"
                        onClick={() =>
                          handleSelectChannel(`dm-${botName.toLowerCase()}`)
                        }
                      >
                        <MessageSquare size={12} /> DM
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
