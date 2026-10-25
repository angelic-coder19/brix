import { adminApp, adminAuth, adminDb } from "../lib/firebase/admin";

async function main() {
  try {
    const app = adminApp();
    const project = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const token = await app.options.credential!.getAccessToken();
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const config = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (config.ok) {
      const c = await config.json();
      console.log(
        JSON.stringify(
          {
            firebaseAuthConfigAccessible: true,
            phoneSignInEnabled: c.signIn?.phoneNumber?.enabled === true,
            authorizedDomains: c.authorizedDomains,
          },
          null,
          2,
        ),
      );
    } else console.log("Firebase Auth config read HTTP " + config.status);
    const google = await fetch(
      `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/defaultSupportedIdpConfigs/google.com`,
      { headers, signal: AbortSignal.timeout(15000) },
    );
    if (google.ok) {
      const g = await google.json();
      console.log("Google sign-in enabled: " + (g.enabled === true));
    } else console.log("Google provider config read HTTP " + google.status);
    const users = await adminAuth().listUsers(100);
    console.log(
      JSON.stringify({
        authAccessible: true,
        accountsInFirstPage: users.users.length,
        verifiedPhoneAccountsInFirstPage: users.users.filter(
          (u) => !!u.phoneNumber,
        ).length,
      }),
    );
    await adminDb().collection("phoneIndex").limit(1).get();
    console.log("Firestore accessible: true");
  } catch (error) {
    console.log(
      "Firebase check failed: " +
        ((error as { code?: string }).code || "connection or permission error"),
    );
    process.exitCode = 1;
  }
}
void main();
