import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageCropper from '@/components/ImageCropper';

// Mock react-image-crop to a passthrough so the cropper renders without DOM/canvas work
vi.mock('react-image-crop', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="react-crop">{children}</div>,
}));
vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}));

describe('ImageCropper — Confirmar Recorte event isolation (mobile)', () => {
  beforeEach(() => {
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

  it('clicking "Confirmar Recorte" does not bubble to the parent (Editar Membro) dialog', () => {
    const parentClick = vi.fn();
    const onClose = vi.fn();
    const onCropComplete = vi.fn();

    render(
      // Simulates the parent "Editar Membro" Dialog content listening for clicks
      <div data-testid="edit-member-parent" onClick={parentClick}>
        <ImageCropper
          open={true}
          imageSrc="data:image/png;base64,AAAA"
          onClose={onClose}
          onCropComplete={onCropComplete}
        />
      </div>
    );

    // Seed completedCrop by simulating image load
    const img = document.querySelector('img[alt="Editar"]') as HTMLImageElement;
    expect(img).toBeTruthy();
    Object.defineProperty(img, 'width', { value: 200, configurable: true });
    Object.defineProperty(img, 'height', { value: 200, configurable: true });
    fireEvent.load(img);

    const confirmBtn = screen.getByRole('button', { name: /confirmar recorte/i });
    fireEvent.click(confirmBtn);

    // The click handler must call stopPropagation, so the parent never receives the event
    expect(parentClick).not.toHaveBeenCalled();
    // And onClose must not be triggered by the click itself
    expect(onClose).not.toHaveBeenCalled();
  });
});
