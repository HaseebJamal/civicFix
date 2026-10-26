import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Eye,
  RefreshCw,
  Search,
  MapPin,
  ClipboardList,
  AlertCircle,
  Clock3,
  CheckCircle2,
  X,
} from "lucide-react";
import api from "../../api/axios.js";
import { socket } from "../../socket/socket.js";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: AlertCircle,
  },
  in_progress: {
    label: "In Progress",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  resolved: {
    label: "Resolved",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
  },
};

const normalizeReports = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.reports)) return data.reports;

  return [];
};

const getNextStatus = (status) => {
  if (status === "pending") return "in_progress";
  if (status === "in_progress") return "resolved";

  return null;
};

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const getReporterName = (report) => {
  const citizen = report?.citizen || report?.user || report?.reporter;
  const fullName = [
    report?.first_name ?? report?.firstName ?? citizen?.first_name ?? citizen?.firstName,
    report?.last_name ?? report?.lastName ?? citizen?.last_name ?? citizen?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    report?.citizen_name ||
    report?.reporter_name ||
    report?.citizenName ||
    citizen?.full_name ||
    citizen?.fullName ||
    citizen?.name ||
    fullName ||
    citizen?.username ||
    report?.username ||
    citizen?.email ||
    report?.email ||
    "Citizen"
  );
};

const getReportImages = (report) => {
  let images = report?.images;
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }

  if (!Array.isArray(images)) return [];

  return images
    .map((image) =>
      typeof image === "string"
        ? { image_url: image }
        : image && typeof image === "object"
          ? image
          : null,
    )
    .filter((image) => image?.image_url || image?.url);
};

const getReportImageUrl = (image) => {
  const imagePath = image?.image_url || image?.url;
  if (!imagePath) return "";
  if (/^(https?:)?\/\//i.test(imagePath) || imagePath.startsWith("data:")) {
    return imagePath;
  }

  const backendOrigin = new URL(api.defaults.baseURL).origin;
  return new URL(
    imagePath.startsWith("/") ? imagePath : `/${imagePath}`,
    `${backendOrigin}/`,
  ).toString();
};

const ReportImage = ({ image, index }) => {
  const [failed, setFailed] = useState(false);
  const imageUrl = getReportImageUrl(image);

  if (failed || !imageUrl) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-center text-sm text-gray-500">
        Image {index + 1} could not be loaded.
      </div>
    );
  }

  return (
    <a href={imageUrl} target="_blank" rel="noreferrer" className="block">
      <img
        src={imageUrl}
        alt={`Report issue ${index + 1}`}
        className="h-36 w-full rounded-xl border border-gray-200 object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  );
};

