import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { Server } from "socket.io";
import { attachSocketHub, createApiMiddleware } from "./server/socketHub.js";

/**
 * Vite plugin that mounts our Express REST API (/api/auth/*, /api/employees, /api/config/*)
 * AND our Socket.io WebSocket Pub/Sub server directly onto Vite's HTTP server.
 */
function embeddedBackendPlugin() {
  return {
    name: "embedded-exactspace-backend",
    configureServer(server) {
      // Mount REST API middleware for Auth, MongoDB & AI Config
      server.middlewares.use(createApiMiddleware());

      if (!server.httpServer) return;
      const io = new Server(server.httpServer, {
        cors: { origin: "*" },
        maxHttpBufferSize: 25 * 1024 * 1024, // Support up to 25MB PDF/Image attachments
      });
      attachSocketHub(io);
    },
  };
}

export default defineConfig({
  plugins: [react(), embeddedBackendPlugin()],
  server: {
    port: 5173,
  },
});
