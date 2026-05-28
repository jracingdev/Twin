"use client";



import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

} from "react";

import { api, type Organization, twinApi } from "@/lib/api";

import { clearToken, getOrganizationId, getToken, setOrganizationId } from "@/lib/auth";



export type AuthUser = {

  id: number;

  name: string;

  email: string;

};



type AuthContextValue = {

  user: AuthUser | null;

  organization: Organization | null;

  organizations: Organization[];

  loading: boolean;

  refresh: () => Promise<void>;

  logout: () => Promise<void>;

  switchOrganization: (orgId: string) => Promise<void>;

};



const AuthContext = createContext<AuthContextValue | null>(null);



export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [user, setUser] = useState<AuthUser | null>(null);

  const [organization, setOrganization] = useState<Organization | null>(null);

  const [organizations, setOrganizations] = useState<Organization[]>([]);

  const [loading, setLoading] = useState(true);



  const refresh = useCallback(async () => {

    const token = getToken();

    if (!token) {

      setUser(null);

      setOrganization(null);

      setOrganizations([]);

      setLoading(false);

      return;

    }

    setLoading(true);

    try {

      const data = await api<{

        user: AuthUser;

        organization: Organization | null;

        organizations?: Organization[];

      }>("/me");

      setUser(data.user);

      const orgs = data.organizations ?? (data.organization ? [data.organization] : []);

      setOrganizations(orgs);

      const storedId = getOrganizationId();

      const active =

        orgs.find((o) => o.id === storedId) ?? data.organization ?? orgs[0] ?? null;

      setOrganization(active);

      if (active?.id) setOrganizationId(active.id);

    } catch {

      clearToken();

      setUser(null);

      setOrganization(null);

      setOrganizations([]);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    refresh();

  }, [refresh]);



  const switchOrganization = useCallback(async (orgId: string) => {

    const res = await twinApi.switchOrganization(orgId);

    setOrganization(res.organization);

    setOrganizationId(res.organization.id);

    window.location.reload();

  }, []);



  const logout = useCallback(async () => {

    try {

      await api("/logout", { method: "POST" });

    } catch {

      /* token may already be invalid */

    }

    clearToken();

    setUser(null);

    setOrganization(null);

    setOrganizations([]);

    window.location.href = "/login";

  }, []);



  const value = useMemo(

    () => ({

      user,

      organization,

      organizations,

      loading,

      refresh,

      logout,

      switchOrganization,

    }),

    [user, organization, organizations, loading, refresh, logout, switchOrganization]

  );



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;

}



export function useAuth(): AuthContextValue {

  const ctx = useContext(AuthContext);

  if (!ctx) {

    throw new Error("useAuth must be used within AuthProvider");

  }

  return ctx;

}

