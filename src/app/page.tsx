import { redirect } from "next/navigation";

// The root simply routes into the dashboard. The middleware enforces auth and
// will redirect unauthenticated users to /login.
export default function Home() {
  redirect("/dashboard");
}
