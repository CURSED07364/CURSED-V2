const logger = require('../utils/logger');

class ImageService {
  /**
   * Generates a styled image URL based on command type and user prompt.
   * @param {string} type - COMMAND type: imagine, art, logo, banner, avatar
   * @param {string} prompt - The raw user prompt
   * @returns {string} The public image url
   */
  generateImageURL(type, prompt) {
    let styledPrompt = prompt;
    let width = 1024;
    let height = 1024;
    
    switch (type.toLowerCase()) {
      case 'logo':
        styledPrompt = `${prompt}, flat vector logo, clean typography, minimalist concept icon, modern graphic design, high contrast, transparent style background, 8k resolution`;
        break;
      case 'banner':
        styledPrompt = `${prompt}, wide horizontal website header banner, gaming background, ultra-wide landscape, highly detailed cinematic lighting, cyberpunk sci-fi or fantasy art, 16:9 ratio`;
        width = 1200;
        height = 630;
        break;
      case 'avatar':
        styledPrompt = `${prompt}, square profile picture portrait avatar, highly detailed character concept art, close-up face, digital painting style, vibrant highlights, profile headshot`;
        break;
      case 'art':
        styledPrompt = `${prompt}, oil painting, museum masterpiece, dramatic baroque lighting, highly expressive texture, high fine art, digital canvas style`;
        break;
      case 'imagine':
      default:
        styledPrompt = `${prompt}, photorealistic, hyper-detailed, 8k resolution, cinematic atmosphere, unreal engine render`;
        break;
    }

    const url = `https://image.pollinations.ai/p/${encodeURIComponent(styledPrompt)}?width=${width}&height=${height}&nologo=true&seed=${Math.floor(Math.random() * 100000)}`;
    logger.debug(`Generated Pollinations AI URL: ${url}`);
    return url;
  }
}

module.exports = new ImageService();
