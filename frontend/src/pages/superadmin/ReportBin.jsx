import { useCallback, useEffect, useState } from "react";
import {
  ArchiveRestore,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
} from "lucide-react";
import api from "../../api/axios.js";

const getReports = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.reports)) return data.data.reports;
  if (Array.isArray(data?.reports)) return data.reports;
  return [];
};

const getReportId = (report) => report?.id ?? report?._id ?? report?.report_id;

const getCitizenName = (report) =>
  [report?.first_name, report?.last_name].filter(Boolean).join(" ") ||
  report?.username ||
  "Unknown citizen";

const formatDate = (value) => {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
};

export function ReportBin() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchDeletedReports = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await api.get("/reports/bin");
      setReports(getReports(response));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load deleted reports.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api
      .get("/reports/bin")
      .then((response) => {
        if (!active) return;
        setReports(getReports(response));
        setError("");
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError.response?.data?.message ||
            "Unable to load deleted reports.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const restoreReport = async (report) => {
    const reportId = getReportId(report);
    if (reportId == null) {
      setError("This report is missing its ID and cannot be restored.");
      return;
    }

    setRestoringId(reportId);
    setError("");
    setNotice("");
    try {
      await api.patch(`/reports/${reportId}/restore`);
      setReports((current) =>
        current.filter((item) => String(getReportId(item)) !== String(reportId)),
      );
      setNotice(`Report "${report.category || "Untitled"}" was restored.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to restore this report.",
      );
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700">
              <Trash2 size={25} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Bin
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Review soft-deleted reports and restore them when needed.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || refreshing}
          onClick={fetchDeletedReports}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Loading deleted reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <ArchiveRestore className="mx-auto text-gray-400" size={32} />
          <h2 className="mt-3 font-semibold text-gray-900">The Bin is empty</h2>
          <p className="mt-1 text-sm text-gray-500">
            Soft-deleted reports will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const reportId = getReportId(report);
            return (
              <li
                key={reportId}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold capitalize text-gray-900">
                      {report.category || "Untitled report"}
                    </h2>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                      ID: {reportId}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                    {report.description || "No description provided."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-500">
                    <span>Reported by {getCitizenName(report)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} />
                      Deleted {formatDate(report.deleted_at)}
                    </span>
                  </div>
                  {report.deletion_reason && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-medium text-gray-700">
                        Deletion reason:
                      </span>{" "}
                      {report.deletion_reason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={restoringId != null}
                  onClick={() => restoreReport(report)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArchiveRestore size={17} />
                  {String(restoringId) === String(reportId)
                    ? "Restoring..."
                    : "Restore report"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
