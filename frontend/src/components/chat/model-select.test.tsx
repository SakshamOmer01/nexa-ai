import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ModelSelect } from "@/components/chat/model-select";

const models = [
  { id: "gpt-4o-mini", name: "GPT-4o mini", description: "Fast" },
  { id: "gpt-4o", name: "GPT-4o", description: "Stronger" },
];

describe("ModelSelect", () => {
  it("shows the current model and switches to another", async () => {
    const onChange = vi.fn();
    render(<ModelSelect models={models} value="gpt-4o-mini" onChange={onChange} provider="Example" />);

    const trigger = screen.getByRole("button", { name: "Model: GPT-4o mini" });
    expect(trigger).toHaveTextContent("GPT-4o mini");

    await userEvent.click(trigger);
    expect(await screen.findByText("Models · Example")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /GPT-4o.*Stronger/ }));
    expect(onChange).toHaveBeenCalledWith("gpt-4o");
  });

  it("falls back to the raw id and disables an empty catalog", () => {
    const { rerender } = render(
      <ModelSelect models={models} value="custom-model" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Model: custom-model" })).toHaveTextContent(
      "custom-model",
    );

    rerender(<ModelSelect models={[]} value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Model: none configured" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Model: none configured" })).toHaveTextContent(
      "No model",
    );
  });

  it("can be disabled explicitly", () => {
    render(<ModelSelect models={models} value="gpt-4o" onChange={vi.fn()} disabled compact />);
    expect(screen.getByRole("button", { name: "Model: GPT-4o" })).toBeDisabled();
  });
});
