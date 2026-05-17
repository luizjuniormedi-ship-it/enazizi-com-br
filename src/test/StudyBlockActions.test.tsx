import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StudyBlockActions from "@/components/cronograma/StudyBlockActions";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("StudyBlockActions", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it("renders the trigger button", () => {
    renderWithRouter(<StudyBlockActions subject="Cardiologia" />);
    expect(screen.getByLabelText("Praticar tema")).toBeInTheDocument();
  });

  it("shows 5 module buttons when popover opens", async () => {
    renderWithRouter(<StudyBlockActions subject="Cardiologia" specialty="Cardiologia" />);
    fireEvent.click(screen.getByLabelText("Praticar tema"));
    
    expect(await screen.findByLabelText("Tutor IA")).toBeInTheDocument();
    expect(screen.getByLabelText("Flashcards")).toBeInTheDocument();
    expect(screen.getByLabelText("Gerar Questões")).toBeInTheDocument();
    expect(screen.getByLabelText("Anamnese")).toBeInTheDocument();
    expect(screen.getByLabelText("Caso Clínico")).toBeInTheDocument();
  });

  it("navigates to Tutor IA with topic param", async () => {
    renderWithRouter(<StudyBlockActions subject="Neurologia" />);
    fireEvent.click(screen.getByLabelText("Praticar tema"));
    
    const tutorBtn = await screen.findByLabelText("Tutor IA");
    fireEvent.click(tutorBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/sessao-estudo?topic=Neurologia");
  });

  it("navigates to Anamnese with specialty param", async () => {
    renderWithRouter(<StudyBlockActions subject="ICC" specialty="Cardiologia" />);
    fireEvent.click(screen.getByLabelText("Praticar tema"));
    
    const anamneseBtn = await screen.findByLabelText("Anamnese");
    fireEvent.click(anamneseBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/anamnese?specialty=Cardiologia");
  });

  it("uses subject as fallback when specialty is not provided", async () => {
    renderWithRouter(<StudyBlockActions subject="Pediatria" />);
    fireEvent.click(screen.getByLabelText("Praticar tema"));
    
    const plantaoBtn = await screen.findByLabelText("Caso Clínico");
    fireEvent.click(plantaoBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/simulacao-clinica?specialty=Pediatria");
  });

  it("displays the subject name in the popover header", async () => {
    renderWithRouter(<StudyBlockActions subject="Oncologia" />);
    fireEvent.click(screen.getByLabelText("Praticar tema"));
    
    expect(await screen.findByText("Praticar: Oncologia")).toBeInTheDocument();
  });
});
