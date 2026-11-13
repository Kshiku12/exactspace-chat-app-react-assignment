# ExactSpace Workspace — Real-Time Enterprise Team Chat Application
**Engineered by Kumar Kshitij**

A full-stack ReactJS + Express.js + Socket.io + MongoDB real-time team collaboration platform built for the ExactSpace engineering evaluation.

---

## Key Features & Architecture

1. **Modern 3-Column Team Collaboration UI/UX:**
   - Custom three-column architecture featuring a far-left workspace navigation rail, a searchable channels & direct-messages directory, a real-time message stream, and a collapsible **Channel & Shared Files Inspector Drawer**.
   - Supports **Group Workspace Channels** (`# Introductions`, `# India Office`, `# Poland Office`, plus custom channels) and **1-on-1 Direct Chats** with `Alan`, `Bob`, `Carol`, `Dean`, and `Elin`.
   - **Quick-Reply Side Gesture:** Double-click or double-tap the side of any message row to quote and reply immediately without reaching for the reply button.
   - **Inline Reaction Drawer:** Clicking or hovering over any reaction pill expands a sleek inline drawer beside the pill showing the exact colleagues who reacted.
2. **Company Employee Login & Registration Portal + MongoDB Atlas Database:**
   - Full **Employee Registration** (`Full Name`, `Employee ID`, `Company Work Email`, `Department`, `Designation`, `Office Location`, `Phone`, `Password`) and **Employee Sign-In** backed by Mongoose (`server/models.js` & `server/storage.js`), `crypto.scryptSync` password hashing, and HMAC-SHA256 session tokens.
   - Pre-seeded with **Kumar Kshitij** (`kshitij@exactspace.co` / `EXS-2026-001` / password: `exactspace123`) for 1-click demo login.
3. **Strict 1-Like-Per-Person Enforcement:**
   - Each message stores `likedBy: [{ employeeId, name }]`. One employee can only like a message once (clicking again unlikes it, and the inline drawer lists everyone who liked the message).
4. **Autonomous & Context-Aware AI Colleagues (`Alan`, `Bob`, `Carol`, `Dean`, `Elin`):**
   - Each member of `const user_list = ["Alan", "Bob", "Carol", "Dean", "Elin"]` has a distinct engineering persona and domain expertise (`server/aiEngine.js`).
   - Supports `@all` / `@everyone` group-wide broadcast mentions as well as individual `@mentions`.
   - Colleagues proactively share realistic engineering artifacts (terminal screenshots, React code diffs, architecture PDFs, and sensor CSVs) and send natural self-follow-ups quoting their own earlier message if left unanswered.
   - Supports live **Google Gemini 2.5 Flash Multimodal API** (`GEMINI_API_KEY`) alongside a built-in **Deep Contextual & File Inspection AI Engine**.
5. **Multimodal File, PDF, Image & Code Attachments:**
   - Attach **Images (`PNG`/`JPG`/`WebP`)**, **PDF documents (`.pdf`)**, or **Code/CSV files (`.js`, `.py`, `.json`, `.csv`)**.
   - The backend inspects binary image dimensions, extracts PDF page counts and embedded text streams, and parses code/CSV lines so your colleagues comment directly on your uploaded files.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start Full-Stack Workspace (Frontend + Express API + Socket.io + MongoDB Sync)
npm run dev
```
