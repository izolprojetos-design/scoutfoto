import { useRef, useState, useCallback } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Crop as CropIcon, Sparkles } from 'lucide-react';

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

const getCroppedCanvas = (
  image: HTMLImageElement,
  crop: PixelCrop
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
};

const ImageCropper = ({ open, imageSrc, onClose, onCropComplete }: ImageCropperProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [sharpness, setSharpness] = useState(30);
  const [processing, setProcessing] = useState(false);

  const onImageLoad = useCallback(() => {
    const img = imgRef.current;
    const initialCrop: Crop = { unit: '%', x: 5, y: 5, width: 90, height: 90 };
    setCrop(initialCrop);
    // Also seed completedCrop in pixels so user can confirm without manually adjusting
    if (img) {
      const w = img.width;
      const h = img.height;
      setCompletedCrop({
        unit: 'px',
        x: w * 0.05,
        y: h * 0.05,
        width: w * 0.9,
        height: h * 0.9,
      });
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    console.log('[CROPPER] handleConfirm clicked', { hasImg: !!imgRef.current, hasCrop: !!completedCrop, crop: completedCrop });
    if (!imgRef.current || !completedCrop) {
      console.warn('[CROPPER] aborted: missing image or crop');
      return;
    }
    setProcessing(true);

    try {
      const canvas = getCroppedCanvas(imgRef.current, completedCrop);
      console.log('[CROPPER] canvas created', { w: canvas.width, h: canvas.height });
      const sharpened = applySharpen(canvas, sharpness);

      sharpened.toBlob(
        (blob) => {
          console.log('[CROPPER] toBlob result', { hasBlob: !!blob, size: blob?.size });
          if (blob) {
            const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg', lastModified: Date.now() });
            onCropComplete(file);
          } else {
            console.error('[CROPPER] toBlob returned null');
            setProcessing(false);
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('[CROPPER] error during crop:', err);
      setProcessing(false);
    }
  }, [completedCrop, sharpness, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !processing) onClose(); }} modal={true}>
      <DialogContent
        className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => { if (processing) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            Recortar e Ajustar Imagem
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center overflow-hidden rounded-lg border bg-muted/30" style={{ maxHeight: '50vh' }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Editar"
                crossOrigin="anonymous"
                onLoad={onImageLoad}
                style={{ maxHeight: '50vh', maxWidth: '100%' }}
              />
            </ReactCrop>
          </div>

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
          <Button type="button" variant="outline" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            Cancelar
          </Button>
          <Button type="button" onClick={(e) => { e.stopPropagation(); handleConfirm(); }} disabled={processing || !completedCrop}>
            {processing ? 'Processando...' : 'Confirmar Recorte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
