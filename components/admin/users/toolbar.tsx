import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AdminStatusFilterOption,
  AdminUsersStatusFilter,
  AdminUsersToolbarState,
} from "@/hooks/use-admin-users";

export function AdminUsersToolbar({
  toolbar,
  options,
}: {
  toolbar: AdminUsersToolbarState;
  options: AdminStatusFilterOption[];
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <Label
            className="text-muted-foreground text-sm"
            htmlFor="admin-users-search"
          >
            Search
          </Label>
          <Input
            className="w-full"
            id="admin-users-search"
            onChange={(event) => toolbar.onSearchChange(event.target.value)}
            placeholder="Name, email or location"
            value={toolbar.searchValue}
          />
        </div>
        <div className="flex flex-1 items-center gap-3">
          <span className="font-medium text-muted-foreground text-sm">
            Status
          </span>
          <Select
            onValueChange={(value) =>
              toolbar.onStatusFilterChange(value as AdminUsersStatusFilter)
            }
            value={toolbar.statusFilter}
          >
            <SelectTrigger aria-label="Filter by status" className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Manage who can log in to Welthra and monitor their activity in real
          time.
        </p>
        <Button className="gap-2" onClick={toolbar.onCreateClick} type="button">
          <PlusIcon size={16} />
          <span>Add user</span>
        </Button>
      </div>
    </div>
  );
}
