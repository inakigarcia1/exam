import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlatformSettingsForm } from "./PlatformSettingsForm";

describe("PlatformSettingsForm", () => {
  it("shows timezone select with placeholder", () => {
    render(<PlatformSettingsForm onSave={() => {}} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Elegí una zona horaria")).toBeInTheDocument();
  });

  it("shows branding fields in the form", () => {
    render(<PlatformSettingsForm onSave={() => {}} />);

    expect(screen.getByLabelText("Título del producto")).toBeInTheDocument();
    expect(screen.getByLabelText("Subtítulo del producto")).toBeInTheDocument();
    expect(screen.getByLabelText("Texto del pie")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la institución")).toBeInTheDocument();
  });

  it("fills form with initialValues", () => {
    render(
      <PlatformSettingsForm
        initialValues={{
          productName: "My Platform",
          productSubtitle: "My Subtitle",
          footerText: "My Footer",
          organizationDisplayName: "My Org",
        }}
        onSave={() => {}}
      />,
    );

    expect(screen.getByLabelText("Título del producto")).toHaveValue("My Platform");
    expect(screen.getByLabelText("Subtítulo del producto")).toHaveValue("My Subtitle");
    expect(screen.getByLabelText("Texto del pie")).toHaveValue("My Footer");
    expect(screen.getByLabelText("Nombre de la institución")).toHaveValue("My Org");
  });

  it("updates form when initialValues change", () => {
    const { rerender } = render(
      <PlatformSettingsForm
        initialValues={{ productName: "V1" }}
        onSave={() => {}}
      />,
    );

    expect(screen.getByLabelText("Título del producto")).toHaveValue("V1");

    rerender(
      <PlatformSettingsForm
        initialValues={{ productName: "V2" }}
        onSave={() => {}}
      />,
    );

    expect(screen.getByLabelText("Título del producto")).toHaveValue("V2");
  });

  it("submits the edited fields through onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PlatformSettingsForm onSave={onSave} />);

    await user.type(screen.getByLabelText("Título del producto"), "新平台");
    await user.type(screen.getByLabelText("Subtítulo del producto"), "新副标题");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    // react-hook-form hands the values object (plus the submit event) to
    // onSave; fields left untouched submit as empty strings.
    const [payload] = onSave.mock.calls[0]!;
    expect(payload).toEqual({
      productName: "新平台",
      productSubtitle: "新副标题",
      footerText: "",
      organizationDisplayName: "",
    });
  });
});
