export const config = Object.freeze({
  // Keep demo until the acceptance checklist in docs/SETUP.md passes.
  mode: "aws", // 'demo' | 'aws'. No automatic fallback from AWS to demo.
  apiBaseUrl: "https://madar-five-swart.vercel.app/api", // HTTPS origin, no trailing path
  cognitoDomain: "https://us-east-1ir3ua8ulo.auth.us-east-1.amazoncognito.com", // HTTPS origin, no trailing path
  region: "us-east-1",
  userPoolId: "us-east-1_Ir3UA8UlO",
  clientId: "17kbtl4s65pjls5ud1r3261o07", // PUBLIC client. Never put a client secret here.
  redirectUri: "https://madar-five-swart.vercel.app/", // Exact registered URL, e.g. http://localhost:8080/
  logoutUri: "https://madar-five-swart.vercel.app/", // Exact registered URL, e.g. http://localhost:8080/
  scopes: ["openid", "email", "profile"],
  defaultLanguage: "en",
});
