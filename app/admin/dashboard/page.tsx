// /admin/dashboard → redirect to /admin (canonical admin home)
import { redirect } from "next/navigation";

export default function AdminDashboardRedirect() {
  redirect("/admin");
}
