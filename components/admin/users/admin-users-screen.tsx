import type { AdminUsersViewModel } from "@/hooks/use-admin-users";
import { AdminUsersDeleteDialog } from "./delete-dialog";
import { AdminUsersSummaryCards } from "./summary-cards";
import { AdminUsersToolbar } from "./toolbar";
import { AdminUsersFormSheet } from "./user-form-sheet";
import { AdminUsersTable } from "./user-table";

export function AdminUsersScreen({
  summaryCards,
  syncLabel,
  toolbar,
  statusFilterOptions,
  table,
  form,
  deleteDialog,
}: AdminUsersViewModel) {
  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-b from-background via-background to-muted/40 p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-primary text-sm">Admin Panel</p>
          <div>
            <h1 className="font-semibold text-2xl">Users</h1>
            <p className="text-muted-foreground text-sm">
              Monitor who has access to Welthra and control their status in one
              place.
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm">{syncLabel}</span>
      </header>

      <AdminUsersSummaryCards cards={summaryCards} />
      <AdminUsersToolbar options={statusFilterOptions} toolbar={toolbar} />
      {table.totalItems === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-16 text-center text-muted-foreground text-sm">
          <p className="mb-1 font-medium text-foreground">
            There are no users yet.
          </p>
          <p className="max-w-md">
            Use the <span className="font-semibold">“Add user”</span> button
            above to create the first account and start managing access to
            Welthra.
          </p>
        </div>
      ) : (
        <AdminUsersTable {...table} />
      )}

      <AdminUsersFormSheet form={form} />
      <AdminUsersDeleteDialog {...deleteDialog} />
    </section>
  );
}
