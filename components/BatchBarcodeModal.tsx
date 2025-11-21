
import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import Card from './Card';
import Button from './Button';
import { X, Download, Printer } from 'lucide-react';
import { PurchaseItem } from '../types';

interface BatchBarcodeModalProps {
  isOpen: boolean;
  purchaseItems: PurchaseItem[];
  onClose: () => void;
  businessName: string;
  title?: string;
}

const generateLabelCanvas = (product: { id: string, name: string, salePrice: number }, businessName: string): HTMLCanvasElement => {
    const labelCanvas = document.createElement('canvas');
    const dpiScale = 6; // Upped to 6 for ~900 DPI on a 2x1 inch label
    labelCanvas.width = 300 * dpiScale;
    labelCanvas.height = 150 * dpiScale;

    const ctx = labelCanvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);

    ctx.font = `bold ${16 * dpiScale}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(businessName, labelCanvas.width / 2, 20 * dpiScale);

    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, product.id, {
      format: 'CODE128',
      width: 2 * dpiScale,
      height: 50 * dpiScale,
      displayValue: false,
      margin: 0,
    });
    
    const barcodeX = (labelCanvas.width - barcodeCanvas.width) / 2;
    const barcodeY = 30 * dpiScale;
    ctx.drawImage(barcodeCanvas, barcodeX, barcodeY);

    let textY = barcodeY + barcodeCanvas.height + (16 * dpiScale);

    ctx.font = `bold ${12 * dpiScale}px Arial`;
    const productText = product.name.substring(0, 30);
    ctx.fillText(productText, labelCanvas.width / 2, textY);
    textY += 16 * dpiScale;

    ctx.font = `normal ${12 * dpiScale}px Arial`;
    ctx.fillText(product.id, labelCanvas.width / 2, textY);
    textY += 18 * dpiScale;

    ctx.font = `bold ${14 * dpiScale}px Arial`;
    ctx.fillText(`MRP: ₹${product.salePrice.toLocaleString('en-IN')}`, labelCanvas.width / 2, textY);

    return labelCanvas;
};

const BatchBarcodeModal: React.FC<BatchBarcodeModalProps> = ({ isOpen, purchaseItems, onClose, businessName, title }) => {
    const [quantities, setQuantities] = useState<{ [key: string]: string }>({});
    const printIframeRef = useRef<HTMLIFrameElement | null>(null);

    useEffect(() => {
        if (isOpen && purchaseItems.length > 0) {
            const initialQuantities = purchaseItems.reduce((acc, item) => {
                acc[item.productId] = String(item.quantity);
                return acc;
            }, {} as { [key: string]: string });
            setQuantities(initialQuantities);
        } else if (!isOpen) {
            setQuantities({});
        }

        // Cleanup iframe on modal close/unmount
        return () => {
            if (printIframeRef.current) {
                document.body.removeChild(printIframeRef.current);
                printIframeRef.current = null;
            }
        };
    }, [isOpen, purchaseItems]);

    const handleQuantityChange = (productId: string, value: string) => {
        const num = parseInt(value, 10);
        const cleanValue = String(num); // This removes leading zeros

        if (value === "") {
            setQuantities(prev => ({ ...prev, [productId]: "" }));
        } else if (!isNaN(num) && num >= 0) {
            setQuantities(prev => ({ ...prev, [productId]: cleanValue }));
        }
    };

    const totalLabels = useMemo(() => Object.values(quantities).reduce((sum: number, qty: string) => sum + (parseInt(qty, 10) || 0), 0), [quantities]);

    const handleDownloadPDF = async () => {
        if (totalLabels <= 0) {
            alert("No labels to print. Please set quantities greater than 0.");
            return;
        }
        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [50.8, 25.4], // 2x1 inch
            });
            const margin = 1;

            let isFirstPage = true;

            for (const item of purchaseItems) {
                const count = parseInt(quantities[item.productId], 10) || 0;
                if (count <= 0) continue;

                const productInfo = { id: item.productId, name: item.productName, salePrice: item.saleValue };
                const labelCanvas = generateLabelCanvas(productInfo, businessName);
                const imageData = labelCanvas.toDataURL('image/png');
                
                const imgWidth = doc.internal.pageSize.getWidth() - 2 * margin;
                const imgHeight = (imgWidth * labelCanvas.height) / labelCanvas.width;
                const yPosition = (doc.internal.pageSize.getHeight() - imgHeight) / 2;

                for (let i = 0; i < count; i++) {
                    if (!isFirstPage) doc.addPage();
                    isFirstPage = false;
                    doc.addImage(imageData, 'PNG', margin, yPosition, imgWidth, imgHeight);
                }
            }

            doc.save(`purchase-labels.pdf`);
        } catch (error) {
            console.error('PDF generation failed:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handlePrint = () => {
        if (totalLabels <= 0) {
            alert("No labels to print. Please set quantities greater than 0.");
            return;
        }
        try {
            let labelsHtml = '';
            for (const item of purchaseItems) {
                const count = parseInt(quantities[item.productId], 10) || 0;
                if (count <= 0) continue;

                const productInfo = { id: item.productId, name: item.productName, salePrice: item.saleValue };
                const labelCanvas = generateLabelCanvas(productInfo, businessName);
                const imageDataUrl = labelCanvas.toDataURL('image/png');

                for (let i = 0; i < count; i++) {
                    labelsHtml += `<div class="label"><img src="${imageDataUrl}" style="width: 100%; height: 100%;" /></div>`;
                }
            }
            
            const printStyles = `
                @page { size: 2in 1in; margin: 0; }
                @media print {
                    html, body { width: 2in; height: 1in; margin: 0; padding: 0; display: block; }
                    .label { width: 2in; height: 1in; page-break-after: always; box-sizing: border-box; display: block; }
                }
            `;
            
            // Cleanup previous iframe if it exists
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
                 // Fallback
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card className="w-full max-w-lg animate-scale-in">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-primary">{title || "Print Barcode Labels for Purchase"}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={20} /></button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {purchaseItems.map(item => (
                        <div key={item.productId} className="grid grid-cols-3 gap-2 items-center p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                            <div className="col-span-2">
                                <p className="font-semibold text-sm">{item.productName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.productId}</p>
                            </div>
                            <input
                                type="number"
                                value={quantities[item.productId] || ''}
                                onChange={e => handleQuantityChange(item.productId, e.target.value)}
                                className="w-full p-2 border rounded text-center dark:bg-slate-600 dark:border-slate-500 dark:text-slate-200"
                            />
                        </div>
                    ))}
                </div>
                
                <div className="mt-4 pt-4 border-t dark:border-slate-700">
                    <p className="text-center font-bold mb-4">Total Labels to Print: {totalLabels}</p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 rounded mb-4">
                        <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Print Settings</p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                        Ensure printer settings use <strong>Actual Size</strong> and <strong>Paper Size: 2x1 inch</strong> (50.8x25.4mm).
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Button onClick={handlePrint} className="w-full"><Printer size={16} className="mr-2" /> Print</Button>
                        <Button onClick={handleDownloadPDF} className="w-full"><Download size={16} className="mr-2" /> Download PDF</Button>
                    </div>
                    <Button onClick={onClose} variant="secondary" className="w-full mt-2">Skip / Close</Button>
                </div>
            </Card>
        </div>
    );
};

export default BatchBarcodeModal;
