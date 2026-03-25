import { useLocation } from "react-router-dom";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Tableau de bord",
  "/vehicles": "Véhicules",
  "/odometer": "Kilométrage",
  "/fuel": "Carburant",
  "/maintenance": "Entretien",
  "/reminders": "Échéances",
  "/documents": "Documents",
  "/settings": "Paramètres",
};

export default function Header() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? "WebMyCar";

  return (
    <header className="header">
      <span className="header__title">{title}</span>
    </header>
  );
}
