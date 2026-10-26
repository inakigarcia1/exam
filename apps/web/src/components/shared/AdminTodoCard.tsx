import type { LucideIcon } from "lucide-react";
import { CircleAlert, ChevronRight, RefreshCw } from "lucide-react";
import { Link } from "react-router";
import { AppIcon } from "@/components/shared/AppIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminTodoState } from "@/hooks/useAdminTodoCount";

/**
 * i18n-resolved copy for one todo card. Kept as plain strings so the card
 * stays a presentation-only component; numeric surfaces are composed from the
 * state itself (the bounded minimum only exists in fetched state).
 */
export interface AdminTodoCardCopy {
  /** Work name, e.g. "Calificación manual pendiente". */
  label: string;
  /** Count unit, e.g. "entregas" / "incidentes". */
  unit: string;
  /** Verified-zero caption, e.g. "No hay entregas pendientes de calificar". */
  zeroCaption: string;
  /** Source-failed placeholder replacing the metric, e.g. "No se pudo obtener". */
  unknownValue: string;
  /** Expired-value caption, e.g. "Los datos pueden estar desactualizados". */
  staleCaption: string;
  /** In-flight refresh caption over an existing value. */
  refreshingCaption: string;
  retryLabel: string;
  refreshLabel: string;
  /** Destination hint inside the link, e.g. "Ir a la cola de calificación". */
  cta: string;
}

/**
 * Actionable todo entry for the admin dashboard.
 *
 * Interaction contract (#784 B3 §4): the navigation Link and the retry Button
 * are siblings inside the card — never nested. The Link wraps the value
 * content (its accessible name therefore reads label + count fact + cta), the
 * Button lives below it and never triggers navigation. Native anchor
 * semantics (Tab / Enter / middle-click / copy address) are preserved — no
 * onClick pseudo-link.
 *
 * State rendering (see {@link AdminTodoState}): only fulfilled sources can
 * render a number, including 0; failures render `unknownValue` (never a zero)
 * with a retry Button, and expired values keep the last number under a stale
 * caption with a refresh Button.
 */
export function AdminTodoCard({
  icon,
  href,
  state,
  copy,
  onRefresh,
}: {
  icon: LucideIcon;
  href: string;
  state: AdminTodoState;
  copy: AdminTodoCardCopy;
  onRefresh: () => void;
}) {
  return (
    <div
      data-slot="admin-todo-card"
      data-depth="flat"
      data-state={state.kind}
      className="surface-content flex flex-col gap-2 p-4"
    >
      <Link
        to={href}
        className="group flex flex-col gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex shrink-0 items-center text-primary">
            <AppIcon icon={icon} size="metric" />
          </div>
          <p className="type-secondary truncate">{copy.label}</p>
        </div>
        <ValueSurface state={state} copy={copy} />
        <StatusLine state={state} copy={copy} />
        {/* Color lives on the inner span: type-metadata owns color, so the
            accent must not sit on the recipe node itself (exam-ui lint). */}
        <span className="type-metadata inline-flex items-center gap-1 group-hover:underline">
          <span className="inline-flex items-center gap-1 text-primary">
            {copy.cta}
            <AppIcon icon={ChevronRight} size="inline" />
          </span>
        </span>
      </Link>
      {(state.kind === "unknown" || state.kind === "stale") && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={onRefresh}
          disabled={state.kind === "stale" && state.refreshing}
        >
          <AppIcon
            icon={RefreshCw}
            size="inline"
            className={
              state.kind === "stale" && state.refreshing
                ? "animate-spin"
                : undefined
            }
          />
          {state.kind === "unknown" ? copy.retryLabel : copy.refreshLabel}
        </Button>
      )}
    </div>
  );
}

/** Metric row: exact number, bounded ">min" lower bound, or non-numeric
 * placeholders (loading skeleton / No se pudo obtener) that can never read as a count. */
function ValueSurface({
  state,
  copy,
}: {
  state: AdminTodoState;
  copy: AdminTodoCardCopy;
}) {
  if (state.kind === "loading") {
    return <Skeleton className="h-7 w-16" />;
  }
  if (state.kind === "unknown") {
    return <p className="type-secondary">{copy.unknownValue}</p>;
  }
  const { count } = state;
  return (
    <div className="flex items-baseline gap-1">
      <p data-slot="admin-todo-card-value" className="type-metric">
        {count.kind === "bounded" ? `>${count.min}` : count.value}
      </p>
      {showUnitIn(state) && <span className="type-secondary">{copy.unit}</span>}
    </div>
  );
}

function showUnitIn(
  state: Extract<AdminTodoState, { kind: "ready" | "stale" }>,
) {
  return (
    state.kind === "stale" ||
    state.count.kind === "bounded" ||
    state.count.value > 0
  );
}

/** Secondary fact under the metric: zero caption, in-flight refresh caption,
 * or the stale-expiry warning. Absent for a fresh non-zero value. */
function StatusLine({
  state,
  copy,
}: {
  state: AdminTodoState;
  copy: AdminTodoCardCopy;
}) {
  if (state.kind === "loading") {
    return <Skeleton className="h-4 w-24" />;
  }
  if (state.kind === "unknown") return null;
  if (state.refreshing) {
    return <p className="type-metadata">{copy.refreshingCaption}</p>;
  }
  if (state.kind === "stale") {
    // Warning color on the inner span: type-metadata owns color (exam-ui
    // lint) — same pattern as the queue page's stale snapshot line.
    return (
      <p className="type-metadata flex items-center gap-1">
        <span className="flex items-center gap-1 text-warning">
          <AppIcon icon={CircleAlert} size="inline" />
          {copy.staleCaption}
        </span>
      </p>
    );
  }
  if (state.count.kind === "exact" && state.count.value === 0) {
    return <p className="type-secondary">{copy.zeroCaption}</p>;
  }
  return null;
}
