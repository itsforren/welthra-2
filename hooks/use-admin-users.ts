"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  adminActivateUserSubscription,
  adminCreateUser,
  adminDeactivateUserSubscription,
  adminDeleteUser,
  adminListUsers,
  adminUpdateUser,
} from "@/actions/admin/actions";
import {
  type AdminUser,
  type AdminUserRole,
  type AdminUserStatus,
  adminUserRoles,
  adminUserStatuses,
  formatRelativeSyncLabel,
  getAdminUserStatusTokens,
  getUserInitials,
  roleLabels,
} from "@/lib/admin/users";

type StatusFilter = AdminUserStatus | "all";
export type AdminUsersStatusFilter = StatusFilter;

type AdminUserDraft = {
  id?: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  location: string;
  sessions: number;
  lastActiveAt: string;
};

type EditableField = "fullName" | "email" | "role" | "status" | "location";

const PAGE_SIZE = 20;

const deriveFullNameFromEmail = (email: string) => {
  const [local] = email.split("@");
  if (!local) {
    return email;
  }

  const parts = local.replace(/[._]/g, " ").split(" ");

  return parts
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
};

export type AdminUsersSummaryCard = {
  label: string;
  value: string;
  helper: string;
};

export type AdminUsersToolbarState = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onCreateClick: () => void;
};

export type AdminStatusFilterOption = {
  value: StatusFilter;
  label: string;
};

export type AdminUserRowView = {
  id: string;
  fullName: string;
  email: string;
  roleLabel: string;
  statusLabel: string;
  statusBadgeClassName: string;
  statusDotClassName: string;
  statusDescription: string;
  initials: string;
  status: AdminUserStatus;
};

