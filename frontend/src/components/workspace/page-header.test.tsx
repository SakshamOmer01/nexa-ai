import { render, screen } from "@testing-library/react";
import { BarChart3 } from "lucide-react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "@/components/workspace/page-header";

describe("PageHeader", () => {
  it("renders the eyebrow, title, description and actions", () => {
    render(
      <PageHeader
        icon={BarChart3}
        eyebrow="Insights"
        title="Data analytics"
        description="Measured usage."
        actions={<button type="button">Export</button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Data analytics");
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByText("Measured usage.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("omits the actions container when none are supplied", () => {
    const { container } = render(
      <PageHeader icon={BarChart3} eyebrow="Insights" title="Title" description="Description" />,
    );
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});
