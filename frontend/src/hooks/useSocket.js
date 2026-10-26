
import { useEffect, useState } from "react";
import { socket } from "../socket/socket.js";

export const useSocket = (enabled = true) => {
  const [connectionStatus, setConnectionStatus] = useState(() =>
    socket.connected
      ? "connected"
      : enabled
      ? "connecting"
      : "disconnected"
  );
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleConnect = () => {
      setConnectionStatus("connected");
      setConnectionError("");
    };

    const handleConnectError = (error) => {
      console.error("Socket connection error:", error.message);
      setConnectionStatus("error");
      setConnectionError(error.message);
    };

    const handleDisconnect = () => {
      setConnectionStatus("disconnected");
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("disconnect", handleDisconnect);

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("disconnect", handleDisconnect);

      // Do not disconnect the shared socket here.
      // Another mounted page/component may still need it.
    };
  }, [enabled]);

  return {
    connectionStatus,
    connectionError,
  };
};
