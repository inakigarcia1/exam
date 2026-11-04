import type { QuestionImage as QuestionImageRef } from "@exam/domain";
import { api } from "@/lib/api";

/** URL of a stored question image (immutable, cacheable). */
export function questionImageUrl(sha256: string): string {
  return `${api.baseURL}/api/question-images/${sha256}`;
}

/** The question's single image, rendered between the prompt and the answer area. */
export function QuestionImage({
  image,
}: {
  image: QuestionImageRef | null | undefined;
}) {
  if (!image) return null;
  return (
    <img
      src={questionImageUrl(image.sha256)}
      alt={image.alt}
      loading="lazy"
      data-testid="question-image"
      className="block h-auto max-h-96 w-auto max-w-full rounded-md border object-contain"
    />
  );
}
