import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { AppIcon } from "@/components/shared/AppIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const MIN_COLUMNS = 2;
const MAX_COLUMNS = 10;

/**
 * Container width at which the statement × column grid fits without
 * horizontal scroll (statement ≥10rem, column ≥4.5rem, delete 2.25rem, 0.5rem
 * gaps). Narrower containers stack each statement with its labelled radios.
 * Literal class strings so Tailwind can see them.
 */
const GRID_LAYOUT: Record<number, { grid: string; stack: string }> = {
  2: { grid: "hidden @sm:grid", stack: "@sm:hidden" },
  3: { grid: "hidden @md:grid", stack: "@md:hidden" },
  4: { grid: "hidden @xl:grid", stack: "@xl:hidden" },
  5: { grid: "hidden @2xl:grid", stack: "@2xl:hidden" },
  6: { grid: "hidden @3xl:grid", stack: "@3xl:hidden" },
  7: { grid: "hidden @3xl:grid", stack: "@3xl:hidden" },
  8: { grid: "hidden @4xl:grid", stack: "@4xl:hidden" },
  9: { grid: "hidden @5xl:grid", stack: "@5xl:hidden" },
  10: { grid: "hidden @5xl:grid", stack: "@5xl:hidden" },
};

/**
 * Likert authoring: an editable list of scale labels (the columns) and one
 * row per statement (the question options) with a radio marking its correct
 * column. Wide containers show the grid the candidate sees; narrow ones stack.
 */
export function LikertEditor({
  rows,
  scale,
  answer,
  onAddRow,
  onRemoveRow,
  onRowChange,
  onScaleChange,
  onCorrectChange,
}: {
  rows: { id: string; content: string }[];
  scale: string[];
  answer: Record<string, number>;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  onRowChange: (index: number, content: string) => void;
  onScaleChange: (scale: string[]) => void;
  onCorrectChange: (rowId: string, column: number) => void;
}) {
  const { t } = useTranslation();
  const layout = GRID_LAYOUT[scale.length] ?? GRID_LAYOUT[MAX_COLUMNS]!;

  const rowInput = (row: { content: string }, i: number) => (
    <Input
      value={row.content}
      placeholder={t("admin.forms.question.likertRowPlaceholder", { n: i + 1 })}
      onChange={(e) => onRowChange(i, e.target.value)}
    />
  );

  const removeButton = (i: number) =>
    rows.length > 2 ? (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t("admin.forms.question.removeRow", { n: i + 1 })}
        onClick={() => onRemoveRow(i)}
      >
        <AppIcon icon={Trash2} size="inline" />
      </Button>
    ) : (
      <span />
    );

  const correctGroup = (
    row: { id: string },
    i: number,
    className: string,
    showLabels: boolean,
  ) => (
    <RadioGroup
      className={className}
      value={answer[row.id] === undefined ? "" : String(answer[row.id])}
      onValueChange={(v) => onCorrectChange(row.id, Number(v))}
      aria-label={t("admin.forms.question.likertCorrect", { n: i + 1 })}
    >
      {scale.map((label, column) =>
        showLabels ? (
          <label
            key={column}
            className="flex cursor-pointer items-center gap-2 type-secondary"
          >
            <RadioGroupItem value={String(column)} />
            {label}
          </label>
        ) : (
          <div key={column} className="flex justify-center">
            <RadioGroupItem value={String(column)} aria-label={label} />
          </div>
        ),
      )}
    </RadioGroup>
  );

  return (
    <div className="@container flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("admin.forms.question.likertColumns")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scale.length >= MAX_COLUMNS}
              onClick={() =>
                onScaleChange([
                  ...scale,
                  t("admin.forms.question.likertColumnLabel", {
                    n: scale.length + 1,
                  }),
                ])
              }
            >
              <AppIcon icon={Plus} size="inline" />
              {t("admin.forms.question.addColumn")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={scale.length <= MIN_COLUMNS}
              onClick={() => onScaleChange(scale.slice(0, -1))}
            >
              {t("admin.forms.question.removeColumn")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 @sm:grid-cols-2 @2xl:grid-cols-3">
          {scale.map((label, column) => (
            <Input
              key={column}
              value={label}
              aria-label={t("admin.forms.question.likertColumnLabel", {
                n: column + 1,
              })}
              onChange={(e) =>
                onScaleChange(
                  scale.map((l, c) => (c === column ? e.target.value : l)),
                )
              }
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>{t("admin.forms.question.likertRows")}</Label>
          <Button type="button" variant="outline" size="sm" onClick={onAddRow}>
            <AppIcon icon={Plus} size="inline" />
            {t("admin.forms.question.addRow")}
          </Button>
        </div>

        <div
          className={`${layout.grid} items-center gap-x-2 gap-y-2`}
          style={{
            gridTemplateColumns: `minmax(10rem, 2fr) repeat(${scale.length}, minmax(0, 1fr)) 2.25rem`,
          }}
        >
          <span />
          {scale.map((label, column) => (
            <span
              key={column}
              className="type-metadata px-1 text-center [overflow-wrap:anywhere]"
            >
              {label}
            </span>
          ))}
          <span />
          {rows.map((row, i) => (
            <Fragment key={row.id}>
              {rowInput(row, i)}
              {correctGroup(row, i, "contents", false)}
              {removeButton(i)}
            </Fragment>
          ))}
        </div>

        <div className={`${layout.stack} flex flex-col gap-3`}>
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                {rowInput(row, i)}
                {removeButton(i)}
              </div>
              {correctGroup(row, i, "flex flex-col gap-2", true)}
            </div>
          ))}
        </div>
      </div>

      <p className="type-metadata">{t("admin.forms.question.likertHint")}</p>
    </div>
  );
}
