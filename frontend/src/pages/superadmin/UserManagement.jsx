
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  UserCheck,
  UserX,
  ShieldCheck,
  RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Ban,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  BadgeCheck,
  AlertCircle,
  LoaderCircle,
  Filter,
} from "lucide-react";

import api from "../../api/axios.js";

const PAGE_SIZE = 10;

// Adapt these paths if your backend uses different route names.
const USER_ENDPOINT = "/users";

const getUsersFromResponse = (response) => {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.users)) return data.data.users;

  return [];
};

const getUserId = (user) => user?.id ?? user?._id;

const getRole = (user) =>
  String(user?.role || "citizen").toLowerCase();

const getStatus = (user) => {
  if (user?.is_active === false) return "blocked";

  const status = String(user?.account_status || "").toLowerCase();

  if (
    ["blocked", "suspended", "inactive", "disabled"].includes(status)
  ) {
    return "blocked";
  }

  if (
    ["rejected", "rejected_by_admin"].includes(status)
  ) {
    return "rejected";
  }

  if (
    ["verified", "approved", "active"].includes(status)
  ) {
    return "verified";
  }

  if (
    ["pending", "pending_verification", "under_review"].includes(status)
  ) {
    return "pending";
  }

  if (
    user?.is_verified === true ||
    user?.is_verified === 1
  ) {
    return "verified";
  }

  return "pending";
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

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  return String(value);
};

