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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AdminUsersFormState } from "@/hooks/use-admin-users";
import { roleLabels } from "@/lib/admin/users";

export function AdminUsersFormSheet({ form }: { form: AdminUsersFormState }) {
  return (
    <Sheet onOpenChange={form.onOpenChange} open={form.isOpen}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{form.title}</SheetTitle>
          <SheetDescription>
            Define the user's data to manage their access to the panel.
          </SheetDescription>
        </SheetHeader>
        <form className="mt-6 space-y-4" onSubmit={form.onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="admin-user-name">Name</Label>
            <Input
              id="admin-user-name"
              onChange={(event) =>
                form.onFieldChange("fullName", event.target.value)
              }
              placeholder="Lucía Ortega"
              value={form.draft.fullName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-user-email">Email</Label>
            <Input
              id="admin-user-email"
              onChange={(event) =>
                form.onFieldChange("email", event.target.value)
              }
              placeholder="usuario@welthra.com"
              type="email"
              value={form.draft.email}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                onValueChange={(value) => form.onFieldChange("role", value)}
                value={form.draft.role}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {form.roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                onValueChange={(value) => form.onFieldChange("status", value)}
                value={form.draft.status}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {form.statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === "active" ? "Active" : "Inactive"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.error ? (
            <p className="font-medium text-destructive text-sm">{form.error}</p>
          ) : null}
          <SheetFooter className="flex flex-col gap-2 sm:flex-row sm:space-x-2">
            <Button
              className="w-full"
              onClick={() => form.onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button className="w-full" type="submit">
              {form.submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
