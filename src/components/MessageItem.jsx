import React, { useState } from "react";
import {
  ThumbsUp,
  Reply,
  Pin,
  Edit3,
  Trash2,
  Copy,
  Check,
  SmilePlus,
  FileText,
  FileCode,
  Download,
  CheckCheck,
  Maximize2,
  X,
} from "lucide-react";
import { user_list, USER_DETAILS } from "../data/constants";

const QUICK_REACTIONS = ["👍", "❤️", "🚀", "🎉", "🔥", "👏"];

function getPersonMeta(personName, currentUser) {
  const clean = String(personName || "").trim();
  const firstWord = clean.split(" ")[0];
  if (USER_DETAILS[clean]) return USER_DETAILS[clean];
  if (USER_DETAILS[firstWord]) return USER_DETAILS[firstWord];
  if (
    currentUser &&
    clean.toLowerCase() === (currentUser.fullName || "").toLowerCase()
  ) {
    return {
      name: currentUser.fullName,
      initials: currentUser.initials || "KK",
      role: currentUser.designation || "Software Engineer",
      color: currentUser.avatarColor || "#4f46e5",
    };
  }
  return {
    name: clean || "Teammate",
    initials: (clean || "TM").slice(0, 2).toUpperCase(),
    role: "Software Engineer",
    color: "#4f46e5",
  };
}

