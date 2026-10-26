
import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});

socket.on("connect", () => {
  console.info(`[Socket] Connected to ${socketUrl} (id: ${socket.id})`);
});

socket.on("connect_error", (error) => {
  console.error(`[Socket] Connection failed: ${error.message}`);
});

socket.on("disconnect", (reason) => {
  console.info(`[Socket] Disconnected (${reason})`);
});

socket.io.on("reconnect_attempt", (attempt) => {
  console.info(`[Socket] Reconnecting (attempt ${attempt})`);
});

socket.io.on("reconnect_error", (error) => {
  console.error(`[Socket] Reconnection failed: ${error.message}`);
});
