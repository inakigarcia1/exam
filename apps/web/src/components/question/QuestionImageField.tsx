import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";
import type { QuestionImage as QuestionImageRef } from "@exam/domain";
import { QUESTION_IMAGE_MAX_BYTES } from "@exam/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/shared/AppIcon";
import { Field } from "@/components/shared/FieldGroup";
import { FieldError } from "@/components/shared/FieldError";
import { QuestionImage } from "@/components/shared/QuestionImage";
import { api } from "@/lib/api";

const MAX_SIDE_PX = 1600;
const WEBP_QUALITY = 0.8;

/**
 * Downscales to MAX_SIDE_PX on the long side and re-encodes as WebP. A
 * browser without a WebP encoder falls back to PNG, which the server also
 * accepts; the server still enforces the byte limit.
 */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/webp",
      WEBP_QUALITY,
    ),
  );
}

/** Picks, compresses and uploads the question's single image. */
export function QuestionImageField({
  value,
  onChange,
}: {
  value: QuestionImageRef | null;
  onChange: (image: QuestionImageRef | null) => void;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      let blob: Blob;
      try {
        blob = await compressImage(file);
      } catch {
        setError(t("admin.forms.question.imageUnreadable"));
        return;
      }
      if (blob.size > QUESTION_IMAGE_MAX_BYTES) {
        setError(t("admin.forms.question.imageTooLarge"));
        return;
      }
      const { sha256 } = await api.upload<{ sha256: string }>(
        "/api/question-images",
        blob,
      );
      onChange({ sha256, alt: value?.alt ?? "" });
    } catch {
      setError(t("admin.forms.question.imageUnreadable"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field>
      <Label htmlFor="question-image-file">
        {t("admin.forms.question.image")}
      </Label>
      {value ? (
        <div className="flex flex-col gap-2">
          <QuestionImage image={value} />
          <Input
            aria-label={t("admin.forms.question.imageAlt")}
            value={value.alt}
            maxLength={300}
            onChange={(e) => onChange({ ...value, alt: e.target.value })}
            placeholder={t("admin.forms.question.imageAltPlaceholder")}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange(null)}
            >
              <AppIcon icon={Trash2} size="inline" />
              {t("admin.forms.question.imageRemove")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-card py-1.5 pr-1.5 pl-3">
          <span className="type-secondary truncate">
            {uploading
              ? t("admin.forms.question.imageUploading")
              : t("admin.forms.question.imageNone")}
          </span>
          <input
            ref={fileInput}
            id="question-image-file"
            className="hidden"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <AppIcon icon={Upload} size="inline" />
            {t("admin.forms.question.imageSelect")}
          </Button>
        </div>
      )}
      <p className="type-metadata">{t("admin.forms.question.imageHint")}</p>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
