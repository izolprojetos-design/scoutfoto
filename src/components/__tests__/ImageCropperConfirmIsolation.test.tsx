import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageCropper from '@/components/ImageCropper';

// Mock react-image-crop to a passthrough so the cropper renders without DOM/canvas work
vi.mock('react-image-crop', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="react-crop">{children}</div>,
}));
vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}));

describe('ImageCropper — Interaction isolation (mobile)', () => {
  beforeEach(() => {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    (globalThis as any).DOMRect = (globalThis as any).DOMRect || class {};

    // jsdom: stub HTMLCanvasElement.toBlob used by handleConfirm
    (HTMLCanvasElement.prototype as any).getContext = vi.fn(() => ({
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
      putImageData: vi.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    }));
    (HTMLCanvasElement.prototype as any).toBlob = vi.fn(function (
      this: HTMLCanvasElement,
      cb: BlobCallback
    ) {
      cb(new Blob(['x'], { type: 'image/jpeg' }));
    });
  });

  it('clicking "Confirmar Recorte" does not bubble to the parent dialog', () => {
    const parentClick = vi.fn();
    const onClose = vi.fn();
    const onCropComplete = vi.fn();

    render(
      <div data-testid="edit-member-parent" onClick={parentClick}>
        <ImageCropper
          open={true}
          imageSrc="data:image/png;base64,AAAA"
          onClose={onClose}
          onCropComplete={onCropComplete}
        />
      </div>
    );

    const img = document.querySelector('img[alt="Editar"]') as HTMLImageElement;
    Object.defineProperty(img, 'width', { value: 200, configurable: true });
    Object.defineProperty(img, 'height', { value: 200, configurable: true });
    fireEvent.load(img);

    const confirmBtn = screen.getByRole('button', { name: /confirmar recorte/i });
    fireEvent.click(confirmBtn);

    expect(parentClick).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('clicking "Cancelar" calls onClose but does not bubble to the parent dialog', () => {
    const parentClick = vi.fn();
    const onClose = vi.fn();
    const onCropComplete = vi.fn();

    render(
      <div data-testid="edit-member-parent" onClick={parentClick}>
        <ImageCropper
          open={true}
          imageSrc="data:image/png;base64,AAAA"
          onClose={onClose}
          onCropComplete={onCropComplete}
        />
      </div>
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    
    // Simulate touch events with proper touch data to avoid JSDOM/Radix errors
    fireEvent.touchStart(cancelBtn, {
      changedTouches: [{ clientX: 10, clientY: 10 }]
    });
    fireEvent.touchEnd(cancelBtn, {
      changedTouches: [{ clientX: 10, clientY: 10 }]
    });
    fireEvent.click(cancelBtn);

    // Should trigger the cropper close logic
    expect(onClose).toHaveBeenCalled();
    // But MUST NOT trigger any logic in the parent "Editar Membro" dialog
    expect(parentClick).not.toHaveBeenCalled();
  });
});
