import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw } from "lucide-react";
import api from "../../api/axios.js";

const FALLBACK_CENTER = [31.4504, 73.135];

const normalizeReports = (response) => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.reports)) return data.reports;
  return [];
};

const parseBoundary = (value) => {
  if (!value) return null;
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const getGeometry = (boundary) =>
  boundary?.type === "Feature" ? boundary.geometry : boundary;

const isPointOnSegment = (point, start, end) => {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);

  if (Math.abs(cross) > 1e-10) return false;

  return (
    x >= Math.min(x1, x2) - 1e-10 &&
    x <= Math.max(x1, x2) + 1e-10 &&
    y >= Math.min(y1, y2) - 1e-10 &&
    y <= Math.max(y1, y2) + 1e-10
  );
};

const isPointInRing = (point, ring) => {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const start = ring[previous];
    const end = ring[index];

    if (isPointOnSegment(point, start, end)) return true;

    const [x, y] = point;
    const [x1, y1] = start;
    const [x2, y2] = end;
    const intersects =
      y1 > y !== y2 > y &&
      x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1;

    if (intersects) inside = !inside;
  }

  return inside;
};

const isPointInPolygon = (point, polygon) => {
  if (!polygon?.length || !isPointInRing(point, polygon[0])) return false;

  return !polygon.slice(1).some((hole) => isPointInRing(point, hole));
};

const isPointInGeometry = (point, geometry) => {
  if (geometry?.type === "Polygon") {
    return isPointInPolygon(point, geometry.coordinates);
  }

  if (geometry?.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) =>
      isPointInPolygon(point, polygon),
    );
  }

  if (geometry?.type === "GeometryCollection") {
    return geometry.geometries.some((shape) =>
      isPointInGeometry(point, shape),
    );
  }

  return false;
};

const hasCoordinates = (report) => {
  const latitude = Number(report?.latitude);
  const longitude = Number(report?.longitude);

  return (
    report?.latitude != null &&
    report?.longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
};

const getMarkerIcon = (status) => {
  const normalizedStatus = String(status || "pending")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();
  const color =
    ["resolved", "completed", "closed"].includes(normalizedStatus)
      ? "#16a34a"
      : ["in progress", "inprogress", "processing"].includes(normalizedStatus)
        ? "#f59e0b"
        : "#dc2626";

  return L.divIcon({
    className: "ward-report-marker",
    html: `<span style="display:block;width:24px;height:24px;border:3px solid #fff;border-radius:50% 50% 50% 0;background:${color};box-shadow:0 2px 6px #0005;transform:rotate(-45deg)"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -22],
  });
};

const FitWardMap = ({ boundary, reports }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(boundary).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      return;
    }

    const points = reports
      .filter(hasCoordinates)
      .map((report) => [Number(report.latitude), Number(report.longitude)]);

    if (points.length) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [24, 24],
        maxZoom: 15,
      });
    }
  }, [boundary, map, reports]);

  return null;
};

const WardOfficialMap = () => {
  const [ward, setWard] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestWardMapData = useCallback(async () => {
    const wardResponse = await api.get("/wards/my-ward");
    const assignedWard = wardResponse?.data?.data;

    if (!assignedWard?.id) {
      throw new Error("No ward is assigned to your account. Contact a superadmin.");
    }

    const parsedBoundary = parseBoundary(assignedWard.boundary_geojson);
    const geometry = getGeometry(parsedBoundary);

    if (
      !parsedBoundary ||
      !["Polygon", "MultiPolygon", "GeometryCollection"].includes(
        geometry?.type,
      )
    ) {
      throw new Error("Your ward does not have a valid map boundary configured.");
    }

    const reportsResponse = await api.get(`/reports/ward/${assignedWard.id}`);

    return {
      ward: { ...assignedWard, boundary: parsedBoundary },
      reports: normalizeReports(reportsResponse),
    };
  }, []);

  useEffect(() => {
    let active = true;

    requestWardMapData()
      .then(({ ward: assignedWard, reports: wardReports }) => {
        if (!active) return;
        setWard(assignedWard);
        setReports(wardReports);
        setError("");
      })
      .catch((requestError) => {
        console.error("Failed to load ward map:", requestError);
        if (!active) return;
        setWard(null);
        setReports([]);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load your ward map.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [requestWardMapData]);

  const refreshWardMap = () => {
    setLoading(true);
    setError("");

    requestWardMapData()
      .then(({ ward: assignedWard, reports: wardReports }) => {
        setWard(assignedWard);
        setReports(wardReports);
      })
      .catch((requestError) => {
        console.error("Failed to refresh ward map:", requestError);
        setWard(null);
        setReports([]);
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load your ward map.",
        );
      })
      .finally(() => setLoading(false));
  };

  const reportsInBoundary = useMemo(() => {
    const geometry = getGeometry(ward?.boundary);
    if (!geometry) return [];

    return reports.filter((report) => {
      if (!hasCoordinates(report)) return false;
      return isPointInGeometry(
        [Number(report.longitude), Number(report.latitude)],
        geometry,
      );
    });
  }, [reports, ward]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
            <MapPin size={16} />
            Ward operations
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            {ward?.ward_name || "Ward map"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Reports are shown only when their locations fall within your ward boundary.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshWardMap}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <p role="status" className="text-sm text-gray-500">
          Loading your ward boundary and reports...
        </p>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <h2 className="font-semibold text-gray-900">
              Reports inside ward boundary
            </h2>
            <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-800">
              {reportsInBoundary.length}{" "}
              {reportsInBoundary.length === 1 ? "report" : "reports"}
            </span>
          </div>

          <div className="relative z-0 h-[55vh] min-h-[360px] w-full">
            <MapContainer
              center={FALLBACK_CENTER}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {ward?.boundary && (
                <>
                  <GeoJSON
                    data={ward.boundary}
                    style={{
                      color: "#15803d",
                      weight: 3,
                      opacity: 0.9,
                      fillColor: "#22c55e",
                      fillOpacity: 0.12,
                    }}
                  />
                  <FitWardMap
                    boundary={ward.boundary}
                    reports={reportsInBoundary}
                  />
                </>
              )}
              {reportsInBoundary.map((report) => (
                <Marker
                  key={report.id}
                  position={[
                    Number(report.latitude),
                    Number(report.longitude),
                  ]}
                  icon={getMarkerIcon(report.status)}
                >
                  <Popup>
                    <div className="max-w-60 space-y-1">
                      <h3 className="font-semibold">
                        {report.category || "Civic issue"}
                      </h3>
                      <p>{report.description || "No description available."}</p>
                      <p>
                        <strong>Status:</strong> {report.status || "Pending"}
                      </p>
                      {report.address && (
                        <p>
                          <strong>Location:</strong> {report.address}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-600" />
              Pending
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500" />
              In progress
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-600" />
              Resolved
            </span>
          </div>
        </div>
      )}
    </section>
  );
};

export default WardOfficialMap;
