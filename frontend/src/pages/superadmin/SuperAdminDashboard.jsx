import { useEffect, useState } from "react";
import {
  Users,
  FileText,
  Clock3,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  RefreshCw,
} from "lucide-react";

import api from "../../api/axios.js";
import { reverseGeocode } from "../../utils/reverseGeocode";

const getCoordinateFallback = (report) => {
  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return "";
  return `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalReports: 0,
    pendingReports: 0,
    inProgressReports: 0,
    resolvedReports: 0,
    verificationRequests: 0,
    totalWards: 0,
  });

  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // =====================================================
  // INITIAL LOAD
  // =====================================================
  useEffect(() => {
    let active = true;

    api
      .get("/superadmin/dashboard")
      .then((response) => {
        if (!active) return;

        const dashboardData = response.data.data;
        setStats(dashboardData.stats);
        setError("");

        const reports = dashboardData.recentReports.map((report) => ({
          ...report,
          address:
            report.address?.trim() ||
            (getCoordinateFallback(report) ? "Finding address…" : ""),
        }));
        setRecentReports(reports);

        const reportsMissingAddress = reports.filter(
          (report) =>
            !report.address?.trim() || report.address === "Finding address…",
        );
        Promise.all(
          reportsMissingAddress.map(async (report) => {
            try {
              const address = await reverseGeocode(
                report.latitude,
                report.longitude,
              );
              if (!active) return;
              setRecentReports((currentReports) =>
                currentReports.map((currentReport) =>
                  currentReport.id === report.id
                    ? { ...currentReport, address }
                    : currentReport,
                ),
              );
            } catch (lookupError) {
              console.error(
                `Unable to find address for report ${report.id}:`,
                lookupError,
              );
              if (!active) return;
              setRecentReports((currentReports) =>
                currentReports.map((currentReport) =>
                  currentReport.id === report.id
                    ? {
                        ...currentReport,
                        address:
                          getCoordinateFallback(report) ||
                          "Address unavailable",
                      }
                    : currentReport,
                ),
              );
            }
          }),
        );
      })
      .catch((requestError) => {
        console.error("Dashboard fetch error:", requestError);
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load dashboard data.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // =====================================================
  // STAT CARDS
  // =====================================================
  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
    },
    {
      title: "Total Reports",
      value: stats.totalReports,
      icon: FileText,
    },
    {
      title: "Pending Reports",
      value: stats.pendingReports,
      icon: Clock3,
    },
    {
      title: "In Progress",
      value: stats.inProgressReports,
      icon: RefreshCw,
    },
    {
      title: "Resolved Reports",
      value: stats.resolvedReports,
      icon: CheckCircle2,
    },
    {
      title: "Verification Requests",
      value: stats.verificationRequests,
      icon: ShieldCheck,
    },
    {
      title: "Total Wards",
      value: stats.totalWards,
      icon: MapPin,
    },
  ];

  // =====================================================
  // STATUS BADGE
  // =====================================================
  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-700";

      case "in_progress":
        return "bg-blue-100 text-blue-700";

      case "resolved":
        return "bg-green-100 text-green-700";

      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatStatus = (status) => {
    if (!status) return "Unknown";

    return status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <section className="space-y-6">
      {/* =====================================================
          HEADER
      ===================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            SuperAdmin Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Monitor CivicFix users, reports, wards and verification requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ===================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">
                    {card.title}
                  </p>

                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {loading ? "—" : card.value}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
                  <Icon size={21} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =====================================================
          REPORT OVERVIEW
      ===================================================== */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Report Summary */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Report Overview
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Current report status distribution.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Pending */}
            <div className="rounded-lg bg-yellow-50 p-4">
              <div className="flex items-center gap-2 text-yellow-700">
                <Clock3 size={18} />

                <span className="text-sm font-medium">Pending</span>
              </div>

              <p className="mt-3 text-2xl font-bold text-gray-900">
                {loading ? "—" : stats.pendingReports}
              </p>
            </div>

            {/* In Progress */}
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <RefreshCw size={18} />

                <span className="text-sm font-medium">In Progress</span>
              </div>

              <p className="mt-3 text-2xl font-bold text-gray-900">
                {loading ? "—" : stats.inProgressReports}
              </p>
            </div>

            {/* Resolved */}
            <div className="rounded-lg bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 size={18} />

                <span className="text-sm font-medium">Resolved</span>
              </div>

              <p className="mt-3 text-2xl font-bold text-gray-900">
                {loading ? "—" : stats.resolvedReports}
              </p>
            </div>
          </div>
        </div>

        {/* System Status */}
      </div>

      {/* =====================================================
          RECENT REPORTS
      ===================================================== */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Reports
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Latest reports submitted by citizens.
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Address lookups use OpenStreetMap contributors.
            </p>
          </div>
        </div>

        {/* =================================================
            DESKTOP TABLE
        ================================================= */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  ID
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Category
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Description
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Address
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>

                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {recentReports.length > 0 ? (
                recentReports.map((report) => (
                  <tr key={report.id} className="transition hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      #{report.id}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {report.category || "—"}
                    </td>

                    <td className="max-w-xs px-5 py-4 text-sm text-gray-600">
                      <p className="truncate">{report.description || "—"}</p>
                    </td>

                    <td className="max-w-xs px-5 py-4 text-sm text-gray-600">
                      <p className="truncate">{report.address || "—"}</p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                          report.status,
                        )}`}
                      >
                        {formatStatus(report.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-500">
                      {report.created_at
                        ? new Date(report.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    {loading ? "Loading reports..." : "No reports found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* =================================================
            MOBILE CARDS
        ================================================= */}
        <div className="divide-y divide-gray-100 md:hidden">
          {recentReports.length > 0 ? (
            recentReports.map((report) => (
              <div key={report.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Report #{report.id}
                    </p>

                    <p className="text-sm text-gray-500">
                      {report.category || "No category"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(
                      report.status,
                    )}`}
                  >
                    {formatStatus(report.status)}
                  </span>
                </div>

                <p className="text-sm text-gray-600">
                  {report.description || "No description"}
                </p>

                <p className="text-xs text-gray-500">
                  {report.address || "No address"}
                </p>

                <p className="text-xs text-gray-400">
                  {report.created_at
                    ? new Date(report.created_at).toLocaleString()
                    : "—"}
                </p>
              </div>
            ))
          ) : (
            <div className="p-10 text-center text-sm text-gray-500">
              {loading ? "Loading reports..." : "No reports found."}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SuperAdminDashboard;
