// /staff/dashboard → redirect to /staff (canonical staff home)
import { redirect } from "next/navigation";

export default function StaffDashboardRedirect() {
  redirect("/staff");
}
