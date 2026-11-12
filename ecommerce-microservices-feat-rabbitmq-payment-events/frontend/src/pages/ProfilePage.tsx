import { AtSign, BadgeCheck, CircleUserRound, Fingerprint } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { Card, PageHeading } from "../components/ui";

export function ProfilePage() {
  const { claims, roles } = useAuth();
  const details = [
    { icon: CircleUserRound, label: "Nom affiché", value: claims?.name || claims?.preferred_username || "Non renseigné" },
    { icon: AtSign, label: "Adresse e-mail", value: claims?.email || "Non renseignée" },
    { icon: Fingerprint, label: "Identifiant Keycloak", value: claims?.sub || "Indisponible" },
    { icon: BadgeCheck, label: "Rôles du realm", value: roles.length ? roles.join(", ") : "Aucun rôle transmis" },
  ];

  return (
    <>
      <PageHeading eyebrow="Compte" title="Mon profil" description="Informations de profil présentes dans le jeton Keycloak courant." />
      <Card className="max-w-3xl">
        <div className="divide-y divide-slate-100">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
              <div className="flex min-w-48 items-center gap-2 text-sm font-semibold text-muted"><Icon className="h-4 w-4 text-brand" />{label}</div>
              <span className="break-all text-sm text-ink">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-muted">Aucun mot de passe ni jeton n’est affiché ou conservé dans le stockage local du navigateur.</p>
      </Card>
    </>
  );
}
