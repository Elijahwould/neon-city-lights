/** Public OAuth client. A build can override it with NEXT_PUBLIC_GOOGLE_CLIENT_ID. */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "340375874756-iiidvfceo0l438328vcmpaiqir6e2l53.apps.googleusercontent.com";

/** Non-sensitive. The app can only see files it creates. */
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Neon City GSheet v2.1. Leave empty until the sheet URL is supplied. */
export const GOOGLE_SHEET_URL = "";
export const GOOGLE_SHEET_LABEL = "Get the Google Sheet version";
