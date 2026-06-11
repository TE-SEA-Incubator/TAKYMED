import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-primary mb-4">{title}</h1>
      <p className="text-muted-foreground mb-8 max-w-lg mx-auto">{description}</p>
      <Link to="/">
        <Button>Retour à l'accueil</Button>
      </Link>
    </div>
  );
}