const statusStyles = {
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  blocked: "bg-red-50 text-red-700 ring-red-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const StatusBadge = ({ status }) => {
  const styles =
    statusStyles[status] ||
    "bg-gray-100 text-gray-700 ring-gray-500/20";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${styles}`}
    >
      {status}
    </span>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
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

export const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await api.get(USER_ENDPOINT);
      setUsers(getUsersFromResponse(response));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Unable to load users. Please check your connection and permissions."
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
    return users.reduce(
      (result, user) => {
        const status = getStatus(user);

        result.total += 1;

        if (status === "verified") result.verified += 1;
        if (status === "pending") result.pending += 1;
        if (status === "blocked") result.blocked += 1;

        return result;
      },
      { total: 0, verified: 0, pending: 0, blocked: 0 }
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [
          user.username,
          user.full_name,
          user.name,
          user.email,
          user.phone_number,
          user.cnic_number,
          user.address,
          getUserId(user),
        ].some((value) =>
          String(value ?? "").toLowerCase().includes(term)
        );

      const matchesRole =
        roleFilter === "all" || getRole(user) === roleFilter;

      const matchesStatus =
        statusFilter === "all" || getStatus(user) === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / PAGE_SIZE)
  );

  const safePage = Math.min(currentPage, totalPages);

  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  const updateUserLocally = (userId, updates) => {
    setUsers((previous) =>
      previous.map((user) =>
        String(getUserId(user)) === String(userId)
          ? { ...user, ...updates }
          : user
      )
    );

    setSelectedUser((previous) =>
      previous &&
      String(getUserId(previous)) === String(userId)
        ? { ...previous, ...updates }
        : previous
    );
  };

  const handleUserAction = async () => {
    if (!pendingAction) return;

    const { user, action } = pendingAction;
    if (getRole(user) === "superadmin" && ["block", "unblock", "delete"].includes(action)) {
      setNotice({
        type: "error",
        message: "Super-admin accounts cannot be blocked or deleted here.",
      });
      setPendingAction(null);
      return;
    }

    const userId = getUserId(user);

    if (userId === null || userId === undefined) {
      setNotice({
        type: "error",
        message: "This user has no valid ID.",
      });
      setPendingAction(null);
      return;
    }

    // These routes must exist in your backend.
    const actionConfig = {
      verify: {
        method: "patch",
        url: `/users/${userId}/verify`,
        data: { account_status: "active", is_active: true },
      },
      block: {
        method: "patch",
        url: `/users/${userId}/block`,
        data: { account_status: "suspended", is_active: false },
      },
      unblock: {
        method: "patch",
        url: `/users/${userId}/unblock`,
        data: { account_status: "active", is_active: true },
      },
    };

    const config = actionConfig[action];

    if (!config) return;

    setActionLoading(true);
    setNotice(null);

    try {
      await api[config.method](config.url, config.data);

      updateUserLocally(userId, config.data);

      setNotice({
        type: "success",
        message:
          action === "verify"
            ? "User verified successfully."
            : action === "block"
              ? "User blocked successfully."
              : "User unblocked successfully.",
      });

      setPendingAction(null);

      // Refresh from the database to reflect the actual backend state.
      await fetchUsers(true);
    } catch (err) {
      setNotice({
        type: "error",
        message:
          err?.response?.data?.message ||
          "The action failed. Verify that the backend endpoint exists and that you have permission.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const openAction = (user, action) => {
    setPendingAction({ user, action });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
                <Users size={25} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                User Management
              </h1>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Manage Civifix accounts, verification, and access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchUsers(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={17}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh users
          </button>
        </div>

        {/* Notifications */}
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
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            ) : (
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
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

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total users"
            value={stats.total}
            icon={Users}
            color="bg-blue-50 text-blue-700"
          />
          <StatCard
            title="Verified users"
            value={stats.verified}
            icon={UserCheck}
            color="bg-emerald-50 text-emerald-700"
          />
          <StatCard
            title="Pending verification"
            value={stats.pending}
            icon={ShieldCheck}
            color="bg-amber-50 text-amber-700"
          />
          <StatCard
            title="Blocked users"
            value={stats.blocked}
            icon={UserX}
            color="bg-red-50 text-red-700"
          />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Filter size={18} />
            Search and filters
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_200px_200px]">
            <div className="relative">
              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone, CNIC, or ID..."
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filter by role"
            >
              <option value="all">All roles</option>
              <option value="citizen">Citizen</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
              <option value="department">Department</option>
              <option value="official">Official</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              aria-label="Filter by account status"
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="blocked">Blocked</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Users table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">
              Registered users
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
              <p className="text-sm">Loading users...</p>
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
              <Users size={36} className="text-gray-300" />
              <p className="font-semibold text-gray-800">
                No users found
              </p>
              <p className="text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">User</th>
                      <th className="px-5 py-4 font-semibold">Role</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold">Joined</th>
                      <th className="px-5 py-4 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {paginatedUsers.map((user) => {
                      const userId = getUserId(user);
                      const status = getStatus(user);
                      const role = getRole(user);
                      const canManageAccess = role !== "superadmin";
                      const name =
                        user.full_name ||
                        user.username ||
                        user.name ||
                        "Unnamed user";

                      return (
                        <tr
                          key={userId ?? user.email}
                          className="transition hover:bg-gray-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold uppercase text-emerald-800">
                                {String(name).charAt(0)}
                              </div>

                              <div className="min-w-0">
                                <p className="max-w-56 truncate font-semibold text-gray-900">
                                  {name}
                                </p>
                                <p className="mt-1 max-w-64 truncate text-xs text-gray-500">
                                  {user.email || "No email"}
                                </p>
                                <p className="mt-1 text-xs text-gray-400">
                                  ID: {displayValue(userId)}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-700">
                              {role.replaceAll("_", " ")}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge status={status} />
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                            {formatDate(user.created_at)}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedUser(user)}
                                title="View details"
                                aria-label={`View ${name}`}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                              >
                                <Eye size={16} />
                              </button>

                              {status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => openAction(user, "verify")}
                                  title="Verify user"
                                  aria-label={`Verify ${name}`}
                                  className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
                                >
                                  <BadgeCheck size={16} />
                                </button>
                              )}

                              {canManageAccess && status !== "blocked" ? (
                                <button
                                  type="button"
                                  onClick={() => openAction(user, "block")}
                                  title="Block user"
                                  aria-label={`Block ${name}`}
                                  className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                                >
                                  <Ban size={16} />
                                </button>
                              ) : canManageAccess ? (
                                <button
                                  type="button"
                                  onClick={() => openAction(user, "unblock")}
                                  title="Unblock user"
                                  aria-label={`Unblock ${name}`}
                                  className="rounded-lg border border-emerald-200 p-2 text-emerald-700 hover:bg-emerald-50"
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                              ) : null}
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
                  <span className="font-semibold text-gray-800">
                    {(safePage - 1) * PAGE_SIZE + 1}
                  </span>
                  {" "}to{" "}
                  <span className="font-semibold text-gray-800">
                    {Math.min(safePage * PAGE_SIZE, filteredUsers.length)}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold text-gray-800">
                    {filteredUsers.length}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
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
                    onClick={() => setCurrentPage((page) => page + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User details modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="user-details-title"
                  className="text-lg font-bold text-gray-900"
                >
                  User details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Account information and verification status
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Close user details"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold uppercase text-emerald-800">
                  {String(
                    selectedUser.full_name ||
                      selectedUser.username ||
                      selectedUser.name ||
                      "U"
                  ).charAt(0)}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-xl font-bold text-gray-900">
                    {selectedUser.full_name ||
                      selectedUser.username ||
                      selectedUser.name ||
                      "Unnamed user"}
                  </h3>
                  <p className="mt-1 break-all text-sm text-gray-500">
                    {selectedUser.email || "No email provided"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={getStatus(selectedUser)} />
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold capitalize text-gray-600">
                      {getRole(selectedUser).replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  icon={Mail}
                  label="Email"
                  value={selectedUser.email}
                />
                <DetailItem
                  icon={Phone}
                  label="Phone number"
                  value={selectedUser.phone_number}
                />
                <DetailItem
                  icon={MapPin}
                  label="Address"
                  value={selectedUser.address}
                />
                <DetailItem
                  icon={CalendarDays}
                  label="Registration date"
                  value={formatDate(selectedUser.created_at)}
                />
                <DetailItem
                  icon={ShieldCheck}
                  label="CNIC number"
                  value={selectedUser.cnic_number}
                />
                <DetailItem
                  icon={BadgeCheck}
                  label="Verification ID"
                  value={selectedUser.verification_id}
                />
                <DetailItem
                  icon={CalendarDays}
                  label="Last updated"
                  value={formatDate(selectedUser.updated_at)}
                />
                <DetailItem
                  icon={ShieldCheck}
                  label="Account ID"
                  value={getUserId(selectedUser)}
                />
              </div>

              {(selectedUser.rejection_reason ||
                selectedUser.approved_at ||
                selectedUser.rejected_at) && (
                <div className="rounded-xl bg-gray-50 p-4">
                  <h4 className="mb-3 font-semibold text-gray-800">
                    Verification history
                  </h4>

                  {selectedUser.approved_at && (
                    <p className="mb-2 text-sm text-gray-600">
                      Approved: {formatDate(selectedUser.approved_at)}
                    </p>
                  )}

                  {selectedUser.rejected_at && (
                    <p className="mb-2 text-sm text-gray-600">
                      Rejected: {formatDate(selectedUser.rejected_at)}
                    </p>
                  )}

                  {selectedUser.rejection_reason && (
                    <p className="text-sm text-red-700">
                      Reason: {selectedUser.rejection_reason}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                {getStatus(selectedUser) === "pending" && (
                  <button
                    type="button"
                    onClick={() => {
                      openAction(selectedUser, "verify");
                      setSelectedUser(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={17} />
                    Verify user
                  </button>
                )}

                {getRole(selectedUser) !== "superadmin" &&
                getStatus(selectedUser) === "blocked" ? (
                  <button
                    type="button"
                    onClick={() => {
                      openAction(selectedUser, "unblock");
                      setSelectedUser(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={17} />
                    Unblock user
                  </button>
                ) : getRole(selectedUser) !== "superadmin" ? (
                  <button
                    type="button"
                    onClick={() => {
                      openAction(selectedUser, "block");
                      setSelectedUser(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    <Ban size={17} />
                    Block user
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-950/50 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
                pendingAction.action === "block"
                  ? "bg-red-100 text-red-600"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {pendingAction.action === "block" ? (
                <Ban size={23} />
              ) : pendingAction.action === "verify" ? (
                <ShieldCheck size={23} />
              ) : (
                <CheckCircle2 size={23} />
              )}
            </div>

            <h3 className="text-lg font-bold text-gray-900">
              {pendingAction.action === "verify"
                ? "Verify this user?"
                : pendingAction.action === "block"
                  ? "Block this user?"
                  : "Unblock this user?"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              You are about to{" "}
              <strong>{pendingAction.action}</strong>{" "}
              the account for{" "}
              <strong>
                {pendingAction.user.username ||
                  pendingAction.user.full_name ||
                  pendingAction.user.name ||
                  pendingAction.user.email ||
                  "this user"}
              </strong>
              . Continue only if you are authorized to make this change.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setPendingAction(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleUserAction}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${
                  pendingAction.action === "block"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {actionLoading && (
                  <LoaderCircle size={16} className="animate-spin" />
                )}
                {actionLoading
                  ? "Processing..."
                  : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3.5">
      <div className="mb-2 flex items-center gap-2 text-gray-500">
        <Icon size={16} />
        <span className="text-xs font-medium">{label}</span>
      </div>

      <p className="break-words text-sm font-semibold text-gray-800">
        {displayValue(value)}
      </p>
    </div>
  );
}
