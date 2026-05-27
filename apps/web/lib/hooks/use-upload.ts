'use client';

import { useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

interface SignedParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * Uploads a file directly to Cloudinary using a signed upload request
 * fetched from the backend. The file never passes through the API server.
 *
 * Returns the secure URL of the uploaded asset.
 *
 * If a new upload is started while one is already in-flight, the previous
 * Cloudinary POST is aborted via AbortController so no orphaned asset is
 * created on Cloudinary for the discarded file.
 */
export function useCloudinaryUpload() {
  // Tracks the AbortController for the currently in-flight upload
  const abortControllerRef = useRef<AbortController | null>(null);

  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      // Cancel any previously in-flight upload before starting a new one
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      try {
        const params = await api.get<SignedParams>('/upload/sign?folder=receipts');

        // Guard: if the caller aborted while we were fetching signed params,
        // stop here before touching Cloudinary at all
        if (signal.aborted) {
          throw new DOMException('Upload cancelled', 'AbortError');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', params.apiKey);
        formData.append('timestamp', String(params.timestamp));
        formData.append('signature', params.signature);
        formData.append('folder', params.folder);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`,
          { method: 'POST', body: formData, signal },
        );

        if (!res.ok) {
          throw new Error('Tải ảnh lên thất bại');
        }

        const data = (await res.json()) as { secure_url: string };
        return data.secure_url;
      } finally {
        // Clear the ref only if this instance is still the most recent upload
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
  });
}
