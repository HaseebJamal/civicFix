import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserCog,
  X,
  Image as ImageIcon,
  ExternalLink,
  Navigation,
} from "lucide-react";

import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import api from "../../api/axios.js";
import { reverseGeocode } from "../../utils/reverseGeocode.js";

const REPORTS_ENDPOINT = "/reports";
const OFFICIALS_ENDPOINT = "/users?role=ward_official";
const PAGE_SIZE = 10;

const REPORT_STATUSES = [
  "pending",
  "under_review",
  "in_progress",
  "resolved",
  "rejected",
];

const STATUS_LABELS = {
  pending: "Pending",
  under_review: "Under review",
  in_progress: "In progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  under_review: "bg-blue-50 text-blue-700 ring-blue-600/20",
  in_progress: "bg-violet-50 text-violet-700 ring-violet-600/20",
  resolved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

const getId = (item) => item?.id ?? item?._id ?? item?.report_id;

const getList = (response, keys = []) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  if (Array.isArray(data?.data)) return data.data;

  for (const key of keys) {
    if (Array.isArray(data?.data?.[key])) return data.data[key];
  }

  return [];
};

const getTitle = (report) =>
  report?.title ||
  report?.report_title ||
  report?.subject ||
  report?.category ||
  "Untitled report";

const getDescription = (report) =>
  report?.description ||
  report?.details ||
  report?.report_description ||
  "No description provided.";

const getCategory = (report) =>
  report?.category_name ||
  report?.category ||
  report?.report_type ||
  "Uncategorized";

const getStatus = (report) => {
  const raw = String(report?.status || report?.report_status || "pending")
    .toLowerCase()
    .trim()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  const aliases = {
    submitted: "pending",
    open: "pending",
    new: "pending",
    review: "under_review",
    reviewed: "under_review",
    assigned: "in_progress",
    processing: "in_progress",
    completed: "resolved",
    closed: "resolved",
    declined: "rejected",
  };

  const status = aliases[raw] || raw;

  return REPORT_STATUSES.includes(status) ? status : "pending";
};

const getPriority = (report) =>
  String(report?.priority || "normal").toLowerCase();

const getCitizenName = (report) =>
  report?.citizen?.full_name ||
  report?.citizen?.name ||
  report?.user?.full_name ||
  report?.user?.name ||
  report?.username ||
  report?.citizen_name ||
  report?.user_name ||
  report?.email ||
  "Unknown citizen";

const getOfficialId = (report) =>
  report?.official_id ??
  report?.assigned_official_id ??
  report?.official?.id ??
  report?.official?._id ??
  report?.assigned_official?.id ??
  report?.assigned_official?._id ??
  null;

const getWardOfficialId = (ward) =>
  ward?.official_id ??
  ward?.assigned_official_id ??
  ward?.official?.id ??
  ward?.official?._id ??
  ward?.assigned_official?.id ??
  ward?.assigned_official?._id ??
  null;

const getWardForOfficial = (officialId, wards) =>
  wards.find(
    (ward) => String(getWardOfficialId(ward)) === String(officialId),
  );

const getOfficialName = (official) =>
  official?.full_name ||
  official?.name ||
  [official?.first_name, official?.last_name].filter(Boolean).join(" ") ||
  official?.username ||
  official?.email ||
  "Unnamed official";

const getAssignedOfficial = (report, officials, wards) => {
  const embedded = report?.official || report?.assigned_official;

  if (embedded) return getOfficialName(embedded);

  let officialId = getOfficialId(report);
  if (officialId == null && report?.ward_id != null) {
    const ward = wards.find(
      (item) => String(getId(item)) === String(report.ward_id),
    );
    officialId = getWardOfficialId(ward);
  }

  if (officialId == null) return "Unassigned";

  const match = officials.find(
    (official) => String(getId(official)) === String(officialId),
  );

  return match ? getOfficialName(match) : "Assigned official";
};

