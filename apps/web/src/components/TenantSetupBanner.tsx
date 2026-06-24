"use client";

import { useAuth } from "@/contexts/AuthContext";

export function TenantSetupBanner() {
  const { user, organization, organizations, loading } = useAuth();

  if (loading || !user || organization || organizations.length > 0) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
      Sua conta não tem organização vinculada. No servidor, execute:{" "}
      <code className="rounded bg-black/40 px-1 py-0.5 text-xs">
        php artisan db:seed &amp;&amp; php artisan twin:reset-demo-user &amp;&amp; php artisan
        tenants:provision --seed
      </code>
    </div>
  );
}