function renderFormattedText(text, onMentionClick) {
  if (!text) return null;

  const tokenRegex =
    /(@all\b|@everyone\b|@[A-Za-z0-9_]+(?:\s+Kshitij)?|#[A-Za-z0-9_-]+|`[^`]+`|\*\*[^*]+\*\*)/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("@")) {
      const mentionedName = part.slice(1);
      const isAll =
        mentionedName.toLowerCase() === "all" ||
        mentionedName.toLowerCase() === "everyone";
      const isKnownBot = user_list.some(
        (u) => u.toLowerCase() === mentionedName.toLowerCase()
      );
      return (
        <span
          key={index}
          className={`wa-mention-token ${
            isAll
              ? "all-mention"
              : isKnownBot
              ? "bot-mention"
              : "user-mention"
          }`}
          onClick={() =>
            !isAll && onMentionClick && onMentionClick(mentionedName)
          }
        >
          {part}
        </span>
      );
    }

    if (part.startsWith("#") && part.length > 1) {
      return (
        <span key={index} className="wa-channel-token">
          {part}
        </span>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={index} className="wa-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export default function MessageItem({
  message,
  currentUser,
  isHighlighted = false,
  onLike,
  onReact,
  onReply,
  onPin,
  onEdit,
  onDelete,
  onMentionClick,
  onJumpToMessage,
}) {
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [replyFlash, setReplyFlash] = useState(false);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [showLikePopover, setShowLikePopover] = useState(false);
  const [hoveredReactionEmoji, setHoveredReactionEmoji] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.text);
  const [expandImageModal, setExpandImageModal] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);

  const triggerQuickReply = () => {
    setReplyFlash(true);
    onReply(message);
    setTimeout(() => setReplyFlash(false), 520);
  };

  const handleRowDoubleClick = (e) => {
    // Ignore double-clicks inside interactive controls, buttons, inputs, or image lightbox triggers
    if (
      e.target.closest(
        "button, input, a, .wa-like-box-wrapper, .wa-reactions-strip, .wa-hover-actions, .wa-quoted-reply-box, .wa-image-preview-wrap"
      )
    ) {
      return;
    }
    // Clear any accidental text selection from double-clicking whitespace
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    triggerQuickReply();
  };

  const handleSideTouchEnd = () => {
    const now = Date.now();
    if (now - lastTapTime < 320) {
      triggerQuickReply();
      setLastTapTime(0);
    } else {
      setLastTapTime(now);
    }
  };

  const isOwnMessage =
    currentUser &&
    (message.senderEmployeeId === currentUser.employeeId ||
      message.user.toLowerCase() === currentUser.fullName.toLowerCase());

  const userProfile = USER_DETAILS[message.user] || {
    initials: message.initials || message.user.slice(0, 2).toUpperCase(),
    color: message.avatarColor || "#4f46e5",
    role: message.senderRole || "Team Member",
  };

  // Requirement 1: Check if current logged-in employee already liked this message
  const likedByList = Array.isArray(message.likedBy) ? message.likedBy : [];
  const hasCurrentUserLiked =
    currentUser &&
    likedByList.some(
      (entry) =>
        entry.employeeId === currentUser.employeeId ||
        entry.name?.toLowerCase() === currentUser.fullName?.toLowerCase()
    );

  const handleLikeClick = () => {
    setLikeAnimating(true);
    onLike(message.id);
    setTimeout(() => setLikeAnimating(false), 300);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (editDraft.trim()) {
      onEdit(message.id, editDraft.trim());
      setIsEditing(false);
    }
  };

  const handleDownloadAttachment = () => {
    const att = message.attachment;
    if (!att || !att.dataUrl) return;
    const link = document.createElement("a");
    link.href = att.dataUrl;
    link.download = att.name || "attachment";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Normalize reactions map ({ emoji: [userNames] } or { emoji: number })
  const reactionEntries = Object.entries(message.reactions || {})
    .map(([emoji, val]) => {
      const users = Array.isArray(val) ? val : [];
      const count = Array.isArray(val) ? val.length : Number(val) || 0;
      return { emoji, count, users };
    })
    .filter((r) => r.count > 0);

  const att = message.attachment;

  return (
    <div
      id={`msg-row-${message.id}`}
      className={`wa-msg-row ${isOwnMessage ? "outgoing" : "incoming"} ${
        message.pinned ? "pinned" : ""
      } ${replyFlash ? "reply-flash" : ""} ${
        isHighlighted ? "jump-highlighted" : ""
      }`}
      onDoubleClick={handleRowDoubleClick}
    >
      {/* Avatar shown on incoming messages */}
      {!isOwnMessage && (
        <div
          className="wa-msg-avatar"
          style={{ backgroundColor: message.avatarColor || userProfile.color }}
        >
          {message.initials || userProfile.initials}
        </div>
      )}

      <div className="wa-msg-column">
        <div className="wa-bubble-and-like-wrap">
          {/* Message Card Bubble */}
          <div className="wa-speech-bubble">
            {/* Sender Header */}
            <div className="wa-bubble-header">
              <span
                className="wa-sender-name"
                style={{
                  color: isOwnMessage
                    ? "var(--wa-accent-strong)"
                    : message.avatarColor || userProfile.color,
                }}
              >
                {isOwnMessage ? `${message.user} (You)` : message.user}
              </span>
              <span className="wa-sender-role">
                {message.senderRole || userProfile.role}
              </span>
              {message.pinned && (
                <span className="wa-pinned-tag">
                  <Pin size={10} /> Pinned
                </span>
              )}
              {replyFlash && (
                <span className="wa-reply-flash-badge">
                  <Reply size={10} /> Replying...
                </span>
              )}
            </div>

            {/* Quoted Reply Block (Click to jump & highlight original message!) */}
            {message.replyTo && (
              <div
                className="wa-quoted-reply-box clickable"
                onClick={() =>
                  message.replyTo.id &&
                  onJumpToMessage &&
                  onJumpToMessage(message.replyTo.id)
                }
              >
                <div className="wa-quoted-author">
                  <span>@{message.replyTo.user}</span>
                  {(message.isFollowUp ||
                    message.replyTo.isSelfFollowUp ||
                    message.replyTo.user === message.user) && (
                    <span className="wa-followup-tag">
                      Followed up on their message ↩
                    </span>
                  )}
                </div>
                <div className="wa-quoted-text">
                  {message.replyTo.text ||
                    (message.replyTo.attachmentName
                      ? `📎 ${message.replyTo.attachmentName}`
                      : "")}
                </div>
              </div>
            )}

            {/* Rich Attachment Renderer (Images/Code Screenshots, PDFs, Source Files) */}
            {att && (
              <div className="wa-attachment-block">
                {att.category === "image" && att.dataUrl ? (
                  <div className="wa-image-attachment">
                    <div
                      className="wa-image-preview-wrap"
                      onClick={() => setExpandImageModal(true)}
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="wa-attached-img"
                      />
                      <span className="wa-img-expand-pill">
                        <Maximize2 size={12} />{" "}
                        {att.dimensions || att.sizeFormatted || "Inspect"}
                      </span>
                    </div>
                    <div className="wa-att-footer-row">
                      <span className="wa-att-filename">{att.name}</span>
                      <button
                        type="button"
                        className="wa-att-dl-btn"
                        onClick={handleDownloadAttachment}
                      >
                        <Download size={13} /> {att.sizeFormatted || "Save"}
                      </button>
                    </div>
                  </div>
                ) : att.category === "pdf" ? (
                  <div className="wa-pdf-attachment-card">
                    <div className="wa-pdf-top-row">
                      <div className="wa-pdf-badge">PDF</div>
                      <div className="wa-pdf-meta">
                        <div className="wa-pdf-name">{att.name}</div>
                        <div className="wa-pdf-sub">
                          {att.pageCount ? `${att.pageCount} pages · ` : ""}
                          {att.sizeFormatted || "PDF Document"} · Verified Spec
                        </div>
                      </div>
                      <button
                        type="button"
                        className="wa-pdf-open-btn"
                        onClick={handleDownloadAttachment}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                    {att.extractedText && (
                      <div className="wa-pdf-extracted-snippet">
                        <strong>Document Preview:</strong>{" "}
                        {att.extractedText.slice(0, 180)}
                        {att.extractedText.length > 180 ? "..." : ""}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="wa-file-attachment-card">
                    <div className="wa-file-top-row">
                      <div className="wa-file-icon-box">
                        {att.category === "code" ? (
                          <FileCode size={18} />
                        ) : (
                          <FileText size={18} />
                        )}
                      </div>
                      <div className="wa-pdf-meta">
                        <div className="wa-pdf-name">{att.name}</div>
                        <div className="wa-pdf-sub">
                          {att.category?.toUpperCase() || "FILE"} ·{" "}
                          {att.sizeFormatted}
                        </div>
                      </div>
                      {att.extractedText && (
                        <button
                          type="button"
                          className="wa-code-toggle-btn"
                          onClick={() => setShowCodePreview((v) => !v)}
                        >
                          {showCodePreview ? "Hide" : "Inspect"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="wa-pdf-open-btn"
                        onClick={handleDownloadAttachment}
                      >
                        <Download size={15} />
                      </button>
                    </div>
                    {showCodePreview && att.extractedText && (
                      <pre className="wa-code-snippet-box">
                        <code>{att.extractedText.slice(0, 600)}</code>
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Message Text or Inline Edit Form */}
            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="wa-edit-form">
                <input
                  type="text"
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="wa-edit-input"
                  autoFocus
                />
                <div className="wa-edit-btns">
                  <button type="submit" className="wa-btn-save">
                    Save
                  </button>
                  <button
                    type="button"
                    className="wa-btn-cancel"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              message.text && (
                <div className="wa-message-text">
                  {renderFormattedText(message.text, onMentionClick)}
                </div>
              )
            )}

            {/* Bottom-right Timestamp & Read Receipts inside Bubble */}
            <div className="wa-bubble-meta-footer">
              {message.edited && (
                <span className="wa-edited-label">edited</span>
              )}
              <span className="wa-timestamp">{message.timestamp}</span>
              {isOwnMessage && (
                <CheckCheck size={15} className="wa-read-ticks" />
              )}
            </div>
          </div>

          {/* Right-end Like Button + Side Popover Box (No browser tooltip!) */}
          <div
            className="wa-like-box-wrapper"
            onMouseEnter={() => setShowLikePopover(true)}
            onMouseLeave={() => setShowLikePopover(false)}
          >
            <div className="wa-like-box">
              <button
                type="button"
                className={`wa-like-btn ${hasCurrentUserLiked ? "liked" : ""} ${
                  likeAnimating ? "pop" : ""
                }`}
                onClick={handleLikeClick}
                aria-label="Like message"
              >
                <ThumbsUp size={13} />
                <span>{hasCurrentUserLiked ? "Liked" : "Like"}</span>
              </button>
              <span
                className={`wa-like-count ${
                  (message.likes || 0) > 0 ? "active" : ""
                }`}
              >
                {message.likes || 0}
              </span>
            </div>

            {/* Side Floating Box showing who liked this message */}
            {showLikePopover && likedByList.length > 0 && (
              <div
                className={`wa-who-popover like-side-box ${
                  isOwnMessage ? "align-left" : "align-right"
                }`}
              >
                <div className="wa-who-popover-header">
                  <span>Liked by</span>
                  <span className="wa-who-count-pill">
                    👍 {likedByList.length}
                  </span>
                </div>
                <div className="wa-who-popover-list">
                  {likedByList.map((entry, idx) => {
                    const meta = getPersonMeta(entry.name, currentUser);
                    const isMe =
                      currentUser &&
                      (entry.employeeId === currentUser.employeeId ||
                        entry.name?.toLowerCase() ===
                          currentUser.fullName?.toLowerCase());
                    return (
                      <div key={idx} className="wa-who-row">
                        <div
                          className="wa-who-avatar"
                          style={{ backgroundColor: meta.color }}
                        >
                          {meta.initials}
                        </div>
                        <div className="wa-who-info">
                          <span className="wa-who-name">
                            {isMe ? `${entry.name} (You)` : entry.name}
                          </span>
                          <span className="wa-who-role">{meta.role}</span>
                        </div>
                        <span className="wa-who-emoji">👍</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Hover Action Bar */}
          <div className="wa-hover-actions">
            <div className="wa-react-wrap">
              <button
                type="button"
                className="wa-act-btn"
                onClick={() => setShowReactionBar((v) => !v)}
                aria-label="React with emoji"
              >
                <SmilePlus size={14} />
              </button>
              {showReactionBar && (
                <div className="wa-quick-emojis">
                  {QUICK_REACTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        onReact(message.id, em);
                        setShowReactionBar(false);
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="wa-act-btn"
              onClick={() => onReply(message)}
              aria-label="Reply to message"
            >
              <Reply size={14} />
            </button>

            <button
              type="button"
              className={`wa-act-btn ${message.pinned ? "active" : ""}`}
              onClick={() => onPin(message.id)}
              aria-label="Pin message"
            >
              <Pin size={14} />
            </button>

            {isOwnMessage && (
              <button
                type="button"
                className="wa-act-btn"
                onClick={() => {
                  setEditDraft(message.text);
                  setIsEditing(true);
                }}
                aria-label="Edit message"
              >
                <Edit3 size={14} />
              </button>
            )}

            <button
              type="button"
              className="wa-act-btn"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>

            {isOwnMessage && (
              <button
                type="button"
                className="wa-act-btn danger"
                onClick={() => onDelete(message.id)}
                aria-label="Delete message"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Emoji Reactions Strip with Floating Side Box on Hover (No native tooltip!) */}
        {reactionEntries.length > 0 && (
          <div className="wa-reactions-strip">
            {reactionEntries.map(({ emoji, count, users }) => (
              <div
                key={emoji}
                className="wa-reaction-chip-wrap"
                onMouseEnter={() => setHoveredReactionEmoji(emoji)}
                onMouseLeave={() => setHoveredReactionEmoji(null)}
              >
                <button
                  type="button"
                  className="wa-reaction-chip"
                  onClick={() => onReact(message.id, emoji)}
                >
                  <span>{emoji}</span>
                  <span className="wa-reaction-num">{count}</span>
                </button>

                {hoveredReactionEmoji === emoji && users.length > 0 && (
                  <div
                    className={`wa-who-popover reaction-side-box ${
                      isOwnMessage ? "align-left" : "align-right"
                    }`}
                  >
                    <div className="wa-who-popover-header">
                      <span>Reacted with {emoji}</span>
                      <span className="wa-who-count-pill">{users.length}</span>
                    </div>
                    <div className="wa-who-popover-list">
                      {users.map((uName, idx) => {
                        const meta = getPersonMeta(uName, currentUser);
                        const isMe =
                          currentUser &&
                          uName.toLowerCase() ===
                            currentUser.fullName?.toLowerCase();
                        return (
                          <div key={idx} className="wa-who-row">
                            <div
                              className="wa-who-avatar"
                              style={{ backgroundColor: meta.color }}
                            >
                              {meta.initials}
                            </div>
                            <div className="wa-who-info">
                              <span className="wa-who-name">
                                {isMe ? `${uName} (You)` : uName}
                              </span>
                              <span className="wa-who-role">{meta.role}</span>
                            </div>
                            <span className="wa-who-emoji">{emoji}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side Double-Tap / Double-Click Zone to Reply Without Pressing Reply Button */}
      <div
        className="wa-double-tap-side-zone"
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (window.getSelection) {
            window.getSelection().removeAllRanges();
          }
          triggerQuickReply();
        }}
        onTouchEnd={handleSideTouchEnd}
        aria-label="Double-click or double-tap side of message to reply"
      >
        <span className="wa-dt-hint-pill">
          <Reply size={11} />
          <span>Double-click side to reply</span>
        </span>
      </div>

      {/* Fullscreen Image Lightbox */}
      {expandImageModal && att?.dataUrl && (
        <div
          className="wa-img-lightbox"
          onClick={() => setExpandImageModal(false)}
        >
          <div
            className="wa-img-lightbox-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wa-img-lightbox-bar">
              <span>
                {att.name} {att.dimensions ? `(${att.dimensions})` : ""} —
                Shared by {message.user}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="wa-lb-btn"
                  onClick={handleDownloadAttachment}
                >
                  <Download size={15} /> Download
                </button>
                <button
                  type="button"
                  className="wa-lb-btn"
                  onClick={() => setExpandImageModal(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <img src={att.dataUrl} alt={att.name} className="wa-lb-full-img" />
          </div>
        </div>
      )}
    </div>
  );
}
