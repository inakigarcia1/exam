import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { ContentRenderer } from "@/components/shared/content/ContentRenderer";
import type { ContentDocumentV1 } from "@exam/domain";

/**
 * Likert grid: one row per statement, one radio per scale column. Each pick
 * reports the whole `Record<rowId, columnIndex>` so partial drafts save.
 */
export function LikertInput({
  rows,
  scale,
  value,
  onChange,
  disabled = false,
}: {
  rows: {
    id: string;
    content: string;
    contentDocument?: ContentDocumentV1 | null;
  }[];
  scale: string[];
  value: Record<string, number>;
  onChange: (answer: unknown) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <div
        className="grid items-center gap-x-2 gap-y-1"
        style={{
          gridTemplateColumns: `minmax(10rem, 2fr) repeat(${scale.length}, minmax(5rem, 1fr))`,
        }}
      >
        <span />
        {scale.map((label, column) => (
          <span key={column} className="type-secondary px-1 text-center">
            {label}
          </span>
        ))}
        {rows.map((row) => (
          <Fragment key={row.id}>
            <div className="border-t py-3">
              <ContentRenderer
                content={row.content}
                document={row.contentDocument}
              />
            </div>
            {scale.map((label, column) => (
              <label
                key={column}
                className={`flex h-full items-center justify-center border-t py-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  name={`likert-${row.id}`}
                  checked={value[row.id] === column}
                  onChange={() => onChange({ ...value, [row.id]: column })}
                  disabled={disabled}
                  aria-label={`${t("candidateRuntime.answer.likertRow", { row: row.content })}: ${label}`}
                  className="size-4 accent-primary"
                />
              </label>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