const getCoordinates = (report) => {
  const lat = Number(
    report?.latitude ??
      report?.lat ??
      report?.location?.latitude ??
      report?.location?.lat ??
      report?.coordinates?.latitude ??
      report?.coordinates?.lat,
  );

  const lng = Number(
    report?.longitude ??
      report?.lng ??
      report?.lon ??
      report?.location?.longitude ??
      report?.location?.lng ??
      report?.coordinates?.longitude ??
      report?.coordinates?.lng,
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  // Do not display an unpopulated pair as the geographic point (0, 0).
  if (
    (report?.latitude == null &&
      report?.lat == null &&
      report?.location?.latitude == null &&
      report?.location?.lat == null &&
      report?.coordinates?.latitude == null &&
      report?.coordinates?.lat == null) ||
    (report?.longitude == null &&
      report?.lng == null &&
      report?.lon == null &&
      report?.location?.longitude == null &&
      report?.location?.lng == null &&
      report?.coordinates?.longitude == null &&
      report?.coordinates?.lng == null)
  ) {
    return null;
  }

  return { lat, lng };
};

const getSavedLocationLabel = (report) => {
  if (typeof report?.location === "string") return report.location;

  return (
    report?.address ||
    report?.location_address ||
    report?.location_name ||
    report?.location?.address ||
    report?.location?.name ||
    report?.city ||
    report?.district ||
    ""
  );
};

const getLocationLabel = (report) => {
  const savedLocation = getSavedLocationLabel(report);
  return savedLocation || "Location not provided";
};

const getReportDate = (report) =>
  report?.created_at ||
  report?.reported_at ||
  report?.createdAt ||
  report?.submitted_at;

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getImageUrl = (report) => {
  const image =
    report?.image_url ||
    report?.image ||
    report?.photo_url ||
    report?.attachment_url ||
    (Array.isArray(report?.images) ? report.images[0] : null);

  const imageUrl =
    typeof image === "string"
      ? image
      : image && typeof image === "object"
        ? image.url || image.image_url
        : null;

  if (!imageUrl) return null;
  if (/^(https?:)?\/\//i.test(imageUrl) || imageUrl.startsWith("data:")) {
    return imageUrl;
  }

  const backendPath = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return new URL(backendPath, api.defaults.baseURL).toString();
};

const getImageUrls = (report) => {
  let images = report?.images;
  if (typeof images === "string") {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }
  if (!Array.isArray(images)) images = [];

  const directImage =
    report?.image_url ||
    report?.image ||
    report?.photo_url ||
    report?.attachment_url;
  const urls = [
    ...images.map((image) => getImageUrl({ images: [image] })),
    directImage ? getImageUrl({ image: directImage }) : null,
  ].filter(Boolean);

  return [...new Set(urls)];
};

const normalizeRole = (official) =>
  String(official?.role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const isWardOfficial = (official) =>
  ["ward_official", "wardofficial"].includes(normalizeRole(official));

const isActiveOfficial = (official) =>
  official?.is_active !== false &&
  official?.is_active !== 0 &&
  String(official?.is_active).toLowerCase() !== "false" &&
  String(official?.is_active) !== "0" &&
  String(official?.account_status || "active").trim().toLowerCase() ===
    "active";

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.pending
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    urgent: "bg-red-50 text-red-700",
    critical: "bg-red-50 text-red-700",
    high: "bg-orange-50 text-orange-700",
    normal: "bg-gray-100 text-gray-600",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-sky-50 text-sky-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        styles[priority] || styles.normal
      }`}
    >
      {priority}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-gray-100 py-3">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="break-words text-sm font-medium text-gray-800">
        {value == null || value === ""
          ? "—"
          : typeof value === "string" || typeof value === "number"
            ? String(value)
            : value}
      </span>
    </div>
  );
}

function ReportLocation({ report }) {
  const coordinates = getCoordinates(report);
  const latitude = coordinates?.lat;
  const longitude = coordinates?.lng;
  const savedLocation = getSavedLocationLabel(report);
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (savedLocation || latitude == null || longitude == null) {
      return undefined;
    }

    let active = true;
    reverseGeocode(latitude, longitude)
      .then((address) => {
        if (active) setResolvedAddress(address);
      })
      .catch((error) => {
        console.error("Unable to resolve report location:", error);
        if (active) setLookupFailed(true);
      });

    return () => {
      active = false;
    };
  }, [latitude, longitude, savedLocation]);

  const location =
    savedLocation ||
    resolvedAddress ||
    (coordinates
      ? lookupFailed
        ? "Address unavailable"
        : "Looking up location..."
      : "Location not provided");

  return (
    <span className="block">{location}</span>
  );
}

function ReportImages({ report }) {
  const imageUrls = getImageUrls(report);
  const [failedImages, setFailedImages] = useState([]);

  if (imageUrls.length === 0) return null;

  const visibleImages = imageUrls.filter((url) => !failedImages.includes(url));
  if (visibleImages.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        The report image could not be loaded.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {visibleImages.map((url) => (
        <div key={url} className="min-w-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Open original image <ExternalLink size={13} />
          </a>
          <img
            src={url}
            alt="Citizen-submitted report"
            className="max-h-72 w-full rounded-xl border border-gray-200 object-contain"
            loading="lazy"
            onError={() =>
              setFailedImages((previous) =>
                previous.includes(url) ? previous : [...previous, url],
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

function MapRecenter({ position }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, Math.max(map.getZoom(), 14));
  }, [map, position]);

  return null;
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function ReportManagement() {
  const [reports, setReports] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [wards, setWards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [detailsReport, setDetailsReport] = useState(null);
  const [statusReport, setStatusReport] = useState(null);
  const [nextStatus, setNextStatus] = useState("under_review");
  const [statusLoading, setStatusLoading] = useState(false);

  const [assignmentReport, setAssignmentReport] = useState(null);
  const [assignmentOfficialId, setAssignmentOfficialId] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [officialsLoading, setOfficialsLoading] = useState(false);

  const [deleteReport, setDeleteReport] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteReportTitle, setDeleteReportTitle] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [mapReport, setMapReport] = useState(null);

  const fetchReports = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api.get(REPORTS_ENDPOINT);
      setReports(getList(response, ["reports"]));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to load reports. Check your backend endpoint and permissions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOfficials = useCallback(async () => {
    setOfficialsLoading(true);

    const [officialsResult, wardsResult] = await Promise.allSettled([
      api.get(OFFICIALS_ENDPOINT),
      api.get("/wards"),
    ]);

    const errors = [];
    if (officialsResult.status === "fulfilled") {
      const list = getList(officialsResult.value, ["users", "officials"]);
      setOfficials(list.filter(isWardOfficial));
    } else {
      setOfficials([]);
      errors.push(
        `Unable to load ward officials: ${
          officialsResult.reason?.response?.data?.message ||
          "check the users endpoint and permissions."
        }`,
      );
    }

    if (wardsResult.status === "fulfilled") {
      setWards(getList(wardsResult.value, ["wards"]));
    } else {
      setWards([]);
      errors.push(
        `Unable to load wards: ${
          wardsResult.reason?.response?.data?.message ||
          "check the wards endpoint and permissions."
        }`,
      );
    }

    if (errors.length > 0) {
      setNotice({
        type: "error",
        message: errors.join(" "),
      });
    }

    setOfficialsLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
    fetchOfficials();
  }, [fetchReports, fetchOfficials]);

  const categories = useMemo(
    () =>
      [
        ...new Set(
          reports
            .map(getCategory)
            .filter((category) => category !== "Uncategorized"),
        ),
      ].sort(),
    [reports],
  );

  const stats = useMemo(() => {
    const result = {
      total: reports.length,
      pending: 0,
      inProgress: 0,
      resolved: 0,
      rejected: 0,
    };

    reports.forEach((report) => {
      const status = getStatus(report);

      if (status === "pending" || status === "under_review") {
        result.pending += 1;
      } else if (status === "in_progress") {
        result.inProgress += 1;
      } else if (status === "resolved") {
        result.resolved += 1;
      } else if (status === "rejected") {
        result.rejected += 1;
      }
    });

    return result;
  }, [reports]);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reports.filter((report) => {
      const searchableValues = [
        getId(report),
        getTitle(report),
        getDescription(report),
        getCategory(report),
        getCitizenName(report),
        report?.email,
        report?.city,
        report?.district,
        getLocationLabel(report),
        getAssignedOfficial(report, officials, wards),
      ];

      const matchesSearch =
        !term ||
        searchableValues.some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );

      const matchesStatus =
        statusFilter === "all" || getStatus(report) === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || getCategory(report) === categoryFilter;

      const matchesPriority =
        priorityFilter === "all" || getPriority(report) === priorityFilter;

      return (
        matchesSearch && matchesStatus && matchesCategory && matchesPriority
      );
    });
  }, [
    reports,
    officials,
    wards,
    search,
    statusFilter,
    categoryFilter,
    priorityFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const paginatedReports = filteredReports.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, priorityFilter]);

  const updateReportLocally = (reportId, updates) => {
    const matches = (report) => String(getId(report)) === String(reportId);

    setReports((previous) =>
      previous.map((report) =>
        matches(report) ? { ...report, ...updates } : report,
      ),
    );

    setDetailsReport((previous) =>
      previous && matches(previous) ? { ...previous, ...updates } : previous,
    );
  };

  const handleStatusUpdate = async (event) => {
    event.preventDefault();

    if (!statusReport) return;

    const reportId = getId(statusReport);

    if (reportId == null) {
      setNotice({ type: "error", message: "Report ID is missing." });
      return;
    }

    setStatusLoading(true);
    setNotice(null);

    try {
      // Expected PATCH body: { status: "in_progress" }
      await api.patch(`${REPORTS_ENDPOINT}/${reportId}/status`, {
        status: nextStatus,
      });

      updateReportLocally(reportId, { status: nextStatus });

      setStatusReport(null);
      setNotice({
        type: "success",
        message: "Report status updated successfully.",
      });

      await fetchReports(true);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Could not update the report status. Verify the backend endpoint and allowed status values.",
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const openStatusModal = (report) => {
    setStatusReport(report);
    setNextStatus(getStatus(report));
  };

  const openAssignmentModal = (report) => {
    const reportWard = wards.find(
      (ward) => String(getId(ward)) === String(report?.ward_id),
    );
    const currentOfficialId =
      getOfficialId(report) ?? getWardOfficialId(reportWard);

    setAssignmentReport(report);
    setAssignmentOfficialId(
      currentOfficialId == null ? "" : String(currentOfficialId),
    );
    setAssignmentError("");
  };

  const handleOfficialAssignment = async (event) => {
    event.preventDefault();

    if (!assignmentReport) return;

    const reportId = getId(assignmentReport);
    const selectedWard = getWardForOfficial(assignmentOfficialId, wards);

    if (reportId == null) {
      const message = "Assignment failed: report ID is missing.";
      setAssignmentError(message);
      setNotice({ type: "error", message });
      return;
    }

    if (!selectedWard) {
      const message =
        "Assignment failed: the selected official is not assigned to a ward. Assign the official to a ward first.";
      setAssignmentError(message);
      setNotice({ type: "error", message });
      return;
    }

    const selectedOfficial = officials.find(
      (official) => String(getId(official)) === String(assignmentOfficialId),
    );
    if (!selectedOfficial || !isActiveOfficial(selectedOfficial)) {
      const message =
        "Assignment failed: select an active ward official. Activate this account in User Management first.";
      setAssignmentError(message);
      setNotice({ type: "error", message });
      return;
    }

    setAssignmentLoading(true);
    setAssignmentError("");
    setNotice(null);

    try {
      await api.patch(`${REPORTS_ENDPOINT}/${reportId}/assign-ward`, {
        ward_id: getId(selectedWard),
      });

      setAssignmentReport(null);
      setNotice({
        type: "success",
        message: `Assignment successful: ${getOfficialName(
          selectedOfficial,
        )} is now responsible for this report.`,
      });

      await fetchReports(true);
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      const message =
        serverMessage ===
        "The selected ward does not cover this report's location"
          ? "Assignment failed: this official's ward does not cover the report's location. Choose an official whose ward contains the report."
          : `Assignment failed: ${
              serverMessage ||
              "Unable to assign this report to the selected official."
            }`;

      setAssignmentError(message);
      setNotice({ type: "error", message });
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteReport) return;

    const reportId = getId(deleteReport);

    if (reportId == null) {
      setNotice({ type: "error", message: "Report ID is missing." });
      return;
    }

    if (deleteReportTitle.trim() !== String(getCategory(deleteReport)).trim()) {
      setNotice({
        type: "error",
        message: "Please enter the exact report category.",
      });
      return;
    }

    if (!deletePassword) {
      setNotice({
        type: "error",
        message: "Super Admin password is required.",
      });
      return;
    }

    if (!deletionReason.trim()) {
      setNotice({
        type: "error",
        message: "Please provide a deletion reason.",
      });
      return;
    }

    setDeleteLoading(true);
    setNotice(null);

    try {
      await api.delete(`${REPORTS_ENDPOINT}/${reportId}`, {
        data: {
          report_title_confirmation: deleteReportTitle.trim(),
          password: deletePassword,
          deletion_reason: deletionReason.trim(),
        },
      });

      setReports((previous) =>
        previous.filter((report) => String(getId(report)) !== String(reportId)),
      );

      setDetailsReport((previous) =>
        previous && String(getId(previous)) === String(reportId)
          ? null
          : previous,
      );

      setMapReport((previous) =>
        previous && String(getId(previous)) === String(reportId)
          ? null
          : previous,
      );

      setDeleteReport(null);
      setDeleteReportTitle("");
      setDeletePassword("");
      setDeletionReason("");

      setNotice({
        type: "success",
        message: "Report deleted successfully.",
      });

      await fetchReports(true);
    } catch (err) {
      setNotice({
        type: "error",
        message: err?.response?.data?.message || "Could not delete the report.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <FileText size={26} />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Report Management
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Review citizen reports, update progress, and assign officials.
            </p>
          </div>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => {
              fetchReports(true);
              fetchOfficials();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {/* Notice */}
        {notice && (
          <div
            role={notice.type === "error" ? "alert" : "status"}
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              notice.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {notice.type === "success" ? (
              <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={19} className="mt-0.5 shrink-0" />
            )}

            <p className="flex-1 text-sm">{notice.message}</p>

            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            title="Total reports"
            value={stats.total}
            icon={FileText}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Pending / review"
            value={stats.pending}
            icon={Clock}
            color="bg-amber-50 text-amber-700"
          />
          <StatCard
            title="In progress"
            value={stats.inProgress}
            icon={RefreshCw}
            color="bg-violet-50 text-violet-700"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            title="Rejected"
            value={stats.rejected}
            icon={Ban}
            color="bg-red-50 text-red-700"
          />
        </div>

        {/* Search and filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Filter size={18} />
            Search and filters
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_190px_170px]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, ID, citizen, city..."
                className={`${inputClass} pl-10`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter reports by status"
            >
              <option value="all">All statuses</option>
              {REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter reports by category"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter reports by priority"
            >
              <option value="all">All priorities</option>
              <option value="critical">Critical</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </section>

        {/* Reports table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">Citizen reports</h2>

            <p className="text-sm text-gray-500">
              {filteredReports.length} result
              {filteredReports.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
              <LoaderCircle
                size={32}
                className="animate-spin text-emerald-600"
              />
              <p className="text-sm">Loading reports...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center">
              <AlertCircle size={35} className="text-red-500" />
              <p className="max-w-xl text-sm text-red-700">{error}</p>

              <button
                type="button"
                onClick={() => fetchReports()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Try again
              </button>
            </div>
          ) : paginatedReports.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-5 text-center">
              <FileText size={36} className="text-gray-300" />
              <p className="font-semibold text-gray-800">No reports found</p>
              <p className="text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Report</th>
                      <th className="px-5 py-4 font-semibold">Citizen</th>
                      <th className="px-5 py-4 font-semibold">Priority</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Official</th>
                      <th className="px-5 py-4 font-semibold">Location</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {paginatedReports.map((report) => {
                      const reportId = getId(report);
                      const coordinates = getCoordinates(report);

                      return (
                        <tr
                          key={reportId ?? getTitle(report)}
                          className="transition hover:bg-gray-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-start gap-3">
                              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                                <FileText size={19} />
                              </div>

                              <div className="max-w-60">
                                <p className="truncate font-semibold text-gray-900">
                                  {getTitle(report)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  ID: {reportId ?? "—"}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {getCategory(report)}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  {formatDate(getReportDate(report))}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="rounded-full bg-gray-100 p-2 text-gray-600">
                                <UserRound size={15} />
                              </div>
                              <div className="max-w-40">
                                <p className="truncate font-medium text-gray-800">
                                  {getCitizenName(report)}
                                </p>
                                <p className="mt-1 truncate text-xs text-gray-500">
                                  {report?.email ||
                                    report?.citizen?.email ||
                                    report?.user?.email ||
                                    "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <PriorityBadge priority={getPriority(report)} />
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={getStatus(report)} />
                          </td>

                          <td className="px-5 py-4">
                            <p className="max-w-40 truncate font-medium text-gray-800">
                              {getAssignedOfficial(report, officials, wards)}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <MapPin size={15} className="shrink-0" />
                              <span className="max-w-36 truncate">
                                <ReportLocation report={report} />
                              </span>
                            </div>

                            {coordinates && (
                              <button
                                type="button"
                                onClick={() => setMapReport(report)}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
                              >
                                <Navigation size={13} />
                                View map
                              </button>
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="View report details"
                                aria-label="View report details"
                                onClick={() => setDetailsReport(report)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Update status"
                                aria-label="Update report status"
                                onClick={() => openStatusModal(report)}
                                className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50"
                              >
                                <RefreshCw size={16} />
                              </button>

                              <button
                                type="button"
                                title="Assign official"
                                aria-label="Assign report to official"
                                onClick={() => openAssignmentModal(report)}
                                className="rounded-lg border border-violet-200 p-2 text-violet-700 hover:bg-violet-50"
                              >
                                <UserRoundCheck size={16} />
                              </button>

                              <button
                                type="button"
                                title="Delete report"
                                aria-label="Delete report"
                                onClick={() => setDeleteReport(report)}
                                className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col gap-4 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Showing{" "}
                  <strong className="text-gray-800">
                    {(safePage - 1) * PAGE_SIZE + 1}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-gray-800">
                    {Math.min(safePage * PAGE_SIZE, filteredReports.length)}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-gray-800">
                    {filteredReports.length}
                  </strong>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((previous) => previous - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-sm text-gray-600">
                    Page {safePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((previous) => previous + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Report details modal */}
      {detailsReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={() => setDetailsReport(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="report-details-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Report details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  ID: {getId(detailsReport) ?? "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsReport(null)}
                aria-label="Close details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <h3 className="break-words text-xl font-bold text-gray-900">
                  {getTitle(detailsReport)}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={getStatus(detailsReport)} />
                  <PriorityBadge priority={getPriority(detailsReport)} />
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {getCategory(detailsReport)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <h4 className="mb-2 font-semibold text-gray-800">
                  Description
                </h4>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                  {getDescription(detailsReport)}
                </p>
              </div>

              <div>
                <DetailRow
                  label="Citizen"
                  value={getCitizenName(detailsReport)}
                />
                <DetailRow
                  label="Email"
                  value={
                    detailsReport?.email ||
                    detailsReport?.citizen?.email ||
                    detailsReport?.user?.email
                  }
                />
                <DetailRow
                  label="Category"
                  value={getCategory(detailsReport)}
                />
                <DetailRow
                  label="Location"
                  value={<ReportLocation report={detailsReport} />}
                />
                <DetailRow
                  label="Assigned official"
                  value={getAssignedOfficial(detailsReport, officials, wards)}
                />
                <DetailRow
                  label="Created"
                  value={formatDate(getReportDate(detailsReport))}
                />
                <DetailRow
                  label="Updated"
                  value={formatDate(detailsReport?.updated_at)}
                />
              </div>

              {getImageUrls(detailsReport).length > 0 && (
                <div>
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
                    <ImageIcon size={17} />
                    Report image
                  </h4>
                  <ReportImages report={detailsReport} />
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                {getCoordinates(detailsReport) && (
                  <button
                    type="button"
                    onClick={() => {
                      const report = detailsReport;
                      setDetailsReport(null);
                      setMapReport(report);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <MapPin size={17} />
                    View map
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const report = detailsReport;
                    setDetailsReport(null);
                    openAssignmentModal(report);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  <UserRoundCheck size={17} />
                  Assign official
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const report = detailsReport;
                    setDetailsReport(null);
                    openStatusModal(report);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <RefreshCw size={17} />
                  Update status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status update modal */}
      {statusReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="status-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Update report status
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getTitle(statusReport)}
                </p>
              </div>

              <button
                type="button"
                disabled={statusLoading}
                onClick={() => setStatusReport(null)}
                aria-label="Close status dialog"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleStatusUpdate} className="space-y-5 p-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  New status
                </span>

                <select
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                  className={inputClass}
                >
                  {REPORT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={statusLoading}
                  onClick={() => setStatusReport(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={statusLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {statusLoading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Save status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign official modal */}
      {assignmentReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assign-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="assign-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Report responsibility
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getTitle(assignmentReport)}
                </p>
              </div>

              <button
                type="button"
                disabled={assignmentLoading}
                onClick={() => setAssignmentReport(null)}
                aria-label="Close assignment dialog"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleOfficialAssignment}
              className="space-y-5 p-5"
            >
              <div className="rounded-xl bg-violet-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2.5 text-violet-700">
                    <UserRoundCheck size={22} />
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900">
                      Official assignment
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Select an active official. The assignment will only
                      succeed when the official’s ward covers this report’s
                      location.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-700">
                  Responsible official
                </p>
                <p className="mt-1 text-sm text-gray-900">
                  {getAssignedOfficial(assignmentReport, officials, wards)}
                </p>
              </div>

              {officialsLoading && (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading official details...
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Assign to official
                </span>
                <select
                  value={assignmentOfficialId}
                  onChange={(event) => {
                    setAssignmentOfficialId(event.target.value);
                    setAssignmentError("");
                  }}
                  disabled={officialsLoading || assignmentLoading}
                  className={inputClass}
                >
                  <option value="">Select an official</option>
                  {officials
                    .map((official) => ({
                      official,
                      ward: getWardForOfficial(getId(official), wards),
                    }))
                    .filter(({ official }) => getId(official) != null)
                    .map(({ official, ward }) => (
                      <option
                        key={getId(official)}
                        value={String(getId(official))}
                        disabled={!ward || !isActiveOfficial(official)}
                      >
                        {getOfficialName(official)} ({official.email || "no email"}) —{" "}
                        {ward?.ward_name || "No ward assigned"}
                        {!isActiveOfficial(official) ? " · Inactive" : ""}
                      </option>
                    ))}
                </select>
              </label>

              {!officialsLoading &&
                officials.length === 0 && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    No ward official accounts were returned by the users
                    endpoint. Verify this account’s role in User Management.
                  </p>
                )}

              {!officialsLoading &&
                officials.length > 0 &&
                !officials.some(
                  (official) =>
                    getWardForOfficial(getId(official), wards) &&
                    isActiveOfficial(official),
                ) && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    No active ward officials are assigned to a ward. Assign an
                    active official to a ward in Ward Management before
                    assigning reports.
                  </p>
                )}

              {assignmentError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {assignmentError}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={assignmentLoading}
                  onClick={() => setAssignmentReport(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={
                    assignmentLoading ||
                    officialsLoading ||
                    !assignmentOfficialId
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {assignmentLoading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  {assignmentLoading ? "Assigning..." : "Assign official"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Map modal */}
      {mapReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setMapReport(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-map-title"
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div className="min-w-0">
                <h2 id="report-map-title" className="font-bold text-gray-900">
                  Report location
                </h2>
                <p className="mt-1 truncate text-sm text-gray-500">
                  {getTitle(mapReport)} · {getLocationLabel(mapReport)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMapReport(null)}
                aria-label="Close map"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {getCoordinates(mapReport) ? (
              <>
                <div className="h-[55vh] min-h-72 w-full">
                  <MapContainer
                    center={[
                      getCoordinates(mapReport).lat,
                      getCoordinates(mapReport).lng,
                    ]}
                    zoom={14}
                    scrollWheelZoom
                    className="h-full w-full"
                  >
                    <MapRecenter
                      position={[
                        getCoordinates(mapReport).lat,
                        getCoordinates(mapReport).lng,
                      ]}
                    />

                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <CircleMarker
                      center={[
                        getCoordinates(mapReport).lat,
                        getCoordinates(mapReport).lng,
                      ]}
                      radius={10}
                      pathOptions={{
                        color: "#047857",
                        fillColor: "#10b981",
                        fillOpacity: 0.8,
                      }}
                    >
                      <Popup>
                        <strong>{getTitle(mapReport)}</strong>
                        <br />
                        {getLocationLabel(mapReport)}
                      </Popup>
                    </CircleMarker>
                  </MapContainer>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <p className="text-sm text-gray-600">
                    {getCoordinates(mapReport).lat},{" "}
                    {getCoordinates(mapReport).lng}
                  </p>

                  <a
                    href={`https://www.openstreetmap.org/?mlat=${getCoordinates(mapReport).lat}&mlon=${getCoordinates(mapReport).lng}#map=16/${getCoordinates(mapReport).lat}/${getCoordinates(mapReport).lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Open in OpenStreetMap
                    <ExternalLink size={16} />
                  </a>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">
                No valid coordinates are available for this report.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}

      {/* Delete confirmation */}
      {deleteReport && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-gray-950/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-report-title"
            className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Trash2 size={23} />
            </div>

            <h2
              id="delete-report-title"
              className="text-lg font-bold text-gray-900"
            >
              Approve report deletion
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              This action will soft-delete the report. The report will be hidden
              from active report lists if your backend filters records using
              deleted_at.
            </p>

            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-red-700">
                Report category
              </p>
              <p className="mt-1 break-words font-semibold text-gray-900">
                {getCategory(deleteReport)}
              </p>

              <p className="mt-2 text-xs text-gray-500">
                Report ID: {getId(deleteReport)}
              </p>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleDelete();
              }}
            >
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Confirm report category
                </span>
                <input
                  type="text"
                  value={deleteReportTitle}
                  onChange={(event) => setDeleteReportTitle(event.target.value)}
                  placeholder="Type the exact category shown above"
                  autoComplete="off"
                  required
                  disabled={deleteLoading}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Super Admin password
                </span>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={deleteLoading}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">
                  Reason for deletion
                </span>
                <textarea
                  value={deletionReason}
                  onChange={(event) => setDeletionReason(event.target.value)}
                  placeholder="Explain why this report should be deleted..."
                  rows={3}
                  maxLength={1000}
                  required
                  disabled={deleteLoading}
                  className={inputClass}
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => {
                    setDeleteReport(null);
                    setDeleteReportTitle("");
                    setDeletePassword("");
                    setDeletionReason("");
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteLoading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Confirm deletion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
