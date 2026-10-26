import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios.js";
import { socket } from "../../socket/socket.js";

export const WardOfficialDashboard = () => {
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [assignedWard, setAssignedWard] = useState(null);

  const fetchWardReports = async () => {
    try {
      setLoading(true);
      setError("");

      let wardResponse;
      try {
        wardResponse = await api.get("/wards/my-ward");
      } catch (err) {
        if (err.response?.status === 404) {
          setAssignedWard(null);
          setReports([]);
          return;
        }
        throw err;
      }

      const ward = wardResponse?.data?.data;
      const wardId = ward?.id;

      if (!wardId) {
        setAssignedWard(null);
        setReports([]);
        return;
      }

      setAssignedWard(ward);
      const response = await api.get(`/reports/ward/${wardId}`);

      const data = response?.data;

      const wardReports = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.data?.reports)
          ? data.data.reports
          : [];

      setReports(wardReports);
    } catch (err) {
      console.error(
        "Failed to fetch ward reports:",
        err.response?.data || err.message
      );

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to load ward reports."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWardReports();

    const handleNewReport = (payload) => {
      const report = payload?.report ?? payload;

      if (!report?.id) return;

      setReports((previous) => {
        const exists = previous.some(
          (item) => String(item.id) === String(report.id)
        );

        if (exists) return previous;

        return [report, ...previous];
      });
    };

    const handleStatusUpdate = (payload) => {
      const report = payload?.report ?? payload;

      if (!report?.id) return;

      setReports((previous) =>
        previous.map((item) =>
          String(item.id) === String(report.id)
            ? { ...item, ...report }
            : item
        )
      );
    };

    const handleDeleted = (payload) => {
      const reportId = payload?.id ?? payload?.reportId;

      if (!reportId) return;

      setReports((previous) =>
        previous.filter(
          (item) => String(item.id) !== String(reportId)
        )
      );
    };

    socket.on("NEW_REPORT", handleNewReport);
    socket.on("REPORT_STATUS_UPDATED", handleStatusUpdate);
    socket.on("REPORT_DELETED", handleDeleted);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("NEW_REPORT", handleNewReport);
      socket.off("REPORT_STATUS_UPDATED", handleStatusUpdate);
      socket.off("REPORT_DELETED", handleDeleted);
    };
  }, []);

  const statistics = useMemo(() => {
    return {
      total: reports.length,

      pending: reports.filter(
        (report) =>
          String(report.status || "").toLowerCase() === "pending"
      ).length,

      inProgress: reports.filter(
        (report) =>
          ["in_progress", "in progress", "inprogress"].includes(
            String(report.status || "").toLowerCase()
          )
      ).length,

      resolved: reports.filter(
        (report) =>
          ["resolved", "completed", "closed"].includes(
            String(report.status || "").toLowerCase()
          )
      ).length,
    };
  }, [reports]);

  const recentReports = useMemo(() => {
    return [...reports]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0) -
          new Date(a.created_at || 0)
      )
      .slice(0, 5);
  }, [reports]);

  const categoryStats = useMemo(() => {
    const counts = {};

    reports.forEach((report) => {
      const category =
        report.category || "Other";

      counts[category] = (counts[category] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [reports]);

  const getStatusStyle = (status) => {
    const normalized = String(status || "")
      .toLowerCase()
      .replace(/[-_]/g, " ");

    if (normalized === "resolved") {
      return "bg-green-100 text-green-700";
    }

    if (normalized === "in progress") {
      return "bg-amber-100 text-amber-700";
    }

    return "bg-red-100 text-red-700";
  };

  const formatStatus = (status) => {
    return String(status || "pending")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ward Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Monitor and manage civic issues reported in your ward.
          </p>
        </div>

        <button
          onClick={fetchWardReports}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            size={17}
            className={loading ? "animate-spin" : ""}
          />

          Refresh
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && !assignedWard && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        >
          <h2 className="font-semibold">No ward is assigned to your account</h2>
          <p className="mt-1">
            Ask a superadmin to assign you to a ward in{" "}
            <span className="font-medium">Superadmin → Ward Management</span>.
            Your ward reports will appear here after assignment.
          </p>
        </div>
      )}

      {/* Statistics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Total */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Total Reports
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {statistics.total}
              </p>
            </div>

            <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
              <FileText size={23} />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            All reports in your ward
          </p>
        </div>

        {/* Pending */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Pending
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {statistics.pending}
              </p>
            </div>

            <div className="rounded-lg bg-red-50 p-3 text-red-600">
              <AlertTriangle size={23} />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Awaiting action
          </p>
        </div>

        {/* In Progress */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                In Progress
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {statistics.inProgress}
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 text-amber-600">
              <Clock3 size={23} />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Currently being handled
          </p>
        </div>

        {/* Resolved */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">
                Resolved
              </p>

              <p className="mt-2 text-3xl font-bold text-gray-900">
                {statistics.resolved}
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-3 text-green-600">
              <CheckCircle2 size={23} />
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Successfully resolved
          </p>
        </div>
      </section>

      {/* Reports + Categories */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Recent Reports */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm xl:col-span-2">

          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Recent Reports
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Latest civic issues in your ward
              </p>
            </div>

            <button
              onClick={() =>
                navigate("/ward-official/reports")
              }
              className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="divide-y divide-gray-100">

            {loading ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">
                Loading reports...
              </div>
            ) : recentReports.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <FileText
                  size={32}
                  className="mx-auto text-gray-300"
                />

                <p className="mt-3 text-sm text-gray-500">
                  No reports found in your ward.
                </p>
              </div>
            ) : (
              recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">

                    <div className="mt-1 rounded-lg bg-gray-100 p-2 text-gray-600">
                      <MapPin size={17} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-gray-800">
                        {report.category || "Civic Issue"}
                      </h3>

                      <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                        {report.description ||
                          "No description available"}
                      </p>

                      <p className="mt-1 text-xs text-gray-400">
                        {report.address ||
                          "Location unavailable"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(
                      report.status
                    )}`}
                  >
                    {formatStatus(report.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Categories */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Report Categories
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Most reported issues
            </p>
          </div>

          <div className="p-5">

            {categoryStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">
                No category data available.
              </p>
            ) : (
              <div className="space-y-4">
                {categoryStats.map(
                  ([category, count]) => {
                    const percentage =
                      statistics.total > 0
                        ? Math.round(
                            (count /
                              statistics.total) *
                              100
                          )
                        : 0;

                    return (
                      <div key={category}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="truncate text-gray-600">
                            {category}
                          </span>

                          <span className="font-semibold text-gray-800">
                            {count}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-green-500"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ward Map */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm">

        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-gray-900">
              Ward Map
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              View reported civic issues on the map.
            </p>
          </div>

          <button
            onClick={() =>
              navigate("/ward-official/map")
            }
            className="flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-700"
          >
            Open Full Map
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="flex h-[300px] items-center justify-center bg-gray-50">
          <div className="text-center">
            <MapPin
              size={42}
              className="mx-auto text-gray-300"
            />

            <p className="mt-3 text-sm font-medium text-gray-600">
              Ward map
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Open the full map to view report locations.
            </p>

            <button
              onClick={() =>
                navigate("/ward-official/map")
              }
              className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Open Map
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
