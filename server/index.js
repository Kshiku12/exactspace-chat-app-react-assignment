import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { attachSocketHub } from "./socketHub.js";

const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 25 * 1024 * 1024,
});

attachSocketHub(io, app);

httpServer.listen(PORT, () => {
  console.log(
    `[ExactSpace Connect] Express + MongoDB + Socket.io Server running on http://localhost:${PORT}`
  );
});
