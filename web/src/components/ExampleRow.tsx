import { EXAMPLES, type Example } from "@/examples";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

interface Props {
  onPick: (example: Example) => void;
  disabled?: boolean;
}

/** Four made-up scams that run through the normal check pipeline with one tap. */
export function ExampleRow({ onPick, disabled }: Props) {
  const t = useT();
  return (
    <section aria-labelledby="examples-title" className="mt-10 border-t pt-6">
      <h2 id="examples-title" className="text-lg font-semibold">
        {t("examples.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("examples.hint")}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <li key={ex.id}>
            <Button type="button" variant="outline" size="lg" disabled={disabled} onClick={() => onPick(ex)} data-example={ex.id}>
              {t(ex.titleKey)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