export const WardReportManagement = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedReport, setSelectedReport] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [statusConfirmation, setStatusConfirmation] = useState(null);
  const [updatingReportId, setUpdatingReportId] = useState(null);
  const assignedWardId = useRef(null);

  const fetchReports = useCallback(async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const wardResponse = await api.get("/wards/my-ward");
      const ward = wardResponse?.data?.data;

      if (!ward?.id) {
        assignedWardId.current = null;
        setReports([]);
        setError("No ward is assigned to your account. Contact a superadmin.");
        return;
      }

      assignedWardId.current = String(ward.id);
      const response = await api.get(`/reports/ward/${ward.id}`);

      const data = normalizeReports(response);

      setReports(data);
    } catch (err) {
      console.error("Failed to fetch ward reports:", err);

      assignedWardId.current = null;
      setReports([]);
      setSelectedReport(null);
      setError(
        err?.response?.status === 404
          ? "No ward is assigned to your account. Contact a superadmin."
          : err?.response?.data?.message ||
          "Unable to load reports assigned to your ward.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    const handleNewReport = (payload) => {
      const report = payload?.report ?? payload;

      if (
        !report?.id ||
        !report?.ward_id ||
        String(report.ward_id) !== assignedWardId.current
      ) {
        return;
      }

      setReports((previous) => {
        const exists = previous.some(
          (item) => String(item.id) === String(report.id),
        );

        return exists ? previous : [report, ...previous];
      });
    };

    const handleStatusUpdated = (payload) => {
      const report = payload?.report ?? payload;

      if (!report?.id) return;

      if (
        report.ward_id != null &&
        String(report.ward_id) !== assignedWardId.current
      ) {
        setReports((previous) =>
          previous.filter((item) => String(item.id) !== String(report.id)),
        );
        setSelectedReport((previous) =>
          previous && String(previous.id) === String(report.id)
            ? null
            : previous,
        );
        return;
      }

      setReports((previous) =>
        previous.map((item) =>
          String(item.id) === String(report.id) ? { ...item, ...report } : item,
        ),
      );

      setSelectedReport((previous) => {
        if (!previous) return previous;

        if (String(previous.id) !== String(report.id)) {
          return previous;
        }

        return {
          ...previous,
          ...report,
        };
      });
    };

    const handleReportDeleted = (payload) => {
      const reportId = payload?.id ?? payload?.reportId;

      if (!reportId) return;

      setReports((previous) =>
        previous.filter((report) => String(report.id) !== String(reportId)),
      );

      setSelectedReport((previous) => {
        if (previous && String(previous.id) === String(reportId)) {
          return null;
        }

        return previous;
      });
    };

    socket.on("NEW_REPORT", handleNewReport);
    socket.on("REPORT_STATUS_UPDATED", handleStatusUpdated);
    socket.on("REPORT_DELETED", handleReportDeleted);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("NEW_REPORT", handleNewReport);
      socket.off("REPORT_STATUS_UPDATED", handleStatusUpdated);
      socket.off("REPORT_DELETED", handleReportDeleted);
    };
  }, [fetchReports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" || report.status === statusFilter;

      if (!matchesStatus) return false;

      if (!normalizedSearch) return true;

      const searchableText = [
        report.category,
        report.description,
        report.address,
        report.username,
        report.first_name,
        report.last_name,
        report.id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [reports, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((report) => report.status === "pending").length,
      inProgress: reports.filter((report) => report.status === "in_progress")
        .length,
      resolved: reports.filter((report) => report.status === "resolved").length,
    };
  }, [reports]);

  const updateStatus = async (
    report,
    nextStatus = getNextStatus(report.status),
  ) => {
    if (!nextStatus) return;

    try {
      setUpdatingReportId(report.id);

      const response = await api.patch(`/reports/${report.id}/status`, {
        status: nextStatus,
      });

      const updatedReport =
        response?.data?.data?.report ||
        response?.data?.report ||
        response?.data?.data ||
        null;

      if (updatedReport) {
        setReports((previous) =>
          previous.map((item) =>
            String(item.id) === String(updatedReport.id)
              ? { ...item, ...updatedReport }
              : item,
          ),
        );

        setSelectedReport((previous) => {
          if (previous && String(previous.id) === String(updatedReport.id)) {
            return {
              ...previous,
              ...updatedReport,
            };
          }

          return previous;
        });
      } else {
        await fetchReports(true);
      }
      return true;
    } catch (err) {
      console.error("Failed to update report status:", err);

      alert(err?.response?.data?.message || "Unable to update report status.");
      return false;
    } finally {
      setUpdatingReportId(null);
    }
  };

  const requestStatusUpdate = (report) => {
    const nextStatus = getNextStatus(report.status);
    if (nextStatus) {
      setStatusConfirmation({ report, nextStatus });
      return;
    }
  };

  const confirmStatusUpdate = async () => {
    if (!statusConfirmation) return;

    const succeeded = await updateStatus(
      statusConfirmation.report,
      statusConfirmation.nextStatus,
    );
    if (succeeded) {
      setStatusConfirmation(null);
    }
  };

  const openReportDetails = async (report) => {
    setSelectedReport(report);
    setDetailsError("");
    setDetailsLoading(true);

    try {
      const response = await api.get(`/reports/${report.id}`);
      const details = response?.data?.data;

      if (details && String(details.id) === String(report.id)) {
        const completeReport = { ...report, ...details };
        setSelectedReport(completeReport);
        setReports((previous) =>
          previous.map((item) =>
            String(item.id) === String(report.id) ? completeReport : item,
          ),
        );
      } else {
        setDetailsError("Report details were returned in an unexpected format.");
      }
    } catch (err) {
      console.error("Failed to load report details:", err);
      setDetailsError(
        err?.response?.data?.message || "Unable to load complete report details.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Page Header */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-green-700">Ward Operations</p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Ward Report Management
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Review civic issues assigned to your ward and update their progress
            until they are resolved.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchReports(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Statistics */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Reports"
          value={counts.total}
          icon={ClipboardIcon}
          className="bg-blue-50 text-blue-700"
        />

        <StatCard
          title="Pending"
          value={counts.pending}
          icon={AlertCircle}
          className="bg-red-50 text-red-700"
        />

        <StatCard
          title="In Progress"
          value={counts.inProgress}
          icon={Clock3}
          className="bg-amber-50 text-amber-700"
        />

        <StatCard
          title="Resolved"
          value={counts.resolved}
          icon={CheckCircle2}
          className="bg-green-50 text-green-700"
        />
      </div>

      {/* Search / Filter */}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports, category, address..."
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Error */}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <RefreshCw
            size={24}
            className="mx-auto animate-spin text-green-700"
          />

          <p className="mt-3 text-sm text-gray-500">Loading ward reports...</p>
        </div>
      )}

      {/* Empty */}

      {!loading && !error && filteredReports.length === 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <ClipboardIcon size={40} className="mx-auto text-gray-300" />

          <h2 className="mt-4 font-semibold text-gray-900">No reports found</h2>

          <p className="mt-1 text-sm text-gray-500">
            Try changing your search or status filter.
          </p>
        </div>
      )}

      {/* Reports */}

      {!loading && filteredReports.length > 0 && (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const status =
              STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;

            const StatusIcon = status.icon;

            const nextStatus = getNextStatus(report.status);

            return (
              <article
                key={report.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  {/* Report Information */}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        #{report.id}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                      >
                        <StatusIcon size={14} />

                        {status.label}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-semibold capitalize text-gray-900">
                      {String(report.category || "Civic Issue").replace(
                        /_/g,
                        " ",
                      )}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {report.description || "No description available."}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:flex-wrap sm:gap-4">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin size={14} />

                        {report.address || "Location not provided"}
                      </span>

                      <span>Reported: {formatDate(report.created_at)}</span>

                      <span>Citizen: {getReporterName(report)}</span>
                    </div>
                  </div>

                  {/* Actions */}

                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-48 xl:flex-col">
                    <button
                      type="button"
                      onClick={() => openReportDetails(report)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 xl:flex-none"
                    >
                      <Eye size={17} />
                      View Details
                    </button>

                    {nextStatus && (
                      <button
                        type="button"
                        onClick={() => requestStatusUpdate(report)}
                        disabled={updatingReportId === report.id}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 xl:flex-none"
                      >
                        {updatingReportId === report.id ? (
                          <RefreshCw size={17} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}

                        {updatingReportId === report.id
                          ? "Updating..."
                          : nextStatus === "in_progress"
                            ? "Start Work"
                            : "Mark Resolved"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Details Modal */}

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdateStatus={requestStatusUpdate}
          updating={updatingReportId === selectedReport.id}
          detailsLoading={detailsLoading}
          detailsError={detailsError}
        />
      )}

      {statusConfirmation && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !updatingReportId) {
              setStatusConfirmation(null);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="status-confirmation-title"
            aria-describedby="status-confirmation-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              {statusConfirmation.nextStatus === "in_progress" ? (
                <Clock3 size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
            </div>
            <h2
              id="status-confirmation-title"
              className="mt-4 text-lg font-bold text-gray-900"
            >
              {statusConfirmation.nextStatus === "in_progress"
                ? "Start working on this report?"
                : "Resolve this report?"}
            </h2>
            <p
              id="status-confirmation-description"
              className="mt-2 text-sm leading-6 text-gray-600"
            >
              {statusConfirmation.nextStatus === "in_progress"
                ? `Confirm that you are ready to begin work on report #${statusConfirmation.report.id}. Its status will change to In Progress.`
                : `Confirm that report #${statusConfirmation.report.id} has been resolved. Its status will change to Resolved.`}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={Boolean(updatingReportId)}
                onClick={() => setStatusConfirmation(null)}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(updatingReportId)}
                onClick={confirmStatusUpdate}
                className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
              >
                {updatingReportId && (
                  <RefreshCw size={16} className="animate-spin" />
                )}
                {statusConfirmation.nextStatus === "in_progress"
                  ? "Confirm and Start Work"
                  : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

const ClipboardIcon = ClipboardList;

const StatCard = ({ title, value, icon: Icon, className }) => {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>

          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>

        <span className={`inline-flex rounded-xl p-3 ${className}`}>
          <Icon size={22} />
        </span>
      </div>
    </article>
  );
};

const ReportDetailsModal = ({
  report,
  onClose,
  onUpdateStatus,
  updating,
  detailsLoading,
  detailsError,
}) => {
  const status = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;

  const StatusIcon = status.icon;
  const nextStatus = getNextStatus(report.status);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium text-gray-500">
              Report #{report.id}
            </p>

            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              Report Details
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {detailsLoading && (
            <p className="flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
              <RefreshCw size={16} className="animate-spin" />
              Loading citizen and image details...
            </p>
          )}

          {detailsError && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {detailsError}
            </p>
          )}

          {/* Category / Status */}

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium capitalize text-gray-700">
              {String(report.category || "Civic Issue").replace(/_/g, " ")}
            </span>

            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${status.className}`}
            >
              <StatusIcon size={16} />

              {status.label}
            </span>
          </div>

          {/* Description */}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Description</h3>

            <p className="mt-2 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
              {report.description || "No description available."}
            </p>
          </div>

          {/* Location */}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Location</h3>

            <div className="mt-2 rounded-xl bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <MapPin size={19} className="mt-0.5 shrink-0 text-green-700" />

                <div>
                  <p className="text-sm text-gray-700">
                    {report.address || "Address not provided"}
                  </p>

                  <p className="mt-2 text-xs text-gray-500">
                    Latitude: {report.latitude}
                    <br />
                    Longitude: {report.longitude}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Citizen */}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">Reported By</h3>

            <div className="mt-2 rounded-xl bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">
                {getReporterName(report)}
              </p>

              {report.username && (
                <p className="mt-1 text-xs text-gray-500">@{report.username}</p>
              )}
              {report.email && (
                <p className="mt-1 text-xs text-gray-500">{report.email}</p>
              )}
            </div>
          </div>

          {/* Images */}

          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Issue Images
            </h3>

            {getReportImages(report).length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {getReportImages(report).map((image, index) => (
                  <ReportImage
                    key={image.id || image.image_url || image.url || index}
                    image={image}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                No images were attached to this report.
              </p>
            )}
          </div>

          {/* Dates */}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Created</p>

              <p className="mt-1 text-sm font-medium text-gray-800">
                {formatDate(report.created_at)}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Last Updated</p>

              <p className="mt-1 text-sm font-medium text-gray-800">
                {formatDate(report.updated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end">
     

          {nextStatus && (
            <button
              type="button"
              onClick={() => onUpdateStatus(report)}
              disabled={updating || detailsLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updating && <RefreshCw size={16} className="animate-spin" />}

              {nextStatus === "in_progress" ? "Start Work" : "Mark Resolved"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WardReportManagement;
