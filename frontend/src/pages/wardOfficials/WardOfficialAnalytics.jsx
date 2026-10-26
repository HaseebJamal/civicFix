import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import api from "../../api/axios.js";

const normalizeReports = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.reports)) return data.reports;
  return [];
};

const normalizeStatus = (status) =>
  String(status || "unknown")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const formatStatus = (status) =>
  String(status || "Unknown")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const STATUS_GROUPS = [
  {
    key: "pending",
    label: "Pending",
    color: "bg-amber-500",
    icon: Clock3,
    iconStyle: "bg-amber-50 text-amber-700",
  },
  {
    key: "in_progress",
    label: "In progress",
    color: "bg-blue-500",
    icon: Activity,
    iconStyle: "bg-blue-50 text-blue-700",
  },
  {
    key: "resolved",
    label: "Resolved",
    color: "bg-green-500",
    icon: CheckCircle2,
    iconStyle: "bg-green-50 text-green-700",
  },
];

const WardOfficialAnalytics = () => {
  const [ward, setWard] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [asOf, setAsOf] = useState(null);

  const requestAnalytics = useCallback(async () => {
    const wardResponse = await api.get("/wards/my-ward");
    const assignedWard = wardResponse?.data?.data;

    if (!assignedWard?.id) {
      throw new Error("No ward is assigned to your account. Contact a superadmin.");
    }

    const reportsResponse = await api.get(
      `/reports/ward/${assignedWard.id}`,
    );

    return {
      ward: assignedWard,
      reports: normalizeReports(reportsResponse),
      asOf: Date.now(),
    };
  }, []);

  useEffect(() => {
    let active = true;

    requestAnalytics()
      .then((data) => {
        if (!active) return;
        setWard(data.ward);
        setReports(data.reports);
        setAsOf(data.asOf);
        setError("");
      })
      .catch((requestError) => {
        console.error("Failed to load ward analytics:", requestError);
        if (!active) return;
        setWard(null);
        setReports([]);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load analytics for your ward.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestAnalytics]);

  const stats = useMemo(() => {
    const statusCounts = { pending: 0, in_progress: 0, resolved: 0 };

    reports.forEach((report) => {
      const status = normalizeStatus(report.status);
      if (status === "pending") statusCounts.pending += 1;
      else if (["in_progress", "inprogress"].includes(status)) {
        statusCounts.in_progress += 1;
      } else if (["resolved", "completed", "closed"].includes(status)) {
        statusCounts.resolved += 1;
      }
    });

    const thirtyDaysAgo = (asOf || 0) - 30 * 24 * 60 * 60 * 1000;
    const reportsLast30Days = reports.filter((report) => {
      const createdAt = new Date(report.created_at).getTime();
      return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo;
    }).length;

    const resolutionRate = reports.length
      ? Math.round((statusCounts.resolved / reports.length) * 100)
      : 0;

    return {
      statusCounts,
      reportsLast30Days,
      resolutionRate,
      otherStatuses:
        reports.length -
        statusCounts.pending -
        statusCounts.in_progress -
        statusCounts.resolved,
    };
  }, [asOf, reports]);

  const categories = useMemo(() => {
    const counts = new Map();
    reports.forEach((report) => {
      const category = report.category?.trim() || "Other";
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 6);
  }, [reports]);

  const recentReports = useMemo(
    () =>
      [...reports]
        .sort(
          (first, second) =>
            new Date(second.created_at || 0) -
            new Date(first.created_at || 0),
        )
        .slice(0, 6),
    [reports],
  );

  const statCards = [
    {
      label: "Total reports",
      value: reports.length,
      note: "Reports assigned to your ward",
      icon: FileText,
      style: "bg-violet-50 text-violet-700",
    },
    {
      label: "Resolved",
      value: stats.statusCounts.resolved,
      note: `${stats.resolutionRate}% of all ward reports`,
      icon: CheckCircle2,
      style: "bg-green-50 text-green-700",
    },
    {
      label: "Awaiting action",
      value: stats.statusCounts.pending,
      note: "Pending reports",
      icon: Clock3,
      style: "bg-amber-50 text-amber-700",
    },
    {
      label: "Reported in 30 days",
      value: stats.reportsLast30Days,
      note: "Recently submitted",
      icon: TrendingUp,
      style: "bg-blue-50 text-blue-700",
    },
  ];

  const refresh = () => {
    setLoading(true);
    setError("");
    requestAnalytics()
      .then((data) => {
        setWard(data.ward);
        setReports(data.reports);
        setAsOf(data.asOf);
      })
      .catch((requestError) => {
        console.error("Failed to refresh ward analytics:", requestError);
        setWard(null);
        setReports([]);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load analytics for your ward.",
        );
      })
      .finally(() => setLoading(false));
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <BarChart3 size={17} />
            Ward operations
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            Analytics &amp; Statistics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {ward?.ward_name
              ? `Report overview for ${ward.ward_name}.`
              : "A report overview for your assigned ward."}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={refresh}
            className="w-fit font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, note, icon: Icon, style }) => (
          <article
            key={label}
            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {loading && reports.length === 0 ? "—" : value.toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-gray-500">{note}</p>
            </div>
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style}`}
            >
              <Icon size={23} aria-hidden="true" />
            </span>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h2 className="font-semibold text-gray-900">Report status</h2>
            <p className="mt-1 text-sm text-gray-500">
              Status breakdown for {reports.length.toLocaleString()} ward reports
            </p>
          </div>
          <div className="space-y-5">
            {STATUS_GROUPS.map(({ key, label, color }) => {
              const count = stats.statusCounts[key];
              const percentage = reports.length
                ? Math.round((count / reports.length) * 100)
                : 0;

              return (
                <div key={key}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">
                      {count} <span className="ml-1 text-xs">{percentage}%</span>
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-label={`${label} reports`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percentage}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {stats.otherStatuses > 0 && (
            <p className="mt-5 text-xs text-gray-500">
              {stats.otherStatuses} report
              {stats.otherStatuses === 1 ? " has" : "s have"} another status.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6">
            <h2 className="font-semibold text-gray-900">Top categories</h2>
            <p className="mt-1 text-sm text-gray-500">
              Most frequently reported issues in your ward
            </p>
          </div>
          {categories.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {loading ? "Loading report categories..." : "No reports to analyze."}
            </p>
          ) : (
            <div className="space-y-4">
              {categories.map(([category, count]) => {
                const percentage = Math.round((count / reports.length) * 100);
                return (
                  <div key={category}>
                    <div className="mb-2 flex justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-gray-700">
                        {category}
                      </span>
                      <span className="shrink-0 text-gray-500">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Latest reports</h2>
          <p className="mt-1 text-sm text-gray-500">
            The six most recently submitted reports for your ward
          </p>
        </div>
        {recentReports.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-500">
            {loading ? "Loading reports..." : "No reports to display."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentReports.map((report) => {
              const status = normalizeStatus(report.status);
              const statusStyle =
                status === "resolved" ||
                ["completed", "closed"].includes(status)
                  ? "bg-green-100 text-green-800"
                  : ["in_progress", "inprogress"].includes(status)
                    ? "bg-blue-100 text-blue-800"
                    : status === "pending"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-gray-100 text-gray-700";

              return (
                <li
                  key={report.id}
                  className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {report.category || "Civic issue"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                      {report.description || "No description available"}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <span
                    className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}
                  >
                    {formatStatus(report.status)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
};

export default WardOfficialAnalytics;
