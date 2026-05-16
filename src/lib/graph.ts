// Microsoft Graph API utilities — gracefully no-ops if env vars are missing

export function isGraphConfigured() {
  return !!(
    process.env.AZURE_AD_TENANT_ID &&
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_CLIENT_SECRET
  );
}

async function fetchAppToken(): Promise<string | null> {
  if (!isGraphConfigured()) return null;
  // AZURE_AD_ORG_TENANT_ID is the real org tenant GUID.
  // AZURE_AD_TENANT_ID may be "common" (for multi-tenant OIDC), which does NOT support
  // client_credentials — using it here would cause a slow network error.
  const tenantId = process.env.AZURE_AD_ORG_TENANT_ID ?? process.env.AZURE_AD_TENANT_ID;
  if (
    !tenantId ||
    tenantId === "common" ||
    tenantId === "organizations" ||
    tenantId === "9188040d-6c67-4c5b-b112-36a304b66dad" // MSA consumer tenant
  ) {
    return null;
  }
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.AZURE_AD_CLIENT_ID ?? "",
          client_secret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.access_token as string) ?? null;
  } catch {
    return null;
  }
}

export async function getAppToken(): Promise<string | null> {
  return fetchAppToken();
}

// Fetches an app token for a specific tenant (from the user's tid claim).
// Needed when AZURE_AD_TENANT_ID="common" — client_credentials requires a real tenant GUID.
export async function getAppTokenForTenant(tenantId: string): Promise<string | null> {
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_CLIENT_SECRET) return null;
  // Personal MSA tenant — client_credentials not supported
  if (tenantId === "9188040d-6c67-4c5b-b112-36a304b66dad") return null;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: process.env.AZURE_AD_CLIENT_ID ?? "",
          client_secret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
          scope: "https://graph.microsoft.com/.default",
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.access_token as string) ?? null;
  } catch {
    return null;
  }
}

async function graphFetch(urlOrPath: string, token: string) {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `https://graph.microsoft.com/v1.0${urlOrPath}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function graphPost(path: string, body: unknown, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

// Delegated — called during sign-in with user's access_token
export async function getDelegatedManagerEmail(userAccessToken: string): Promise<string | null> {
  const data = await graphFetch("/me/manager", userAccessToken);
  return data?.mail ?? data?.userPrincipalName ?? null;
}

export async function getDelegatedRole(
  userAccessToken: string
): Promise<"ADMIN" | "MANAGER" | "EMPLOYEE"> {
  const data = await graphFetch("/me/memberOf?$select=displayName", userAccessToken);
  const groups: string[] = (data?.value ?? []).map((g: { displayName: string }) => g.displayName);
  if (groups.includes("GoalTrack-Admins")) return "ADMIN";
  if (groups.includes("GoalTrack-Managers")) return "MANAGER";
  return "EMPLOYEE";
}

// App token — used for admin sync
export interface GraphUser {
  id: string;
  mail: string | null;
  displayName: string;
  department: string | null;
}

export async function getAllGraphUsers(appToken: string): Promise<GraphUser[]> {
  const results: GraphUser[] = [];
  let nextLink: string | null =
    "https://graph.microsoft.com/v1.0/users?$select=id,mail,displayName,department&$top=100";

  while (nextLink) {
    const data = await graphFetch(nextLink, appToken);
    if (!data?.value) break;
    results.push(...data.value);
    nextLink = data["@odata.nextLink"] ?? null;
  }
  return results;
}

export async function getGraphUserManagerEmail(
  userId: string,
  appToken: string
): Promise<string | null> {
  const data = await graphFetch(`/users/${encodeURIComponent(userId)}/manager`, appToken);
  return data?.mail ?? data?.userPrincipalName ?? null;
}

export async function getGraphUserGroups(userId: string, appToken: string): Promise<string[]> {
  const data = await graphFetch(
    `/users/${encodeURIComponent(userId)}/memberOf?$select=displayName`,
    appToken
  );
  return (data?.value ?? []).map((g: { displayName: string }) => g.displayName);
}
