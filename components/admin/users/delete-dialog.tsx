import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminUsersDeleteDialogState } from "@/hooks/use-admin-users";

export function AdminUsersDeleteDialog({
  isOpen,
  userName,
  onCancel,
  onConfirm,
}: AdminUsersDeleteDialogState) {
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open={isOpen}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {userName || "this user"}? This
            action will immediately revoke their access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
