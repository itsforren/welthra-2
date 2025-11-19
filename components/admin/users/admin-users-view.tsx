"use client";

import { useAdminUsers } from "@/hooks/use-admin-users";
import { AdminUsersScreen } from "./admin-users-screen";

export function AdminUsersView() {
  const viewModel = useAdminUsers();

  return <AdminUsersScreen {...viewModel} />;
}
