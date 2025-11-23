/**
 * Nano Banana (Gemini) Image Generation Helper
 * Utilities for working with Google's gemini-2.5-flash-image-preview model
 * 
 * @see https://docs.laozhang.ai/en/api-capabilities/nano-banana-image
 */

export interface NanoBananaResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ExtractedImageData {
  format: string;
  base64Data: string;
  dataUrl: string;
}

/**
 * Extract base64 image data from Nano Banana API response
 * Supports both text2image and image edit responses
 * 
 * @param content - The message content from API response
 * @returns Extracted image data or null if not found
 */
export function extractBase64Image(content: string): ExtractedImageData | null {
  // Pattern to match: data:image/{format};base64,{base64_data}
  const base64Pattern = /data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)/;
  const match = content.match(base64Pattern);

  if (!match) {
    console.error('❌ Base64 image data not found in response');
    console.log('📄 Content preview:', content.substring(0, 300));
    return null;
  }

  const imageFormat = match[1]; // png, jpg, jpeg, webp, etc.
  const base64Data = match[2];

  // Validate base64 data length (should be reasonably long for an image)
  if (base64Data.length < 100) {
    console.error('❌ Base64 data too short, possibly invalid');
    return null;
  }

  return {
    format: imageFormat,
    base64Data,
    dataUrl: `data:image/${imageFormat};base64,${base64Data}`,
  };
}

/**
 * Build Nano Banana text-to-image request
 * 
 * @param prompt - Image generation prompt
 * @returns Request body for the API
 */
export function buildText2ImageRequest(prompt: string) {
  return {
    model: 'gemini-2.5-flash-image-preview',
    stream: false,
    response_format: { type: 'base64' }, // Forçar resposta em base64
    messages: [
      {
        role: 'system',
        content: 'You are an AI that generates images. Always return the image as a base64 data URL in the format: data:image/png;base64,{data}',
      },
      {
        role: 'user',
        content: `Generate an image: ${prompt}`,
      },
    ],
  };
}

/**
 * Build Nano Banana image edit request
 * Supports single or multiple image inputs (URLs or base64)
 * 
 * @param prompt - Edit instruction prompt
 * @param imageUrls - Array of image URLs or base64 data URLs to edit/compose
 * @returns Request body for the API
 */
export function buildImageEditRequest(prompt: string, imageUrls: string[]) {
  const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: prompt,
    },
  ];

  // Add all images (URLs or base64) to the content
  imageUrls.forEach((imageData) => {
    // ✅ Suporta tanto URLs (http/https) quanto base64 (data:image)
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: imageData, // Aceita URL ou data:image/...;base64,...
      },
    });
  });

  return {
    model: 'gemini-2.5-flash-image-preview',
    stream: false,
    messages: [
      {
        role: 'user',
        content: contentArray,
      },
    ],
  };
}

/**
 * Convert base64 string to Buffer
 * Useful for saving images to file system or uploading to storage
 * 
 * @param base64Data - Base64 encoded image data (without data URI prefix)
 * @returns Buffer containing the decoded image data
 */
export function base64ToBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}

/**
 * Get file extension from image format
 * 
 * @param format - Image format (png, jpg, jpeg, webp, etc.)
 * @returns File extension with dot prefix
 */
export function getFileExtension(format: string): string {
  const normalizedFormat = format.toLowerCase();
  
  // Handle common format variations
  const formatMap: Record<string, string> = {
    jpg: '.jpg',
    jpeg: '.jpg',
    png: '.png',
    webp: '.webp',
    gif: '.gif',
  };

  return formatMap[normalizedFormat] || '.png';
}

/**
 * Generate unique task ID for Nano Banana generations
 * 
 * @param type - Generation type (text2image or image2image)
 * @returns Unique task ID
 */
export function generateTaskId(type: 'text2image' | 'image2image' = 'text2image'): string {
  const prefix = type === 'image2image' ? 'nano-edit' : 'nano';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate Nano Banana API response
 * 
 * @param response - API response object
 * @returns True if valid, false otherwise
 */
export function isValidNanoBananaResponse(response: unknown): response is NanoBananaResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const res = response as Partial<NanoBananaResponse>;
  
  return (
    Array.isArray(res.choices) &&
    res.choices.length > 0 &&
    res.choices[0]?.message !== undefined &&
    typeof res.choices[0]?.message?.content === 'string'
  );
}

/**
 * Calculate estimated generation time for Nano Banana
 * Based on documentation: ~10 seconds average
 * 
 * @returns Estimated time in milliseconds
 */
export function getEstimatedGenerationTime(): number {
  return 10000; // 10 seconds in milliseconds
}

/**
 * Get Nano Banana API pricing information
 * 
 * @returns Pricing details
 */
export function getPricingInfo() {
  return {
    pricePerImage: 0.025, // USD
    currency: 'USD',
    officialPrice: 0.04,
    savings: '37.5%',
    averageGenerationTime: '~10s',
  };
}

