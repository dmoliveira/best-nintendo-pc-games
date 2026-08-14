export function isValidHttpsUrl(value) {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && typeof url.hostname === "string" && url.hostname.trim() !== "";
  } catch {
    return false;
  }
}
