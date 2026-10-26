import { useState, useEffect, useCallback } from "react";
import { socket } from "../../socket/socket.js";
import { useSocket } from "../../hooks/useSocket.js";
import api from "../../api/axios.js";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const getStatusStyle = (status) => {
  switch ((status || "pending").toLowerCase()) {
    case "resolved":
      return "bg-green-100 text-green-700";
    case "in_progress":
    case "in progress":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-red-100 text-red-700";
  }
};

const getImageUrl = (image) => {
  if (!image) return null;

  if (image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }

  return `${API_BASE_URL.replace(/\/$/, "")}/${image.replace(/^\//, "")}`;
};

const getResponseArray = (response) => {
  const data = response?.data?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.comments)) return data.comments;
  if (Array.isArray(response?.data?.comments)) {
    return response.data.comments;
  }

  return [];
};

export const TrendingReports = () => {
  const [trendingReports, setTrendingReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upvote state
  const [upvotingIds, setUpvotingIds] = useState([]);
  // Comment state
  const [activeCommentReport, setActiveCommentReport] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");

  // Use your actual authentication state here if available.
  const isAuthenticated = true;
  const { connectionStatus } = useSocket(isAuthenticated);
  console.log("TRENDING REPORTS MOUNTED");
console.log("Socket status:", connectionStatus);
console.log("Socket connected:", socket.connected);

  // Fetch trending reports
  const fetchTrendingReport = useCallback(async () => {
    try {
      setError("");

      const response = await api.get("/reports/trending");
      const responseData = getResponseArray(response);

      setTrendingReports(responseData);
    } catch (error) {
      console.error(
        "Unable to fetch trending reports:",
        error?.response?.data || error,
      );

      setError(
        error?.response?.data?.message || "Unable to fetch trending reports.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrendingReport();
  }, [fetchTrendingReport]);

  // Listen for real-time trending updates
  useEffect(() => {
    const handleTrendingReports = () => {
      fetchTrendingReport();
    };
const handleNewReport = (report) => {
  console.log("TRENDING PAGE RECEIVED NEW_REPORT:", report);
  fetchTrendingReport();
};

socket.on("NEW_REPORT", handleNewReport);
    socket.on("trending:updated", handleTrendingReports);

    return () => {
      socket.off("trending:updated", handleTrendingReports);
      socket.off("NEW_REPORT", handleNewReport);
    };
  }, [fetchTrendingReport]
);

  // Like / unlike a report
  // Like / unlike a report
  const handleUpvote = async (item) => {
    const reportId = item.id;

    if (!reportId || upvotingIds.includes(reportId)) return;

    const wasUpvoted = item.has_upvoted === true || item.has_upvoted === "true";

    // Prevent repeated clicks while the request is running.
    setUpvotingIds((prev) => [...prev, reportId]);

    // Optimistically update the UI.
    setTrendingReports((prev) =>
      prev.map((report) => {
        if (report.id !== reportId) return report;

        return {
          ...report,
          has_upvoted: !wasUpvoted,
          upvotes_count: Math.max(
            0,
            Number(report.upvotes_count || 0) + (wasUpvoted ? -1 : 1),
          ),
        };
      }),
    );

    try {
      if (wasUpvoted) {
        // Remove the existing upvote.
        await api.delete(`/reports/${reportId}/upvotes`);
      } else {
        // Add an upvote.
        await api.post(`/reports/${reportId}/upvotes`);
      }

      // Synchronize with the backend.
      await fetchTrendingReport();
    } catch (err) {
      console.error(
        "Unable to update upvote:",
        err.response?.data || err.message,
      );

      // Restore the actual state from the server.
      await fetchTrendingReport();

      setError(err.response?.data?.message || "Unable to update your upvote.");
    } finally {
      setUpvotingIds((prev) => prev.filter((id) => id !== reportId));
    }
  };

  // Fetch all comments for a report
  const fetchComments = useCallback(async (reportId) => {
    try {
      setCommentsLoading(true);
      setCommentError("");

      const response = await api.get(`/reports/${reportId}/comments`);

      setComments(getResponseArray(response));
    } catch (error) {
      console.error(
        "Unable to fetch comments:",
        error?.response?.data || error,
      );

      setComments([]);
      setCommentError(
        error?.response?.data?.message ||
          "Unable to load comments. Please try again.",
      );
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  // Open or close comments
  const handleOpenComments = async (reportId) => {
    if (activeCommentReport === reportId) {
      setActiveCommentReport(null);
      setCommentText("");
      setComments([]);
      setCommentError("");
      return;
    }

    setActiveCommentReport(reportId);
    setCommentText("");
    setComments([]);
    setCommentError("");

    await fetchComments(reportId);
  };

  // Add a new comment
  const handleAddComment = async (reportId) => {
    const trimmedComment = commentText.trim();

    if (!trimmedComment || commentLoading) return;

    try {
      setCommentLoading(true);
      setCommentError("");

      await api.post(`/reports/${reportId}/comments`, {
        content: trimmedComment,
      });

      setCommentText("");

      // Fetch the actual saved comments from the backend.
      await fetchComments(reportId);

      // Update the visible comment count.
      setTrendingReports((prev) =>
        prev.map((item) => {
          if (item.id !== reportId) return item;

          return {
            ...item,
            comments_count: (item.comments_count ?? 0) + 1,
          };
        }),
      );

      // Refresh trending score/count from the server.
      fetchTrendingReport();
    } catch (error) {
      console.error("Unable to add comment:", error?.response?.data || error);

      setCommentError(
        error?.response?.data?.message ||
          "Unable to post your comment. Please try again.",
      );
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-2 sm:px-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-700">Trending Issues</h1>

          <p className="mt-1 text-sm text-gray-500">
            See the civic issues getting the most attention right now.
          </p>
        </div>

        {/* Trending reports */}
      </section>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Loading trending issues...</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <p className="text-sm text-red-500">{error}</p>

          <button
            type="button"
            onClick={fetchTrendingReport}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && trendingReports.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-500">
            No trending issues available right now.
          </p>
        </div>
      )}

      {/* Trending report cards */}
      {!loading && !error && trendingReports.length > 0 && (
        <div className="flex flex-col gap-4">
          {trendingReports.map((item) => {
            const fullName = [item.first_name, item.last_name]
              .filter(Boolean)
              .join(" ");

            const displayName = fullName || item.username || "CivicFix User";
            const displayAddress = item.address || item.user_address;

            const isCommentOpen = activeCommentReport === item.id;

            const isUpvoting = upvotingIds.includes(item.id);

            return (
              <article
                key={item.id}
                className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* User header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-blue-100">
                    {item.profile_image ? (
                      <img
                        src={getImageUrl(item.profile_image)}
                        alt={displayName}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base">
                        👤
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-gray-900">
                      {displayName}
                    </h2>

                    {displayAddress && (
                      <p className="truncate text-xs text-gray-500">
                        📍 {displayAddress}
                      </p>
                    )}

                    <p className="text-[11px] text-gray-400">
                      Reported a civic issue
                    </p>
                  </div>

                  {item.updated_at && (
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium capitalize text-blue-700">
                      {item.category}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(item.status)}`}
                    >
                      {item.status?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold leading-5 text-gray-900">
                    {item.description}
                  </h3>
                </div>

                {/* Report images */}
                {Array.isArray(item.images) && item.images.length > 0 && (
                  <div className="w-full overflow-hidden">
                    {item.images.length === 1 ? (
                      <div className="h-[220px] w-full overflow-hidden bg-gray-50 sm:h-[280px]">
                        <img
                          src={getImageUrl(
                            item.images[0].image_url || item.images[0].url,
                          )}
                          alt="Reported civic issue"
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="grid h-[220px] w-full grid-cols-2 gap-1 overflow-hidden bg-gray-50 sm:h-[280px]">
                        {item.images.slice(0, 4).map((image, index) => {
                          const imageUrl = image.image_url || image.url;

                          return (
                            <div
                              key={`${imageUrl}-${index}`}
                              className="relative min-h-0 min-w-0 overflow-hidden"
                            >
                              <img
                                src={getImageUrl(imageUrl)}
                                alt={`Reported civic issue ${index + 1}`}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />

                              {index === 3 && item.images.length > 4 && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-semibold text-white">
                                  +{item.images.length - 4}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Report details */}
                <div className="px-4 py-4">
                  {/* Like, comment and trending actions */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => handleUpvote(item)}
                        disabled={upvotingIds.includes(item.id)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 transition disabled:cursor-wait disabled:opacity-60 ${
                          item.has_upvoted === true ||
                          item.has_upvoted === "true"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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

                        <span>
                          {item.has_upvoted === true ||
                          item.has_upvoted === "true"
                            ? "Like"
                            : "Like"}
                        </span>

                        <span>{item.upvotes_count ?? 0}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenComments(item.id)}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition ${
                          isCommentOpen
                            ? "bg-gray-100 text-gray-900"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
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
                        Comments
                        <span>{item.comments_count ?? 0}</span>
                      </button>
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
                      <div className="ml-auto flex items-center gap-1 px-3 py-2">
                        <span>🔥</span>
                        <span className="text-xs font-semibold text-gray-500">
                          {item.trending_score ?? 0}
                        </span>
                      </div>
                    </div>

                    {/* All comments and comment input */}
                    {isCommentOpen && (
                      <div className="mt-3 border-t border-gray-100 pt-3">
                        <div className="mb-3 max-h-60 space-y-3 overflow-y-auto">
                          {commentsLoading ? (
                            <p className="text-xs text-gray-400">
                              Loading comments...
                            </p>
                          ) : commentError && comments.length === 0 ? (
                            <div>
                              <p className="text-xs text-red-500">
                                {commentError}
                              </p>

                              <button
                                type="button"
                                onClick={() => fetchComments(item.id)}
                                className="mt-2 text-xs font-medium text-blue-600"
                              >
                                Retry
                              </button>
                            </div>
                          ) : comments.length === 0 ? (
                            <p className="text-xs text-gray-400">
                              No comments yet. Be the first to comment.
                            </p>
                          ) : (
                            comments.map((comment, index) => {
                              const commentName = [
                                comment.first_name,
                                comment.last_name,
                              ]
                                .filter(Boolean)
                                .join(" ");

                              const author =
                                commentName ||
                                comment.username ||
                                "CivicFix User";

                              return (
                                <div
                                  key={
                                    comment.comment_id || comment.id || index
                                  }
                                  className="flex gap-2"
                                >
                                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
                                    {comment.profile_image ? (
                                      <img
                                        src={getImageUrl(comment.profile_image)}
                                        alt={author}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-sm">
                                        👤
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1 rounded-xl bg-gray-100 px-3 py-2">
                                    <p className="text-xs font-semibold text-gray-800">
                                      {author}
                                    </p>

                                    <p className="mt-0.5 break-words text-sm text-gray-700">
                                      {comment.content ??
                                        comment.comment_text ??
                                        ""}
                                    </p>

                                    {comment.created_at && (
                                      <p className="mt-1 text-[10px] text-gray-400">
                                        {new Date(
                                          comment.created_at,
                                        ).toLocaleString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Comment error after posting */}
                        {commentError && comments.length > 0 && (
                          <p className="mb-2 text-xs text-red-500">
                            {commentError}
                          </p>
                        )}

                        {/* Add comment */}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleAddComment(item.id);
                          }}
                          className="flex gap-2"
                        >
                          <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Write a comment..."
                            maxLength={2000}
                            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                          />

                          <button
                            type="submit"
                            disabled={commentLoading || !commentText.trim()}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 bg-blue-600"
                          >
                            {commentLoading ? "Posting..." : "Post"}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
