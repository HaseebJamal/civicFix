
import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";
import { socket } from "../../socket/socket.js";

const PAGE_SIZE = 10;

const fetchNotifications = async () => {
  const response = await api.get("/notifications");
  const responseData = response?.data?.data;

  return Array.isArray(responseData) ? responseData : [];
};

export const Notification = () => {
  const [notification, setNotification] = useState([]);
  const [filter, setFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchNotification = useCallback(async () => {
    try {
      setError("");
      const notifications = await fetchNotifications();
      setNotification(notifications);
      setCurrentPage(1);
    } catch (error) {
      console.error("Unable to fetch notifications:", error);
      setError("Unable to fetch notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const handleConnect = () => {
      console.log("[Notification] Socket connected:", socket.id);
    };

    const handleConnectError = (error) => {
      console.error("[Notification] Socket error:", error.message);
    };

    const handleNewNotification = (newNotification) => {
      if (!newNotification?.id) return;

      setNotification((previous) => {
        const exists = previous.some(
          (item) => String(item.id) === String(newNotification.id)
        );

        if (exists) return previous;

        return [newNotification, ...previous];
      });

      setCurrentPage(1);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);
    socket.on("NEW_NOTIFICATION", handleNewNotification);

    if (!socket.connected) {
      socket.connect();
    }

    const loadNotifications = async () => {
      try {
        const notifications = await fetchNotifications();

        if (active) {
          setNotification((previous) => {
            // Preserve notifications received through the socket
            // while the initial API request was in progress.
            const combined = [...notifications];

            previous.forEach((item) => {
              if (
                !combined.some(
                  (existing) =>
                    String(existing.id) === String(item.id)
                )
              ) {
                combined.push(item);
              }
            });

            return combined.sort(
              (a, b) =>
                new Date(b.created_at || 0) -
                new Date(a.created_at || 0)
            );
          });

          setError("");
        }
      } catch (error) {
        console.error("Unable to fetch notifications:", error);

        if (active) {
          setError("Unable to fetch notifications.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNotifications();

    return () => {
      active = false;
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
      socket.off("NEW_NOTIFICATION", handleNewNotification);
    };
  }, []);

  const markAllAsRead = async () => {
    try {
      setError("");
      await api.patch("/notifications/read-all");

      setNotification((previous) =>
        previous.map((item) => ({ ...item, is_read: true }))
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

      setNotification((previous) =>
        previous.map((item) =>
          String(item.id) === String(id)
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (error) {
      console.error("Unable to mark notification as read:", error);
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

  const totalPages = Math.ceil(
    filteredNotifications.length / PAGE_SIZE
  );

  const safePage = Math.min(
    currentPage,
    Math.max(totalPages, 1)
  );

  const startIndex = (safePage - 1) * PAGE_SIZE;

  const paginatedNotifications = filteredNotifications.slice(
    startIndex,
    startIndex + PAGE_SIZE
  );

  const changeFilter = (nextFilter) => {
    setFilter(nextFilter);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-600">
        Loading notifications...
      </div>
    );
  }

  return (
    <section className="w-full px-3 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage your notifications and activity updates.
            </p>
          </div>

          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Mark all as read
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={fetchNotification}
              className="font-semibold underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total notifications
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900">
              {notification.length}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Unread notifications
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-600">
              {unreadCount}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => changeFilter("all")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                filter === "all"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All ({notification.length})
            </button>

            <button
              type="button"
              onClick={() => changeFilter("unread")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                filter === "unread"
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <p className="text-sm text-gray-500">
            {filteredNotifications.length} records
          </p>
        </div>

        {/* Data Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] divide-y divide-gray-200 text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Notification
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date &amp; Time
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginatedNotifications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-sm text-gray-500"
                    >
                      {filter === "unread"
                        ? "No unread notifications found."
                        : "No notifications found."}
                    </td>
                  </tr>
                ) : (
                  paginatedNotifications.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition hover:bg-gray-50 ${
                        !item.is_read ? "bg-blue-50/60" : "bg-white"
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">
                            {getIcon(item.type)}
                          </span>

                          <div className="min-w-0 max-w-md">
                            <p className="break-words text-sm font-semibold text-gray-900">
                              {item.title}
                            </p>
                            <p className="mt-1 break-words text-sm text-gray-500">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {(item.type || "general")
                            .replaceAll("_", " ")
                            .replace(/\b\w/g, (char) =>
                              char.toUpperCase()
                            )}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        {item.is_read ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            Read
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                            Unread
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        {!item.is_read ? (
                          <button
                            type="button"
                            onClick={() =>
                              markNotificationAsReadById(item.id)
                            }
                            className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Mark as read
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredNotifications.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-800">
                  {startIndex + 1}
                </span>
                {" "}to{" "}
                <span className="font-medium text-gray-800">
                  {Math.min(
                    startIndex + PAGE_SIZE,
                    filteredNotifications.length
                  )}
                </span>
                {" "}of{" "}
                <span className="font-medium text-gray-800">
                  {filteredNotifications.length}
                </span>
                {" "}notifications
              </p>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  disabled={safePage === 1}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    aria-current={safePage === page ? "page" : undefined}
                    className={`min-w-10 rounded-lg border px-3 py-2 text-sm font-medium ${
                      safePage === page
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(totalPages, page + 1)
                    )
                  }
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
