import api from "../api/axios.js";

export const siteAssetUrl = (url) => {
  if (!url) return "";

  try {
    return new URL(url, api.defaults.baseURL).href;
  } catch {
    return "";
  }
};
