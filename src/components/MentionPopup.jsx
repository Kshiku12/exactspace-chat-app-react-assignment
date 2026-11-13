import React from "react";
import { AtSign, Users } from "lucide-react";
import { USER_DETAILS } from "../data/constants";

/**
 * Stretch Goal 2 + @all Broadcast Tag:
 * Shows @all (notify everyone in channel) + `const user_list = ["Alan", "Bob", "Carol", "Dean", "Elin"]`
 * whenever the user types '@' or clicks the '@' button in the composer.
 */
export default function MentionPopup({
  users,
  selectedIndex,
  onSelectUser,
  onHoverIndex,
  query,
}) {
  if (!users || users.length === 0) {
    return (
      <div className="mention-popup" role="listbox" aria-label="Mention users">
        <div className="mention-popup-header">
          <AtSign size={14} />
          <span>No matching teammate for &ldquo;@{query}&rdquo;</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mention-popup" role="listbox" aria-label="Mention users">
      <div className="mention-popup-header">
        <div className="mention-popup-title">
          <AtSign size={14} />
          <span>Mention @all or a teammate</span>
        </div>
        <span className="mention-popup-kbd">↑↓ navigate · Enter ↵</span>
      </div>

      <div className="mention-list">
        {users.map((username, idx) => {
          const isAll = username.toLowerCase() === "all";
          const details = USER_DETAILS[username] || {
            initials: username.slice(0, 2).toUpperCase(),
            role: "Team Member",
            color: "#4f46e5",
            status: "online",
          };
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={username}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`mention-item ${isSelected ? "selected" : ""} ${
                isAll ? "broadcast-item" : ""
              }`}
              onMouseEnter={() => onHoverIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectUser(username);
              }}
            >
              <div
                className="mention-avatar"
                style={{ backgroundColor: details.color }}
              >
                {isAll ? <Users size={15} /> : details.initials}
                <span
                  className={`mention-status-dot ${details.status || "online"}`}
                />
              </div>
              <div className="mention-info">
                <div className="mention-name-row">
                  <span className="mention-name">@{username}</span>
                  {isAll && (
                    <span className="mention-broadcast-pill">Notify All</span>
                  )}
                </div>
                <span className="mention-role">{details.role}</span>
              </div>
              <span className="mention-select-badge">Enter ↵</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
