import { useRef, useState, useCallback } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Crop, RotateCw, ZoomIn, ZoomOut, Sparkles } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (file: File) => void;
}

const applySharpen = (canvas: HTMLCanvasElement, amount: number): HTMLCanvasElement => {
  if (amount === 0) return canvas;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  const copy = new Uint8ClampedArray(data);
  const factor = amount / 100;

  // Unsharp mask kernel
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const neighbors =
          copy[((y - 1) * w + x) * 4 + c] +
          copy[((y + 1) * w + x) * 4 + c] +
          copy[(y * w + (x - 1)) * 4 + c] +
          copy[(y * w + (x + 1)) * 4 + c];
        const blur = neighbors / 4;
        const sharp = copy[i + c] + (copy[i + c] - blur) * factor * 2;
        data[i + c] = Math.max(0, Math.min(255, sharp));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

const ImageCropper = ({ open, imageSrc, onClose, onCropComplete }: ImageCropperProps) => {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [sharpness, setSharpness] = useState(30);
  const [processing, setProcessing] = useState(false);

  const handleRotate = () => {
    cropperRef.current?.cropper.rotate(90);
  };

  const handleZoomIn = () => {
    cropperRef.current?.cropper.zoom(0.1);
  };

  const handleZoomOut = () => {
    cropperRef.current?.cropper.zoom(-0.1);
  };

  const handleConfirm = useCallback(async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    setProcessing(true);
    try {
      const canvas = cropper.getCroppedCanvas({
        maxWidth: 1920,
        maxHeight: 1920,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
      });

      const sharpened = applySharpen(canvas, sharpness);

      sharpened.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
            onCropComplete(file);
          }
          setProcessing(false);
        },
        'image/jpeg',
        0.92
      );
    } catch {
      setProcessing(false);
    }
  }, [sharpness, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Recortar e Ajustar Imagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border bg-muted/30" style={{ maxHeight: '50vh' }}>
            <Cropper
              ref={cropperRef}
              src={imageSrc}
              style={{ height: '100%', maxHeight: '50vh', width: '100%' }}
              guides={true}
              viewMode={1}
              responsive={true}
              autoCropArea={1}
              checkOrientation={true}
              background={false}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={handleRotate} title="Girar">
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleZoomIn} title="Zoom +">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={handleZoomOut} title="Zoom -">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Sharpness slider */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4" />
              Nitidez: {sharpness}%
            </Label>
            <Slider
              value={[sharpness]}
              onValueChange={(v) => setSharpness(v[0])}
              min={0}
              max={100}
              step={5}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={processing}>
            {processing ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
