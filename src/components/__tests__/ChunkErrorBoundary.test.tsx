import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { ChunkErrorBoundary } from "@/components/ChunkErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

const reloadMock = vi.fn();
const sendBeaconMock = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reloadMock.mockReset();
  sendBeaconMock.mockReset();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/login", reload: reloadMock },
  });
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: sendBeaconMock,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChunkErrorBoundary", () => {
  it("mostra mensagem amigável e botão recarregar quando há ChunkLoadError", () => {
    const Boom = () => {
      throw new Error("Failed to fetch dynamically imported module: /Login.tsx");
    };
    // Silence React's expected error log
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ChunkErrorBoundary>
        <Boom />
      </ChunkErrorBoundary>
    );

    expect(screen.getByText(/Atualização disponível/i)).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Recarregar/i });
    fireEvent.click(btn);
    expect(reloadMock).toHaveBeenCalled();
    // Telemetria: deve ter chamado sendBeacon com payload de ChunkLoadError
    expect(sendBeaconMock).toHaveBeenCalled();
    const [url, blob] = sendBeaconMock.mock.calls[0];
    expect(url).toBe("/api/telemetry/chunk-error");
    expect(blob).toBeInstanceOf(Blob);

    errSpy.mockRestore();
  });

  it("mostra mensagem genérica para erros não relacionados a chunk", () => {
    const Boom = () => { throw new Error("regular error"); };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ChunkErrorBoundary>
        <Boom />
      </ChunkErrorBoundary>
    );
    expect(screen.getByText(/Algo deu errado/i)).toBeTruthy();
    expect(sendBeaconMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("lazyWithRetry integração", () => {
  it("tenta novamente após falha de chunk e renderiza ao suceder", async () => {
    let calls = 0;
    const factory = vi.fn(async () => {
      calls++;
      if (calls < 2) {
        throw new Error("Failed to fetch dynamically imported module: /X.tsx");
      }
      return { default: () => <div>OK</div> };
    });

    const Lazy = lazyWithRetry(factory, 3, 1);

    render(
      <Suspense fallback={<div>loading</div>}>
        <Lazy />
      </Suspense>
    );

    await waitFor(() => expect(screen.getByText("OK")).toBeTruthy(), { timeout: 2000 });
    expect(factory).toHaveBeenCalledTimes(2);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("após esgotar retries, dispara reload único e envia telemetria com rota e contagem", async () => {
    const factory = vi.fn(async () => {
      throw new Error("Failed to fetch dynamically imported module: /Login.tsx");
    });
    const Lazy = lazyWithRetry(factory, 1, 1);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ChunkErrorBoundary>
        <Suspense fallback={<div>loading</div>}>
          <Lazy />
        </Suspense>
      </ChunkErrorBoundary>
    );

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(sessionStorage.getItem("__chunk_retry_reloaded__")).toBe("1");

    expect(sendBeaconMock).toHaveBeenCalled();
    const blob = sendBeaconMock.mock.calls[0][1] as Blob;
    const text = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsText(blob);
    });
    const payload = JSON.parse(text);
    expect(payload.type).toBe("ChunkLoadError");
    expect(payload.route).toBe("/login");
    expect(payload.retries).toBe(1);
    expect(payload.willReload).toBe(true);

    errSpy.mockRestore();
  });

  it("não recarrega novamente se já recarregou nesta sessão (proteção contra loop)", async () => {
    sessionStorage.setItem("__chunk_retry_reloaded__", "1");
    const factory = vi.fn(async () => {
      throw new Error("Failed to fetch dynamically imported module: /X.tsx");
    });
    const Lazy = lazyWithRetry(factory, 0, 1);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ChunkErrorBoundary>
        <Suspense fallback={<div>loading</div>}>
          <Lazy />
        </Suspense>
      </ChunkErrorBoundary>
    );

    await waitFor(() => expect(screen.getByText(/Atualização disponível/i)).toBeTruthy(), { timeout: 2000 });
    expect(reloadMock).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
