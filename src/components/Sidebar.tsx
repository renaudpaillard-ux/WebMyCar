import { NavLink } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  caption: string;
}

const mainNav: NavItem[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: "⊞", caption: "Vue d'ensemble" },
  { to: "/vehicles", label: "Véhicules", icon: "◈", caption: "Fiches et profils" },
  { to: "/odometer", label: "Kilométrage", icon: "◎", caption: "Historique des relevés" },
  { to: "/fuel", label: "Carburant", icon: "⊕", caption: "Pleins et recharges" },
  { to: "/maintenance", label: "Entretien", icon: "⚙", caption: "Suivi des opérations" },
  { to: "/reminders", label: "Échéances", icon: "◷", caption: "Alertes à venir" },
  { to: "/documents", label: "Documents", icon: "◻", caption: "Pièces et justificatifs" },
];

const bottomNav: NavItem[] = [
  { to: "/settings", label: "Paramètres", icon: "⊙", caption: "Préférences de l'application" },
];

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark" aria-hidden="true">W</div>
        <div className="sidebar__brand-text">
          <div className="sidebar__brand-title">WebMyCar</div>
          <div className="sidebar__brand-subtitle">Gestion automobile personnelle</div>
        </div>
      </div>

      <div className="sidebar__nav">
        <div className="sidebar__section-label">Navigation</div>
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sidebar__link-text">
              <span className="sidebar__link-label">{item.label}</span>
              <span className="sidebar__link-caption">{item.caption}</span>
            </span>
          </NavLink>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__section-label">Application</div>
        {bottomNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "sidebar__link" + (isActive ? " active" : "")}
          >
            <span className="sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="sidebar__link-text">
              <span className="sidebar__link-label">{item.label}</span>
              <span className="sidebar__link-caption">{item.caption}</span>
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
