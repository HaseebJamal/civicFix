import { useState, useEffect, useCallback } from "react";
import api from "../../api/axios";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const getImageUrl = (image) => {
  if (typeof image !== "string" || !image.trim()) return null;

  const value = image.trim();

  if (/^(https?:\/\/|data:|blob:)/i.test(value)) {
    return value;
  }

  // Absolute path on the same backend host
  if (value.startsWith("/")) {
    try {
      const base = new URL(API_BASE_URL);
      return `${base.origin}${value}`;
    } catch {
      return value;
    }
  }

  return `${API_BASE_URL}/${value}`;
};

const getReportId = (item) =>
  item?.id ?? item?.report_id ?? item?.report?.id ?? null;

const getStatusStyle = (status) => {
  switch ((status || "pending").toLowerCase().replace(/[\s-]+/g, "_")) {
    case "resolved":
      return "bg-green-100 text-green-700";
    case "in_progress":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-red-100 text-red-700";
  }
};

const getStatusLabel = (status) => {
  const value = (status || "pending").replace(/[_-]+/g, " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = (date) => {
  if (!date) return "Recently";

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? "Recently" : parsed.toLocaleString();
};

const getErrorMessage = (err, fallback) =>
  err.response?.data?.message || fallback;

const isUpvoted = (value) => value === true || value === "true" || value === 1;

const getDisplayName = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
  user?.username ||
  user?.user_name ||
  user?.full_name ||
  "Citizen";
const Avatar = ({ image, name, size = "h-11 w-11" }) => {
  const [failed, setFailed] = useState(false);
  const imageUrl = getImageUrl(image);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <div
      className={`${size} relative shrink-0 overflow-hidden rounded-full bg-blue-100`}
    >
      <div className="absolute inset-0 flex items-center justify-center text-lg">
        👤
      </div>

      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt={name || "Citizen"}
          className="relative z-10 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export const CitizenReports = () => {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [commentsByReport, setCommentsByReport] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  // GET /reports/my
  const fetchReports = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const response = await api.get("/reports/my");
      const data = response.data?.data;

      if (!Array.isArray(data)) {
        throw new Error("Unexpected reports API response.");
      }

      setReports(data);
      setError("");
    } catch (err) {
      console.error("Unable to fetch reports:", err);
      setError(getErrorMessage(err, "Unable to fetch reports."));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Load comments. Used by both initial load and Retry.
  const loadComments = async (reportId) => {
    if (!reportId || commentsLoading[reportId]) return;

    setCommentsLoading((prev) => ({
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
      console.error("Unable to fetch comments:", err);
      setError(getErrorMessage(err, "Unable to load comments."));
    } finally {
      setCommentsLoading((prev) => ({
        ...prev,
        [reportId]: false,
      }));
    }
  };

  // Like / unlike report
  const handleUpvote = async (item) => {
    const reportId = getReportId(item);

    if (!reportId || actionLoading[reportId]) return;

    const wasLiked = isUpvoted(item.has_upvoted);

    setActionLoading((prev) => ({
      ...prev,
      [reportId]: true,
    }));

    // Optimistic UI update
    setReports((prev) =>
      prev.map((report) => {
        if (String(getReportId(report)) !== String(reportId)) {
          return report;
        }

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

    try {
      if (wasLiked) {
        await api.delete(`/reports/${reportId}/upvotes`);
      } else {
        await api.post(`/reports/${reportId}/upvotes`);
      }

      setError("");
    } catch (err) {
      console.error("Unable to update upvote:", err);

      // Restore the actual database state
      await fetchReports(false);
      setError(getErrorMessage(err, "Unable to update your upvote."));
    } finally {
      setActionLoading((prev) => ({
        ...prev,
        [reportId]: false,
      }));
    }
  };

  // Open / close comments
  const toggleComments = async (item) => {
    const reportId = getReportId(item);

    if (!reportId) return;

    const willOpen = !openComments[reportId];

    setOpenComments((prev) => ({
      ...prev,
      [reportId]: willOpen,
    }));

    if (!willOpen) return;

    // Load only if comments have not been loaded yet
    if (commentsByReport[reportId] === undefined) {
      await loadComments(reportId);
    }
  };

  // Submit comment
  const handleCommentSubmit = async (event, item) => {
    event.preventDefault();

    const reportId = getReportId(item);
    if (!reportId || commentSubmitting[reportId]) return;

    const content = (commentDrafts[reportId] || "").trim();
    if (!content) return;

    setCommentSubmitting((prev) => ({
      ...prev,
      [reportId]: true,
    }));

    try {
      const response = await api.post(`/reports/${reportId}/comments`, {
        content,
      });

      const result = response.data?.data;

      // Support either a single comment or an array response
      const newComment = Array.isArray(result) ? result[0] : result;

      if (newComment) {
        setCommentsByReport((prev) => ({
          ...prev,
          [reportId]: [...(prev[reportId] || []), newComment],
        }));
      } else {
        // If the backend does not return the inserted comment,
        // fetch the latest comments instead.
        await loadComments(reportId);
      }

      setCommentDrafts((prev) => ({
        ...prev,
        [reportId]: "",
      }));

      setError("");

      // Refresh counts without hiding the feed
      await fetchReports(false);
    } catch (err) {
      console.error("Unable to submit comment:", err);
      setError(getErrorMessage(err, "Unable to add your comment."));
    } finally {
      setCommentSubmitting((prev) => ({
        ...prev,
        [reportId]: false,
      }));
    }
  };

  // Share report link
  const handleShare = async (item) => {
    const reportId = getReportId(item);
    const shareUrl = new URL("/map", window.location.origin);

    if (reportId) {
      shareUrl.searchParams.set("reportId", reportId);
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "CivicFix Report",
          text: item.description || "View this civic issue on CivicFix",
          url: shareUrl.toString(),
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl.toString());
        window.alert("Report link copied!");
      } else {
        window.prompt("Copy this report link:", shareUrl.toString());
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Unable to share report:", err);
      }
    }
  };

  return (
    <section className=" w-full max-w-lg space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-white p-4"
        >
          <p className="text-sm text-red-600">{error}</p>

          <button
            type="button"
            onClick={() => fetchReports()}
            className="mt-2 text-sm font-semibold text-blue-600 hover:underline"
          >
            Refresh reports
          </button>
        </div>
      )}

      {loading && (
        <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
          Loading reports...
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">🏙️</div>
          <h3 className="mt-3 font-semibold text-gray-800">No reports yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your submitted reports will appear here.
          </p>
        </div>
      )}

      {!loading &&
        reports.map((item, index) => {
          const reportId = getReportId(item);
          const liked = isUpvoted(item.has_upvoted);

          const comments = commentsByReport[reportId] || [];
          const images = Array.isArray(item.images) ? item.images : [];

          const username = getDisplayName(item);
          const displayAddress = item.address || item.user_address;

          return (
            <article
              key={reportId ?? `report-${index}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Report author and date */}
              <div className="flex items-center gap-3 p-4">
                <Avatar image={item.profile_image} name={username} />

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900">
                    {username}
                  </h3>

                  <p className="text-xs text-gray-500">
                    {formatDate(item.created_at)}
                  </p>

                  {displayAddress && (
                    <p className="mt-1 truncate text-xs text-gray-500">
                      📍 {displayAddress}
                    </p>
                  )}
                </div>
              </div>

              {/* Category and status */}
              <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium capitalize text-blue-700">
                  {item.category || "General"}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}
                >
                  {getStatusLabel(item.status)}
                </span>
              </div>

              {/* Description */}
              {item.description && (
                <div className="px-4 pb-4">
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">
                    {item.description}
                  </p>
                </div>
              )}

              {/* Report images */}
              {images.length > 0 && (
                <div
                  className={`grid gap-1 overflow-hidden bg-gray-50 ${
                    images.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {images.slice(0, 4).map((image, imageIndex) => {
                    const imageUrl = getImageUrl(image.image_url);

                    return (
                      <div
                        key={image.id ?? `${image.image_url}-${imageIndex}`}
                        className={`relative h-48 overflow-hidden bg-gray-100 sm:h-64 ${
                          images.length === 3 && imageIndex === 0
                            ? "col-span-2"
                            : ""
                        }`}
                      >
                        {imageUrl && (
                          <img
                            src={imageUrl}
                            alt={`Reported issue ${imageIndex + 1}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}

                        {imageIndex === 3 && images.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
                            +{images.length - 4}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="mx-4 border-t border-gray-200 py-1">
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => handleUpvote(item)}
                    disabled={!reportId || !!actionLoading[reportId]}
                    aria-pressed={liked}
                    className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 ${
                      liked ? "text-blue-600" : "text-gray-600"
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

                  <button
                    type="button"
                    onClick={() => toggleComments(item)}
                    disabled={!reportId}
                    aria-expanded={!!openComments[reportId]}
                    className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {" "}
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
                    <span> Comment</span>
                    <span>{item.comments_count ?? comments.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleShare(item)}
                    className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100"
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

                    <span> Share</span>
                  </button>
                </div>
              </div>

              {/* Comments */}
              {openComments[reportId] && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="max-h-80 space-y-4 overflow-y-auto">
                    {commentsLoading[reportId] && (
                      <p className="py-2 text-center text-sm text-gray-500">
                        Loading comments...
                      </p>
                    )}

                    {!commentsLoading[reportId] &&
                      commentsByReport[reportId] === undefined && (
                        <div className="py-2 text-center">
                          <p className="text-sm text-red-600">
                            Comments could not be loaded.
                          </p>

                          <button
                            type="button"
                            onClick={() => loadComments(reportId)}
                            className="mt-1 text-sm font-medium text-blue-600 hover:underline"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                    {!commentsLoading[reportId] &&
                      commentsByReport[reportId] !== undefined &&
                      comments.length === 0 && (
                        <p className="py-2 text-center text-sm text-gray-500">
                          No comments yet. Start the conversation!
                        </p>
                      )}

                    {comments.map((comment, commentIndex) => {
                      const commentUsername = getDisplayName(comment);

                      return (
                        <div
                          key={
                            comment.id ?? `${reportId}-comment-${commentIndex}`
                          }
                          className="flex items-start gap-2.5"
                        >
                          <Avatar
                            image={comment.profile_image}
                            name={commentUsername}
                            size="h-9 w-9"
                          />

                          <div className="min-w-0 max-w-[85%] rounded-2xl bg-gray-100 px-3.5 py-2">
                            <p className="text-xs font-semibold text-gray-900">
                              {commentUsername}
                            </p>

                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800">
                              {comment.content}
                            </p>

                            <p className="mt-1 text-[11px] text-gray-500">
                              {formatDate(comment.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add comment */}
                  <form
                    onSubmit={(event) => handleCommentSubmit(event, item)}
                    className="mt-4 flex items-end gap-2"
                  >
                    <textarea
                      rows={1}
                      value={commentDrafts[reportId] || ""}
                      onChange={(event) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [reportId]: event.target.value,
                        }))
                      }
                      placeholder="Write a comment..."
                      aria-label="Write a comment"
                      className="max-h-28 min-h-10 flex-1 resize-y rounded-2xl bg-gray-100 px-4 py-2.5 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-200"
                    />

                    <button
                      type="submit"
                      disabled={
                        !(commentDrafts[reportId] || "").trim() ||
                        !!commentSubmitting[reportId]
                      }
                      className="rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {commentSubmitting[reportId] ? "Sending..." : "Post"}
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
    </section>
  );
};

export default CitizenReports;
