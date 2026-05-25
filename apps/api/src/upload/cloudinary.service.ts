import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface SignedUploadParams {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface UploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  bytes: number;
}

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = config.get<string>('CLOUDINARY_API_SECRET');

    this.configured = !!(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    } else {
      this.logger.warn('Cloudinary credentials not set — upload features will be mocked');
    }
  }

  /**
   * Returns signed parameters the browser uses to upload a file directly to
   * Cloudinary (POST https://api.cloudinary.com/v1_1/:cloud_name/image/upload).
   * Files never pass through this server.
   */
  generateSignedUploadParams(folder: string): SignedUploadParams {
    if (!this.configured) {
      return this.mockSignedParams(folder);
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { folder, timestamp };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      this.config.get<string>('CLOUDINARY_API_SECRET')!,
    );

    return {
      signature,
      timestamp,
      apiKey: this.config.get<string>('CLOUDINARY_API_KEY')!,
      cloudName: this.config.get<string>('CLOUDINARY_CLOUD_NAME')!,
      folder,
    };
  }

  /**
   * Server-side upload from a buffer (used by the export module for PDFs).
   */
  async uploadBuffer(buffer: Buffer, folder: string, publicId?: string): Promise<UploadResult> {
    if (!this.configured) {
      this.logger.log(`[DEV] Mock upload buffer to folder "${folder}"`);
      return {
        publicId: `${folder}/mock-${Date.now()}`,
        secureUrl: `https://res.cloudinary.com/mock/image/upload/${folder}/mock.jpg`,
        format: 'jpg',
        bytes: buffer.length,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder,
        ...(publicId && { public_id: publicId }),
        resource_type: 'auto' as const,
      };

      cloudinary.uploader
        .upload_stream(uploadOptions, (error, result) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            reject(new InternalServerErrorException('Tải lên thất bại, vui lòng thử lại'));
            return;
          }
          resolve({
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
          });
        })
        .end(buffer);
    });
  }

  /**
   * Deletes a file by its Cloudinary public ID.
   */
  async deleteFile(publicId: string): Promise<void> {
    if (!this.configured) {
      this.logger.log(`[DEV] Mock delete file "${publicId}"`);
      return;
    }
    await cloudinary.uploader.destroy(publicId);
  }

  private mockSignedParams(folder: string): SignedUploadParams {
    return {
      signature: 'mock-signature',
      timestamp: Math.round(Date.now() / 1000),
      apiKey: 'mock-api-key',
      cloudName: 'mock-cloud',
      folder,
    };
  }
}
