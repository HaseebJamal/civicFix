import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import api from "../../api/axios.js";
import { socket } from "../../socket/socket.js";
import { useSocket } from "../../hooks/useSocket.js";

const center = [31.4504, 73.135];

/*
|--------------------------------------------------------------------------
| Normalize API response
|--------------------------------------------------------------------------
*/

const normalizeReports = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.reports)) return data.reports;

  return [];
};

/*
|--------------------------------------------------------------------------
| Validate report coordinates
|--------------------------------------------------------------------------
*/

const hasCoordinates = (report) => {
  const lat = Number(report?.latitude);
  const lng = Number(report?.longitude);

  return (
    report?.latitude != null &&
    report?.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
};

/*
|--------------------------------------------------------------------------
| Report marker icon based on status
|--------------------------------------------------------------------------
*/

const getIssueIcon = (status) => {
  const normalizedStatus = String(status || "pending")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .trim();

  let color = "#dc2626";

  if (["resolved", "completed", "closed"].includes(normalizedStatus)) {
    color = "#16a34a";
  } else if (
    ["in progress", "inprogress", "processing"].includes(normalizedStatus)
  ) {
    color = "#f59e0b";
  } else if (["under review", "review"].includes(normalizedStatus)) {
    color = "#2563eb";
  }

  return L.divIcon({
    className: "civifix-marker-wrapper",

    html: `
      <div style="
        width: 30px;
        height: 30px;
        box-sizing: border-box;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      ">
        <div style="
          width: 8px;
          height: 8px;
          margin: 8px;
          background: white;
          border-radius: 50%;
        "></div>
      </div>
    `,

    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
};

/*
|--------------------------------------------------------------------------
| Automatically fit map to reports
|--------------------------------------------------------------------------
*/

const FitReports = ({ reports }) => {
  const map = useMap();

  useEffect(() => {
    if (reports.length === 0) return;

    const points = reports
      .filter(hasCoordinates)
      .map((report) => [
        Number(report.latitude),
        Number(report.longitude),
      ]);

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
      });
    }
  }, [reports, map]);

  return null;
};

/*
|--------------------------------------------------------------------------
| Map View
|--------------------------------------------------------------------------
*/

