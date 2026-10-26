import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubjectRow {
  id: string;
  name: string;
}

export function SubjectPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<SubjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.get<{ items: SubjectRow[] }>("/api/subjects");
      setItems(data.items);
    } catch (err) {
      setError(getApiErrorMessage(err, t, "No se pudieron cargar las materias"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function startCreate() {
    setEditing(null);
    setName("");
    setOpen(true);
  }

  function startEdit(row: SubjectRow) {
    setEditing(row);
    setName(row.name);
    setOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/subjects/${editing.id}`, { name: trimmed });
      } else {
        await api.post("/api/subjects", { name: trimmed });
      }
      setOpen(false);
      toast.success(editing ? "Materia actualizada" : "Materia creada");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, "No se pudo guardar la materia"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: SubjectRow) {
    if (!window.confirm(`¿Eliminar la materia «${row.name}»?`)) return;
    try {
      await api.delete(`/api/subjects/${row.id}`);
      toast.success("Materia eliminada");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, t, "No se pudo eliminar la materia"));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <PageContainer role="admin-standard" className="flex flex-col gap-6">
      <PageHeader
        title="Materias"
        actions={<Button onClick={startCreate}>Nueva materia</Button>}
      />
      {items.length === 0 ? (
        <EmptyState title="No hay materias" description="Creá la primera materia." />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <span>{row.name}</span>
              <span className="flex gap-2">
                <Button variant="outline" onClick={() => startEdit(row)}>
                  Editar
                </Button>
                <Button variant="outline" onClick={() => void remove(row)}>
                  Eliminar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar materia" : "Nueva materia"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="subject-name">Nombre</Label>
            <Input
              id="subject-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => void save()} disabled={saving || !name.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
