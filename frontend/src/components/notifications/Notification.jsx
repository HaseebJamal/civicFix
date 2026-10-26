
import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { socket } from "../../socket/socket.js";

const fetchNotifications = async () => {
  const response = await api.get("/notifications");
  const responseData = response?.data?.data;

  return Array.isArray(responseData) ? responseData : [];
};

export const Notification = () => {
  const [notification, setNotification] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotification = useCallback(async () => {
    try {
      setError("");
      const notifications = await fetchNotifications();
      setNotification(notifications);
    } catch (error) {
      console.error("Unable to fetch notifications:", error);
      setError("Unable to fetch notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const notifications = await fetchNotifications();

        if (active) {
          setNotification(notifications);
          setError("");
        }
      } catch (error) {
        console.error("Unable to fetch notifications:", error);

        if (active) {
          setError("Unable to fetch notifications.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const handleNewNotification = (newNotification) => {
      if (!newNotification?.id) return;

      console.log("Received real-time notification:", newNotification);

      setNotification((prev) => {
        const alreadyExists = prev.some(
          (item) => String(item.id) === String(newNotification.id)
        );

        if (alreadyExists) return prev;

        return [newNotification, ...prev];
      });
    };

    // Listen for notifications for the current user.
    socket.on("NEW_NOTIFICATION", handleNewNotification);

    // Reuse the existing socket connection.
    if (!socket.connected) {
      socket.connect();
    }

    loadNotifications();

    return () => {
      active = false;
      socket.off("NEW_NOTIFICATION", handleNewNotification);
    };
  }, []);

  const markAllAsRead = async () => {
    try {
      setError("");
      await api.patch("/notifications/read-all");

      setNotification((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
    } catch (error) {
      console.error("Unable to mark all notifications as read:", error);
      setError(
        error.response?.data?.message ||
          "Unable to mark all notifications as read."
      );
    }
  };

  const markNotificationAsReadById = async (id) => {
    try {
      setError("");
      await api.patch(`/notifications/${id}/read`);

      setNotification((prev) =>
        prev.map((item) =>
          String(item.id) === String(id)
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      setError(
        error.response?.data?.message ||
          "Unable to mark notification as read."
      );
    }
  };

  const getIcon = (type) => {
    const icons = {
      report_status_changed: "🔄",
      report_commented: "💬",
      report_upvoted: "👍",
      report_resolved: "✅",
      official_approved: "🎉",
      official_rejected: "⚠️",
    };

    return icons[type] || "🔔";
  };

  const filteredNotifications =
    filter === "unread"
      ? notification.filter((item) => !item.is_read)
      : notification;

  const unreadCount = notification.filter(
    (item) => !item.is_read
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-center">
        Loading notifications...
      </div>
    );
  }

  return (
    <section className="w-full overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Stay up to date with activity and updates.
            </p>
          </div>

          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Mark all as read
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
            <button
              type="button"
              onClick={fetchNotification}
              className="ml-2 font-semibold underline"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total notifications</p>
            <h2 className="mt-2 text-3xl font-bold">
              {notification.length}
            </h2>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Unread notifications</p>
            <h2 className="mt-2 text-3xl font-bold">{unreadCount}</h2>
          </div>
        </div>

        <div className="mb-4 flex gap-3">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              filter === "all"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            All
          </button>

          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              filter === "unread"
                ? "border-blue-600 bg-blue-600 text-white"
                : "bg-white text-gray-700"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          {filteredNotifications.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              {filter === "unread"
                ? "No unread notifications."
                : "No notifications found."}
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                className={`flex gap-3 border-b p-4 sm:p-5 ${
                  item.is_read ? "bg-white" : "bg-blue-50"
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl">
                  {getIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-gray-900">
                    {item.title}
                  </h3>

                  <p className="mt-1 break-words text-sm text-gray-600">
                    {item.message}
                  </p>

                  <p className="mt-2 text-xs text-gray-400">
                    {item.created_at
                      ? new Date(item.created_at).toLocaleString()
                      : ""}
                  </p>

                  {!item.is_read && (
                    <button
                      onClick={() => markNotificationAsReadById(item.id)}
                      className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Mark as read
                    </button>
                  )}
                </div>

                {!item.is_read && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