export type AdminUsersTableState = {
  rows: AdminUserRowView[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPrevPage: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
};

export type AdminUsersFormState = {
  isOpen: boolean;
  mode: "create" | "edit";
  title: string;
  submitLabel: string;
  draft: AdminUserDraft;
  error: string | null;
  roleOptions: readonly AdminUserRole[];
  statusOptions: readonly AdminUserStatus[];
  onOpenChange: (open: boolean) => void;
  onFieldChange: (field: EditableField, value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
};

export type AdminUsersDeleteDialogState = {
  isOpen: boolean;
  userName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export type AdminUsersViewModel = {
  summaryCards: AdminUsersSummaryCard[];
  syncLabel: string;
  toolbar: AdminUsersToolbarState;
  statusFilterOptions: AdminStatusFilterOption[];
  table: AdminUsersTableState;
  form: AdminUsersFormState;
  deleteDialog: AdminUsersDeleteDialogState;
};

const createEmptyDraft = (): AdminUserDraft => ({
  fullName: "",
  email: "",
  role: "user",
  status: "active",
  location: "",
  sessions: 0,
  lastActiveAt: new Date().toISOString(),
});

const sanitizeText = (value: string) => value.replace(/\s+/g, " ").trim();

export const useAdminUsers = (): AdminUsersViewModel => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formDraft, setFormDraft] = useState<AdminUserDraft>(() =>
    createEmptyDraft()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [lastSyncTs, setLastSyncTs] = useState(() => Date.now() - 120_000);

  const persistUsers = useCallback(
    (updater: (prev: AdminUser[]) => AdminUser[]) => {
      setUsers((prev) => updater(prev));
      setLastSyncTs(Date.now());
    },
    []
  );

  useEffect(() => {
    let isCancelled = false;

    const loadUsersFromDatabase = async () => {
      try {
        const records = await adminListUsers();
        if (isCancelled) {
          return;
        }

        const hydrated: AdminUser[] = records.map((record) => ({
          id: record.id,
          email: record.email,
          fullName: deriveFullNameFromEmail(record.email),
          role: record.role === "admin" ? "admin" : "user",
          status:
            record.subscriptionStatus === "active" ? "active" : "inactive",
          sessions: 0,
          location: "",
          lastActiveAt: new Date().toISOString(),
        }));

        setUsers(hydrated);
      } catch {
        // If the query fails, keep the list empty so the empty-state
        // message is rendered.
      }
    };

    loadUsersFromDatabase();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: StatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return users
      .filter((user) => {
        const matchesStatus =
          statusFilter === "all" ? true : user.status === statusFilter;
        if (!normalizedSearch) {
          return matchesStatus;
        }
        const haystack =
          `${user.fullName} ${user.email} ${roleLabels[user.role]} ${user.location}`.toLowerCase();
        return matchesStatus && haystack.includes(normalizedSearch);
      })
      .sort(
        (a, b) =>
          new Date(b.lastActiveAt).getTime() -
          new Date(a.lastActiveAt).getTime()
      );
  }, [users, searchValue, statusFilter]);

  const allRows: AdminUserRowView[] = useMemo(
    () =>
      filteredUsers.map((user) => {
        const statusTokens = getAdminUserStatusTokens(user.status);
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          roleLabel: roleLabels[user.role],
          statusLabel: statusTokens.label,
          statusBadgeClassName: statusTokens.badgeClassName,
          statusDotClassName: statusTokens.dotClassName,
          statusDescription: statusTokens.description,
          // lastActiveLabel:
          //   user.sessions === 0
          //     ? "-"
          //     : formatRelativeLastActive(user.lastActiveAt),
          // sessions: user.sessions,
          // location: user.location,
          initials: getUserInitials(user.fullName),
          status: user.status,
        };
      }),
    [filteredUsers]
  );

  const totalItems = allRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const rows: AdminUserRowView[] = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return allRows.slice(start, end);
  }, [allRows, currentPage]);

  const summaryCards: AdminUsersSummaryCard[] = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === "active").length;
    const inactive = total - active;
    const sessions = users.reduce((acc, user) => acc + user.sessions, 0);

    return [
      {
        label: "Total users",
        value: total.toString(),
        helper: `${active} active`,
      },
      {
        label: "Inactive users",
        value: inactive.toString(),
        helper: "Review their activity",
      },
      {
        label: "Accumulated sessions",
        value: sessions.toString(),
        helper: "Last 30 days",
      },
    ];
  }, [users]);

  const statusFilterOptions: AdminStatusFilterOption[] = useMemo(
    () => [
      { value: "all", label: "All" },
      ...adminUserStatuses.map((status) => ({
        value: status,
        label: status === "active" ? "Active" : "Inactive",
      })),
    ],
    []
  );

  const openCreateForm = useCallback(() => {
    setFormMode("create");
    setFormDraft(createEmptyDraft());
    setFormError(null);
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback(
    (userId: string) => {
      const user = users.find((item) => item.id === userId);
      if (!user) {
        return;
      }
      setFormMode("edit");
      setFormDraft({ ...user });
      setFormError(null);
      setIsFormOpen(true);
    },
    [users]
  );

  const closeForm = useCallback((open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setFormError(null);
      setFormDraft(createEmptyDraft());
    }
  }, []);

  const handleFieldChange = useCallback(
    (field: EditableField, value: string) => {
      setFormDraft((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const ensureRequiredFields = useCallback((draft: AdminUserDraft) => {
    if (!sanitizeText(draft.fullName) || !sanitizeText(draft.email)) {
      return "Complete the name and email.";
    }

    if (!sanitizeText(draft.location)) {
      return "Add the user's location.";
    }

    return null;
  }, []);

  const upsertUser = useCallback(async () => {
    const validationMessage = ensureRequiredFields(formDraft);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    const normalizedDraft: AdminUserDraft = {
      ...formDraft,
      fullName: sanitizeText(formDraft.fullName),
      email: sanitizeText(formDraft.email).toLowerCase(),
      location: sanitizeText(formDraft.location),
      lastActiveAt:
        formMode === "create"
          ? new Date().toISOString()
          : formDraft.lastActiveAt,
    };

    if (formMode === "create") {
      try {
        const created = await adminCreateUser({
          email: normalizedDraft.email,
          role: normalizedDraft.role,
        });

        const payload: AdminUser = {
          ...normalizedDraft,
          id: created.id,
        };

        persistUsers((prev) => [payload, ...prev]);
      } catch {
        setFormError("Failed to create user");
        return;
      }
    } else if (normalizedDraft.id) {
      try {
        await adminUpdateUser({
          id: normalizedDraft.id,
          email: normalizedDraft.email,
          role: normalizedDraft.role,
        });

        persistUsers((prev) =>
          prev.map((user) =>
            user.id === normalizedDraft.id
              ? { ...normalizedDraft, id: user.id }
              : user
          )
        );
      } catch {
        setFormError("Failed to update user");
        return;
      }
    }

    setIsFormOpen(false);
    setFormDraft(createEmptyDraft());
    setFormError(null);
  }, [ensureRequiredFields, formDraft, formMode, persistUsers]);

  const handleFormSubmit = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();
      upsertUser();
    },
    [upsertUser]
  );

  const queueDeleteUser = useCallback(
    (userId: string) => {
      const target = users.find((item) => item.id === userId);
      if (!target) {
        return;
      }
      setDeleteTarget(target);
    },
    [users]
  );

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) {
      return;
    }
    const targetId = deleteTarget.id;

    adminDeleteUser(targetId)
      .then(() => {
        persistUsers((prev) => prev.filter((user) => user.id !== targetId));
        setDeleteTarget(null);
      })
      .catch(() => {
        setDeleteTarget(null);
      });
  }, [deleteTarget, persistUsers]);

  const toggleStatus = useCallback(
    (userId: string) => {
      const target = users.find((user) => user.id === userId);
      if (!target) {
        return;
      }

      const nextStatus: AdminUserStatus =
        target.status === "active" ? "inactive" : "active";

      if (nextStatus === "active") {
        adminActivateUserSubscription(userId);
      } else {
        adminDeactivateUserSubscription(userId);
      }

      persistUsers((prev) =>
        prev.map((user) => {
          if (user.id !== userId) {
            return user;
          }
          return {
            ...user,
            status: nextStatus,
            lastActiveAt:
              nextStatus === "active"
                ? new Date().toISOString()
                : user.lastActiveAt,
          };
        })
      );
    },
    [persistUsers, users]
  );

  return {
    summaryCards,
    syncLabel: formatRelativeSyncLabel(lastSyncTs),
    toolbar: {
      searchValue,
      onSearchChange: handleSearchChange,
      statusFilter,
      onStatusFilterChange: handleStatusFilterChange,
      onCreateClick: openCreateForm,
    },
    statusFilterOptions,
    table: {
      rows,
      page: currentPage,
      pageSize: PAGE_SIZE,
      totalPages,
      totalItems,
      onPageChange: (nextPage: number) => {
        setPage(Math.min(Math.max(1, nextPage), totalPages));
      },
      onNextPage: () => {
        setPage((prev) => Math.min(prev + 1, totalPages));
      },
      onPrevPage: () => {
        setPage((prev) => Math.max(prev - 1, 1));
      },
      onEdit: openEditForm,
      onDelete: queueDeleteUser,
      onToggleStatus: toggleStatus,
    },
    form: {
      isOpen: isFormOpen,
      mode: formMode,
      title: formMode === "create" ? "Add user" : "Edit user",
      submitLabel: formMode === "create" ? "Create" : "Save changes",
      draft: formDraft,
      error: formError,
      roleOptions: adminUserRoles,
      statusOptions: adminUserStatuses,
      onOpenChange: closeForm,
      onFieldChange: handleFieldChange,
      onSubmit: handleFormSubmit,
    },
    deleteDialog: {
      isOpen: Boolean(deleteTarget),
      userName: deleteTarget?.fullName ?? "",
      onCancel: cancelDelete,
      onConfirm: confirmDelete,
    },
  };
};
