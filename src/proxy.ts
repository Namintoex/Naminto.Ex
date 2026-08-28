import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/reset-password",
  "/auth",
  "/design-system",
  // Les fournisseurs externes n'ont jamais de session Naminto.Ex — leur
  // authenticité est vérifiée par signature (voir ProviderAdapter.verifyAndParseWebhook).
  "/api/webhooks",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function proxy(request: NextRequest) {
  // Request ID (Prompt 27) — propagé à toute l'application via l'en-tête
  // x-request-id, réutilisé s'il est déjà présent (ex. fourni par un
  // proxy en amont) plutôt que d'en générer un nouveau qui casserait la
  // corrélation de bout en bout.
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  request.headers.set("x-request-id", requestId);

  let supabaseResponse = NextResponse.next({ request });
  supabaseResponse.headers.set("x-request-id", requestId);

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        supabaseResponse.headers.set("x-request-id", requestId);
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT : getUser() revalide le token auprès de Supabase — ne jamais
  // se fier uniquement au cookie de session pour une décision de sécurité.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // /admin n'est protégé ici que par l'authentification (session valide) —
  // le contrôle de permission RBAC (Prompt 23) est vérifié plus finement
  // par `requirePermission`/`checkPermission` dans chaque page et chaque
  // Server Action sous `src/app/admin/(protected)/`, jamais ici : ce
  // middleware n'a pas accès aux permissions résolues sans requête base
  // supplémentaire à chaque navigation. Ne pas ajouter de route sous
  // `/admin` hors du groupe `(protected)` sans sa propre vérification
  // explicite de permission.

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
