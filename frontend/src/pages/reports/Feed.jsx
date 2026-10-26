import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/axios";
import { ReportModel } from "../../components/reports/ReportModel";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const getProfileImageUrl = (image) => {
  if (!image) return null;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_BASE_URL.replace(/\/$/, "")}/${image.replace(/^\//, "")}`;
};

const NEARBY_RADIUS_KM = 10;

const getDistanceInKm = (first, second) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = toRadians(second.lat - first.lat);
  const longitudeDifference = toRadians(second.lng - first.lng);
  const haversine = Math.min(
    1,
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(longitudeDifference / 2) ** 2,
  );

  return (
    6371 *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

export const Feed = () => {
  const { locationPermission, setLocationPermission } = useAuth();
  const locationRequestStarted = useRef(false);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [commentsByReport, setCommentsByReport] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const fetchReports = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const params = {};
      if (locationPermission.status === "granted") {
        params.lat = locationPermission.coordinates.lat;
        params.lng = locationPermission.coordinates.lng;
        params.radius = NEARBY_RADIUS_KM;
      }

      const response = await api.get("/reports", { params });

      const data = response.data?.data;
      const reportList = Array.isArray(data) ? data : [];
      if (locationPermission.status === "granted") {
        const { lat, lng } = locationPermission.coordinates;
        setReports(
          reportList.filter((report) => {
            const reportLat = Number(report.latitude);
            const reportLng = Number(report.longitude);
            if (!Number.isFinite(reportLat) || !Number.isFinite(reportLng)) {
              return false;
            }

            return (
              getDistanceInKm(
                { lat, lng },
                { lat: reportLat, lng: reportLng },
              ) <= NEARBY_RADIUS_KM
            );
          }),
        );
      } else {
        setReports(reportList);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Unable to fetch reports.");
    } finally {
      setLoading(false);
    }
  }, [locationPermission]);

  useEffect(() => {
    if (locationPermission.status === "unrequested") {
      locationRequestStarted.current = false;
    }
  }, [locationPermission.status]);

  useEffect(() => {
    if (
      locationPermission.status !== "unrequested" ||
      locationRequestStarted.current
    ) {
      return;
    }

    locationRequestStarted.current = true;
    if (!navigator.geolocation) {
      setLocationPermission({ status: "denied", coordinates: null });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationPermission({
          status: "granted",
          coordinates: { lat: coords.latitude, lng: coords.longitude },
        });
      },
      () => {
        setLocationPermission({ status: "denied", coordinates: null });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, [locationPermission.status, setLocationPermission]);

  useEffect(() => {
    if (
      locationPermission.status !== "granted" &&
      locationPermission.status !== "denied"
    ) {
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) fetchReports();
    });

    return () => {
      cancelled = true;
    };
  }, [fetchReports, locationPermission.status]);

  const getStatusStyle = (status) => {
    switch ((status || "pending").toLowerCase()) {
      case "resolved":
        return "bg-green-100 text-green-700";
      case "in_progress":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-red-100 text-red-700";
    }
  };

  const formatDate = (date) => {
    if (!date) return "Recently";

    const parsedDate = new Date(date);

    return Number.isNaN(parsedDate.getTime())
      ? "Recently"
      : parsedDate.toLocaleString();
  };

  const getReportId = (item) => item.id || item.report_id;

  const handleUpvote = async (item) => {
    const reportId = getReportId(item);

    if (!reportId || actionLoading[reportId]) return;

    const wasLiked = item.has_upvoted === true || item.has_upvoted === "true";

    // Update the UI immediately, like Facebook.
    setReports((prev) =>
      prev.map((report) => {
        if (getReportId(report) !== reportId) return report;

        return {
          ...report,
          has_upvoted: !wasLiked,
          upvotes_count: Math.max(
            0,
            Number(report.upvotes_count || 0) + (wasLiked ? -1 : 1),
          ),
        };
      }),
    );

    setActionLoading((prev) => ({ ...prev, [reportId]: true }));

    try {
      if (wasLiked) {
        await api.delete(`/reports/${reportId}/upvotes`);
      } else {
        await api.post(`/reports/${reportId}/upvotes`);
      }
    } catch (err) {
      // Restore the server's actual state if the request fails.
      await fetchReports();

      setError(err.response?.data?.message || "Unable to update your like.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const toggleComments = async (item) => {
    const reportId = getReportId(item);
    if (!reportId) return;

    const willOpen = !openComments[reportId];

    setOpenComments((prev) => ({
      ...prev,
      [reportId]: willOpen,
    }));

    if (!willOpen || commentsByReport[reportId]) return;

    setCommentLoading((prev) => ({
      ...prev,
      [reportId]: true,
    }));

    try {
      const response = await api.get(`/reports/${reportId}/comments`);

      const data = response.data?.data;
      setCommentsByReport((prev) => ({
        ...prev,
        [reportId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      setCommentsByReport((prev) => ({
        ...prev,
        [reportId]: [],
      }));

      setError(
        err.response?.data?.message ||
          "Unable to load comments. Check the comments GET route.",
      );
    } finally {
      setCommentLoading((prev) => ({
        ...prev,
        [reportId]: false,
      }));
    }
  };

  const handleCommentSubmit = async (item) => {
    const reportId = getReportId(item);
    const content = (commentDrafts[reportId] || "").trim();

    if (!reportId || !content || commentLoading[reportId]) return;

    setCommentLoading((prev) => ({
      ...prev,
      [reportId]: true,
    }));

    try {
      const response = await api.post(`/reports/${reportId}/comments`, {
        content,
      });

      const newComment = response.data?.data;

      if (newComment) {
        setCommentsByReport((prev) => ({
          ...prev,
          [reportId]: [
            ...(prev[reportId] || []),
            {
              ...newComment,
              username:
                newComment.username || newComment.first_name || "Citizen",
            },
          ],
        }));
      }

      setCommentDrafts((prev) => ({
        ...prev,
        [reportId]: "",
      }));
      await fetchReports();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to add your comment.");
    } finally {
      setCommentLoading((prev) => ({
        ...prev,
        [reportId]: false,
      }));
    }
  };

  return (
    <section className="mx-auto w-full max-w-lg space-y-4">
      {/* Create Report */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <ReportModel />
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
          Loading community reports...
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-red-600">{error}</p>

          <button
            type="button"
            onClick={() => fetchReports()}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty Feed */}
      {!loading && !error && reports.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🏙️</div>
          <h3 className="mt-3 font-semibold text-gray-800">No reports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Be the first to report an issue in your community.
          </p>
        </div>
      )}

      {/* Report Posts */}

      {!loading &&
        !error &&
        reports.map((item) => (
          <article
            key={item.id || item.report_id}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-blue-100">
                  {item.profile_image ? (
                    <img
                      src={getProfileImageUrl(item.profile_image)}
                      alt={item.username || "Citizen profile"}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">
                      👤
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-gray-900">
                    {item.user_name ||
                      [item.first_name, item.last_name]
                        .filter(Boolean)
                        .join("") ||
                      item.full_name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {formatDate(item.created_at ?? item.createdAt)} · 🌐
                  </p>
                  {(item.address || item.user_address) && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      📍 {item.address || item.user_address}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label="Post options"
                className="rounded-full px-3 py-1 text-2xl leading-none text-gray-500 hover:bg-gray-100"
              >
                ⋯
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium capitalize text-blue-700">
                {item.category}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}
              >
                {item.status}
              </span>
            </div>
            {item.description && (
              <div className="px-4 pb-4">
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                  {item.description}
                </p>
              </div>
            )}

            {/* Report Images */}
            {Array.isArray(item.images) && item.images.length > 0 && (
              <div className="w-full overflow-hidden">
                {item.images.length === 1 ? (
                  <div className="flex h-[280px] w-full items-center justify-center overflow-hidden bg-gray-50 sm:h-[360px]">
                    <img
                      src={getProfileImageUrl(item.images[0].image_url)}
                      alt="Reported civic issue"
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="grid h-[280px] w-full grid-cols-2 gap-1 overflow-hidden bg-gray-50 sm:h-[360px]">
                    {item.images.slice(0, 4).map((image, index) => (
                      <div
                        key={`${image.image_url}-${index}`}
                        className="relative min-h-0 min-w-0 overflow-hidden"
                      >
                        <img
                          src={getProfileImageUrl(image.image_url)}
                          alt={`Reported civic issue ${index + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />

                        {index === 3 && item.images.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
                            +{item.images.length - 4}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Post Actions */}

            <div className="mx-4 border-t border-gray-200 py-1">
              <div className="grid grid-cols-3 gap-1">
                {/* Like / Unlike */}
                <button
                  type="button"
                  onClick={() => handleUpvote(item)}
                  disabled={!!actionLoading[getReportId(item)]}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition hover:bg-gray-100 disabled:opacity-50 ${
                    item.has_upvoted ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={item.has_upvoted ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.5l5-7a2 2 0 0 1 2.5 2.88Z" />
                  </svg>

                  <span>{item.has_upvoted ? "Like" : "Like"}</span>
                  <span>{item.upvotes_count ?? 0}</span>
                </button>

                {/* Comment */}
                <button
                  type="button"
                  onClick={() => toggleComments(item)}
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
                  </svg>

                  <span>Comment</span>
                  <span>{item.comments_count ?? 0}</span>
                </button>

                {/* Share */}
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
                  onClick={() => {
                    const url = `${window.location.origin}/map`;

                    if (navigator.share) {
                      navigator
                        .share({
                          title: "CivicFix Reports",
                          text:
                            item.description ||
                            "View this civic issue on CivicFix",
                          url,
                        })
                        .catch(() => {
                          console.log("Unable to share report");
                        });
                    } else {
                      navigator.clipboard?.writeText(url);
                    }
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
                  </svg>

                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Facebook-style Comments Panel */}
            {openComments[getReportId(item)] && (
              <div className="border-t border-gray-100 bg-white px-4 py-3">
                {/* Comments list */}
                <div className="max-h-80 space-y-4 overflow-y-auto">
                  {commentLoading[getReportId(item)] &&
                    !commentsByReport[getReportId(item)] && (
                      <p className="py-2 text-center text-sm text-gray-500">
                        Loading comments...
                      </p>
                    )}

                  {!commentLoading[getReportId(item)] &&
                    (commentsByReport[getReportId(item)] || []).length ===
                      0 && (
                      <p className="py-2 text-center text-sm text-gray-500">
                        No comments yet. Start the conversation!
                      </p>
                    )}

                  {(commentsByReport[getReportId(item)] || []).map(
                    (comment) => (
                      <div
                        key={comment.id}
                        className="flex items-start gap-2.5"
                      >
                        {/* Commenter's profile */}
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-200">
                          {comment.profile_image ? (
                            <img
                              src={getProfileImageUrl(comment.profile_image)}
                              alt={comment.username || "User"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm">
                              👤
                            </div>
                          )}
                        </div>

                        {/* Comment bubble */}
                        <div className="min-w-0 rounded-2xl bg-gray-100 px-3.5 py-2">
                          <p className="text-xs font-semibold text-gray-900">
                            {[comment.first_name, comment.last_name]
                              .filter(Boolean)
                              .join(" ") ||
                              comment.username ||
                              "Citizen"}
                          </p>

                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                            {comment.content}
                          </p>

                          <p className="mt-1 text-[11px] text-gray-500">
                            {formatDate(comment.created_at)}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>

                {/* Add comment */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCommentSubmit(item);
                  }}
                  className="mt-4 flex items-end gap-2"
                >
                  <div className="flex-1">
                    <textarea
                      rows={1}
                      value={commentDrafts[getReportId(item)] || ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [getReportId(item)]: e.target.value,
                        }))
                      }
                      placeholder="Write a comment..."
                      className="max-h-28 min-h-10 w-full resize-y rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={
                      !(commentDrafts[getReportId(item)] || "").trim() ||
                      !!commentLoading[getReportId(item)]
                    }
                    className="mb-0.5 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {commentLoading[getReportId(item)] ? "Sending..." : "Post"}
                  </button>
                </form>
              </div>
            )}
          </article>
        ))}
    </section>
  );
};
