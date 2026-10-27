
import asyncHandler from "../utils/asyncHandler.js";
import apiErrorHandler from "../utils/apiErrorHandler.js";
import pool from "../config/db.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { uploadImage } from "../utils/cloudinary.js";
const siteAssetsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../public/uploads/site-assets",
);

const allowedSvgElements = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "ellipse",
  "rect",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "title",
  "desc",
  "text",
  "tspan",
]);

const allowedSvgAttributes = new Set([
  "xmlns",
  "viewBox",
  "preserveAspectRatio",
  "width",
  "height",
  "version",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-opacity",
  "opacity",
  "d",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "points",
  "transform",
  "clip-rule",
  "clip-path",
  "id",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
]);

const sanitizeSvg = (source) => {
  const svg = source.trim();
  if (!svg || svg.length > 20000) {
    throw new apiErrorHandler(400, "SVG must be no larger than 20 KB.");
  }

  const tokens = svg.match(/<[^>]*>|[^<]+/g) || [];
  const stack = [];
  const safeTokens = [];
  let rootSeen = false;

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      if (token.trim()) {
        const parent = stack[stack.length - 1];
        if (!["text", "tspan", "title", "desc"].includes(parent)) {
          throw new apiErrorHandler(400, "SVG text is only allowed in text elements.");
        }
        safeTokens.push(
          token.replace(/&/g, "&amp;").replace(/>/g, "&gt;"),
        );
      }
      continue;
    }

    const tagMatch = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b([\s\S]*?)>$/i);
    if (!tagMatch) {
      throw new apiErrorHandler(400, "SVG contains invalid markup.");
    }

    const [, closingSlash, rawName, rawAttributes] = tagMatch;
    const name = rawName.toLowerCase();
    if (!allowedSvgElements.has(name)) {
      throw new apiErrorHandler(400, `SVG element "${name}" is not allowed.`);
    }
    if (rootSeen && stack.length === 0) {
      throw new apiErrorHandler(400, "SVG must have one root element.");
    }

    if (closingSlash) {
      if (rawAttributes.trim() || stack.pop() !== name) {
        throw new apiErrorHandler(400, "SVG tags must be correctly nested.");
      }
      safeTokens.push(`</${name}>`);
      continue;
    }

    if (!rootSeen && name !== "svg") {
      throw new apiErrorHandler(400, "SVG must have an svg root element.");
    }
    if (name === "svg") {
      if (rootSeen || stack.length > 0) {
        throw new apiErrorHandler(400, "SVG must have one root element.");
      }
      rootSeen = true;
    }

    const selfClosing = /\/\s*$/.test(rawAttributes);
    const attributesSource = selfClosing
      ? rawAttributes.replace(/\/\s*$/, "")
      : rawAttributes;
    const attributes = [];
    let cursor = 0;
    const attributePattern = /([a-z][\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gi;
    let match;

    while ((match = attributePattern.exec(attributesSource))) {
      if (attributesSource.slice(cursor, match.index).trim()) {
        throw new apiErrorHandler(400, "SVG contains invalid attributes.");
      }

      const attributeName = match[1];
      const attributeValue = match[3] ?? match[4];
      const localFragmentReference =
        ["fill", "stroke", "clip-path"].includes(attributeName) &&
        /^url\(#[a-z_][\w.-]*\)$/i.test(attributeValue);
      if (
        !allowedSvgAttributes.has(attributeName) ||
        /[<>&]|javascript:|data:/i.test(attributeValue) ||
        (/\burl\s*\(/i.test(attributeValue) && !localFragmentReference) ||
        (attributeName === "id" && !/^[\w.-]+$/.test(attributeValue))
      ) {
        throw new apiErrorHandler(
          400,
          `SVG attribute "${attributeName}" is not allowed.`,
        );
      }

      attributes.push(
        `${attributeName}="${attributeValue.replace(/"/g, "&quot;")}"`,
      );
      cursor = attributePattern.lastIndex;
    }

    if (attributesSource.slice(cursor).trim()) {
      throw new apiErrorHandler(400, "SVG contains invalid attributes.");
    }

    safeTokens.push(
      `<${rawName}${attributes.length ? ` ${attributes.join(" ")}` : ""}${selfClosing ? " />" : ">"}`,
    );
    if (!selfClosing) stack.push(name);
  }

  if (!rootSeen || stack.length > 0) {
    throw new apiErrorHandler(400, "SVG must have balanced tags.");
  }

  return safeTokens.join("");
};

export const uploadSiteAsset = asyncHandler(async (req, res) => {
  const { assetType } = req.body;
  const file = req.file;

  if (!["logo", "favicon"].includes(assetType)) {
    throw new apiErrorHandler(400, "Choose a logo or favicon asset type.");
  }
  if (!file) {
    throw new apiErrorHandler(400, "Choose an image file to upload.");
  }

  const isSvg =
    file.mimetype === "image/svg+xml" ||
    path.extname(file.originalname).toLowerCase() === ".svg";

  if (isSvg) {
    const svg = sanitizeSvg(file.buffer.toString("utf8"));
    if (assetType === "logo") {
      return res.status(200).json({
        success: true,
        data: {
          settings: { logoSvg: svg, logoUrl: "" },
        },
      });
    }

    const uploadedFavicon = await uploadImage(
  Buffer.from(svg, "utf8"),
  "civifix/site-assets",
);

return res.status(200).json({
  success: true,
  data: {
    settings: {
      faviconUrl: uploadedFavicon.secure_url,
    },
  },
});
  }

  const assetTypes = {
    "image/png": { extension: ".png", signature: [0x89, 0x50, 0x4e, 0x47] },
    "image/jpeg": { extension: ".jpg", signature: [0xff, 0xd8, 0xff] },
    "image/webp": { extension: ".webp", signature: null },
    "image/x-icon": { extension: ".ico", signature: null },
    "image/vnd.microsoft.icon": { extension: ".ico", signature: null },
  };
  const asset = assetTypes[file.mimetype];
  if (!asset || (assetType === "favicon" && file.mimetype === "image/webp")) {
    throw new apiErrorHandler(
      400,
      "Use a PNG, JPEG, SVG, or ICO file. WEBP is supported for logos.",
    );
  }

  const buffer = file.buffer;
  if (asset.signature) {
    const hasSignature = asset.signature.every(
      (byte, index) => buffer[index] === byte,
    );
    if (!hasSignature) {
      throw new apiErrorHandler(
        400,
        "The file contents do not match its image type.",
      );
    }
  } else if (file.mimetype === "image/webp") {
    if (
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) {
      throw new apiErrorHandler(
        400,
        "The file contents do not match its image type.",
      );
    }
  } else if (file.mimetype.includes("icon")) {
    if (
      buffer[0] !== 0 ||
      buffer[1] !== 0 ||
      buffer[2] !== 1 ||
      buffer[3] !== 0
    ) {
      throw new apiErrorHandler(
        400,
        "The file contents do not match its image type.",
      );
    }
  }

  const uploadedAsset = await uploadImage(
  buffer,
  "civifix/site-assets",
);

const url = uploadedAsset.secure_url;
  return res.status(200).json({
    success: true,
    data: {
      settings:
        assetType === "logo"
          ? { logoUrl: url, logoSvg: "" }
          : { faviconUrl: url },
    },
  });
});

const settingDefinitions = {
  siteName: { key: "site_name", type: "string", maxLength: 80 },
  tagline: { key: "site_tagline", type: "string", maxLength: 160 },
  logoUrl: { key: "site_logo_url", type: "url", maxLength: 2048 },
  logoSvg: { key: "site_logo_svg", type: "svg", maxLength: 20000 },
  faviconUrl: { key: "site_favicon_url", type: "url", maxLength: 2048 },
  primaryColor: { key: "site_primary_color", type: "color" },
  supportEmail: { key: "support_email", type: "email", maxLength: 254 },
  supportPhone: { key: "support_phone", type: "string", maxLength: 30 },
  whatsappNumber: { key: "whatsapp_number", type: "whatsapp" },
  location: { key: "site_location", type: "string", maxLength: 200 },
  workingHours: { key: "working_hours", type: "string", maxLength: 120 },
  allowRegistration: { key: "allow_registration", type: "boolean" },
  maintenanceMode: { key: "maintenance_mode", type: "boolean" },
  maintenanceMessage: {
    key: "maintenance_message",
    type: "string",
    maxLength: 300,
  },
  emailNotifications: { key: "email_notifications", type: "boolean" },
  defaultLanguage: {
    key: "default_language",
    type: "string",
    maxLength: 12,
  },
  privacyPolicyUrl: {
    key: "privacy_policy_url",
    type: "url",
    maxLength: 2048,
  },
  termsUrl: { key: "terms_url", type: "url", maxLength: 2048 },
  facebookUrl: { key: "facebook_url", type: "url", maxLength: 2048 },
  instagramUrl: { key: "instagram_url", type: "url", maxLength: 2048 },
  xUrl: { key: "x_url", type: "url", maxLength: 2048 },
};

const publicSettingNames = [
  "siteName",
  "tagline",
  "logoUrl",
  "logoSvg",
  "faviconUrl",
  "primaryColor",
  "supportEmail",
  "supportPhone",
  "whatsappNumber",
  "location",
  "workingHours",
  "allowRegistration",
  "maintenanceMode",
  "maintenanceMessage",
  "privacyPolicyUrl",
  "termsUrl",
  "facebookUrl",
  "instagramUrl",
  "xUrl",
];

const defaultSettings = {
  siteName: "CivicFix",
  tagline: "Better cities, together.",
  logoUrl: "",
  logoSvg: "",
  faviconUrl: "",
  primaryColor: "#15803d",
  supportEmail: "support@civicfix.com",
  supportPhone: "",
  whatsappNumber: "",
  location: "Faisalabad, Pakistan",
  workingHours: "Monday - Friday, 9 AM - 5 PM",
  allowRegistration: true,
  maintenanceMode: false,
  maintenanceMessage: "We will be back soon.",
  emailNotifications: true,
  defaultLanguage: "en",
  privacyPolicyUrl: "",
  termsUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  xUrl: "",
};

const decodeSetting = (value, type) => {
  if (type === "boolean") return value === "true";
  return value ?? "";
};

const readSettings = async (
  queryable,
  names = Object.keys(settingDefinitions),
) => {
  const definitions = names.map((name) => [name, settingDefinitions[name]]);
  const keys = definitions.map(([, definition]) => definition.key);
  const result = await queryable.query(
    `SELECT setting_key, setting_value
     FROM site_settings
     WHERE setting_key = ANY($1::text[])`,
    [keys],
  );
  const savedValues = new Map(
    result.rows.map((row) => [row.setting_key, row.setting_value]),
  );

  return Object.fromEntries(
    definitions.map(([name, definition]) => [
      name,
      savedValues.has(definition.key)
        ? decodeSetting(savedValues.get(definition.key), definition.type)
        : defaultSettings[name],
    ]),
  );
};

const validateSetting = (name, value, definition) => {
  if (definition.type === "boolean") {
    if (typeof value !== "boolean") {
      throw new apiErrorHandler(400, `${name} must be true or false.`);
    }
    return String(value);
  }

  if (typeof value !== "string") {
    throw new apiErrorHandler(400, `${name} must be a string.`);
  }

  const normalized = value.trim();
  if (normalized.length > (definition.maxLength || 80)) {
    throw new apiErrorHandler(400, `${name} is too long.`);
  }

  if (name === "siteName" && !normalized) {
    throw new apiErrorHandler(400, "siteName cannot be empty.");
  }

  if (
    definition.type === "email" &&
    normalized &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new apiErrorHandler(400, "Enter a valid support email address.");
  }

  if (definition.type === "url" && normalized) {
    const isRelativePath = normalized.startsWith("/") &&
      !normalized.startsWith("//") &&
      !normalized.includes("\\");
    let isHttpUrl = false;
    try {
      const parsedUrl = new URL(normalized);
      isHttpUrl = parsedUrl.protocol === "https:" && Boolean(parsedUrl.hostname);
    } catch {
      isHttpUrl = false;
    }

    if (!isRelativePath && !isHttpUrl) {
      throw new apiErrorHandler(
        400,
        `${name} must be an HTTPS URL or a site-relative path.`,
      );
    }
  }

  if (definition.type === "color" && !/^#[\da-f]{6}$/i.test(normalized)) {
    throw new apiErrorHandler(
      400,
      "primaryColor must be a six-digit hex color.",
    );
  }

  if (
    definition.type === "whatsapp" &&
    normalized &&
    !/^[1-9]\d{7,14}$/.test(normalized)
  ) {
    throw new apiErrorHandler(
      400,
      "Enter a WhatsApp number with country code, without + or spaces.",
    );
  }

  if (definition.type === "svg" && normalized) {
    return sanitizeSvg(normalized);
  }

  return normalized;
};

export const getPublicSiteSettings = asyncHandler(async (req, res) => {
  const settings = await readSettings(pool, publicSettingNames);

  return res.status(200).json({
    success: true,
    data: { settings },
  });
});

export const getSiteSettings = asyncHandler(async (req, res) => {
  const settings = await readSettings(pool);

  return res.status(200).json({
    success: true,
    data: { settings },
  });
});

export const updateSiteSettings = asyncHandler(async (req, res) => {
  const { settings } = req.body;

  if (
    !settings ||
    typeof settings !== "object" ||
    Array.isArray(settings) ||
    Object.keys(settings).length === 0
  ) {
    throw new apiErrorHandler(400, "Provide at least one setting to update.");
  }

  const entries = Object.entries(settings);
  const valuesToSave = entries.map(([name, value]) => {
    const definition = settingDefinitions[name];
    if (!definition) {
      throw new apiErrorHandler(400, `Unknown site setting: ${name}.`);
    }

    return [definition.key, validateSetting(name, value, definition)];
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of valuesToSave) {
      await client.query(
        `INSERT INTO site_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
        [key, value],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const savedSettings = await readSettings(pool);
  return res.status(200).json({
    success: true,
    message: "Website settings saved successfully.",
    data: { settings: savedSettings },
  });
});

// Get the public WhatsApp number
export const getWhatsAppNumber = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT setting_value
     FROM site_settings
     WHERE setting_key = $1
     LIMIT 1`,
    ["whatsapp_number"]
  );

  return res.status(200).json({
    success: true,
    data: {
      whatsappNumber: result.rows[0]?.setting_value || "",
    },
  });
});

// Update the WhatsApp number (SuperAdmin only)
export const updateWhatsAppNumber = asyncHandler(async (req, res) => {
  if (req.user?.role !== "superadmin") {
    throw new apiErrorHandler(
      403,
      "Only SuperAdmin can update the WhatsApp number."
    );
  }

  const { whatsappNumber } = req.body;

  if (
    typeof whatsappNumber !== "string" ||
    !/^[1-9]\d{7,14}$/.test(whatsappNumber)
  ) {
    throw new apiErrorHandler(
      400,
      "Enter a valid WhatsApp number with country code, without + or spaces."
    );
  }

  const result = await pool.query(
    `INSERT INTO site_settings (
       setting_key,
       setting_value,
       updated_at
     )
     VALUES ($1, $2, NOW())
     ON CONFLICT (setting_key)
     DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = NOW()
     RETURNING setting_value`,
    ["whatsapp_number", whatsappNumber]
  );

  return res.status(200).json({
    success: true,
    message: "WhatsApp number updated successfully.",
    data: {
      whatsappNumber: result.rows[0].setting_value,
    },
  });
});
