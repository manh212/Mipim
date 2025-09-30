import { 
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_FOLDER_PLAYER,
  CLOUDINARY_FOLDER_NPC_MALE,
  CLOUDINARY_FOLDER_NPC_WOMEN,
  CLOUDINARY_FOLDER_YEU_THU,
  // CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are no longer directly used here for signing.
  // They are expected to be environment variables in the Netlify function.
} from '../constants';

// Netlify function endpoint
const SIGNATURE_FUNCTION_ENDPOINT = '/.netlify/functions/generate-cloudinary-signature';

export async function uploadImageToCloudinary(
  base64ImageString: string,
  type: 'player' | 'npc_male' | 'npc_female' | 'yeu_thu', 
  publicId?: string
): Promise<string> {

  const effectiveCloudinaryCloudName = CLOUDINARY_CLOUD_NAME;
  if (!effectiveCloudinaryCloudName) {
    const errorMessage = "Cloudinary Cloud Name (từ constants.ts) is missing. Cannot upload image.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  
  let folderName: string;
  if (type === 'player') {
    folderName = CLOUDINARY_FOLDER_PLAYER;
  } else if (type === 'npc_male') {
    folderName = CLOUDINARY_FOLDER_NPC_MALE;
  } else if (type === 'yeu_thu') {
    folderName = CLOUDINARY_FOLDER_YEU_THU;
  } else { // npc_female
    folderName = CLOUDINARY_FOLDER_NPC_WOMEN;
  }
  
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    timestamp: timestamp,
    folder: folderName,
  };

  let sanitizedPublicId: string | undefined = undefined;
  if (publicId) {
    sanitizedPublicId = publicId.replace(/[\/\?&#%<>]/g, '_');
    paramsToSign.public_id = sanitizedPublicId;
  }
  
  let signature: string;
  let apiKeyToUse: string;
  let timestampToUse: number;

  try {
    const sigResponse = await fetch(SIGNATURE_FUNCTION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paramsToSign }),
    });
    
    // CORRECTED LOGIC: Read the body as text ONCE.
    const responseText = await sigResponse.text();

    if (!sigResponse.ok) {
      let errorBodyText = `Server responded with ${sigResponse.status} ${sigResponse.statusText}.`;
      let errorDetails = responseText; // Default to raw text
      try {
        // TRY to parse the text as JSON.
        const errorBodyJson = JSON.parse(responseText); 
        errorDetails = errorBodyJson?.message || JSON.stringify(errorBodyJson) || 'Unknown server error content.';
      } catch (jsonError) {
        // If parsing fails, it's not JSON. Use the raw text which is already in errorDetails.
      }
      errorBodyText += ` Details: ${errorDetails || '(empty response body)'}`;
      throw new Error(errorBodyText);
    }
    
    // Now, parse the successful response text as JSON.
    const sigData = JSON.parse(responseText);
    signature = sigData.signature;
    apiKeyToUse = sigData.apiKey;
    timestampToUse = sigData.timestamp; // Use timestamp from server response to ensure consistency
    
    if (!signature || !apiKeyToUse || typeof timestampToUse !== 'number') {
        throw new Error("Invalid signature data received from server. Signature, API key, or timestamp missing/invalid.");
    }

  } catch (error) {
    console.error("Error fetching Cloudinary signature:", error);
    const userMessage = error instanceof Error ? error.message : "Lỗi kết nối đến dịch vụ ký Cloudinary.";
    // Avoid redundant "Failed to get signature from server" if it's already in the message from the !sigResponse.ok block
    if (error instanceof Error && error.message.startsWith("Server responded with")) {
        throw error;
    }
    throw new Error(`Không thể lấy chữ ký Cloudinary: ${userMessage}`);
  }
  
  const formData = new FormData();
  formData.append('file', `data:image/png;base64,${base64ImageString}`);
  formData.append('api_key', apiKeyToUse);
  formData.append('timestamp', timestampToUse.toString());
  formData.append('signature', signature);
  formData.append('folder', folderName);
  if (sanitizedPublicId) {
    formData.append('public_id', sanitizedPublicId);
  }
  
  const cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${effectiveCloudinaryCloudName}/image/upload`;
  try {
    const uploadResponse = await fetch(cloudinaryUploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.text(); 
      throw new Error(`Cloudinary upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. Details: ${errorBody}`);
    }

    const uploadResult = await uploadResponse.json();
    if (!uploadResult.secure_url) {
      throw new Error("Cloudinary upload succeeded but did not return a secure_url.");
    }
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error during Cloudinary upload POST request:", error);
    throw new Error(`Tải ảnh lên Cloudinary thất bại: ${error instanceof Error ? error.message : String(error)}`);
  }
}