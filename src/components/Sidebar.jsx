import React, { useState } from "react";
import {
  MessageSquare,
  Users,
  Sun,
  Moon,
  LogOut,
  Plus,
  Search,
  CheckCheck,
  X,
  Building2,
  MapPin,
  Mail,
  Hash,
} from "lucide-react";
import { USER_DETAILS } from "../data/constants";

export default function Sidebar({
  currentUser,
  employees,
  channels,
  activeChannelId,
  messagesByChannel,
  onSelectChannel,
  onCreateChannel,
  unreadByChannel,
  senderMode,
  onChangeSenderMode,
  darkMode,
  onToggleDarkMode,
  onLogout,
  isMobileOpen,
  onCloseMobile,
}) {
  const [activeTab, setActiveTab] = useState("all"); // all | channels | dms | directory
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    onCreateChannel({
      name: newChannelName.trim(),
      description: newChannelDesc.trim(),
    });
    setNewChannelName("");
    setNewChannelDesc("");
    setShowNewChannelModal(false);
  };

  const groupChannels = channels.filter((c) => c.type !== "dm");
  const dmChannels = channels.filter((c) => c.type === "dm");

  const filterList = (list) => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
    );
  };

  const getLastMessageInfo = (channelId) => {
    const msgs = messagesByChannel[channelId] || [];
    if (msgs.length === 0) {
      return { preview: "No messages yet", time: "", sender: "" };
    }
    const last = msgs[msgs.length - 1];
    const textPreview = last.attachment
      ? `📎 ${last.attachment.name}`
      : last.text;
    return {
      preview:
        textPreview.length > 38
          ? `${textPreview.slice(0, 38)}...`
          : textPreview,
      time: last.timestamp || "",
      sender: last.user,
    };
  };

  return (
    <aside className={`wa-sidebar-shell ${isMobileOpen ? "mobile-open" : ""}`}>
      {/* Far-Left Navigation Rail */}
      <nav className="wa-left-rail" aria-label="Workspace navigation">
        <div className="wa-rail-top">
          <div className="wa-rail-brand" title="ExactSpace Connect">
            EX
          </div>

          <button
            type="button"
            className={`wa-rail-btn ${
              activeTab !== "directory" ? "active" : ""
            }`}
            onClick={() => setActiveTab("all")}
            title="Channels & Direct Messages"
          >
            <MessageSquare size={19} />
          </button>

          <button
            type="button"
            className={`wa-rail-btn ${
              activeTab === "directory" ? "active" : ""
            }`}
            onClick={() => setActiveTab("directory")}
            title="Team Directory"
          >
            <Users size={19} />
          </button>
        </div>

        <div className="wa-rail-bottom">
          <button
            type="button"
            className="wa-rail-btn"
            onClick={onToggleDarkMode}
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {currentUser && (
            <div
              className="wa-rail-user-avatar"
              style={{ backgroundColor: currentUser.avatarColor || "#4f46e5" }}
              title={`${currentUser.fullName} (${currentUser.employeeId})`}
            >
              {currentUser.initials}
              <span className="wa-online-dot" />
            </div>
          )}

          <button
            type="button"
            className="wa-rail-btn logout"
            onClick={onLogout}
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Conversation & Directory Column */}
      <div className="wa-chatlist-pane">
        {/* Logged-In Employee Header */}
        <div className="wa-chatlist-header">
          <div className="wa-logged-user-card">
            <div
              className="wa-user-avatar-lg"
              style={{
                backgroundColor: currentUser?.avatarColor || "#4f46e5",
              }}
            >
              {currentUser?.initials || "KK"}
              <span className="wa-online-dot" />
            </div>
            <div className="wa-user-details">
              <div className="wa-user-name-row">
                <span className="wa-user-fullname">
                  {currentUser?.fullName || "Kumar Kshitij"}
                </span>
                <span className="wa-emp-id-badge">
                  {currentUser?.employeeId || "EXS-2026-001"}
                </span>
              </div>
              <div className="wa-user-role-sub">
                {currentUser?.designation || "Software Engineer"} ·{" "}
                {currentUser?.officeLocation?.split(" ")[0] || "Bengaluru"}
              </div>
            </div>
          </div>

          <div className="wa-header-actions">
            <button
              type="button"
              className="wa-icon-circle-btn"
              onClick={() => setShowNewChannelModal((v) => !v)}
              title="Create new channel"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="wa-mobile-close-btn"
              onClick={onCloseMobile}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search + Filter Chips */}
        <div className="wa-search-and-tabs">
          <div className="wa-sidebar-search">
            <Search size={14} className="wa-search-ic" />
            <input
              type="text"
              placeholder="Jump to channel or teammate..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
            {sidebarSearch && (
              <button
                type="button"
                className="wa-clear-btn"
                onClick={() => setSidebarSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="wa-filter-chips-row">
            <button
              type="button"
              className={`wa-chip ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`wa-chip ${activeTab === "channels" ? "active" : ""}`}
              onClick={() => setActiveTab("channels")}
            >
              Spaces
            </button>
            <button
              type="button"
              className={`wa-chip ${activeTab === "dms" ? "active" : ""}`}
              onClick={() => setActiveTab("dms")}
            >
              Direct (5)
            </button>
            <button
              type="button"
              className={`wa-chip ${activeTab === "directory" ? "active" : ""}`}
              onClick={() => setActiveTab("directory")}
            >
              People ({employees.length})
            </button>
          </div>
        </div>

        {/* New Channel Drawer */}
        {showNewChannelModal && (
          <form onSubmit={handleCreateSubmit} className="wa-new-channel-box">
            <input
              type="text"
              placeholder="New channel name (e.g. Sprint Review)"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              autoFocus
            />
            <input
              type="text"
              placeholder="Channel purpose / topic"
              value={newChannelDesc}
              onChange={(e) => setNewChannelDesc(e.target.value)}
            />
            <div className="wa-new-channel-btns">
              <button type="submit" className="wa-btn-create">
                Create Space
              </button>
              <button
                type="button"
                className="wa-btn-cancel-sm"
                onClick={() => setShowNewChannelModal(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Conversation or Employee Directory List */}
        <div className="wa-conversation-scroll">
          {activeTab === "directory" ? (
            <div className="wa-directory-list">
              <div className="wa-list-section-label">
                ENGINEERING TEAM ({employees.length})
              </div>
              {employees.map((emp) => (
                <div key={emp.employeeId} className="wa-directory-card">
                  <div className="wa-dir-top">
                    <div
                      className="wa-conv-avatar"
                      style={{ backgroundColor: emp.avatarColor || "#4f46e5" }}
                    >
                      {emp.initials}
                      <span className="wa-online-dot" />
                    </div>
                    <div className="wa-dir-info">
                      <div className="wa-dir-name">
                        {emp.displayFullName || emp.fullName}
                      </div>
                      <div className="wa-dir-role">{emp.designation}</div>
                    </div>
                  </div>
                  <div className="wa-dir-meta">
                    <span>
                      <Building2 size={12} /> {emp.department}
                    </span>
                    <span>
                      <MapPin size={12} /> {emp.officeLocation}
                    </span>
                    <span>
                      <Mail size={12} /> {emp.email} ·{" "}
                      <code>{emp.employeeId}</code>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {(activeTab === "all" || activeTab === "channels") && (
                <>
                  <div className="wa-list-section-label">TEAM SPACES</div>
                  {filterList(groupChannels).map((channel) => {
                    const isActive = channel.id === activeChannelId;
                    const unread = unreadByChannel[channel.id] || 0;
                    const last = getLastMessageInfo(channel.id);

                    return (
                      <button
                        key={channel.id}
                        type="button"
                        className={`wa-conv-row ${isActive ? "active" : ""}`}
                        onClick={() => {
                          onSelectChannel(channel.id);
                          onCloseMobile();
                        }}
                      >
                        <div className="wa-conv-hash">
                          <Hash size={17} />
                        </div>
                        <div className="wa-conv-body">
                          <div className="wa-conv-top">
                            <span className="wa-conv-title">
                              {channel.name}
                            </span>
                            <span className="wa-conv-time">{last.time}</span>
                          </div>
                          <div className="wa-conv-bottom">
                            <span className="wa-conv-preview">
                              {last.sender ? (
                                <>
                                  <strong>{last.sender}:</strong> {last.preview}
                                </>
                              ) : (
                                last.preview
                              )}
                            </span>
                            {unread > 0 && !isActive && (
                              <span className="wa-unread-pill">{unread}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {(activeTab === "all" || activeTab === "dms") && (
                <>
                  <div className="wa-list-section-label">
                    COLLEAGUES · ONLINE (5)
                  </div>
                  {filterList(dmChannels).map((dm) => {
                    const isActive = dm.id === activeChannelId;
                    const unread = unreadByChannel[dm.id] || 0;
                    const last = getLastMessageInfo(dm.id);
                    const details = USER_DETAILS[dm.botName] || {};

                    return (
                      <button
                        key={dm.id}
                        type="button"
                        className={`wa-conv-row ${isActive ? "active" : ""}`}
                        onClick={() => {
                          onSelectChannel(dm.id);
                          onCloseMobile();
                        }}
                      >
                        <div
                          className="wa-conv-avatar"
                          style={{
                            backgroundColor:
                              dm.avatarColor || details.color || "#4f46e5",
                          }}
                        >
                          {dm.initials || details.initials}
                          <span className="wa-online-dot" />
                        </div>
                        <div className="wa-conv-body">
                          <div className="wa-conv-top">
                            <span className="wa-conv-title">
                              {dm.name}{" "}
                              <small className="wa-role-inline">
                                · {details.role}
                              </small>
                            </span>
                            <span className="wa-conv-time">{last.time}</span>
                          </div>
                          <div className="wa-conv-bottom">
                            <span className="wa-conv-preview">
                              <CheckCheck size={13} className="wa-mini-ticks" />{" "}
                              {last.preview}
                            </span>
                            {unread > 0 && !isActive && (
                              <span className="wa-unread-pill">{unread}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Bottom Workspace Identity Control */}
        <div className="wa-sidebar-footer">
          <div className="wa-sender-mode-row">
            <span className="wa-mode-label">Post as:</span>
            <select
              value={senderMode}
              onChange={(e) => onChangeSenderMode(e.target.value)}
              className="wa-mode-select"
            >
              <option value="logged-in">
                {currentUser?.fullName || "Kumar Kshitij"} (You)
              </option>
              <option value="random">
                Random from user_list (Assignment Spec)
              </option>
            </select>
          </div>
        </div>
      </div>
    </aside>
  );
}
