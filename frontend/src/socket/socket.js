
import { io } from "socket.io-client";

export const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? "http://localhost:5000" : "");

console.log("[Socket] Server URL:", socketUrl);

export const socket = io(socketUrl, {
  path: "/socket.io/",
  transports: ["websocket"],
  autoConnect: false,
  withCredentials: true,
});

socket.on("connect", () => {
  console.info("[Socket] Connected:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("[Socket] Connection failed:", error.message);
});

socket.on("disconnect", (reason) => {
  console.info("[Socket] Disconnected:", reason);
});
