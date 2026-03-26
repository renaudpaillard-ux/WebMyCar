import { useLocation } from "react-router-dom";

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Tableau de bord",
    subtitle: "Vue synthétique de votre parc et de vos prochains suivis.",
  },
  "/vehicles": {
    title: "Véhicules",
    subtitle: "Profils, motorisations et configuration de référence.",
  },
  "/odometer": {
    title: "Kilométrage",
    subtitle: "Historique des relevés pour garder un suivi fiable.",
  },
  "/fuel": {
    title: "Carburant",
    subtitle: "Pleins, recharges et consommation par véhicule.",
  },
  "/maintenance": {
    title: "Entretien",
    subtitle: "Interventions passées et opérations à prévoir.",
  },
  "/reminders": {
    title: "Échéances",
    subtitle: "Rappels utiles pour ne rien laisser filer.",
  },
  "/documents": {
    title: "Documents",
    subtitle: "Centralisez vos pièces et justificatifs importants.",
  },
  "/settings": {
    title: "Paramètres",
    subtitle: "Préférences et configuration générale de l'application.",
  },
};

export default function Header() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] ?? {
    title: "WebMyCar",
    subtitle: "Application desktop de gestion automobile.",
  };

  return (
    <header className="header">
      <div>
        <span className="header__eyebrow">WebMyCar</span>
        <div className="header__title">{meta.title}</div>
        <p className="header__subtitle">{meta.subtitle}</p>
      </div>
      <div className="header__meta" aria-hidden="true">
        <span className="header__meta-dot" />
        <span>Desktop</span>
      </div>
    </header>
  );
}
