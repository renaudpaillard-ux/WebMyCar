import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  CarFront,
  FileText,
  Fuel,
  Gauge,
  LayoutDashboard,
  Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  caption: string;
}

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, caption: "Vue d'ensemble" },
  { to: "/vehicles", label: "Véhicules", icon: CarFront, caption: "Fiches et profils" },
  { to: "/odometer", label: "Kilométrage", icon: Gauge, caption: "Historique des relevés" },
  { to: "/fuel", label: "Carburant", icon: Fuel, caption: "Pleins et recharges" },
  { to: "/maintenance", label: "Entretien", icon: Wrench, caption: "Suivi des opérations" },
  { to: "/reminders", label: "Échéances", icon: BellRing, caption: "Alertes à venir" },
  { to: "/documents", label: "Documents", icon: FileText, caption: "Pièces et justificatifs" },
];

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
    >
      <span className="sidebar__link-icon" aria-hidden="true">
        <item.icon className="sidebar__link-icon-svg" strokeWidth={2} />
      </span>
      <span className="sidebar__link-text">
        <span className="sidebar__link-label">{item.label}</span>
        <span className="sidebar__link-caption">{item.caption}</span>
      </span>
    </NavLink>
  );
}

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__nav">
        {mainNav.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}
