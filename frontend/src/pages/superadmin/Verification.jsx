import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  Users,
  X,
  XCircle,
  ExternalLink,
} from "lucide-react";

import api from "../../api/axios.js";

const USERS_ENDPOINT = "/users";
const PAGE_SIZE = 10;

const getVerificationEndpoint = (userId) => `/users/${userId}/verification`;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const getId = (user) => user?.id ?? user?._id;

const getUsersList = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.users)) return data.data.users;

  return [];
};

const getName = (user) =>
  user?.full_name ||
  user?.fullName ||
  user?.name ||
  [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
  user?.username ||
  "Unnamed user";

const getEmail = (user) => user?.email || "No email provided";

const getRole = (user) => {
  const role = String(user?.role || "user")
    .toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (role === "department_official") return "official";

  return role;
};

const isVerifiableOfficial = (user) =>
  ["ward_official", "official", "department"].includes(getRole(user));

const getVerificationStatus = (user) => {
  const raw = String(
    user?.verification_status ??
      user?.verificationStatus ??
      user?.verification?.status ??
    user?.account_status ??
    "",
  )
    .toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (
    ["verified", "approved", "accepted", "active"].includes(raw) ||
    user?.is_verified === true ||
    user?.isVerified === true ||
    user?.verified === true
  ) {
    return "verified";
  }

  if (["rejected", "declined", "denied"].includes(raw)) {
    return "rejected";
  }

  return "pending";
};

const getDate = (user) =>
  user?.created_at ||
  user?.createdAt ||
  user?.verification_requested_at ||
  user?.verification?.requested_at;

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

const getDocumentUrl = (user) =>
  user?.verification_document_url ||
  user?.document_url ||
  user?.cnic_document_url ||
  user?.identity_document_url ||
  user?.verification?.document_url ||
  user?.documents?.[0]?.url ||
  null;

const STATUS_LABELS = {
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
};

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  rejected: "bg-red-50 text-red-700 ring-red-600/20",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.pending
      }`}
    >
      {status === "verified" ? (
        <CheckCircle2 size={13} />
      ) : status === "rejected" ? (
        <XCircle size={13} />
      ) : (
        <Clock size={13} />
      )}
      {STATUS_LABELS[status] || "Pending"}
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
        {value == null || value === "" ? "—" : String(value)}
      </span>
    </div>
  );
}

export function Verification() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState(null);
  const [actionUser, setActionUser] = useState(null);
  const [actionType, setActionType] = useState("");
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api.get(USERS_ENDPOINT);
      setUsers(getUsersList(response));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to load users. Check the users endpoint and your permissions.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const stats = useMemo(() => {
    const eligibleUsers = users.filter(isVerifiableOfficial);
    const result = {
      total: users.length,
      pending: 0,
      verified: 0,
      rejected: 0,
    };

    eligibleUsers.forEach((user) => {
      const status = getVerificationStatus(user);
      result[status] += 1;
    });

    return result;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      if (!isVerifiableOfficial(user)) return false;

      const status = getVerificationStatus(user);
      const role = getRole(user);

      const matchesStatus = statusFilter === "all" || status === statusFilter;

      const matchesRole = roleFilter === "all" || role === roleFilter;

      const matchesSearch =
        !term ||
        [
          getId(user),
          getName(user),
          getEmail(user),
          user?.phone,
          user?.phone_number,
          user?.cnic,
          user?.national_id,
          role,
        ].some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        );

      return matchesStatus && matchesRole && matchesSearch;
    });
  }, [users, search, statusFilter, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  const safePage = Math.min(page, totalPages);

  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, roleFilter]);

  const openAction = (user, type) => {
    setActionUser(user);
    setActionType(type);
    setReason("");
    setNotice(null);
  };

  const closeAction = () => {
    if (actionLoading) return;

    setActionUser(null);
    setActionType("");
    setReason("");
  };

  const handleVerification = async (event) => {
    event.preventDefault();

    if (!actionUser || !actionType) return;

    if (!isVerifiableOfficial(actionUser)) {
      setNotice({
        type: "error",
        message: "Only Ward Officials and officials can be verified here.",
      });
      setActionUser(null);
      return;
    }

    const userId = getId(actionUser);

    if (userId == null) {
      setNotice({
        type: "error",
        message: "User ID is missing.",
      });
      return;
    }

    if (actionType === "rejected" && !reason.trim()) {
      setNotice({
        type: "error",
        message: "Please provide a reason for rejecting this account.",
      });
      return;
    }

    setActionLoading(true);
    setNotice(null);

    try {
      await api.patch(getVerificationEndpoint(userId), {
        verification_status: actionType,
        verification_reason: reason.trim(),
      });

      const accountStatus = actionType === "verified" ? "active" : "rejected";
      setUsers((previous) =>
        previous.map((user) =>
          String(getId(user)) === String(userId)
            ? {
                ...user,
                verification_status: actionType,
                account_status: accountStatus,
                is_active: actionType === "verified",
                is_verified: actionType === "verified",
                verification_reason: reason.trim(),
              }
            : user,
        ),
      );

      setSelectedUser((previous) =>
        previous && String(getId(previous)) === String(userId)
          ? {
              ...previous,
              verification_status: actionType,
              account_status: accountStatus,
              is_active: actionType === "verified",
              is_verified: actionType === "verified",
              verification_reason: reason.trim(),
            }
          : previous,
      );

      setActionUser(null);
      setActionType("");
      setReason("");

      setNotice({
        type: "success",
        message:
          actionType === "verified"
            ? "Account verified successfully."
            : "Account verification rejected.",
      });

      await fetchUsers(true);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "Verification action failed. Check the backend endpoint and request fields.",
      });
    } finally {
      setActionLoading(false);
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
                <ShieldCheck size={26} />
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Account Verification
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Review and verify Ward Official and official accounts only.
            </p>
          </div>

          <button
            type="button"
            disabled={loading || refreshing}
            onClick={() => fetchUsers(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {/* Notice */}
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
              onClick={() => setNotice(null)}
              aria-label="Dismiss notification"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total users"
            value={stats.total}
            icon={Users}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Pending verification"
            value={stats.pending}
            icon={Clock}
            color="bg-amber-50 text-amber-700"
          />
          <StatCard
            title="Verified accounts"
            value={stats.verified}
            icon={UserRoundCheck}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            title="Rejected accounts"
            value={stats.rejected}
            icon={XCircle}
            color="bg-red-50 text-red-700"
          />
        </div>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Filter size={18} />
            Search and filters
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone, ID..."
                className={`${inputClass} pl-10`}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by verification status"
            >
              <option value="pending">Pending verification</option>
              <option value="all">All verification statuses</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className={inputClass}
              aria-label="Filter by account role"
            >
              <option value="all">All account types</option>
              <option value="ward_official">Ward Officials</option>
              <option value="official">Officials</option>
            </select>
          </div>
        </section>

        {/* Users table */}
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">
              Account verification requests
            </h2>

            <p className="text-sm text-gray-500">
              {filteredUsers.length} result
              {filteredUsers.length === 1 ? "" : "s"}
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-gray-500">
              <LoaderCircle
                size={32}
                className="animate-spin text-emerald-600"
              />
              <p className="text-sm">Loading accounts...</p>
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 text-center">
              <AlertCircle size={35} className="text-red-500" />
              <p className="max-w-xl text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => fetchUsers()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Try again
              </button>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-5 text-center">
              <FileCheck2 size={36} className="text-gray-300" />
              <p className="font-semibold text-gray-800">No accounts found</p>
              <p className="text-sm text-gray-500">
                Try changing the search term or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Account</th>
                      <th className="px-5 py-4 font-semibold">Role</th>
                      <th className="px-5 py-4 font-semibold">Registered</th>
                      <th className="px-5 py-4 font-semibold">Verification</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {paginatedUsers.map((user) => {
                      const userId = getId(user);
                      const status = getVerificationStatus(user);

                      return (
                        <tr
                          key={userId ?? getEmail(user)}
                          className="transition hover:bg-gray-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                <UserRound size={19} />
                              </div>

                              <div className="min-w-0">
                                <p className="max-w-64 truncate font-semibold text-gray-900">
                                  {getName(user)}
                                </p>
                                <p className="mt-1 max-w-64 truncate text-xs text-gray-500">
                                  {getEmail(user)}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  ID: {userId ?? "—"}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-700">
                              {getRole(user).replaceAll("_", " ")}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-gray-600">
                            {formatDate(getDate(user))}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={status} />
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                title="View account details"
                                aria-label={`View ${getName(user)} details`}
                                onClick={() => setSelectedUser(user)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100"
                              >
                                <Eye size={16} />
                              </button>

                              {status === "pending" && (
                                <>
                                  <button
                                    type="button"
                                    title="Approve account"
                                    aria-label={`Approve ${getName(user)}`}
                                    onClick={() => openAction(user, "verified")}
                                    className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <CheckCircle2 size={16} />
                                  </button>

                                  <button
                                    type="button"
                                    title="Reject account"
                                    aria-label={`Reject ${getName(user)}`}
                                    onClick={() => openAction(user, "rejected")}
                                    className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </>
                              )}
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
                    {Math.min(safePage * PAGE_SIZE, filteredUsers.length)}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-gray-800">
                    {filteredUsers.length}
                  </strong>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((previous) => previous - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <span className="min-w-20 text-center text-sm text-gray-600">
                    Page {safePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((previous) => previous + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Account details modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-details-title"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2
                  id="verification-details-title"
                  className="text-lg font-bold text-gray-900"
                >
                  Account details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  ID: {getId(selectedUser) ?? "—"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close account details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <UserRound size={27} />
                </div>

                <div className="min-w-0">
                  <h3 className="break-words text-xl font-bold text-gray-900">
                    {getName(selectedUser)}
                  </h3>
                  <p className="break-all text-sm text-gray-500">
                    {getEmail(selectedUser)}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={getVerificationStatus(selectedUser)} />
                  </div>
                </div>
              </div>

              <div>
                <DetailRow label="Account ID" value={getId(selectedUser)} />
                <DetailRow label="Full name" value={getName(selectedUser)} />
                <DetailRow label="Email" value={getEmail(selectedUser)} />
                <DetailRow
                  label="Phone"
                  value={selectedUser?.phone || selectedUser?.phone_number}
                />
                <DetailRow
                  label="Role"
                  value={getRole(selectedUser).replaceAll("_", " ")}
                />
                <DetailRow
                  label="CNIC"
                  value={selectedUser?.cnic || selectedUser?.national_id}
                />
                <DetailRow
                  label="Registered"
                  value={formatDate(getDate(selectedUser))}
                />
                <DetailRow
                  label="Verification reason"
                  value={
                    selectedUser?.verification_reason ||
                    selectedUser?.verification?.reason
                  }
                />
              </div>

              {getDocumentUrl(selectedUser) && (
                <a
                  href={getDocumentUrl(selectedUser)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  View verification document
                  <ExternalLink size={16} />
                </a>
              )}

              {getVerificationStatus(selectedUser) === "pending" && (
                <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const user = selectedUser;
                      setSelectedUser(null);
                      openAction(user, "rejected");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <XCircle size={17} />
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const user = selectedUser;
                      setSelectedUser(null);
                      openAction(user, "verified");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={17} />
                    Approve account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approval / rejection confirmation */}
      {actionUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="verification-action-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                actionType === "verified"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-600"
              }`}
            >
              {actionType === "verified" ? (
                <ShieldCheck size={24} />
              ) : (
                <XCircle size={24} />
              )}
            </div>

            <h2
              id="verification-action-title"
              className="text-lg font-bold text-gray-900"
            >
              {actionType === "verified"
                ? "Approve this account?"
                : "Reject this account?"}
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Account: <strong>{getName(actionUser)}</strong>
              <br />
              {getEmail(actionUser)}
            </p>

            <form onSubmit={handleVerification} className="mt-5 space-y-4">
              {actionType === "rejected" && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-700">
                    Reason for rejection
                  </span>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Explain why this account cannot be verified..."
                    rows={3}
                    maxLength={1000}
                    required
                    disabled={actionLoading}
                    className={inputClass}
                  />
                </label>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={closeAction}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                    actionType === "verified"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {actionLoading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  {actionType === "verified"
                    ? "Confirm approval"
                    : "Confirm rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
