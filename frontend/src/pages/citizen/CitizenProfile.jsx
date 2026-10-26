import { useState, useRef, useEffect, useCallback } from "react";
import api from "../../api/axios.js";
import Swal from "sweetalert2";
import { useAuth } from "../../context/AuthContext";
import CitizenReports from "./CitizenReports.jsx";

const PROFILE_ENDPOINT = "/users/me";
const UPDATE_PROFILE_ENDPOINT = "/users/update";

const getProfileObject = (responseData) =>
  responseData?.data?.user ||
  responseData?.data?.profile ||
  responseData?.data ||
  responseData?.user ||
  responseData?.profile ||
  responseData;

const getImageUrl = (imagePath) => {
  if (!imagePath || /^(?:https?:|data:|blob:)/i.test(imagePath)) {
    return imagePath;
  }

  const apiOrigin = new URL(
    api.defaults.baseURL || window.location.origin,
    window.location.origin,
  ).origin;

  return new URL(
    imagePath.startsWith("/") ? imagePath : `/${imagePath}`,
    apiOrigin,
  ).toString();
};

export const CitizenProfile = () => {
  const { updateUser } = useAuth();
  const [user, setUser] = useState(null);

  const [updateFirstName, setUpdateFirstName] = useState("");
  const [updateLastName, setUpdateLastName] = useState("");
  const [updateUserName, setUpdateUserName] = useState("");
  const [updateEmail, setUpdateEmail] = useState("");
  const [updatePassword, setUpdatePassword] = useState("");
  const [updateCnicNumber, setUpdateCnicNumber] = useState("");
  const [updatePhoneNumber, setUpdatePhoneNumber] = useState("");
  const [updateAddress, setUpdateAddress] = useState("");

  const [updateProfileImage, setUpdateProfileImage] = useState(null);
  const [updateCoverImage, setUpdateCoverImage] = useState(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [error, setError] = useState("");

  const profileImageRef = useRef(null);
  const coverImageRef = useRef(null);
  const profilePreviewRef = useRef(null);
  const coverPreviewRef = useRef(null);

  const applyProfile = useCallback((profile) => {
    if (
      !profile ||
      typeof profile !== "object" ||
      Array.isArray(profile) ||
      (!profile.id && !profile.email && !profile.username)
    ) {
      throw new Error("The server returned an invalid profile.");
    }

    setUser(profile);
    updateUser(profile);

    setUpdateFirstName(profile.first_name || "");
    setUpdateLastName(profile.last_name || "");
    setUpdateUserName(profile.username || "");
    setUpdateEmail(profile.email || "");
    setUpdateCnicNumber(profile.cnic_number || "");
    setUpdatePhoneNumber(profile.phone_number || profile.phone || "");
    setUpdateAddress(profile.address || "");

    setUpdateProfileImage(
      getImageUrl(profile.profile_image || profile.profileImage || null),
    );

    setUpdateCoverImage(
      getImageUrl(
        profile.cover_image ||
          profile.coverImage ||
          profile.banner_image ||
          null,
      ),
    );
  }, [updateUser]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await api.get(PROFILE_ENDPOINT);
      applyProfile(getProfileObject(response.data));
      setError("");
    } catch (err) {
      console.error("Fetch profile error:", err);
      console.error("Backend response:", err.response?.data);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load your profile.",
      );

      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    let active = true;

    api
      .get(PROFILE_ENDPOINT)
      .then((response) => {
        if (!active) return;

        applyProfile(getProfileObject(response.data));
        setError("");
      })
      .catch((err) => {
        console.error("Fetch profile error:", err);
        console.error("Backend response:", err.response?.data);

        if (active) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load your profile.",
          );
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [applyProfile]);

  useEffect(() => {
    if (!isLoading && window.location.hash === "#my-reports") {
      document.getElementById("my-reports")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (profilePreviewRef.current) {
        URL.revokeObjectURL(profilePreviewRef.current);
      }

      if (coverPreviewRef.current) {
        URL.revokeObjectURL(coverPreviewRef.current);
      }
    };
  }, []);

  const uploadImage = async (fieldName, file) => {
    const isProfileImage = fieldName === "profileImage";
    const setUploading = isProfileImage
      ? setUploadingProfileImage
      : setUploadingCoverImage;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append(fieldName, file);

      const response = await api.patch(UPDATE_PROFILE_ENDPOINT, formData);
      const savedProfile = getProfileObject(response.data);
      const savedImage = isProfileImage
        ? savedProfile?.profile_image
        : savedProfile?.banner_image;

      if (!savedImage) {
        throw new Error("The server did not return the saved image.");
      }

      applyProfile(savedProfile);

      const previewRef = isProfileImage ? profilePreviewRef : coverPreviewRef;

      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    } catch (err) {
      console.error("Image upload error:", err);
      console.error("Backend response:", err.response?.data);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to upload your image.",
      );

      // Restore the image saved on the server after an upload failure.
      try {
        const response = await api.get(PROFILE_ENDPOINT);
        applyProfile(getProfileObject(response.data));
      } catch (refreshError) {
        console.error("Could not refresh profile:", refreshError);
      }
    } finally {
      setUploading(false);
    }
  };

  const editDetail = () => {
    if (!user) return;

    setUpdateFirstName(user.first_name || "");
    setUpdateLastName(user.last_name || "");
    setUpdateUserName(user.username || "");
    setUpdateEmail(user.email || "");
    setUpdateCnicNumber(user.cnic_number || "");
    setUpdatePhoneNumber(user.phone_number || user.phone || "");
    setUpdateAddress(user.address || "");
    setUpdatePassword("");

    setError("");
    setShowProfileMenu(false);
    setShowEditDetails(true);
  };

  const validateAndUpload = (event, imageType) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be 5 MB or smaller.");
      return;
    }

    const isProfileImage = imageType === "profileImage";
    const previewRef = isProfileImage ? profilePreviewRef : coverPreviewRef;

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }

    previewRef.current = URL.createObjectURL(file);

    if (isProfileImage) {
      setUpdateProfileImage(previewRef.current);
      setShowProfileMenu(false);
    } else {
      setUpdateCoverImage(previewRef.current);
    }

    setError("");
    void uploadImage(imageType, file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSaving || uploadingProfileImage || uploadingCoverImage) {
      return;
    }

    const firstName = updateFirstName.trim();
    const lastName = updateLastName.trim();
    const username = updateUserName.trim();
    const email = updateEmail.trim();
    const cnicNumber = updateCnicNumber.trim();
    const phoneNumber = updatePhoneNumber.trim();
    const address = updateAddress.trim();

    if (!firstName || !lastName || !username || !email) {
      setError("First name, last name, username and email are required.");
      return;
    }

    if (cnicNumber && !/^\d{5}-\d{7}-\d{1}$/.test(cnicNumber)) {
      setError("Enter CNIC in 12345-1234567-1 format.");
      return;
    }

    if (updatePassword && updatePassword.length < 8) {
      setError("New password must contain at least 8 characters.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");

      const formData = new FormData();

      formData.append("first_name", firstName);
      formData.append("last_name", lastName);
      formData.append("username", username);
      formData.append("email", email);
      formData.append("cnic_number", cnicNumber);
      formData.append("phone_number", phoneNumber);
      formData.append("address", address);

      if (updatePassword.trim()) {
        formData.append("password", updatePassword);
      }

      const patchResponse = await api.patch(UPDATE_PROFILE_ENDPOINT, formData);

      const freshResponse = await api.get(PROFILE_ENDPOINT);
      applyProfile(getProfileObject(freshResponse.data));

      setUpdatePassword("");
      setShowEditDetails(false);
      setShowProfileMenu(false);

      await Swal.fire({
        icon: "success",
        title: "Profile Updated",
        text:
          patchResponse.data?.message ||
          "Your profile has been updated successfully.",
        confirmButtonColor: "#16a34a",
      });
    } catch (err) {
      console.error("Profile update error:", err);
      console.error("Backend response:", err.response?.data);

      const message =
        err.response?.data?.message ||
        err.message ||
        "Unable to update your profile.";

      setError(message);

      await Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: message,
        confirmButtonColor: "#dc2626",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username ||
    "User";
  const isProfileOnly = user?.role !== "citizen";

  if (isLoading) {
    return (
      <div className="flex min-h-64 w-full items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="mt-3 text-sm text-gray-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p role="alert" className="break-words text-sm text-red-700">
            {error || "Your profile could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() => {
              setIsLoading(true);
              setError("");
              void fetchProfile();
            }}
            className="mt-4 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-clip bg-gray-50 pb-8">
      {/* Profile cover */}
      <section className="mx-auto w-full max-w-7xl px-0 sm:px-4">
        <div className="bg-white shadow-sm sm:rounded-b-2xl sm:border sm:border-gray-200">
          <div className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-green-700 via-emerald-600 to-teal-500 sm:h-56 md:h-72">
            {updateCoverImage && (
              <img
                src={updateCoverImage}
                alt="Profile cover"
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setUpdateCoverImage(null)}
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

            <button
              type="button"
              disabled={uploadingCoverImage}
              onClick={() => coverImageRef.current?.click()}
              className="absolute bottom-3 right-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-gray-800 shadow-md transition hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:bottom-4 sm:right-4 sm:text-sm"
            >
              {uploadingCoverImage ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
                  Uploading...
                </>
              ) : (
                <>
                  <span aria-hidden="true"></span>
                  Edit cover photo
                </>
              )}
            </button>

            <input
              ref={coverImageRef}
              type="file"
              accept="image/*"
              disabled={uploadingCoverImage}
              className="hidden"
              onChange={(event) => validateAndUpload(event, "coverImage")}
            />
          </div>

          {/* Profile identity and actions */}
          <div className="relative px-4 pb-5 sm:px-6 md:px-8">
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
              <div className="-mt-12 shrink-0 self-center sm:-mt-14 sm:self-auto md:-mt-16">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gray-100 shadow-md sm:h-28 sm:w-28 md:h-36 md:w-36">
                  {updateProfileImage ? (
                    <img
                      src={updateProfileImage}
                      alt={fullName}
                      className="h-full w-full object-cover"
                      onError={() => setUpdateProfileImage(null)}
                    />
                  ) : (
                    <span className="text-3xl font-bold text-gray-500 sm:text-4xl">
                      {fullName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-1 text-center sm:pb-3 sm:text-left">
                <h1 className="break-words text-xl font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">
                  {fullName}
                </h1>

                {user.username && (
                  <p className="mt-1 break-all text-sm text-gray-500">
                    @{user.username}
                  </p>
                )}

                {user.address && (
                  <p className="mt-2 flex items-start justify-center gap-1.5 break-words text-sm text-gray-600 sm:justify-start">
                    <span aria-hidden="true">📍</span>
                    <span>{user.address}</span>
                  </p>
                )}
              </div>

              <div className="relative z-20 flex shrink-0 justify-center pb-1 sm:justify-end sm:pb-3">
                <button
                  type="button"
                  disabled={uploadingProfileImage}
                  onClick={() => setShowProfileMenu((previous) => !previous)}
                  aria-expanded={showProfileMenu}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  {uploadingProfileImage ? "Uploading..." : "Edit Profile"}
                  <span aria-hidden="true">▾</span>
                </button>

                {showProfileMenu && (
                  <>
                    <button
                      type="button"
                      aria-label="Close profile menu"
                      className="fixed inset-0 z-10 cursor-default"
                      onClick={() => setShowProfileMenu(false)}
                    />

                    <div className="absolute right-0 top-full z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          profileImageRef.current?.click();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <span aria-hidden="true"></span>
                        Upload profile photo
                      </button>

                      <button
                        type="button"
                        onClick={editDetail}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                      >
                        <span aria-hidden="true"></span>
                        Edit personal details
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={profileImageRef}
                  type="file"
                  accept="image/*"
                  disabled={uploadingProfileImage}
                  className="hidden"
                  onChange={(event) => validateAndUpload(event, "profileImage")}
                />
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-4">
              <p className="break-all text-sm text-gray-600">
                <span className="font-medium text-gray-800">Email:</span>{" "}
                {user.email || "Not provided"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4">
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span className="min-w-0 break-words">{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="shrink-0 rounded px-2 text-lg leading-none hover:bg-red-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Profile details and citizen reports */}
      <section className="mx-auto mt-5 w-full max-w-7xl px-3 sm:mt-6 sm:px-4 lg:px-6">
        <div
          className={`grid min-w-0 grid-cols-1 items-start gap-5 md:gap-6 ${
            isProfileOnly ? "" : "lg:grid-cols-3"
          }`}
        >
          {/* Left column */}
          <aside
            className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 ${
              isProfileOnly ? "" : "lg:col-span-1"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                Personal Details
              </h2>

              <button
                type="button"
                onClick={editDetail}
                className="rounded-md px-2 py-1 text-sm font-semibold text-green-700 transition hover:bg-green-50 hover:text-green-800"
              >
                Edit
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Detail label="First Name" value={user.first_name} />
              <Detail label="Last Name" value={user.last_name} />
              <Detail label="Username" value={user.username} />
              <Detail label="Email" value={user.email} />
              <Detail label="CNIC" value={user.cnic_number} />
              <Detail
                label="Phone Number"
                value={user.phone_number || user.phone}
              />
              <Detail label="Address" value={user.address} />
            </div>
          </aside>

          {!isProfileOnly && (
            <section
              id="my-reports"
              className="min-w-0 w-full scroll-mt-6 lg:col-span-2"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  Posts
                </h2>
              </div>

              <div className="min-w-0 w-full">
                <CitizenReports />
              </div>
            </section>
          )}
        </div>
      </section>

      {/* Edit profile modal */}
      {showEditDetails && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-[2px] sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !isSaving &&
              !uploadingProfileImage &&
              !uploadingCoverImage
            ) {
              setShowEditDetails(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-heading"
            className="my-auto max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-2xl sm:p-6 md:p-7"
          >
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div className="min-w-0">
                <h2
                  id="edit-profile-heading"
                  className="text-xl font-bold text-gray-900 sm:text-2xl"
                >
                  Edit Personal Details
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Update your profile information.
                </p>
              </div>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowEditDetails(false)}
                className="shrink-0 rounded-lg p-2 text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                aria-label="Close edit profile"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="First Name"
                  value={updateFirstName}
                  onChange={setUpdateFirstName}
                  required
                />

                <Field
                  label="Last Name"
                  value={updateLastName}
                  onChange={setUpdateLastName}
                  required
                />

                <Field
                  label="Username"
                  value={updateUserName}
                  onChange={setUpdateUserName}
                  required
                />

                <Field
                  label="Email"
                  type="email"
                  value={updateEmail}
                  onChange={setUpdateEmail}
                  required
                />

                <Field
                  label="CNIC Number"
                  value={updateCnicNumber}
                  onChange={setUpdateCnicNumber}
                  placeholder="12345-1234567-1"
                />

                <Field
                  label="Phone Number"
                  value={updatePhoneNumber}
                  onChange={setUpdatePhoneNumber}
                />
              </div>

              <div>
                <label
                  htmlFor="profile-address"
                  className="mb-1.5 block text-sm font-semibold text-gray-700"
                >
                  Address
                </label>

                <textarea
                  id="profile-address"
                  value={updateAddress}
                  onChange={(event) => setUpdateAddress(event.target.value)}
                  rows={3}
                  className="block w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
                />
              </div>

              <Field
                label="New Password (optional)"
                type="password"
                value={updatePassword}
                onChange={setUpdatePassword}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
              />

              <p className="text-xs leading-5 text-gray-500">
                Leave the password blank if you do not want to change it. A new
                password must contain at least 8 characters.
              </p>

              {error && (
                <p
                  role="alert"
                  className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowEditDetails(false)}
                  className="w-full rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSaving || uploadingProfileImage || uploadingCoverImage
                  }
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isSaving && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  )}
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

const Detail = ({ label, value }) => (
  <div className="min-w-0 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
      {label}
    </p>
    <p className="mt-1 break-words text-sm leading-6 text-gray-900">
      {value || "Not provided"}
    </p>
  </div>
);

const Field = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  autoComplete,
}) => {
  const inputId = `profile-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={inputId}
        className="mb-1.5 block text-sm font-semibold text-gray-700"
      >
        {label}
      </label>

      <input
        id={inputId}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="block w-full min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-green-600 focus:ring-2 focus:ring-green-100"
      />
    </div>
  );
};

export default CitizenProfile;
