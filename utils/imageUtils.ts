
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            if (event.target?.result) {
                img.src = event.target.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scaleSize = maxWidth / img.width;
                    canvas.width = maxWidth;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    } else {
                        resolve(img.src);
                    }
                };
                img.onerror = (error) => reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
    });
};

export const extractDominantColor = (base64Image: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Image;
        img.crossOrigin = "Anonymous";
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('#000000');
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);

            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const colorCounts: { [key: string]: number } = {};
                let maxCount = 0;
                let dominantColor = '#000000';

                // Sample every 10th pixel for performance
                for (let i = 0; i < data.length; i += 40) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const a = data[i + 3];

                    // Skip transparent or very white/black/gray pixels to find the "Brand" color
                    if (a < 128) continue; // Transparent
                    if (r > 240 && g > 240 && b > 240) continue; // White
                    if (r < 20 && g < 20 && b < 20) continue; // Black
                    
                    // Simple check for gray (r, g, b are close)
                    if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15) continue;

                    const rgb = `${r},${g},${b}`;
                    colorCounts[rgb] = (colorCounts[rgb] || 0) + 1;

                    if (colorCounts[rgb] > maxCount) {
                        maxCount = colorCounts[rgb];
                        // Convert to Hex
                        dominantColor = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
                    }
                }
                resolve(dominantColor);
            } catch (e) {
                console.error("Error extracting color", e);
                resolve('#000000');
            }
        };
        img.onerror = (e) => {
            console.error("Error loading image for color extraction", e);
            resolve('#000000');
        };
    });
};
