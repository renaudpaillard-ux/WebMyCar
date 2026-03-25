import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./app/AppShell";
import {
  createDatabaseAtPath,
  getCurrentDatabaseInfo,
  openDatabaseAtPath,
  revealCurrentDatabaseInFolder,
  saveDatabaseAsPath,
} from "./features/app-file/api";
import type { CurrentDatabaseInfo, MenuActionPayload } from "./features/app-file/types";
import DashboardPage from "./pages/DashboardPage";
import DocumentsPage from "./pages/DocumentsPage";
import FuelPage from "./pages/FuelPage";
import MaintenancePage from "./pages/MaintenancePage";
import OdometerPage from "./pages/OdometerPage";
import RemindersPage from "./pages/RemindersPage";
import SettingsPage from "./pages/SettingsPage";
import VehiclesPage from "./pages/VehiclesPage";

const DATABASE_FILE_FILTERS = [{ name: "Base WebMyCar", extensions: ["wmc"] }];

export default function App() {
  const [databaseInfo, setDatabaseInfo] = useState<CurrentDatabaseInfo | null>(null);
  const [databaseRevision, setDatabaseRevision] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function handleMenuAction(payload: MenuActionPayload) {
      try {
        if (payload.action === "new") {
          const selectedPath = await save({
            filters: DATABASE_FILE_FILTERS,
            defaultPath: "nouvelle-base.wmc",
          });

          if (typeof selectedPath === "string") {
            await createDatabaseAtPath(selectedPath);
          }
          return;
        }

        if (payload.action === "open") {
          const selectedPath = await open({
            filters: DATABASE_FILE_FILTERS,
            multiple: false,
            directory: false,
          });

          if (typeof selectedPath === "string") {
            await openDatabaseAtPath(selectedPath);
          }
          return;
        }

        if (payload.action === "open_recent" && payload.path) {
          await openDatabaseAtPath(payload.path);
          return;
        }

        if (payload.action === "save_as") {
          const selectedPath = await save({
            filters: DATABASE_FILE_FILTERS,
            defaultPath: databaseInfo?.file_name ?? "copie-webmycar.wmc",
          });

          if (typeof selectedPath === "string") {
            await saveDatabaseAsPath(selectedPath);
          }
          return;
        }

        if (payload.action === "show_in_folder") {
          await revealCurrentDatabaseInFolder();
        }
      } catch (error) {
        window.alert(typeof error === "string" ? error : "Impossible d'exécuter l'action Fichier.");
      }
    }

    void getCurrentDatabaseInfo()
      .then((info) => {
        if (isMounted) {
          setDatabaseInfo(info);
        }
      })
      .catch(() => {});

    const unsubscribePromise = Promise.all([
      listen<CurrentDatabaseInfo>("database-changed", (event) => {
        if (!isMounted) {
          return;
        }

        setDatabaseInfo(event.payload);
        setDatabaseRevision((previous) => previous + 1);
      }),
      listen<MenuActionPayload>("menu-action", (event) => {
        void handleMenuAction(event.payload);
      }),
    ]);

    return () => {
      isMounted = false;
      void unsubscribePromise.then((unsubscribe) => {
        unsubscribe.forEach((current) => current());
      });
    };
  }, [databaseInfo?.file_name]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell key={databaseRevision} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="vehicles" element={<VehiclesPage />} />
          <Route path="fuel" element={<FuelPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="odometer" element={<OdometerPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
