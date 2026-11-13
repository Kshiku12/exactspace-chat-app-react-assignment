import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Clock,
  Smile,
  Dog,
  Apple,
  Dribbble,
  Car,
  Lightbulb,
  Hash,
  Flag,
  Search,
} from "lucide-react";
import { EMOJI_CATEGORIES, EMOJI_LIST } from "../data/constants";

const CATEGORY_ICONS = {
  frequent: Clock,
  smileys: Smile,
  animals: Dog,
  food: Apple,
  activities: Dribbble,
  travel: Car,
  objects: Lightbulb,
  symbols: Hash,
};

export default function EmojiPicker({
  onSelectEmoji,
  onClose,
  frequentEmojis,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("frequent");
  const [hoveredEmoji, setHoveredEmoji] = useState(null);
  const searchInputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    searchInputRef.current?.focus();

    const handleClickOutside = (event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        !event.target.closest("[data-emoji-trigger]")
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return EMOJI_LIST;
    return EMOJI_LIST.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.char.includes(q)
    );
  }, [searchQuery]);

  const frequentList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      frequentEmojis && frequentEmojis.length > 0
        ? frequentEmojis
        : EMOJI_LIST.filter((e) => e.frequent);
    if (!q) return base;
    return base.filter((e) => e.name.toLowerCase().includes(q));
  }, [frequentEmojis, searchQuery]);

  const categoryEmojis = useMemo(() => {
    if (activeCategory === "frequent") {
      return filteredEmojis.filter((e) => e.category === "smileys");
    }
    return filteredEmojis.filter((e) => e.category === activeCategory);
  }, [activeCategory, filteredEmojis]);

  const activeCategoryLabel =
    activeCategory === "frequent"
      ? "Smileys & People"
      : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.label ||
        "Smileys & People";

  return (
    <div
      ref={pickerRef}
      className="emoji-picker-popover"
      role="dialog"
      aria-label="Emoji Picker"
    >
      {/* Top Category Tabs matching Frame 50 of team-chat-intro.gif */}
      <div className="emoji-category-tabs">
        {EMOJI_CATEGORIES.map((cat) => {
          const IconComponent = CATEGORY_ICONS[cat.id] || Flag;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`emoji-cat-tab ${isActive ? "active" : ""}`}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.label}
            >
              <IconComponent size={17} />
            </button>
          );
        })}
      </div>

      {/* Search Box */}
      <div className="emoji-search-wrapper">
        <div className="emoji-search-box">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emojis (try 'w' for 👋)..."
            className="emoji-search-input"
          />
          <Search size={15} className="emoji-search-icon" />
        </div>
      </div>

      {/* Scrollable Emoji Sections */}
      <div className="emoji-scroll-area">
        {frequentList.length > 0 && (
          <div className="emoji-section">
            <div className="emoji-section-title">Frequently Used</div>
            <div className="emoji-grid">
              {frequentList.map((item) => (
                <button
                  key={`freq-${item.char}`}
                  type="button"
                  className="emoji-cell"
                  onMouseEnter={() => setHoveredEmoji(item)}
                  onClick={() => onSelectEmoji(item)}
                  title={item.name}
                >
                  {item.char}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="emoji-section">
          <div className="emoji-section-title">
            {searchQuery.trim()
              ? `Search Results (${filteredEmojis.length})`
              : activeCategoryLabel}
          </div>
          { (searchQuery.trim() ? filteredEmojis : categoryEmojis).length === 0 ? (
            <div className="emoji-empty-state">
              No emojis found for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="emoji-grid">
              {(searchQuery.trim() ? filteredEmojis : categoryEmojis).map(
                (item, idx) => (
                  <button
                    key={`${item.char}-${idx}`}
                    type="button"
                    className="emoji-cell"
                    onMouseEnter={() => setHoveredEmoji(item)}
                    onClick={() => onSelectEmoji(item)}
                    title={item.name}
                  >
                    {item.char}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Footer matching GIF */}
      <div className="emoji-picker-footer">
        <div className="emoji-preview-label">
          {hoveredEmoji ? (
            <>
              <span className="emoji-preview-char">{hoveredEmoji.char}</span>
              <span className="emoji-preview-name">
                :{hoveredEmoji.name.split(" ")[0]}:
              </span>
            </>
          ) : (
            <span className="emoji-preview-hint">Pick an emoji...</span>
          )}
        </div>
        <span className="emoji-skin-dot" title="Default skin tone" />
      </div>
    </div>
  );
}
