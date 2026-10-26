import { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  FileText,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import api from "../../api/axios.js";

const initialAnalytics = {
  stats: {
    totalUsers: 0,
    totalReports: 0,
    pendingReports: 0,
    inProgressReports: 0,
    resolvedReports: 0,
    verificationRequests: 0,
    totalWards: 0,
  },
  recentReports: [],
};

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatStatus = (status) =>
  String(status || "Unknown")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const statusStyles = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

const AnalyticsAndStatics = () => {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/superadmin/dashboard", { signal: controller.signal })
      .then((response) => {
        const data = response.data?.data;

        if (!data?.stats || !Array.isArray(data.recentReports)) {
          throw new Error("The analytics response has an unexpected format.");
        }

        setAnalytics(data);
        setLastUpdated(new Date());
      })
      .catch((requestError) => {
        if (requestError.name === "CanceledError") return;

        console.error("Analytics fetch error:", requestError);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load analytics data.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const { stats, recentReports } = analytics;
  const reportStatuses = [
    {
      label: "Pending",
      count: Number(stats.pendingReports) || 0,
      color: "bg-amber-500",
    },
    {
      label: "In progress",
      count: Number(stats.inProgressReports) || 0,
      color: "bg-blue-500",
    },
    {
      label: "Resolved",
      count: Number(stats.resolvedReports) || 0,
      color: "bg-green-500",
    },
  ];
  const totalReports = Number(stats.totalReports) || 0;

  const statCards = [
    { label: "Total reports", value: stats.totalReports, icon: FileText, iconColor: "text-blue-700", iconBg: "bg-blue-100" },
    { label: "Registered users", value: stats.totalUsers, icon: Users, iconColor: "text-violet-700", iconBg: "bg-violet-100" },
    { label: "Wards", value: stats.totalWards, icon: MapPin, iconColor: "text-emerald-700", iconBg: "bg-emerald-100" },
    { label: "Verification requests", value: stats.verificationRequests, icon: ShieldCheck, iconColor: "text-amber-700", iconBg: "bg-amber-100" },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Analytics &amp; Statistics
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            An overview of CivicFix reports, users, wards, and report progress.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {lastUpdated && (
        <p className="text-xs text-gray-500">
          Last updated {formatDate(lastUpdated)}
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              setRefreshKey((key) => key + 1);
            }}
            className="w-fit font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, iconColor, iconBg }) => (
          <article
            key={label}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p className="text-sm font-medium text-gray-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {loading && !lastUpdated ? "—" : formatNumber(value)}
              </p>
            </div>
            <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
              <Icon size={23} aria-hidden="true" />
            </span>
          </article>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <Activity size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Report status</h2>
              <p className="text-sm text-gray-500">
                {formatNumber(totalReports)} reports in total
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {reportStatuses.map(({ label, count, color }) => {
              const percentage =
                totalReports > 0
                  ? Math.min((count / totalReports) * 100, 100)
                  : 0;

              return (
                <div key={label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="text-gray-500">
                      {formatNumber(count)}
                      <span className="ml-2 text-xs">
                        {percentage.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-gray-100"
                    role="progressbar"
                    aria-label={`${label} reports`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percentage)}
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

          <p className="mt-5 text-xs text-gray-500">
            Percentages are calculated against all reports. Other statuses, if
            present, are not included in these three categories.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock3 size={20} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Latest reports</h2>
              <p className="text-sm text-gray-500">
                The five most recently submitted reports
              </p>
            </div>
          </div>

          {recentReports.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
              {loading ? "Loading reports..." : "No reports to display."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentReports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-col gap-2 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {report.category || "Civic issue"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                      statusStyles[report.status?.toLowerCase()] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {formatStatus(report.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      
    </section>
  );
};

export default AnalyticsAndStatics;