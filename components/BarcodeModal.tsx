
import React, { useState, useRef, useEffect } from 'react';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import Card from './Card';
import Button from './Button';
import { X, Download, Printer } from 'lucide-react';

interface BarcodeModalProps {
  isOpen: boolean;
  product: {
    id: string;
    name: string;
    salePrice: number;
    quantity: number;
  };
  onClose: () => void;
  businessName: string;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ isOpen, product, onClose, businessName }) => {
  const [numberOfCopies, setNumberOfCopies] = useState(1);
  const labelPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  const generateLabelCanvas = (): HTMLCanvasElement => {
    const labelCanvas = document.createElement('canvas');
    const dpiScale = 6; // Upped to 6 for ~900 DPI on a 2x1 inch label
    labelCanvas.width = 300 * dpiScale;
    labelCanvas.height = 150 * dpiScale;

    const ctx = labelCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    // Set white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    // Add Business Name
    ctx.font = `bold ${16 * dpiScale}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(businessName, labelCanvas.width / 2, 20 * dpiScale);

    // Generate barcode on a temporary canvas
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, product.id, {
      format: 'CODE128',
      width: 2 * dpiScale,
      height: 50 * dpiScale,
      displayValue: false, // We will render text manually
      margin: 0,
    });
    
    // Draw barcode onto the main label canvas, centered
    const barcodeX = (labelCanvas.width - barcodeCanvas.width) / 2;
    const barcodeY = 30 * dpiScale;
    ctx.drawImage(barcodeCanvas, barcodeX, barcodeY);

    // Starting Y for text, below the barcode
    let textY = barcodeY + barcodeCanvas.height + (16 * dpiScale);

    // Add product name
    ctx.font = `bold ${12 * dpiScale}px Arial`;
    const productText = product.name.substring(0, 30);
    ctx.fillText(productText, labelCanvas.width / 2, textY);
    textY += 16 * dpiScale; // Move to next line

    // Add product ID
    ctx.font = `normal ${12 * dpiScale}px Arial`;
    ctx.fillText(product.id, labelCanvas.width / 2, textY);
    textY += 18 * dpiScale; // Move to next line with a bit more space

    // Add MRP
    ctx.font = `bold ${14 * dpiScale}px Arial`;
    ctx.fillText(`MRP: ₹${product.salePrice.toLocaleString('en-IN')}`, labelCanvas.width / 2, textY);

    return labelCanvas;
  }

  useEffect(() => {
    if (isOpen && product) {
        setNumberOfCopies(product.quantity || 0);
    }

    // Cleanup iframe on modal close/unmount
    return () => {
        if (printIframeRef.current) {
            document.body.removeChild(printIframeRef.current);
            printIframeRef.current = null;
        }
    };
  }, [isOpen, product]);

  useEffect(() => {
    if (isOpen && product && labelPreviewCanvasRef.current) {
        const fullLabelCanvas = generateLabelCanvas();
        const previewCtx = labelPreviewCanvasRef.current.getContext('2d');
        if (previewCtx) {
            const previewWidth = 200;
            const previewHeight = 100;
            // Render at 2x for retina displays, then style down
            labelPreviewCanvasRef.current.width = previewWidth * 2; 
            labelPreviewCanvasRef.current.height = previewHeight * 2;
            labelPreviewCanvasRef.current.style.width = `${previewWidth}px`;
            labelPreviewCanvasRef.current.style.height = `${previewHeight}px`;

            previewCtx.fillStyle = '#FFFFFF';
            previewCtx.fillRect(0, 0, labelPreviewCanvasRef.current.width, labelPreviewCanvasRef.current.height);
            previewCtx.drawImage(fullLabelCanvas, 0, 0, labelPreviewCanvasRef.current.width, labelPreviewCanvasRef.current.height);
        }
    }
  }, [isOpen, product, businessName, numberOfCopies]); // Re-render preview if copies change (though not used in preview)


  const handleDownloadPDF = async () => {
    if (numberOfCopies <= 0) {
      alert("Please enter a number of copies greater than 0.");
      return;
    }
    try {
      const doc = new jsPDF({
        orientation: 'landscape', // Correct orientation for 2x1 label
        unit: 'mm',
        format: [50.8, 25.4], // 2x1 inch
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 1;

      for (let copy = 0; copy < numberOfCopies; copy++) {
        if (copy > 0) doc.addPage();
        
        const labelCanvas = generateLabelCanvas();
        const imageData = labelCanvas.toDataURL('image/png');
        
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (imgWidth * labelCanvas.height) / labelCanvas.width;
        const yPosition = (doc.internal.pageSize.getHeight() - imgHeight) / 2;

        doc.addImage(imageData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      }

      const filename = `${product.id}-labels-${numberOfCopies}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handlePrint = () => {
    if (numberOfCopies <= 0) {
      alert("Please enter a number of copies greater than 0.");
      return;
    }
    try {
        const labelCanvas = generateLabelCanvas();
        const imageDataUrl = labelCanvas.toDataURL('image/png');

        let labelsHtml = '';
        for (let i = 0; i < numberOfCopies; i++) {
            labelsHtml += `<div class="label"><img src="${imageDataUrl}" style="width: 100%; height: 100%;" /></div>`;
        }

        const printStyles = `
            @page { size: 2in 1in; margin: 0; }
            @media print {
                html, body { width: 2in; height: 1in; margin: 0; padding: 0; display: block; }
                .label { width: 2in; height: 1in; page-break-after: always; box-sizing: border-box; display: block; }
            }
        `;
        
        // Cleanup previous iframe if it exists from a prior print action
        if (printIframeRef.current) {
            document.body.removeChild(printIframeRef.current);
        }

        const iframe = document.createElement('iframe');
        printIframeRef.current = iframe; // Store ref
        iframe.style.position = 'absolute';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument;
        if (doc) {
            doc.open();
            doc.write(`<html><head><title>Print Labels</title><style>${printStyles}</style></head><body>${labelsHtml}</body></html>`);
            doc.close();
            iframe.onload = () => {
                if (iframe.contentWindow) {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                }
                // NOTE: The iframe is NOT removed here. It will be cleaned up by the useEffect hook when the modal closes.
            };
        } else {
             // Fallback if doc is not available
             if (printIframeRef.current) {
                document.body.removeChild(printIframeRef.current);
                printIframeRef.current = null;
             }
        }
    } catch (error) {
        console.error('Printing failed:', error);
        alert('Failed to print labels. Please try again.');
    }
  };


  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
      <Card className="w-full max-w-md animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Print/Download Barcode Labels</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Label Preview:</h3>
            <div className="border-2 border-dashed border-purple-300 bg-gray-50 dark:bg-slate-700/50 dark:border-slate-600 p-4 rounded-lg flex justify-center">
              <canvas ref={labelPreviewCanvasRef} style={{ border: '1px solid #ddd', background: 'white' }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-center">Number of copies</label>
            <div className="flex items-center justify-center gap-2">
                <Button 
                    onClick={() => setNumberOfCopies(prev => Math.max(0, prev - 1))}
                    className="px-4 py-2 text-xl font-bold"
                    variant="secondary"
                    aria-label="Decrease quantity"
                >
                    -
                </Button>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={numberOfCopies}
                  onChange={(e) => setNumberOfCopies(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 p-2 border rounded text-center text-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                />
                <Button
                    onClick={() => setNumberOfCopies(prev => Math.min(100, prev + 1))}
                    className="px-4 py-2 text-xl font-bold"
                    variant="secondary"
                    aria-label="Increase quantity"
                >
                    +
                </Button>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 rounded">
            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Important Print Settings</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              When printing, ensure printer settings use <strong>Actual Size</strong> and <strong>Paper Size: 2x1 inch</strong> (50.8x25.4mm).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handlePrint} className="w-full"><Printer size={16} className="mr-2" /> Print</Button>
            <Button onClick={handleDownloadPDF} className="w-full"><Download size={16} className="mr-2" /> Download PDF</Button>
          </div>
          <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
        </div>
      </Card>
    </div>
  );
};