const MapView = ({
  mapHeightClassName = "h-[350px] w-full sm:h-[450px] lg:h-[500px]",
}) => {
  /*
  |--------------------------------------------------------------------------
  | Socket connection
  |--------------------------------------------------------------------------
  */

  const { connectionError } = useSocket(true);

  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Fetch + Socket listeners
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    /*
    |--------------------------------------------------------------------------
    | Add new report OR update existing report
    |--------------------------------------------------------------------------
    */

    const mergeReport = (report) => {
      if (!report?.id) {
        console.warn("Socket report has no ID:", report);
        return;
      }

      setReports((previous) => {
        const exists = previous.some(
          (item) => String(item.id) === String(report.id)
        );

        /*
        |--------------------------------------------------------------------------
        | Existing report
        |--------------------------------------------------------------------------
        */

        if (exists) {
          return previous
            .map((item) =>
              String(item.id) === String(report.id)
                ? {
                    ...item,
                    ...report,
                  }
                : item
            )
            .filter(hasCoordinates);
        }

        /*
        |--------------------------------------------------------------------------
        | New report
        |--------------------------------------------------------------------------
        */

        return [report, ...previous].filter(hasCoordinates);
      });
    };

    /*
    |--------------------------------------------------------------------------
    | NEW_REPORT
    |--------------------------------------------------------------------------
    */

    const handleNewReport = (payload) => {
      const report = payload?.report ?? payload;

      console.log("🟢 SOCKET NEW REPORT:", report);

      mergeReport(report);
    };

    /*
    |--------------------------------------------------------------------------
    | REPORT_STATUS_UPDATED
    |--------------------------------------------------------------------------
    */

    const handleReportStatusUpdated = (payload) => {
      const report = payload?.report ?? payload;

      console.log("🟡 SOCKET REPORT STATUS UPDATED:", report);

      mergeReport(report);
    };

    /*
    |--------------------------------------------------------------------------
    | REPORT_DELETED
    |--------------------------------------------------------------------------
    */

    const handleReportDeleted = (payload) => {
      const reportId = payload?.id ?? payload?.reportId;

      if (!reportId) {
        console.warn(
          "Socket delete event received without report ID:",
          payload
        );
        return;
      }

      console.log("🔴 SOCKET REPORT DELETED:", reportId);

      setReports((previous) =>
        previous.filter(
          (report) => String(report.id) !== String(reportId)
        )
      );
    };

    /*
    |--------------------------------------------------------------------------
    | Fetch initial reports
    |--------------------------------------------------------------------------
    */

    const fetchReports = async () => {
      try {
        setLoading(true);

        const response = await api.get("/reports");

        const allReports = normalizeReports(response);

        const validReports = allReports.filter(hasCoordinates);

        console.log("📡 Reports API response:", response.data);
        console.log("📊 Total reports:", allReports.length);
        console.log(
          "📍 Reports with coordinates:",
          validReports.length
        );

        if (mounted) {
          setReports(validReports);
          setError("");
        }
      } catch (err) {
        console.error(
          "❌ Failed to fetch reports:",
          err.response?.data || err.message
        );

        if (mounted) {
          setError(
            "Unable to Load Reports . API response check."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    /*
    |--------------------------------------------------------------------------
    | Socket listeners
    |--------------------------------------------------------------------------
    */

    socket.on("NEW_REPORT", handleNewReport);

    socket.on(
      "REPORT_STATUS_UPDATED",
      handleReportStatusUpdated
    );

    socket.on(
      "REPORT_DELETED",
      handleReportDeleted
    );

    /*
    |--------------------------------------------------------------------------
    | Initial API request
    |--------------------------------------------------------------------------
    */

    fetchReports();

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */

    return () => {
      mounted = false;

      socket.off(
        "NEW_REPORT",
        handleNewReport
      );

      socket.off(
        "REPORT_STATUS_UPDATED",
        handleReportStatusUpdated
      );

      socket.off(
        "REPORT_DELETED",
        handleReportDeleted
      );
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {/* <span>Real-time updates:</span> */}
          {/* <span
            role="status"
            aria-live="polite"
            className={`rounded-full px-2.5 py-1 font-semibold ${connectionStatusClass}`}
          >
            {connectionStatus === "connected"
              ? "Connected"
              : connectionStatus === "connecting"
              ? "Connecting..."
              : connectionStatus === "error"
              ? "Connection failed"
              : "Disconnected"}
          </span> */}
        </div>

        {connectionError && (
          <div className="text-xs text-red-500">
            {connectionError}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <p className="px-4 pb-3 text-sm text-gray-500">
          Loading reports...
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="px-4 pb-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Empty state */}
      {!loading &&
        !error &&
        reports.length === 0 && (
          <p className="px-4 pb-3 text-sm text-gray-500">
            No reports with valid coordinates are available.
          </p>
        )}

      {/* Map */}
      <div
        className={`relative z-0 min-w-0 overflow-hidden ${mapHeightClassName}`}
      >
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitReports reports={reports} />

          {reports.map((report) => (
            <Marker
              key={report.id}
              position={[
                Number(report.latitude),
                Number(report.longitude),
              ]}
              icon={getIssueIcon(report.status)}
            >
              <Popup>
                <div className="max-w-56 space-y-1">
                  <h3 className="font-semibold">
                    {report.category || "Civic Issue"}
                  </h3>

                  <p>
                    {report.description ||
                      "No description available"}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {report.status || "Pending"}
                  </p>

                  {report.address && (
                    <p>
                      <strong>Location:</strong>{" "}
                      {report.address}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 border-t border-gray-200 px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-600" />
          Pending
        </span>

        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
          In Progress
        </span>

        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-green-600" />
          Resolved
        </span>
      </div>
    </section>
  );
};

export default MapView;