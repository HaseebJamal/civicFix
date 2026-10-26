import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  FileText,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api from "../../api/axios.js";

const PAGE_SIZE = 8;

const getActionLabel = (log) =>
  log.action ||
  log.event_type ||
  log.activity_type ||
  log.event ||
  "System activity";

const getActorName = (log) =>
  log.actor_name ||
  log.user_name ||
  log.performed_by_name ||
  log.email ||
  "System";

const getTargetName = (log) =>
  log.target_name ||
  log.resource_name ||
  log.entity_name ||
  log.target_type ||
  log.entity_type ||
  "—";

const getDescription = (log) =>
  log.description ||
  log.details ||
  log.message ||
  log.action_description ||
  "No additional details available.";

const getTimestamp = (log) =>
  log.created_at || log.createdAt || log.timestamp || log.performed_at;

const getActionStyle = (action) => {
  const value = String(action).toLowerCase();

  if (
    value.includes("verif") ||
    value.includes("approv") ||
    value.includes("success")
  ) {
    return {
      color: "text-green-700",
      bg: "bg-green-100",
      icon: UserCheck,
    };
  }

  if (
    value.includes("reject") ||
    value.includes("delete") ||
    value.includes("fail")
  ) {
    return {
      color: "text-red-700",
      bg: "bg-red-100",
      icon: AlertCircle,
    };
  }

  if (value.includes("report")) {
    return {
      color: "text-blue-700",
      bg: "bg-blue-100",
      icon: FileText,
    };
  }

  if (
    value.includes("login") ||
    value.includes("logout") ||
    value.includes("auth")
  ) {
    return {
      color: "text-purple-700",
      bg: "bg-purple-100",
      icon: ShieldCheck,
    };
  }

  return {
    color: "text-gray-700",
    bg: "bg-gray-100",
    icon: Activity,
  };
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString();
};

export const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError("");

      // Update this endpoint to match your backend audit-log route.
      const response = await api.get("/audit-logs");

      const payload = response.data?.data ?? response.data;

      const records = Array.isArray(payload)
        ? payload
        : (payload?.logs ??
          payload?.auditLogs ??
          payload?.audit_logs ??
          payload?.records ??
          []);

      setLogs(records);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Audit logs load nahi ho sake. Backend endpoint check karein.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const actionTypes = useMemo(() => {
    return [...new Set(logs.map((log) => getActionLabel(log)).filter(Boolean))];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return logs.filter((log) => {
      const searchableText = [
        getActionLabel(log),
        getActorName(log),
        getTargetName(log),
        getDescription(log),
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(query);

      const matchesAction =
        actionFilter === "all" || getActionLabel(log) === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, search, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));

  const currentPage = Math.min(page, totalPages);

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  const stats = useMemo(() => {
    const verified = logs.filter((log) =>
      /verif|approv/i.test(getActionLabel(log)),
    ).length;

    const reports = logs.filter((log) =>
      /report/i.test(getActionLabel(log)),
    ).length;

    const security = logs.filter((log) =>
      /login|logout|auth|permission|access/i.test(getActionLabel(log)),
    ).length;

    return [
      {
        label: "Total Activities",
        value: logs.length,
        icon: Activity,
        color: "bg-blue-100 text-blue-700",
      },
      {
        label: "Verification Actions",
        value: verified,
        icon: UserCheck,
        color: "bg-green-100 text-green-700",
      },
      {
        label: "Report Activities",
        value: reports,
        icon: FileText,
        color: "bg-purple-100 text-purple-700",
      },
      {
        label: "Security Events",
        value: security,
        icon: ShieldCheck,
        color: "bg-orange-100 text-orange-700",
      },
    ];
  }, [logs]);

  return (
    <section className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <span>Super Admin</span>
              <span>/</span>
              <span className="text-green-700">Audit Logs</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Audit Logs
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Monitor and review recorded activities across Civifix.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Refresh Logs
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{stat.label}</p>

                    <h2 className="mt-2 text-2xl font-bold text-gray-900">
                      {stat.value}
                    </h2>
                  </div>

                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.color}`}
                  >
                    <Icon size={23} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Audit Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-200 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Activity History
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Search and filter recorded system events.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search activities..."
                  className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100 sm:w-64"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                <option value="all">All Actions</option>

                {actionTypes.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="m-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={19} className="mt-0.5 shrink-0" />

              <div>
                <p className="font-medium">{error}</p>
                <button
                  type="button"
                  onClick={fetchAuditLogs}
                  className="mt-2 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-4 font-semibold">Activity</th>
                  <th className="px-5 py-4 font-semibold">Performed By</th>
                  <th className="px-5 py-4 font-semibold">Target</th>
                  <th className="px-5 py-4 font-semibold">Date & Time</th>
                  <th className="px-5 py-4 font-semibold">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-16 text-center text-gray-500"
                    >
                      <RefreshCw
                        size={24}
                        className="mx-auto mb-3 animate-spin text-green-600"
                      />
                      Loading audit logs...
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center">
                      <Activity
                        size={32}
                        className="mx-auto mb-3 text-gray-300"
                      />

                      <p className="font-medium text-gray-700">
                        No audit logs found
                      </p>

                      <p className="mt-1 text-sm text-gray-500">
                        {logs.length === 0
                          ? "Activity will appear here after an admin action is recorded."
                          : "Try changing your search or filter."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => {
                    const action = getActionLabel(log);
                    const style = getActionStyle(action);
                    const Icon = style.icon;

                    return (
                      <tr
                        key={log.id ?? log.audit_log_id ?? `${action}-${index}`}
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.color}`}
                            >
                              <Icon size={19} />
                            </div>

                            <span className="font-semibold text-gray-800">
                              {action}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-gray-800">
                            {getActorName(log)}
                          </p>

                          {log.actor_role || log.role ? (
                            <p className="mt-1 text-xs capitalize text-gray-500">
                              {log.actor_role || log.role}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-5 py-4 text-gray-700">
                          {getTargetName(log)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Clock size={15} className="shrink-0" />
                            {formatDate(getTimestamp(log))}
                          </div>
                        </td>

                        <td className="max-w-xs px-5 py-4 text-gray-600">
                          <p className="line-clamp-2">{getDescription(log)}</p>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filteredLogs.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-800">
                  {(currentPage - 1) * PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium text-gray-800">
                  {Math.min(currentPage * PAGE_SIZE, filteredLogs.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-800">
                  {filteredLogs.length}
                </span>{" "}
                activities
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setPage((previous) => Math.max(1, previous - 1))
                  }
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="px-2 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() =>
                    setPage((previous) => Math.min(totalPages, previous + 1))
                  }
                  className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs leading-5 text-gray-500">
          Audit history should be recorded by the backend. This page only
          displays records returned by the API; it does not create a
          tamper-resistant audit trail by itself.
        </p>
      </div>
    </section>
  );
};
