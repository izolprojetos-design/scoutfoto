import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SchedulingAttachments from "../SchedulingAttachments";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockUpload = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({ upload: mockUpload }),
    },
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return { select: (...sArgs: unknown[]) => { mockSelect(...sArgs); return { single: mockSingle }; } };
      },
      delete: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

const toastSpy = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => toastSpy(...args),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function createFile(name = "doc.pdf", type = "application/pdf", sizeKB = 10) {
  const buf = new ArrayBuffer(sizeKB * 1024);
  return new File([buf], name, { type });
}

const noop = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SchedulingAttachments — upload bloqueado após aprovação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não exibe zona de upload quando editable=false (status aprovado)", () => {
    render(
      <SchedulingAttachments
        requestId="req-1"
        editable={false}
        attachments={[]}
        onAttachmentsChange={noop}
      />
    );

    expect(screen.queryByText(/arraste arquivos/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("exibe zona de upload quando editable=true (status pendente)", () => {
    render(
      <SchedulingAttachments
        requestId="req-1"
        editable={true}
        attachments={[]}
        onAttachmentsChange={noop}
      />
    );

    expect(screen.getByText(/arraste arquivos/i)).toBeInTheDocument();
  });

  it("upload via Storage falha quando RLS bloqueia (simulação de status aprovado)", async () => {
    // Simula erro de RLS no Storage
    mockUpload.mockResolvedValue({
      error: { message: "new row violates row-level security policy", statusCode: "403" },
    });

    render(
      <SchedulingAttachments
        requestId="req-1"
        editable={true}
        attachments={[]}
        onAttachmentsChange={noop}
      />
    );

    const file = createFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro no upload",
          variant: "destructive",
        })
      );
    });

    // Não deve ter tentado inserir na tabela
    expect(mockInsert).not.toHaveBeenCalled();
    // Callback é chamado mas sem novos anexos (array vazio permanece)
    expect(noop).toHaveBeenCalledWith([]);
  });

  it("insert na tabela falha quando RLS bloqueia (simulação de status aprovado)", async () => {
    // Storage OK, mas insert na tabela falha
    mockUpload.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });

    render(
      <SchedulingAttachments
        requestId="req-1"
        editable={true}
        attachments={[]}
        onAttachmentsChange={noop}
      />
    );

    const file = createFile();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao registrar anexo",
          variant: "destructive",
        })
      );
    });
  });

  it("não exibe botão de remover quando editable=false", () => {
    render(
      <SchedulingAttachments
        requestId="req-1"
        editable={false}
        attachments={[
          { id: "att-1", file_name: "foto.png", file_path: "user-123/req-1/abc.png", file_size: 5000, content_type: "image/png" },
        ]}
        onAttachmentsChange={noop}
      />
    );

    // Download deve estar visível
    expect(screen.getByText("foto.png")).toBeInTheDocument();
    // Botão X de remover não deve existir
    const removeButtons = screen.queryAllByRole("button").filter(
      (btn) => btn.querySelector(".lucide-x")
    );
    expect(removeButtons).toHaveLength(0);
  });
});
