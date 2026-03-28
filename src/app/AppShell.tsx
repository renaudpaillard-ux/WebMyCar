import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";

export default function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__main">
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
