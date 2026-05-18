import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';

expect.extend(toHaveNoViolations);

const PHOTOS_HUB_ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PHOTOS_HUB_ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const PHOTOS_HUB_MAX_SIZE = 10 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB (${bytes.toLocaleString()} bytes)`;
  return `${bytes.toLocaleString()} bytes`;
};

const getFileDetails = (file: { name: string; type?: string; size?: number }) => {
  const name = file.name;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = file.type || 'MIME desconhecido';
  const size = formatFileSize(file.size || 0);
  return { name, ext, mime, size };
};

const isAllowedImage = (f: { name: string, type: string }) => {
  const type = (f.type || '').toLowerCase();
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  
  const isAcceptedMime = PHOTOS_HUB_ALLOWED_TYPES.some(allowed => 
    type === allowed || (type.startsWith('image/') && allowed.includes(type.split('/')[1]))
  );
  const isAcceptedExt = PHOTOS_HUB_ALLOWED_EXT.includes(ext);

  return isAcceptedMime || isAcceptedExt;
};

const ToastContent = ({ oldFile, newFile }: { oldFile: any, newFile: any }) => {
  const oldDetails = getFileDetails(oldFile);
  const newDetails = getFileDetails(newFile);
  
  const oldExt = oldDetails.ext;
  const newExt = newDetails.ext;
  const oldMime = oldFile.type || '';
  const newMime = newFile.type || '';

  const sameMime = oldMime && newMime && oldMime === newMime;
  const sameExt = oldExt && newExt && oldExt === newExt;

  const isDifferentExt = oldExt !== newExt;
  const isDifferentMime = oldMime !== newMime;
  const isTooLarge = newFile.size > PHOTOS_HUB_MAX_SIZE;

  return (
    <div className="flex flex-col gap-2 py-1" role="alert" aria-live="assertive">
      <div className="flex items-center gap-2 border-b border-destructive/20 pb-2 mb-1">
        <p className="font-bold text-sm">
          {isTooLarge ? 'Arquivo muito grande' : 'Incompatibilidade de Arquivo'}
        </p>
      </div>
      
      <div className="space-y-1 bg-destructive/5 p-2 rounded border border-destructive/10" aria-label="Informações do arquivo atual">
        <p className="text-[10px] uppercase font-bold text-muted-foreground opacity-60 tracking-wider text-destructive">Arquivo Atual</p>
        <p className="text-[11px] font-medium truncate leading-none">{oldDetails.name}</p>
        <p className="text-[10px] font-mono opacity-80" aria-label={`Extensão ${oldDetails.ext} e tipo ${oldDetails.mime}`}>
          [.{oldDetails.ext.toUpperCase()}] {oldDetails.mime}
        </p>
        <p className="text-[10px] font-mono opacity-60">{oldDetails.size}</p>
      </div>

      <div className={`space-y-1 p-2 rounded border ${isDifferentExt || isDifferentMime ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`} aria-label="Informações do novo arquivo">
        <p className={`text-[10px] uppercase font-bold tracking-wider ${isDifferentExt || isDifferentMime ? 'text-amber-600' : 'text-emerald-600'}`}>Novo Arquivo</p>
        <p className="text-[11px] font-medium truncate leading-none">{newDetails.name}</p>
        <p className={`text-[10px] font-mono ${isDifferentExt ? 'text-amber-600 font-bold' : 'opacity-80'}`}>
          [.{newDetails.ext.toUpperCase()}] {newDetails.mime}
        </p>
        <p className={`text-[10px] font-mono ${isTooLarge ? 'text-destructive font-bold' : 'opacity-60'}`}>{newDetails.size}</p>
      </div>
    </div>
  );
};

describe('Photos Hub Validation & UI', () => {
  describe('MIME & Extension Normalization', () => {
    it('should correctly handle image/jpg vs image/jpeg aliases', () => {
      const fileJpg = { name: 'test.jpg', type: 'image/jpg' };
      const fileJpeg = { name: 'test.jpeg', type: 'image/jpeg' };
      
      expect(isAllowedImage(fileJpg)).toBe(true);
      expect(isAllowedImage(fileJpeg)).toBe(true);
    });

    it('should handle uppercase extensions and MIME types', () => {
      const file = { name: 'PHOTO.PNG', type: 'IMAGE/PNG' };
      expect(isAllowedImage(file)).toBe(true);
    });

    it('should reduce false positives for valid images with missing MIME', () => {
      const file = { name: 'photo.webp', type: '' };
      expect(isAllowedImage(file)).toBe(true);
    });
  });

  describe('Toast UI Structure & Accessibility', () => {
    it('should match the expected visual snapshot structure', () => {
      const oldFile = { name: 'old.png', type: 'image/png', size: 500000 };
      const newFile = { name: 'new.jpg', type: 'image/jpeg', size: 600000 };
      
      const { asFragment } = render(<ToastContent oldFile={oldFile} newFile={newFile} />);
      expect(asFragment()).toMatchSnapshot();
    });

    it('should have correct accessibility attributes', () => {
      const oldFile = { name: 'old.png', type: 'image/png', size: 500000 };
      const newFile = { name: 'new.jpg', type: 'image/jpeg', size: 600000 };
      
      render(<ToastContent oldFile={oldFile} newFile={newFile} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByLabelText('Informações do arquivo atual')).toBeInTheDocument();
      expect(screen.getByLabelText('Informações do novo arquivo')).toBeInTheDocument();
    });

    it('should pass automated accessibility audits', async () => {
      const oldFile = { name: 'old.png', type: 'image/png', size: 500000 };
      const newFile = { name: 'new.jpg', type: 'image/jpeg', size: 600000 };
      
      const { container } = render(<ToastContent oldFile={oldFile} newFile={newFile} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
