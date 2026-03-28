interface PagePlaceholderProps {
  title: string;
  subtitle: string;
  status: string;
  description: string;
}

export default function PagePlaceholder({
  title,
  subtitle,
  status,
  description,
}: PagePlaceholderProps) {
  return (
    <div className="placeholder-page">
      <div className="page-header">
        <div>
          <h1 className="page-header__title">{title}</h1>
          <p className="page-header__subtitle">{subtitle}</p>
        </div>
      </div>

      <section className="placeholder-card">
        <span className="placeholder-card__status">{status}</span>
        <h2 className="placeholder-card__title">{title}</h2>
        <p className="placeholder-card__body">{description}</p>
      </section>
    </div>
  );
}
