const LS_FALLBACK = "dg_cookies_supported";

function supportsCookies(): boolean {
  try {
    const id = "__ck_test_" + Math.random().toString(36).slice(2);
    document.cookie = `${id}=1;path=/;SameSite=Lax`;
    const ok = document.cookie.includes(id);
    if (ok) document.cookie = `${id}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    sessionStorage.setItem(LS_FALLBACK, "1");
    return ok;
  } catch {
    return false;
  }
}

const COOKIE_SUPPORTED = typeof document !== "undefined" && supportsCookies();

function setCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (!COOKIE_SUPPORTED) return;
  try {
    let c = `${name}=${value};path=/;SameSite=Lax`;
    if (typeof maxAgeSeconds === "number" && maxAgeSeconds > 0) c += `;Max-Age=${maxAgeSeconds}`;
    if (window.location.protocol === "https:") c += ";Secure";
    document.cookie = c;
  } catch {
    /* ignore */
  }
}

function getCookie(name: string): string | null {
  if (!COOKIE_SUPPORTED) return null;
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[-.+]/g, "\\$1")}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function deleteCookie(name: string) {
  if (!COOKIE_SUPPORTED) return;
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
    if (window.location.protocol === "https:") {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;Secure;SameSite=Lax`;
    }
  } catch {
    /* ignore */
  }
}

export function getAdminToken(): string | null {
  return getCookie("dg_admin_token");
}
export function setAdminToken(token: string): void {
  setCookie("dg_admin_token", token, 60 * 60 * 24 * 30);
  try { sessionStorage.setItem("dg_admin_token_last", token); } catch {}
}
export function clearAdminToken(): void {
  deleteCookie("dg_admin_token");
  try { sessionStorage.removeItem("dg_admin_token_last"); sessionStorage.removeItem("dg_admin_token"); } catch {}
}
export function hasAdminCookieSupport(): boolean {
  return COOKIE_SUPPORTED && !!getCookie("dg_admin_token");
}

export function getClienteToken(): string | null {
  return getCookie("dgriffe:cliente_token");
}
export function setClienteToken(token: string): void {
  setCookie("dgriffe:cliente_token", token, 60 * 60 * 24 * 90);
}
export function clearClienteToken(): void {
  deleteCookie("dgriffe:cliente_token");
}
