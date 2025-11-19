import Link from "next/link";
import { AdminUsersView } from "@/components/admin/users/admin-users-view";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  return (
    <div className="container mx-auto py-10">
      <Link href="/">
        <Button className="mb-4" variant="outline">
          Back to Home
        </Button>
      </Link>

      <AdminUsersView />
    </div>
  );
}
