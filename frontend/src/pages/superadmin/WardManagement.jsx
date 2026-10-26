import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Search,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  Users,
  UserRoundCheck,
  ChevronLeft,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Filter,
  UserCog,
} from "lucide-react";
import Swal from "sweetalert2";

import api from "../../api/axios.js";
import { reverseGeocode } from "../../utils/reverseGeocode.js";

const WARDS_ENDPOINT = "/wards";
const OFFICIALS_ENDPOINT = "/users";
const PAGE_SIZE = 10;

const getId = (item) => item?.id ?? item?._id;

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

const getWardName = (ward) =>
  ward?.ward_name || ward?.name || "Unnamed ward";

const parseBoundary = (boundary) => {
  if (!boundary) return null;
  if (typeof boundary !== "string") return boundary;

  try {
    return JSON.parse(boundary);
  } catch {
    return null;
  }
};

const getWardLocationName = (ward) => {
  const boundary = parseBoundary(ward?.boundary_geojson);
  const featureProperties =
    boundary?.type === "Feature" ? boundary.properties : null;

  return (
    ward?.location_name ||
    featureProperties?.location_name ||
    featureProperties?.name ||
    featureProperties?.display_name ||
    featureProperties?.place_name ||
    ""
  );
};

const getWardBoundaryCenter = (ward) => {
  const boundary = parseBoundary(ward?.boundary_geojson);
  const geometry =
    boundary?.type === "Feature" ? boundary.geometry : boundary;
  const coordinates = geometry?.coordinates;

  if (!coordinates) return null;

  const points = [];
  const collectPoints = (value) => {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      points.push(value);
      return;
    }

    if (Array.isArray(value)) value.forEach(collectPoints);
  };

  collectPoints(coordinates);
  if (points.length === 0) return null;

  const bounds = points.reduce(
    ([minLongitude, minLatitude, maxLongitude, maxLatitude], [longitude, latitude]) => [
      Math.min(minLongitude, longitude),
      Math.min(minLatitude, latitude),
      Math.max(maxLongitude, longitude),
      Math.max(maxLatitude, latitude),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bounds;
  const longitude = (minLongitude + maxLongitude) / 2;
  const latitude = (minLatitude + maxLatitude) / 2;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

const getOfficialId = (ward) =>
  ward?.official_id ??
  ward?.assigned_official_id ??
  ward?.official?.id ??
  ward?.official?._id ??
  ward?.assigned_official?.id ??
  ward?.assigned_official?._id ??
  null;

const getOfficialName = (official) =>
  official?.full_name ||
  official?.name ||
  [official?.first_name, official?.last_name].filter(Boolean).join(" ") ||
  official?.username ||
  official?.email ||
  "Unnamed official";

const isWardOfficial = (official) =>
  String(official?.role || "").trim().toLowerCase() === "ward_official";

const isAssignableOfficial = (official) =>
  isWardOfficial(official) &&
  official?.is_active !== false &&
  official?.is_active !== 0 &&
  String(official?.is_active).toLowerCase() !== "false" &&
  String(official?.is_active) !== "0" &&
  String(official?.account_status || "").trim().toLowerCase() === "active";

const getOfficialStatus = (official) => {
  if (isAssignableOfficial(official)) return "Active";
  if (
    official?.is_active === false ||
    official?.is_active === 0 ||
    String(official?.is_active).toLowerCase() === "false" ||
    String(official?.is_active) === "0"
  ) {
    return "Inactive";
  }
  return String(official?.account_status || "Pending")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getAssignedOfficialName = (ward, officials) => {
  const embedded =
    ward?.official || ward?.assigned_official;

  if (embedded) return getOfficialName(embedded);

  const assignedName = [
    ward?.official_first_name,
    ward?.official_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  if (assignedName) return assignedName;
  if (ward?.official_username) return ward.official_username;

  const officialId = getOfficialId(ward);

  if (officialId == null) return "Unassigned";

  const official = officials.find(
    (item) => String(getId(item)) === String(officialId)
  );

  return official ? getOfficialName(official) : "Assigned official";
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const boundaryStyles = {
  "Location set": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Location missing": "bg-amber-50 text-amber-700 ring-amber-600/20",
};

function BoundaryBadge({ hasBoundary }) {
  const label = hasBoundary ? "Location set" : "Location missing";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        boundaryStyles[label]
      }`}
    >
      {label}
    </span>
  );
}

function WardLocation({ ward }) {
  const savedLocation = getWardLocationName(ward);
  const center = getWardBoundaryCenter(ward);
  const latitude = center?.latitude;
  const longitude = center?.longitude;
  const [resolvedLocation, setResolvedLocation] = useState("");
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (savedLocation || latitude == null || longitude == null) {
      return undefined;
    }

    let active = true;
    reverseGeocode(latitude, longitude)
      .then((address) => {
        if (active) setResolvedLocation(address);
      })
      .catch((error) => {
        console.error("Unable to resolve saved ward location:", error);
        if (active) setLookupFailed(true);
      });

    return () => {
      active = false;
    };
  }, [savedLocation, latitude, longitude]);

  if (savedLocation) return savedLocation;
  if (resolvedLocation) return resolvedLocation;
  if (latitude == null || longitude == null) {
    return ward?.boundary_geojson ? "Location unavailable" : "Not set";
  }
  if (lookupFailed) {
    return `Address unavailable (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
  }

  return "Finding location...";
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {value}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={23} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function WardManagement() {
  const [wards, setWards] = useState([]);
  const [officials, setOfficials] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [officialsLoading, setOfficialsLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [officialFilter, setOfficialFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [editingWard, setEditingWard] = useState(null);
  const [wardFormOpen, setWardFormOpen] = useState(false);
  const [detailsWard, setDetailsWard] = useState(null);

  const [assignmentWard, setAssignmentWard] = useState(null);
  const [assignmentOfficialId, setAssignmentOfficialId] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  const [deleteWard, setDeleteWard] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [wardSaving, setWardSaving] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [form, setForm] = useState({
    ward_name: "",
    description: "",
    boundary_geojson: "",
    location_name: "",
  });

  useEffect(() => {
    const query = locationSearch.trim();
    if (selectedLocation && query === selectedLocation.name) {
      setLocationResults([]);
      setLocationSearchLoading(false);
      setLocationSearchError("");
      return undefined;
    }

    if (query.length < 3) {
      setLocationResults([]);
      setLocationSearchLoading(false);
      setLocationSearchError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLocationSearchLoading(true);
      setLocationSearchError("");

      try {
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          polygon_geojson: "1",
          polygon_threshold: "0.00005",
          limit: "20",
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(`Place search failed with status ${response.status}.`);
        }

        const results = await response.json();
        if (!controller.signal.aborted) {
          setLocationResults(
            results
              .map((result) => ({
                id: result.place_id,
                name: result.display_name,
                geometry: result.geojson,
                category: result.category,
                type: result.type,
              }))
              .sort((first, second) => {
                const firstHasBoundary = [
                  "Polygon",
                  "MultiPolygon",
                ].includes(first.geometry?.type);
                const secondHasBoundary = [
                  "Polygon",
                  "MultiPolygon",
                ].includes(second.geometry?.type);
                return Number(secondHasBoundary) - Number(firstHasBoundary);
              }),
          );
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Unable to search for ward location:", error);
          setLocationSearchError(
            "Could not search for places. Check your connection and try again.",
          );
          setLocationResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLocationSearchLoading(false);
      }
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationSearch, selectedLocation]);

  const fetchWards = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api.get(WARDS_ENDPOINT);
      setWards(getList(response, ["wards"]));
    } catch (err) {
      if (err?.response?.status === 404) {
        setWards([]);
      } else {
        setError(
          err?.response?.data?.message ||
            "Unable to load wards. Check your API endpoint and permissions."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchOfficials = useCallback(async () => {
    setOfficialsLoading(true);

    try {
      const response = await api.get(OFFICIALS_ENDPOINT);
      const list = getList(response, ["users", "officials"]);

      setOfficials(list.filter(isWardOfficial));
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Could not load officials. Check the officials endpoint.",
      });
    } finally {
      setOfficialsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      const [wardsResult, officialsResult] = await Promise.allSettled([
        api.get(WARDS_ENDPOINT),
        api.get(OFFICIALS_ENDPOINT),
      ]);
      if (!active) return;

      if (wardsResult.status === "fulfilled") {
        setWards(getList(wardsResult.value, ["wards"]));
        setError("");
      } else if (wardsResult.reason?.response?.status === 404) {
        setWards([]);
      } else {
        setError(
          wardsResult.reason?.response?.data?.message ||
            "Unable to load wards. Check your connection and permissions.",
        );
      }
      setLoading(false);

      if (officialsResult.status === "fulfilled") {
        const list = getList(officialsResult.value, ["users", "officials"]);
        setOfficials(list.filter(isWardOfficial));
      } else {
        setNotice({
          type: "error",
          message:
            officialsResult.reason?.response?.data?.message ||
            "Could not load ward officials.",
        });
      }
    };

    loadInitialData();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const assigned = wards.filter(
      (ward) => getOfficialId(ward) != null
    ).length;
    const withBoundary = wards.filter(
      (ward) => Boolean(ward?.boundary_geojson)
    ).length;

    return {
      total: wards.length,
      assigned,
      unassigned: wards.length - assigned,
      withBoundary,
    };
  }, [wards]);

  const filteredWards = useMemo(() => {
    const term = search.trim().toLowerCase();

    return wards.filter((ward) => {
      const matchesSearch =
        !term ||
        [
          getWardName(ward),
          ward.description,
          getAssignedOfficialName(ward, officials),
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(term)
        );

      const matchesOfficial =
        officialFilter === "all" ||
        (officialFilter === "assigned"
          ? getOfficialId(ward) != null
          : getOfficialId(ward) == null);

      return matchesSearch && matchesOfficial;
    });
  }, [wards, officials, search, officialFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredWards.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const paginatedWards = filteredWards.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingWard(null);
    setLocationSearch("");
    setLocationResults([]);
    setSelectedLocation(null);
    setLocationSearchError("");
    setForm({
      ward_name: "",
      description: "",
      boundary_geojson: "",
      location_name: "",
    });
    setWardFormOpen(true);
  };

  const openEditModal = (ward) => {
    setEditingWard(ward);
    const boundary = parseBoundary(ward.boundary_geojson);
    const locationName = getWardLocationName(ward);
    const geometry =
      boundary?.type === "Feature" ? boundary.geometry : boundary;
    setLocationSearch(locationName);
    setLocationResults([]);
    setSelectedLocation(
      locationName &&
        geometry &&
        ["Polygon", "MultiPolygon"].includes(geometry.type)
        ? { name: locationName, geometry }
        : null,
    );
    setLocationSearchError("");

    setForm({
      ward_name: ward.ward_name || ward.name || "",
      description: ward.description || "",
      boundary_geojson: boundary ? JSON.stringify(boundary) : "",
      location_name: locationName,
    });

    setWardFormOpen(true);
  };

  const closeWardForm = () => {
    setWardFormOpen(false);
    setEditingWard(null);
    setSelectedLocation(null);
    setLocationResults([]);
  };

  const handleWardSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);

    let boundary = selectedLocation
      ? {
          type: "Feature",
          properties: {
            location_name: selectedLocation.name,
          },
          geometry: selectedLocation.geometry,
        }
      : parseBoundary(form.boundary_geojson);
    const geometry =
      boundary?.type === "Feature" ? boundary.geometry : boundary;

    if (
      !geometry ||
      !["Polygon", "MultiPolygon"].includes(geometry.type) ||
      !Array.isArray(geometry.coordinates)
    ) {
      setNotice({
        type: "error",
        message: "Choose a place with an available area boundary to continue.",
      });
      return;
    }

    if (
      !selectedLocation &&
      boundary?.type === "Feature" &&
      form.location_name &&
      !boundary.properties?.location_name
    ) {
      boundary = {
        ...boundary,
        properties: {
          ...boundary.properties,
          location_name: form.location_name,
        },
      };
    }

    const payload = {
      ward_name: form.ward_name.trim(),
      description: form.description.trim(),
      boundary_geojson: boundary,
    };

    if (!payload.ward_name) {
      setNotice({
        type: "error",
        message: "Ward name is required.",
      });
      return;
    }

    setWardSaving(true);
    try {
      if (editingWard) {
        const wardId = getId(editingWard);

        await api.patch(`${WARDS_ENDPOINT}/${wardId}`, payload);

        setNotice({
          type: "success",
          message: "Ward updated successfully.",
        });
      } else {
        await api.post(WARDS_ENDPOINT, payload);

        setNotice({
          type: "success",
          message: "Ward created successfully.",
        });
      }

      closeWardForm();
      await fetchWards(true);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Could not save the ward. Check your backend fields and route.",
      });
    } finally {
      setWardSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteWard) return;

    const wardId = getId(deleteWard);

    if (wardId == null) {
      setNotice({
        type: "error",
        message: "This ward does not have a valid ID.",
      });
      setDeleteWard(null);
      return;
    }

    setDeleteLoading(true);

    try {
      await api.delete(`${WARDS_ENDPOINT}/${wardId}`);

      setNotice({
        type: "success",
        message: "Ward deleted successfully.",
      });

      setDeleteWard(null);
      setDetailsWard(null);

      await fetchWards(true);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Could not delete the ward. It may have assigned reports or related records.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const selectLocation = (location) => {
    const geometry = location.geometry;
    if (
      !geometry ||
      !["Polygon", "MultiPolygon"].includes(geometry.type) ||
      !Array.isArray(geometry.coordinates)
    ) {
      setLocationSearchError(
        "This place does not have an area boundary. Try searching for a district, town, or village.",
      );
      return;
    }

    setSelectedLocation(location);
    setLocationSearch(location.name);
    setLocationResults([]);
    setLocationSearchError("");
    setForm((previous) => ({
      ...previous,
      boundary_geojson: "",
      location_name: location.name,
    }));
  };

  const openAssignment = async (ward) => {
    setAssignmentWard(ward);
    setAssignmentOfficialId(
      getOfficialId(ward) == null ? "" : String(getOfficialId(ward))
    );

    if (officials.length === 0) {
      await fetchOfficials();
    }
  };

  const handleAssignment = async (event) => {
    event.preventDefault();

    if (!assignmentWard) return;

    if (assignmentOfficialId) {
      const selectedOfficial = officials.find(
        (official) => String(getId(official)) === assignmentOfficialId,
      );
      if (!selectedOfficial || !isAssignableOfficial(selectedOfficial)) {
        setNotice({
          type: "error",
          message: "Only active ward officials can be assigned.",
        });
        return;
      }

      const existingWard = wards.find(
        (ward) =>
          String(getId(ward)) !== String(getId(assignmentWard)) &&
          String(getOfficialId(ward)) === assignmentOfficialId,
      );

      if (existingWard) {
        await Swal.fire({
          icon: "warning",
          title: "Official already assigned",
          text: `${getOfficialName(selectedOfficial)} is already assigned to ${getWardName(existingWard)}. Each official can only be assigned to one ward.`,
          confirmButtonText: "Got it",
          confirmButtonColor: "#7c3aed",
        });
        return;
      }
    }

    const wardId = getId(assignmentWard);

    if (wardId == null) {
      setNotice({
        type: "error",
        message: "This ward does not have a valid ID.",
      });
      return;
    }

    setAssignmentLoading(true);
    setNotice(null);

    try {
      const currentOfficialId = getOfficialId(assignmentWard);
      if (
        assignmentOfficialId &&
        String(currentOfficialId) === assignmentOfficialId
      ) {
        setAssignmentWard(null);
        return;
      }

      if (assignmentOfficialId) {
        await api.patch(`${WARDS_ENDPOINT}/${wardId}/official`, {
          official_id: assignmentOfficialId,
        });
      } else if (currentOfficialId != null) {
        await api.delete(`${WARDS_ENDPOINT}/${wardId}/official`);
      } else {
        setAssignmentWard(null);
        return;
      }

      setNotice({
        type: "success",
        message: assignmentOfficialId
          ? "Official assigned successfully."
          : "Ward assignment removed successfully.",
      });

      setAssignmentWard(null);
      await fetchWards(true);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        "Assignment failed. Confirm the assignment endpoint and request body in your backend.";

      if (err?.response?.status === 409) {
        await Swal.fire({
          icon: "warning",
          title: "Official already assigned",
          text: message,
          confirmButtonText: "Got it",
          confirmButtonColor: "#7c3aed",
        });
      } else {
        setNotice({ type: "error", message });
      }
    } finally {
      setAssignmentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
                <MapPin size={26} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Ward Management
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Manage wards, locations, and official assignments.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                fetchWards(true);
                fetchOfficials();
              }}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <Plus size={18} />
              Add ward
            </button>
          </div>
        </header>

        {/* Notification */}
        {notice && (
          <div
            role="status"
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
              aria-label="Dismiss notification"
              onClick={() => setNotice(null)}
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total wards"
            value={stats.total}
            icon={MapPin}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Assigned wards"
            value={stats.assigned}
            icon={UserRoundCheck}
            color="bg-violet-50 text-violet-700"
          />
          <StatCard
            title="Unassigned wards"
            value={stats.unassigned}
            icon={Users}
            color="bg-gray-100 text-gray-700"
          />
          <StatCard
            title="Locations captured"
            value={stats.withBoundary}
            icon={MapPin}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>

        {/* Search and filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Filter size={18} />
            Search and filters
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search ward name, description, official..."
                className={`${inputClass} pl-10`}
              />
            </div>

            <select
              value={officialFilter}
              onChange={(event) => {
                setOfficialFilter(event.target.value);
                setPage(1);
              }}
              className={inputClass}
              aria-label="Filter by official assignment"
            >
              <option value="all">All wards</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </section>

        {/* Ward table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">
              Registered wards
            </h2>

            <span className="text-sm text-gray-500">
              {filteredWards.length} result
              {filteredWards.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
              <LoaderCircle
                size={32}
                className="animate-spin text-emerald-600"
              />
              <p className="text-sm">Loading wards...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center">
              <AlertCircle size={35} className="text-red-500" />
              <p className="max-w-xl text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => fetchWards()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Try again
              </button>
            </div>
          ) : paginatedWards.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-5 text-center">
              <MapPin size={36} className="text-gray-300" />
              <p className="font-semibold text-gray-800">No wards found</p>
              <p className="text-sm text-gray-500">
                Try changing your filters or add a ward.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Ward</th>
                      <th className="px-5 py-4 font-semibold">Description</th>
                      <th className="px-5 py-4 font-semibold">Official</th>
                      <th className="px-5 py-4 font-semibold">Location</th>
                      <th className="px-5 py-4 font-semibold">Created</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {paginatedWards.map((ward) => {
                      const wardId = getId(ward);
                      const assigned = getOfficialId(ward) != null;

                      return (
                        <tr
                          key={wardId ?? getWardName(ward)}
                          className="transition hover:bg-gray-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                                <MapPin size={19} />
                              </div>

                              <div>
                                <p className="font-semibold text-gray-900">
                                  {getWardName(ward)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  ID: {wardId ?? "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            <span className="line-clamp-2">
                              {ward.description || "—"}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`rounded-lg p-2 ${
                                  assigned
                                    ? "bg-violet-50 text-violet-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                <Users size={16} />
                              </div>

                              <div>
                                <p className="font-medium text-gray-800">
                                  {getAssignedOfficialName(ward, officials)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {assigned ? "Assigned" : "Unassigned"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="space-y-1">
                              <p className="max-w-56 truncate font-medium text-gray-800">
                                <WardLocation ward={ward} />
                              </p>
                              <BoundaryBadge
                                hasBoundary={Boolean(ward.boundary_geojson)}
                              />
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {formatDate(ward.created_at)}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="View details"
                                aria-label="View ward details"
                                onClick={() => setDetailsWard(ward)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                title="Assign official"
                                aria-label="Assign official"
                                onClick={() => openAssignment(ward)}
                                className="rounded-lg border border-violet-200 p-2 text-violet-700 hover:bg-violet-50"
                              >
                                <UserCog size={16} />
                              </button>

                              <button
                                type="button"
                                title="Edit ward"
                                aria-label="Edit ward"
                                onClick={() => openEditModal(ward)}
                                className="rounded-lg border border-blue-200 p-2 text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                type="button"
                                title="Delete ward"
                                aria-label="Delete ward"
                                onClick={() => setDeleteWard(ward)}
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
                  </strong>
                  {" "}to{" "}
                  <strong className="text-gray-800">
                    {Math.min(safePage * PAGE_SIZE, filteredWards.length)}
                  </strong>
                  {" "}of{" "}
                  <strong className="text-gray-800">
                    {filteredWards.length}
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

      {/* Create / Edit ward modal */}
      {wardFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={closeWardForm}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ward-form-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="ward-form-title"
                  className="text-lg font-bold text-gray-900"
                >
                  {editingWard ? "Edit ward" : "Add new ward"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Enter ward information below.
                </p>
              </div>

              <button
                type="button"
                onClick={closeWardForm}
                aria-label="Close ward form"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleWardSubmit} className="space-y-4 p-5">
              <Field label="Ward name *">
                <input
                  name="ward_name"
                  value={form.ward_name}
                  onChange={updateForm}
                  required
                  maxLength={150}
                  placeholder="e.g. Ward 12"
                  className={inputClass}
                />
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ward area or other relevant details"
                  className={inputClass}
                />
              </Field>

              <Field label="Ward location *">
                <p className="mb-2 text-xs text-gray-500">
                  Search for an area such as a city, village, district,
                  province, or capital. Street addresses may not have a
                  selectable boundary.
                </p>
                <div className="relative">
                  <MapPin
                    size={17}
                    className="pointer-events-none absolute left-3 top-3 text-gray-400"
                  />
                  <input
                    value={locationSearch}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLocationSearch(value);
                      setSelectedLocation(null);
                      setForm((previous) => ({
                        ...previous,
                        boundary_geojson: "",
                        location_name: value,
                      }));
                    }}
                    required
                    minLength={3}
                    maxLength={200}
                    autoComplete="off"
                    placeholder="Search a city, village, town, or district"
                    className={`${inputClass} pl-10`}
                  />
                  {locationSearchLoading && (
                    <LoaderCircle
                      size={17}
                      className="absolute right-3 top-3 animate-spin text-emerald-600"
                    />
                  )}
                </div>

                {locationResults.length > 0 && (
                  <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                    {locationResults.map((location) => {
                      const hasAreaBoundary =
                        location.geometry &&
                        ["Polygon", "MultiPolygon"].includes(
                          location.geometry.type,
                        );

                      return (
                        <li key={location.id}>
                          <button
                            type="button"
                            onClick={() => selectLocation(location)}
                            className="w-full border-b border-gray-100 px-3.5 py-3 text-left last:border-0 hover:bg-emerald-50"
                          >
                            <span className="block text-sm font-medium text-gray-800">
                              {location.name}
                            </span>
                            {hasAreaBoundary && (
                              <span className="mt-1 block text-xs text-emerald-700">
                                Area boundary available
                              </span>
                            )}
                            {!hasAreaBoundary && (
                              <span className="mt-1 block text-xs text-amber-700">
                                Area boundary unavailable — choose another
                                result
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {locationSearch.length > 0 &&
                  locationSearch.trim().length < 3 && (
                    <span className="mt-1 block text-xs text-gray-500">
                      Enter at least 3 characters to search.
                    </span>
                  )}
                {locationSearchError && (
                  <span role="alert" className="mt-2 block text-sm text-red-700">
                    {locationSearchError}
                  </span>
                )}
                {selectedLocation && (
                  <span className="mt-2 block text-sm text-emerald-700">
                    Location selected. Its area boundary will be saved
                    automatically.
                  </span>
                )}
                {!selectedLocation &&
                  !locationSearchError &&
                  locationSearch.trim().length >= 3 &&
                  !locationSearchLoading &&
                  locationResults.length === 0 && (
                    <span className="mt-2 block text-sm text-amber-700">
                      No matching places found. Try a more specific name.
                    </span>
                  )}
                <span className="mt-2 block text-xs text-gray-500">
                  Search is provided by OpenStreetMap and includes places and
                  administrative areas. Saving requires an area boundary so
                  reports can be matched to this ward.
                </span>
              </Field>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={closeWardForm}
                  disabled={wardSaving}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={wardSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {wardSaving ? "Saving..." : editingWard ? "Save changes" : "Create ward"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ward details modal */}
      {detailsWard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={() => setDetailsWard(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ward-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="ward-details-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Ward details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Information and official assignment
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsWard(null)}
                aria-label="Close ward details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
                <div className="rounded-xl bg-white p-3 text-emerald-700">
                  <MapPin size={25} />
                </div>
                <div className="min-w-0">
                  <h3 className="break-words font-bold text-gray-900">
                    {getWardName(detailsWard)}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {detailsWard.description || "No description provided"}
                  </p>
                </div>
                <div className="ml-auto">
                  <BoundaryBadge
                    hasBoundary={Boolean(detailsWard.boundary_geojson)}
                  />
                </div>
              </div>

              <DetailRow
                label="Ward ID"
                value={getId(detailsWard)}
              />
              <DetailRow
                label="Description"
                value={detailsWard.description}
              />
              <DetailRow
                label="Location"
                value={<WardLocation ward={detailsWard} />}
              />
              <DetailRow
                label="Assigned official"
                value={getAssignedOfficialName(detailsWard, officials)}
              />
              <DetailRow
                label="Official ID"
                value={getOfficialId(detailsWard)}
              />
              <DetailRow
                label="Created"
                value={formatDate(detailsWard.created_at)}
              />
              <DetailRow
                label="Last updated"
                value={formatDate(detailsWard.updated_at)}
              />

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    const ward = detailsWard;
                    setDetailsWard(null);
                    openAssignment(ward);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  <UserCog size={17} />
                  Assign official
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const ward = detailsWard;
                    setDetailsWard(null);
                    openEditModal(ward);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Pencil size={17} />
                  Edit ward
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign / Reassign official modal */}
      {assignmentWard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={() => {
            if (!assignmentLoading) setAssignmentWard(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-title"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="assignment-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Assign ward to official
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getWardName(assignmentWard)}
                </p>
              </div>

              <button
                type="button"
                disabled={assignmentLoading}
                onClick={() => setAssignmentWard(null)}
                aria-label="Close assignment modal"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignment} className="space-y-5 p-5">
              <div className="rounded-xl bg-violet-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white p-2.5 text-violet-700">
                    <UserCog size={23} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      Official assignment
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Select an official responsible for this ward.
                    </p>
                  </div>
                </div>
              </div>

              <Field label="Select official">
                <select
                  value={assignmentOfficialId}
                  onChange={(event) =>
                    setAssignmentOfficialId(event.target.value)
                  }
                  disabled={officialsLoading || assignmentLoading}
                  className={inputClass}
                >
                  <option value="">Unassign official</option>

                  {officials.map((official) => (
                    <option
                      key={getId(official)}
                      value={String(getId(official))}
                      disabled={!isAssignableOfficial(official)}
                    >
                      {getOfficialName(official)}
                      {official.email ? ` — ${official.email}` : ""}
                      {!isAssignableOfficial(official)
                        ? ` (${getOfficialStatus(official)})`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {officialsLoading && (
                <p className="flex items-center gap-2 text-sm text-gray-500">
                  <LoaderCircle size={16} className="animate-spin" />
                  Loading officials...
                </p>
              )}

              {!officialsLoading && officials.length === 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No ward-official accounts were returned. Register an account
                  with the Ward Official role before assigning this ward.
                </p>
              )}
              {!officialsLoading &&
                officials.length > 0 &&
                !officials.some(isAssignableOfficial) && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    Ward-official accounts are listed above, but none are
                    active yet. Approve and activate an account before
                    assigning it to a ward.
                  </p>
                )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={assignmentLoading}
                  onClick={() => setAssignmentWard(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={assignmentLoading || officialsLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assignmentLoading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  Save assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteWard && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <Trash2 size={23} />
            </div>

            <h2 className="text-lg font-bold text-gray-900">
              Delete this ward?
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              You are about to delete{" "}
              <strong>{getWardName(deleteWard)}</strong>. This action may
              be blocked by the backend if reports or other records depend
              on this ward.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteWard(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteLoading && (
                  <LoaderCircle size={16} className="animate-spin" />
                )}
                Delete ward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid grid-cols-[125px_minmax(0,1fr)] gap-3 border-b border-gray-100 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="break-words text-sm font-medium text-gray-800">
        {value === null || value === undefined || value === ""
          ? "—"
          : typeof value === "string" || typeof value === "number"
            ? String(value)
            : value}
      </span>
    </div>
  );
}

export default WardManagement;
