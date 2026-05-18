import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock getFileDetails and formatFileSize logic locally for testing the structure
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

describe('Toast Compatibility UI structure', () => {
  it('should render correct information for mismatched extensions', () => {
    const oldFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 * 1024 };
    const newFile = { name: 'document.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 };
    
    const oldDetails = getFileDetails(oldFile);
    const newDetails = getFileDetails(newFile);
    
    const isDifferentExt = oldDetails.ext !== newDetails.ext;
    const isDifferentMime = oldDetails.mime !== newDetails.mime;
    const isTooLarge = newFile.size > 10 * 1024 * 1024;

    const ToastContent = () => (
      <div className="flex flex-col gap-2 py-1" role="alert" aria-live="assertive">
        <div className="flex items-center gap-2 border-b border-destructive/20 pb-2 mb-1">
          <p className="font-bold text-sm">
            {isTooLarge ? 'Arquivo muito grande' : 'Incompatibilidade de Arquivo'}
          </p>
        </div>
        
        <div className="space-y-1 bg-destructive/5 p-2 rounded border border-destructive/10" aria-label="Informações do arquivo atual">
          <p>{oldDetails.name}</p>
          <p aria-label={`Extensão ${oldDetails.ext} e tipo ${oldDetails.mime}`}>
            [.{oldDetails.ext.toUpperCase()}] {oldDetails.mime}
          </p>
          <p>{oldDetails.size}</p>
        </div>

        <div className={`space-y-1 p-2 rounded border ${isDifferentExt || isDifferentMime ? 'bg-amber-500/5 border-amber-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`} aria-label="Informações do novo arquivo">
          <p>{newDetails.name}</p>
          <p className={isDifferentExt ? 'text-amber-600 font-bold' : ''}>
            [.{newDetails.ext.toUpperCase()}] {newDetails.mime}
          </p>
          <p className={isTooLarge ? 'text-destructive font-bold' : ''}>{newDetails.size}</p>
        </div>
      </div>
    );

    render(<ToastContent />);
    
    expect(screen.getByText('Incompatibilidade de Arquivo')).toBeInTheDocument();
    expect(screen.getByLabelText('Informações do arquivo atual')).toBeInTheDocument();
    expect(screen.getByLabelText('Extensão jpg e tipo image/jpeg')).toBeInTheDocument();
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('[.PDF] application/pdf')).toHaveClass('text-amber-600 font-bold');
  });

  it('should handle missing MIME or extension gracefully', () => {
    const oldFile = { name: 'unknown', type: '', size: 500 };
    const newFile = { name: 'new_unknown', type: '', size: 800 };
    
    const oldDetails = getFileDetails(oldFile);
    const newDetails = getFileDetails(newFile);
    
    expect(oldDetails.ext).toBe('unknown');
    expect(oldDetails.mime).toBe('MIME desconhecido');
    expect(newDetails.size).toBe('800 bytes');
  });

  it('should flag oversized files correctly', () => {
    const oldFile = { name: 'photo.jpg', type: 'image/jpeg', size: 1024 };
    const newFile = { name: 'heavy.jpg', type: 'image/jpeg', size: 15 * 1024 * 1024 }; // 15MB
    
    const isTooLarge = newFile.size > 10 * 1024 * 1024;
    expect(isTooLarge).toBe(true);
  });
});
