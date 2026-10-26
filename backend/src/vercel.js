
import { createServer } from "node:http";
import app from "./app.js";
import { initializeSocket } from "./socket/socketServer.js";

const httpServer = createServer(app);

const io = initializeSocket(httpServer);
app.set("io", io);

export default httpServer;
