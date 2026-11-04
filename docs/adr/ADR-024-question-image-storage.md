# ADR-024 — Question Image Storage

## Status

ACCEPTED (2026-11-02)

## Metadata

| Field | Value |
|---|---|
| Date | 2026-11-02 |
| Decision owners | project owner |
| Supersedes | the unused `questions.attachments` field (never had an upload path) |
| Superseded by | — |
| Related decisions | ADR-019 (content document model), ADR-023 (host owns backups) |

## Context

A question may carry at most one image, shown after the prompt and before
the answer area, for every question type. The image must survive as long as
any frozen exam or attempt snapshot references it. The application container
has no persistent volume; the only documented backup path is `pg_dump` of the
PostgreSQL database (deployment runbook §17). The runtime must stay
LAN/offline-capable with no external storage service.

`questions.attachments` (`[{url, type, name}]`) existed in the schema,
contracts and snapshots but had no upload path, no renderer and accepted
arbitrary URLs.

## Decision

1. **Bytes live in PostgreSQL**, table `question_images`, primary key
   `(organization_id, sha256)`. The key is the SHA-256 of the stored bytes, so
   identical uploads in one organization are stored once.
2. **Rows are immutable and append-only.** No update and no delete path
   exists. A snapshot freezes an image by copying its `sha256`; the bytes it
   points at can never change or disappear.
3. **A question references one image** through `questions.image`
   (`{ sha256, alt } | null`, jsonb). A stored generated column
   `image_sha256` carries a foreign key to
   `question_images (organization_id, sha256)`, so the database guarantees the
   image exists and belongs to the same organization.
4. **Formats and size:** PNG, JPEG or WebP, identified by magic bytes (the
   request `Content-Type` is not trusted), at most
   `QUESTION_IMAGE_MAX_BYTES` (1 MiB). SVG is rejected (script-capable). The
   browser downscales to 1600 px on the long side and re-encodes to WebP
   before upload; the server does not re-encode (no native image dependency).
5. **HTTP surface:** `POST /api/question-images` (raw binary body,
   `question.create` capability) returns `{ sha256 }`.
   `GET /api/question-images/:sha256` is authenticate-only, scoped to the
   actor's organization, and served with
   `Cache-Control: private, max-age=31536000, immutable`. There is no
   per-question or per-exam check: the hash only reaches clients through
   responses they were already authorized to read and cannot be guessed.
6. `questions.attachments` is removed. The migration fails loudly if any row
   carries a non-empty value, because an arbitrary URL cannot be mapped.

## Consequences

- Images are covered by the existing `pg_dump`/`pg_restore` procedure; no
  new volume or backup step.
- Database size grows with images. Orphaned rows (uploaded but never saved,
  or no longer referenced) are not collected. Collection would need to scan
  both live questions and every exam/attempt snapshot; it is deferred until
  measured storage justifies it.
- Images on options, images in CSV import and multiple images per question
  are out of scope.
