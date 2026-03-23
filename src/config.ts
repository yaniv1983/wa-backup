// Default Google OAuth Web Client ID shipped with the app.
// APK users don't need to change this - it works out of the box.
// Developers building from source with their own signing key
// can override this in Settings → Developer or via .env file.
export const DEFAULT_WEB_CLIENT_ID =
  process.env.WEB_CLIENT_ID ||
  '589817877084-lqri056vao0rnsoon2lvs9n9q0cfusmj.apps.googleusercontent.com';
