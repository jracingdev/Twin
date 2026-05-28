"use client";

import { useAuth } from "@/contexts/AuthContext";
import { setOrganizationId } from "@/lib/auth";

export function OrgSwitcher() {
  const { organization, organizations, switchOrganization, loading } = useAuth();

  if (loading || organizations.length <= 1) {
    if (organization) {
      return (
        <span className="hidden text-xs text-twin-muted sm:inline" title={organization.id}>
          {organization.name}
        </span>
      );
    }
    return null;
  }

  return (
    <select
      value={organization?.id ?? ""}
      onChange={(e) => {
        void switchOrganization(e.target.value);
        setOrganizationId(e.target.value);
      }}
      className="max-w-[140px] truncate rounded border border-twin-cyan/20 bg-black/40 px-2 py-1 text-xs text-twin-cyan"
      aria-label="Organização"
    >
      {organizations.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
