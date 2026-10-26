const CACHE_KEY = "civicfix_reverse_geocode";
const MIN_REQUEST_INTERVAL_MS = 1100;

let requestQueue = Promise.resolve();
let lastRequestAt = 0;
const addressCache = new Map();

const coordinateKey = (latitude, longitude) =>
  `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;

const getCachedAddress = (key) => {
  if (addressCache.has(key)) return addressCache.get(key);

  try {
    const savedAddresses = JSON.parse(
      sessionStorage.getItem(CACHE_KEY) || "{}",
    );
    const cachedAddress = savedAddresses[key];
    if (typeof cachedAddress === "string") {
      addressCache.set(key, cachedAddress);
      return cachedAddress;
    }
  } catch {
    // Session storage may be unavailable; keep the in-memory cache.
  }

  return null;
};

const cacheAddress = (key, address) => {
  addressCache.set(key, address);
  try {
    const savedAddresses = JSON.parse(
      sessionStorage.getItem(CACHE_KEY) || "{}",
    );
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...savedAddresses, [key]: address }),
    );
  } catch {
    // Session storage may be unavailable; keep the in-memory cache.
  }
};

export const reverseGeocode = (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Promise.reject(new Error("Valid coordinates are required."));
  }

  const key = coordinateKey(lat, lon);
  const cachedAddress = getCachedAddress(key);
  if (cachedAddress) return Promise.resolve(cachedAddress);

  const lookup = requestQueue.then(async () => {
    const waitTime = Math.max(
      0,
      MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt),
    );
    if (waitTime) {
      await new Promise((resolve) => window.setTimeout(resolve, waitTime));
    }

    lastRequestAt = Date.now();
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lon),
      zoom: "18",
      addressdetails: "1",
    });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        throw new Error(`Address lookup failed with status ${response.status}.`);
      }

      const result = await response.json();
      if (typeof result.display_name !== "string" || !result.display_name) {
        throw new Error("No address was found for these coordinates.");
      }

      cacheAddress(key, result.display_name);
      return result.display_name;
    } finally {
      window.clearTimeout(timeoutId);
    }
  });

  requestQueue = lookup.catch(() => {});
  return lookup;
};
