import { PencilEditIcon, TrashIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUsersTableState } from "@/hooks/use-admin-users";

export function AdminUsersTable({
  rows,
  page,
  pageSize,
  totalPages,
  totalItems,
  onNextPage,
  onPrevPage,
  onEdit,
  onDelete,
  onToggleStatus,
}: AdminUsersTableState) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell className="h-32 text-center text-sm" colSpan={7}>
                  No users found with the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow className="align-middle" key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-border">
                        <AvatarFallback className="bg-primary/10 font-semibold text-primary text-sm">
                          {row.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {row.fullName}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {row.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {row.roleLabel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={row.statusBadgeClassName}
                      title={row.statusDescription}
                    >
                      <span
                        aria-hidden
                        className={`mr-2 inline-flex h-2 w-2 rounded-full ${row.statusDotClassName}`}
                      />
                      {row.statusLabel}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <div className="flex items-center gap-2 rounded-full border px-3 py-1">
                        <span className="font-medium text-muted-foreground text-xs">
                          {row.status === "active" ? "Active" : "Inactive"}
                        </span>
                        <Switch
                          aria-label={`Change status of ${row.fullName}`}
                          checked={row.status === "active"}
                          onCheckedChange={() => onToggleStatus(row.id)}
                        />
                      </div>
                      <Button
                        aria-label={`Edit ${row.fullName}`}
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit(row.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <PencilEditIcon size={16} />
                      </Button>
                      <Button
                        aria-label={`Delete ${row.fullName}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(row.id)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <TrashIcon size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t bg-card px-4 py-3 text-muted-foreground text-xs">
        <div>
          {totalItems === 0 ? (
            <span>No users to display</span>
          ) : (
            <span>
              Showing{" "}
              <span className="font-medium">
                {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, totalItems)}
              </span>{" "}
              of <span className="font-medium">{totalItems}</span> users
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={onPrevPage}
            size="sm"
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <span>
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </span>
          <Button
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={onNextPage}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
