import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp } from "lucide-react";
import { AppIcon } from "@/components/shared/AppIcon";
import { Button } from "@/components/ui/button";
import { ContentRenderer } from "@/components/shared/content/ContentRenderer";
import type { ContentDocumentV1 } from "@exam/domain";

type RankingOption = {
  id: string;
  content: string;
  contentDocument?: ContentDocumentV1 | null;
};

/**
 * Ordering input. Until the candidate moves something, the list shows the
 * per-attempt presented order and no answer is stored; every move reports
 * the full ordered id array.
 */
export function RankingInput({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: RankingOption[];
  value: string[] | undefined;
  onChange: (answer: unknown) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const byId = new Map(options.map((o) => [o.id, o]));
  const ordered =
    value &&
    value.length === options.length &&
    value.every((id) => byId.has(id))
      ? value.map((id) => byId.get(id)!)
      : options;

  function move(index: number, delta: -1 | 1) {
    const next = ordered.map((o) => o.id);
    const target = index + delta;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="type-metadata">
        {t("candidateRuntime.answer.rankingHint")}
      </p>
      <ol className="flex flex-col gap-2">
        {ordered.map((option, i) => (
          <li
            key={option.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${disabled ? "opacity-50" : ""}`}
          >
            <span className="type-secondary w-6">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <ContentRenderer
                content={option.content}
                document={option.contentDocument}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || i === 0}
              aria-label={t("candidateRuntime.answer.moveUp", {
                option: option.content,
              })}
              onClick={() => move(i, -1)}
            >
              <AppIcon icon={ArrowUp} size="inline" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || i === ordered.length - 1}
              aria-label={t("candidateRuntime.answer.moveDown", {
                option: option.content,
              })}
              onClick={() => move(i, 1)}
            >
              <AppIcon icon={ArrowDown} size="inline" />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
