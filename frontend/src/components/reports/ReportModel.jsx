import { useState, useRef } from "react";
import { useContextHook } from "../../context/useContextHook";
import api from "../../api/axios.js";
import { reverseGeocode } from "../../utils/reverseGeocode";
import Swal from "sweetalert2";
const imageType = [
  {
    id: 1,
    value: "evidence",
    Title: "Evidence",
  },
  {
    id: 2,
    value: "before",
    Title: "Before",
  },
  {
    id: 3,
    value: "after",
    Title: "After",
  },
  {
    id: 4,
    value: "resolution_proof",
    Title: "Resolution Proof",
  },
];
const categoryData = [
  {
    id: 1,
    value: "pothole",
    title: "Road Phothole",
    icon: "🚧",
  },
  {
    id: 2,
    value: "streetlight",
    title: "StreetLights",
    icon: "💡",
  },
  {
    id: 3,
    value: "garbage_waste",
    title: "Garbage & Waste",
    icon: "🗑️",
  },
  {
    id: 4,
    value: "water_supply",
    title: "WaterSupply",
    icon: "💧",
  },
  {
    id: 5,
    value: "sewerage_drainage",
    title: "Sewerage & Drainage",
    icon: "🌊",
  },

  {
    id: 6,
    value: "illegal_construction_encroachment",
    title: "illegal_construction & Encroachment",
    icon: "🏗️",
  },
  {
    id: 7,
    value: "traffic_signal",
    title: "traffic Signal",
    icon: "🚦",
  },
  {
    id: 8,
    value: "public_property_damage",
    title: "Public Property Damage",
    icon: "🚦",
  },
  {
    id: 9,
    value: "other",
    title: "Other",
    icon: "📌",
  },
];
export const ReportModel = () => {
  const [isModelOpen, setIsModelOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [reportImage, setReportImage] = useState([]);
  const [location, setLocation] = useState(null);
  const [reportAddress, setReportAddress] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const editorRef = useRef(null);
  const [selectedImageType, setSelectedImageType] = useState("evidence");
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage("Your browser does not support GPS.");
      return;
    }

    setIsCapturingLocation(true);
    setLocationMessage("Capturing your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const capturedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocation(capturedLocation);

        try {
          const address = await reverseGeocode(
            capturedLocation.latitude,
            capturedLocation.longitude,
          );
          setReportAddress(address);
          setLocationMessage(`Location captured: ${address}`);
        } catch (error) {
          console.error("Unable to find report address:", error);
          setReportAddress("");
          setLocationMessage(
            "Location captured, but its address could not be found.",
          );
        } finally {
          setIsCapturingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);

        setLocation(null);
        setReportAddress("");
        setIsCapturingLocation(false);

        setLocationMessage(
          "Location unavailable. Please allow location access or try again.",
        );
        setIsCapturingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };
  const handleModel = () => {
    setIsModelOpen(true);
    getLocation();
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate location
    if (!location) {
      await Swal.fire({
        icon: "warning",
        title: "Location Access Required",
        text: "Please allow location access in your browser and capture your location before submitting the report.",
        confirmButtonText: "OK",
        confirmButtonColor: "#16a34a",
      });

      return;
    }

    // 2. Validate category
    if (!category) {
      await Swal.fire({
        icon: "warning",
        title: "Category Required",
        text: "Please select an issue category.",
        confirmButtonColor: "#16a34a",
      });
      return;
    }

    // 3. Validate description
    if (!description.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Description Required",
        text: "Please describe the issue.",
        confirmButtonColor: "#16a34a",
      });

      editorRef.current?.focus();
      return;
    }

    try {
      // 4. Prepare report data for Express backend
      const reportData = {
        category,
        description: description.trim(),
        latitude: location.latitude,
        longitude: location.longitude,
        address: reportAddress || undefined,
      };
      console.log("Category being sent:", category);

      // 5. Create report
      const response = await api.post("/reports/", reportData);

      // Extract created report from API response
      const createdReport = response.data?.data ?? response.data;
      const reportId = createdReport?.id;

      // 6. Upload images after report creation
      let imagesUploaded = true;

      if (reportImage.length > 0 && reportId) {
        for (const image of reportImage) {
          const formData = new FormData();

          // Must match uploadFileMiddleware.single("image")
          formData.append("image", image);

          // Required by the backend controller
          formData.append("image_type", selectedImageType);

          try {
            await api.post(`/reports/${reportId}/images`, formData, {
              headers: {
                "Content-Type": undefined,
              },
            });
          } catch (imageError) {
            imagesUploaded = false;

            console.error(
              "Image upload failed:",
              image.name,
              imageError.response?.data || imageError.message,
            );
          }
        }
      } else if (reportImage.length > 0 && !reportId) {
        imagesUploaded = false;
        console.error("Report ID was not found in the API response.");
      }

      // 7. Reset form after report creation
      setCategory("");
      setDescription("");
      setReportImage([]);
      setLocation(null);
      setReportAddress("");
      setLocationMessage("");

      if (editorRef.current) {
        editorRef.current.innerText = "";
      }

      setIsModelOpen(false);

      // 8. Show the appropriate result
      if (imagesUploaded) {
        await Swal.fire({
          icon: "success",
          title: "Report Created!",
          text: "Your report has been submitted successfully.",
          confirmButtonColor: "#16a34a",
        });
      } else {
        await Swal.fire({
          icon: "warning",
          title: "Report Created, Images Incomplete",
          text: "Your report was saved, but some images could not be uploaded.",
          confirmButtonColor: "#16a34a",
        });
      }
    } catch (error) {
      console.error(
        "Report creation failed:",
        error.response?.data || error.message,
      );

      await Swal.fire({
        icon: "error",
        title: "Report Failed",
        text:
          error.response?.data?.message ||
          "Unable to create your report. Please try again.",
        confirmButtonColor: "#16a34a",
      });
    }
  };
  const handleReportImages = (e) => {
    const files = Array.from(e.target.files || []);
    setReportImage((prev) => [...prev, ...files]);
    e.target.value = "";
  };
  const removeReportImage = (index) => {
    setReportImage((prev) => prev.filter((_, i) => i !== index));
  };
  const handleCategory = (value) => {
    setCategory(value);
  };
  const handleImageType = (type) => {
    setSelectedImageType(type);
  };
  const { profileImage, name } = useContextHook();
  return (
    <section className="flex w-full justify-center px-4">
      <div className="w-full max-w-xl rounded-xl bg-white/60 px-3 py-3 shadow-md">
        <div className="flex items-center gap-4">
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="rounded-full bg-gray-100 p-2 text-gray-500"
            >
              <path d="M20 21a8 8 0 0 0-16 0" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          )}

          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="What's happening in your area?"
              readOnly
              onClick={handleModel}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition-shadow focus:border-green-500 focus:shadow-sm cursor-pointer"
            />
            <label
              htmlFor="feedreportImage"
              title="Upload images"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-green-700 transition hover:bg-green-50"
            >
              {" "}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </label>
            <input
              type="file"
              name="feedreportImage"
              id="feedreportImage"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                handleReportImages(e);
                handleModel();
              }}
            />
          </div>
        </div>
      </div>
      {isModelOpen && (
        <div className=" fixed flex justify-center inset-0 z-50 bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-y-auto  rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="felx items-center gap-3 ">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="44"
                    height="44"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="rounded-full bg-gray-100 p-2 text-gray-500"
                  >
                    <path d="M20 21a8 8 0 0 0-16 0" />
                    <circle cx="12" cy="8" r="4" />
                  </svg>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsModelOpen(false)}
                className="flex
              h-7 w-7 items-center justify-center bg-gray-300 text-gray-600 rounded-full transition hover:bg-gray-100 hover:text-gray-800 "
              >
                X
              </button>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Create a Report
              </h2>

              <p className="text-xs text-gray-500">{name || "Citizen"}</p>
            </div>
            <form onSubmit={handleSubmit} className=" mt-5 space-y-5">
              <div>
                <label
                  htmlFor="category"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  {" "}
                  Issue Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categoryData.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleCategory(item.value)}
                      className={`flex min-h-8 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none transition
        ${
          category === item.value
            ? "border-green-600 bg-green-100 text-green-700"
            : "border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50"
        }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2">
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  {" "}
                  Description
                </label>
                <div className="overflow-hidden rounded-xl border border-gray-300 focus-within:border-green-500">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    data-placeholder="Describe Issue"
                    onInput={(e) => setDescription(e.currentTarget.innerText)}
                    className=" min-h-28 whitespace-pre-wrap break-words px-3 py-2 text-sm text-gray-700 outline-none  empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
                  />
                  {reportImage.length > 0 && (
                    <div className="grid gird-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3">
                      {reportImage.map((image, index) => (
                        <div
                          key={`${image}-${index}`}
                          className="relative aspect-square overflow-hidden rounded-lg"
                        >
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Report Image-${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeReportImage(index)}
                            aria-label="Remove Image"
                            className="absolute right-2 top-2 flex h-7 w-7 justify-center items-center rounded-full bg-black/70 text-lg text-white hover:bg-red-600"
                          >
                            x
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Select Image Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {imageType.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleImageType(item.value)}
                        className={`flex min-h-8 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none transition ${
                          selectedImageType === item.value
                            ? "border-green-600 bg-green-100 text-green-700"
                            : "border-gray-300 text-gray-700 hover:border-green-400 hover:bg-green-50"
                        }`}
                      >
                        {item.Title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className=" mt-5 flex border-t border-gray-200 px-3 py-2 ">
                  <label
                    htmlFor="reportImage"
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
                  >
                    Upload Image
                  </label>
                  <input
                    id="reportImage"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReportImages}
                    className="hidden"
                  />
                </div>
              </div>

              {locationMessage && (
                <p
                  aria-live="polite"
                  className={`text-sm ${
                    reportAddress ? "text-green-700" : "text-gray-600"
                  }`}
                >
                  {locationMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isCapturingLocation}
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Post
              </button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
