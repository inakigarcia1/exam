import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportWizard } from "./ImportWizard";
import type { ImportPreviewRow } from "./ImportWizard";

const previewRows: ImportPreviewRow[] = [
  { row: 2, status: "create", message: "Se creará el alumno" },
  { row: 3, status: "update", message: "已存在" },
];

describe("ImportWizard", () => {
  it("renders title and instructions", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Importar alumnos"
        instructions="请上传CSV文件"
        csv=""
        onCsvChange={() => {}}
        preview={[]}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Importar alumnos")).toBeInTheDocument();
    expect(screen.getByText("请上传CSV文件")).toBeInTheDocument();
  });

  it("renders preview rows", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv=""
        onCsvChange={() => {}}
        preview={previewRows}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/Se creará el alumno/)).toBeInTheDocument();
    expect(screen.getByText(/已存在/)).toBeInTheDocument();
  });

  it("disables confirm button when preview has errors", () => {
    const errorRows: ImportPreviewRow[] = [
      { row: 2, status: "error", message: "缺少用户名" },
    ];
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv=""
        onCsvChange={() => {}}
        preview={errorRows}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Confirmar importación")).toBeDisabled();
  });

  it("disables confirm button when preview is empty", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv=""
        onCsvChange={() => {}}
        preview={[]}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Confirmar importación")).toBeDisabled();
  });

  it("enables confirm when no errors", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv="csv data"
        onCsvChange={() => {}}
        preview={previewRows}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Confirmar importación")).not.toBeDisabled();
  });

  it("shows warning text when provided", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv=""
        onCsvChange={() => {}}
        preview={[]}
        warning="注意覆盖"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("注意覆盖")).toBeInTheDocument();
  });

  it("shows summary text when provided", () => {
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv=""
        onCsvChange={() => {}}
        preview={previewRows}
        summary="导入完成"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("导入完成")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    const { userEvent } = await import("@testing-library/user-event");
    render(
      <ImportWizard
        open={true}
        onOpenChange={() => {}}
        title="Test"
        instructions=""
        csv="data"
        onCsvChange={() => {}}
        preview={previewRows}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.setup().click(screen.getByText("Confirmar importación"));
    expect(onConfirm).toHaveBeenCalled();
  });
});
