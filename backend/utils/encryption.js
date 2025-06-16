// const crypto = require("crypto");

// // These keys should be 64 hex characters (32 bytes) for AES-256 and 32 hex characters (16 bytes) for the IV.
// const AES_SECRET_KEY = process.env.AES_SECRET_KEY ;
// const AES_IV = process.env.AES_IV.substr(0, 16); 

// // Convert hex keys to buffers
// const keyBuffer = Buffer.from(AES_SECRET_KEY, "hex");
// const ivBuffer = Buffer.from(AES_IV, "utf8");

// function decryptAES256(encryptedText) {
//   if (!encryptedText) return null;
//   try {
//     const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, ivBuffer);
//     let decrypted = decipher.update(encryptedText, "base64", "utf8");
//     decrypted += decipher.final("utf8");
//     return decrypted;
//   } catch (error) {
//     console.error("Decryption error (falling back to default):", error.message);
//     return null;
//   }
// }

// module.exports = { decryptAES256 };


const crypto = require("crypto");

// Encryption and decryption key and IV
// Note: In a real application, store these securely and keep them confidential.
const key = Buffer.from(process.env.AES_SECRET_KEY, "hex");
const iv = Buffer.from(process.env.AES_IV, "hex");

// Encrypt function
function encryptWithAES256(text, options = {}) {
  let encryption_key = key,
    encryption_iv = iv;
  let { key: _key, iv: _iv, algorithm = "aes-128-cbc" } = options;
  if (_key && _iv) {
    encryption_key = Buffer.from(_key, "hex");
    encryption_iv = Buffer.from(_iv, "hex");
  }
  const cipher = crypto.createCipheriv(
    algorithm,
    encryption_key,
    encryption_iv
  );
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Return the encrypted data, no need to include IV as it's shared
  return encrypted.slice(0, 25); // Slicing to keep the length within 25 characters
}

// Decrypt function
function decryptAES256(encrypted) {

  try{
  const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}catch (error) {
    console.error("Decryption error:", error.message);
    return null;
  }
}


module.exports = {decryptAES256 };