import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/shared/FieldError";
import { InlineErrorBanner } from "@/components/shared/InlineErrorBanner";
import { FieldGroup, Field } from "@/components/shared/FieldGroup";
import { PageContainer } from "@/components/shared/PageContainer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";

type Step = "legajo" | "password" | "register";

export function InscriptionPage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const [title, setTitle] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("legajo");
  const [legajo, setLegajo] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api
      .get<{ title: string }>(`/api/auth/inscriptions/${token}`)
      .then((data) => setTitle(data.title))
      .catch((err) =>
        setLoadError(getApiErrorMessage(err, t, "El link no es válido")),
      );
  }, [token]);

  async function lookup() {
    const value = legajo.trim();
    if (value.length < 3) {
      setFieldError("Ingresá el legajo");
      return;
    }
    setBusy(true);
    setFieldError(null);
    setFormError(null);
    try {
      const result = await api.post<{ exists: boolean }>(
        `/api/auth/inscriptions/${token}/lookup`,
        { legajo: value },
      );
      setLegajo(value);
      setStep(result.exists ? "password" : "register");
    } catch (err) {
      setFormError(readError(err, "No se pudo comprobar el legajo"));
    } finally {
      setBusy(false);
    }
  }

  function readError(err: unknown, fallback: string) {
    if (err instanceof ApiError) {
      const fields = (
        err.details as { fields?: { message?: string }[] } | undefined
      )?.fields;
      const text = fields?.find((field) => field.message)?.message;
      if (text) return text;
    }
    return getApiErrorMessage(err, t, fallback);
  }

  async function join() {
    if (step === "register") {
      if (!name.trim()) {
        setFieldError("Ingresá tu nombre");
        return;
      }
      if (password.length < 8) {
        setFieldError("La contraseña tiene que tener al menos 8 caracteres");
        return;
      }
      if (password !== confirm) {
        setFieldError("Las contraseñas no coinciden");
        return;
      }
    } else if (!password) {
      setFieldError("Contraseña incorrecta");
      return;
    }
    setBusy(true);
    setFieldError(null);
    setFormError(null);
    try {
      await api.post(`/api/auth/inscriptions/${token}`, {
        legajo,
        password,
        ...(step === "register" ? { name: name.trim() } : {}),
      });
      window.location.assign("/exam/list");
    } catch (err) {
      setFormError(readError(err, "No se pudo completar la inscripción"));
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <PageContainer role="auth" className="mx-auto max-w-md py-16">
        <InlineErrorBanner>{loadError}</InlineErrorBanner>
      </PageContainer>
    );
  }
  if (!title) return <LoadingState />;

  return (
    <PageContainer
      role="auth"
      className="mx-auto flex min-h-screen max-w-md items-center py-10"
    >
      <Card className="w-full">
        <CardHeader>
          <h1 className="type-page-title">Inscripción a {title}</h1>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {formError && <InlineErrorBanner>{formError}</InlineErrorBanner>}
            {step === "legajo" && (
              <Field>
                <Label htmlFor="legajo">Nro. de Legajo</Label>
                <Input
                  id="legajo"
                  value={legajo}
                  autoFocus
                  onChange={(event) => setLegajo(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void lookup();
                  }}
                />
                <FieldError>{fieldError}</FieldError>
                <Button onClick={() => void lookup()} disabled={busy}>
                  Continuar
                </Button>
              </Field>
            )}
            {step === "password" && (
              <Field>
                <p className="type-secondary">
                  Legajo encontrado. Ingresá la contraseña.
                </p>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  autoFocus
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void join();
                  }}
                />
                <FieldError>{fieldError}</FieldError>
                <Button onClick={() => void join()} disabled={busy}>
                  Entrar e inscribirme
                </Button>
              </Field>
            )}
            {step === "register" && (
              <Field>
                <p className="type-secondary">
                  El legajo {legajo} no existe en el sistema. Creá tu cuenta
                  para inscribirte al examen.
                </p>
                <Label htmlFor="student-name">Nombre</Label>
                <Input
                  id="student-name"
                  value={name}
                  autoFocus
                  onChange={(event) => setName(event.target.value)}
                />
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  autoFocus
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Label htmlFor="confirm">Confirmá la contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
                <FieldError>{fieldError}</FieldError>
                <Button onClick={() => void join()} disabled={busy}>
                  Crear cuenta e inscribirme
                </Button>
              </Field>
            )}
          </FieldGroup>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
