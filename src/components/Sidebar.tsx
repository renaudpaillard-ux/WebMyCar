import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: "⊞" },
  { to: "/vehicles", label: "Véhicules", icon: "◈" },
  { to: "/odometer", label: "Kilométrage", icon: "◎" },
  { to: "/fuel", label: "Carburant", icon: "⊕" },
  { to: "/maintenance", label: "Entretien", icon: "⚙" },
  { to: "/reminders", label: "Échéances", icon: "◷" },
  { to: "/documents", label: "Documents", icon: "◻" },
];

const bottomNav: NavItem[] = [{ to: "/settings", label: "Paramètres", icon: "⊙" }];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">WebMyCar</div>

      <div className="sidebar__nav">
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="sidebar__footer">
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
