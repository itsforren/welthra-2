const MINUTE_IN_MS = 60_000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;
const DAY_IN_MS = 24 * HOUR_IN_MS;

export const adminUserStatuses = ["active", "inactive"] as const;
export type AdminUserStatus = (typeof adminUserStatuses)[number];

export const adminUserRoles = ["admin", "user"] as const;
export type AdminUserRole = (typeof adminUserRoles)[number];

export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastActiveAt: string;
  sessions: number;
  location: string;
};

const baseUsers: AdminUser[] = [
  {
    id: "usr_4f91aa",
    fullName: "Mateo Salgado",
    email: "msalgado@welthra.com",
    role: "admin",
    status: "active",
    lastActiveAt: "2025-11-18T10:30:00.000Z",
    sessions: 176,
    location: "Monterrey, MX",
  },
  {
    id: "usr_7be430",
    fullName: "Renata Valdés",
    email: "renata@welthra.com",
    role: "user",
    status: "inactive",
    lastActiveAt: "2025-11-14T21:05:00.000Z",
    sessions: 102,
    location: "Bogotá, CO",
  },
  {
    id: "usr_fae239",
    fullName: "Andrés Molina",
    email: "andres@welthra.com",
    role: "user",
    status: "active",
    lastActiveAt: "2025-11-18T07:55:00.000Z",
    sessions: 88,
    location: "Buenos Aires, AR",
  },
  {
    id: "usr_c00c13",
    fullName: "Fernanda Cárdenas",
    email: "fcardenas@welthra.com",
    role: "user",
    status: "inactive",
    lastActiveAt: "2025-11-10T16:12:00.000Z",
    sessions: 47,
    location: "Lima, PE",
  },
  {
    id: "usr_71b403",
    fullName: "Iván Ríos",
    email: "ivan.rios@welthra.com",
    role: "user",
    status: "active",
    lastActiveAt: "2025-11-17T22:18:00.000Z",
    sessions: 63,
    location: "Santiago, CL",
  },
  {
    id: "usr_3b192a",
    fullName: "Marina Duarte",
    email: "marina@welthra.com",
    role: "user",
    status: "active",
    lastActiveAt: "2025-11-15T14:02:00.000Z",
    sessions: 134,
    location: "Madrid, ES",
  },
  {
    id: "usr_8d310b",
    fullName: "Sebastián León",
    email: "sleon@welthra.com",
    role: "user",
    status: "active",
    lastActiveAt: "2025-11-13T19:44:00.000Z",
    sessions: 51,
    location: "Quito, EC",
  },
];

export const mockAdminUsers = baseUsers;

const statusTokens: Record<
  AdminUserStatus,
  {
    label: string;
    badgeClassName: string;
    dotClassName: string;
    description: string;
  }
> = {
  active: {
    label: "Activo",
    badgeClassName:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dotClassName: "bg-emerald-500",
    description: "Sesión válida",
  },
  inactive: {
    label: "Inactivo",
    badgeClassName: "border-transparent bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground/40",
    description: "Sin actividad reciente",
  },
};

export const roleLabels: Record<AdminUserRole, string> = {
  admin: "Admin",
  user: "User",
};

export const getAdminUserStatusTokens = (status: AdminUserStatus) =>
  statusTokens[status];

export const getUserInitials = (fullName: string) => {
  if (!fullName) {
    return "?";
  }

  const normalized = fullName.trim().split(/\s+/);
  if (normalized.length === 1) {
    return normalized[0]?.at(0)?.toUpperCase() ?? "?";
  }

  const [first, second] = normalized;
  return `${first?.at(0) ?? ""}${second?.at(0) ?? ""}`.toUpperCase();
};

const coerceDate = (value: string | number) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

export const formatRelativeLastActive = (isoDate: string) => {
  const date = coerceDate(isoDate);
  if (!date) {
    return "No activity";
  }

  const diff = Date.now() - date.getTime();

  if (diff < HOUR_IN_MS) {
    const minutes = Math.max(1, Math.round(diff / MINUTE_IN_MS));
    return ` ${minutes} minutes ago`;
  }

  if (diff < DAY_IN_MS) {
    const hours = Math.max(1, Math.round(diff / HOUR_IN_MS));
    return ` ${hours} hours ago`;
  }

  if (diff < 14 * DAY_IN_MS) {
    const days = Math.max(1, Math.round(diff / DAY_IN_MS));
    return ` ${days} days ago`;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const formatRelativeSyncLabel = (timestamp: number) => {
  const diff = Date.now() - timestamp;

  if (diff < MINUTE_IN_MS) {
    return "Updated a few seconds ago";
  }

  if (diff < HOUR_IN_MS) {
    const minutes = Math.max(1, Math.round(diff / MINUTE_IN_MS));
    return `Updated ${minutes} min ago`;
  }

  if (diff < DAY_IN_MS) {
    const hours = Math.max(1, Math.round(diff / HOUR_IN_MS));
    return `Updated ${hours} hours ago`;
  }

  const date = coerceDate(timestamp);
  if (!date) {
    return "Not synchronized";
  }

  return `Last sync: ${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
};
