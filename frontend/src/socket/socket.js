
import { io } from "socket.io-client";

const socketUrl = window.location.origin;

export const socket = io(socketUrl, {
  path: "/socket.io/",
  autoConnect: false,
  withCredentials: true,
});

socket.on("connect", () => {
  console.info(`[Socket] Connected (id: ${socket.id})`);
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
