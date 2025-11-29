
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return, Quote, InvoiceTemplateConfig, CustomFont, InvoiceLabels } from '../types';
import { logoBase64 } from './logo';

// --- Number to Words (Indian Currency - Robust Recursive) ---
const numberToWords = (n: number): string => {
    const num = Math.floor(n);
    const paise = Math.round((n - num) * 100);
    
    if (num === 0) return "Zero";

    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

    const convert = (n: number): string => {
        if (n < 20) return units[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + units[n % 10] : "");
        if (n < 1000) return units[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + convert(n % 100) : "");
        if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
        if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + convert(n % 100000) : "");
        return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + convert(n % 10000000) : "");
    };

    let str = convert(num) + " Rupees";
    if (paise > 0) {
        str += " and " + convert(paise) + " Paise";
    }
    
    return str + " Only";
};

// --- Helper: Fetch QR Code ---
export const getQrCodeBase64 = async (data: string): Promise<string> => {
    try {
        const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=200x200&margin=0`);
        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return '';
    }
};

// --- Helper: Detect Image Type ---
export const getImageType = (dataUrl: string): string => {
    if (!dataUrl) return 'PNG';
    // Robust Case Insensitive Checks for Common Types
    const header = dataUrl.substring(0, 30).toLowerCase();
    
    if (header.includes('image/png')) return 'PNG';
    if (header.includes('image/jpeg') || header.includes('image/jpg')) return 'JPEG';
    if (header.includes('image/webp')) return 'WEBP';
    
    // Fallback: Check magic bytes for base64 without prefix
    if (dataUrl.startsWith('/9j/')) return 'JPEG';
    if (dataUrl.startsWith('iVBORw0KGgo')) return 'PNG';
    if (dataUrl.startsWith('UklGR')) return 'WEBP';
    
    return 'PNG'; // Default
};

// --- Helper: Register Custom Fonts ---
const registerCustomFonts = (doc: jsPDF, fonts: CustomFont[]) => {
    if (!fonts || fonts.length === 0) return;
    fonts.forEach(font => {
        try {
            let cleanData = font.data;
            if (cleanData.includes(',')) cleanData = cleanData.split(',')[1];
            const filename = `${font.name}.ttf`;
            doc.addFileToVFS(filename, cleanData);
            doc.addFont(filename, font.name, 'normal');
            doc.addFont(filename, font.name, 'bold');
            doc.addFont(filename, font.name, 'italic');
        } catch (e) { console.error(`Failed to register font ${font.name}`, e); }
    });
};

const formatDate = (dateString: string, format: string) => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`;
};

const formatCurrency = (amount: number, symbol: string, fontName: string): string => {
    // Some basic fonts don't support the Rupee symbol
    const isStandardFont = ['helvetica', 'times', 'courier'].includes(fontName.toLowerCase());
    const safeSymbol = (isStandardFont && symbol === '₹') ? 'Rs.' : symbol;
    return `${safeSymbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

export const defaultLabels: InvoiceLabels = {
    billedTo: "Billed To",
    invoiceNo: "Invoice No",
    date: "Date",
    item: "Item",
    qty: "Qty",
    rate: "Rate",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    gst: "GST",
    grandTotal: "Grand Total",
    paid: "Paid",
    balance: "Balance"
};

// --- Thermal Receipt Generator (Fixed / Legacy Mode) ---
export const generateThermalInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig?: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    // If we have template config, try to use it as much as possible for fonts/logos, but layout is fixed for thermal paper
    const labels = { ...defaultLabels, ...templateConfig?.content.labels };
    const currencySymbol = templateConfig?.currencySymbol || 'Rs.';
    const currency = customFonts?.length ? currencySymbol : 'Rs.';
    const margin = 2;
    const pageWidth = 72; 
    const centerX = 40; 

    const renderContent = (doc: jsPDF) => {
        let y = 5;
        if (customFonts) registerCustomFonts(doc, customFonts);

        if (profile?.logo) {
            try {
                const logoWidth = 18;
                let logoHeight = 18;
                const props = doc.getImageProperties(profile.logo);
                logoHeight = logoWidth / (props.width / props.height);
                doc.addImage(profile.logo, getImageType(profile.logo), centerX - (logoWidth/2), y, logoWidth, logoHeight);
                y += logoHeight + 3;
            } catch(e) {}
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(doc.splitTextToSize(profile?.name || 'Business Name', pageWidth), centerX, y, { align: 'center' });
        y += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        if (profile?.address) {
            const addr = doc.splitTextToSize(profile.address, pageWidth);
            doc.text(addr, centerX, y, { align: 'center' });
            y += (addr.length * 3.5) + 1;
        }
        if (profile?.phone) {
            doc.text(`Ph: ${profile.phone}`, centerX, y, { align: 'center' });
            y += 4;
        }

        doc.line(margin, y, 80 - margin, y); y += 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(templateConfig?.content.titleText || 'TAX INVOICE', centerX, y, { align: 'center' });
        y += 5;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`${labels.invoiceNo}: ${sale.id}`, margin, y); y += 4;
        doc.text(`${labels.date}: ${formatDate(sale.date, 'DD/MM/YYYY')}`, margin, y); y += 4;
        doc.text(`${labels.billedTo}: ${customer.name}`, margin, y); y += 5;

        doc.line(margin, y, 80 - margin, y); y += 4;
        doc.setFont('helvetica', 'bold');
        doc.text(labels.item, margin, y);
        doc.text(labels.amount, 80 - margin, y, { align: 'right' });
        y += 2;
        doc.line(margin, y, 80 - margin, y); y += 4;

        doc.setFont('helvetica', 'normal');
        sale.items.forEach(item => {
            const itemTotal = Number(item.price) * Number(item.quantity);
            const name = doc.splitTextToSize(item.productName, 50);
            doc.text(name, margin, y);
            doc.text(itemTotal.toLocaleString('en-IN'), 80 - margin, y, { align: 'right' });
            y += (name.length * 3.5);
            doc.setFontSize(7);
            doc.text(`${item.quantity} x ${Number(item.price).toLocaleString('en-IN')}`, margin, y);
            doc.setFontSize(8);
            y += 4;
        });

        doc.line(margin, y, 80 - margin, y); y += 4;
        
        const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        
        const addRow = (l: string, v: string, b = false) => {
            doc.setFont('helvetica', b ? 'bold' : 'normal');
            doc.text(l, 45, y, { align: 'right' });
            doc.text(v, 80 - margin, y, { align: 'right' });
            y += 4;
        }

        addRow(labels.subtotal, subTotal.toLocaleString('en-IN'));
        if (sale.discount > 0) addRow(labels.discount, `-${Number(sale.discount).toLocaleString('en-IN')}`);
        addRow(labels.grandTotal, `${currency} ${Number(sale.totalAmount).toLocaleString('en-IN')}`, true);
        if (paid < Number(sale.totalAmount)) {
            addRow(labels.balance, `${currency} ${(Number(sale.totalAmount) - paid).toLocaleString('en-IN')}`, true);
        }

        y += 5;
        doc.setFont('helvetica', 'italic');
        const footerLines = doc.splitTextToSize(templateConfig?.content.footerText || 'Thank You!', pageWidth);
        doc.text(footerLines, centerX, y, { align: 'center' });
        return y + (footerLines.length * 4) + 5;
    };

    const dummy = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, 2000] });
    const h = renderContent(dummy);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [80, h] });
    renderContent(doc);
    return doc;
};

export interface GenericDocumentData {
    id: string;
    date: string;
    recipient: { label: string; name: string; address: string; contact?: string; };
    sender: { label: string; idLabel: string; };
    items: { name: string; quantity: number; rate: number; amount: number; }[];
    totals: { label: string; value: string; isBold?: boolean; color?: string; size?: number; }[];
    watermarkText?: string;
    qrString?: string;
    grandTotalNumeric?: number;
    balanceDue?: number;
    taxBreakdown?: { rate: number, taxable: number, tax: number }[];
}

// --- Configurable PDF Engine (Modular) ---
const _generateConfigurablePDF = async (
    data: GenericDocumentData,
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[],
    customPaperSize?: [number, number] // Optional override for receipt width
): Promise<jsPDF> => {
    
    // Support custom paper size array (e.g. [80, 200] for receipt preview)
    let doc: jsPDF;
    if (customPaperSize) {
        doc = new jsPDF({ orientation: 'p', unit: 'mm', format: customPaperSize });
    } else {
        const paperSize = templateConfig.layout.paperSize || 'a4';
        doc = new jsPDF({ format: paperSize });
    }
    
    if (customFonts) registerCustomFonts(doc, customFonts);

    const { colors, fonts, layout, content, currencySymbol } = templateConfig;
    const labels = { ...defaultLabels, ...content.labels };
    
    const pageWidth = doc.internal.pageSize.getWidth(); 
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = layout.margin || 10;
    const spacingScale = layout.spacing !== undefined ? layout.spacing : 1.0;
    
    let currentY = margin;

    // Helper for applying spacing
    const addY = (amount: number) => {
        currentY += amount * spacingScale;
    };

    // --- Render Background Image (Stationery) ---
    if (layout.backgroundImage) {
        try {
            doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
        } catch(e) {
            console.warn("Failed to render background image", e);
        }
    }

    // --- RENDERERS ---

    const renderHeader = async () => {
        if (content.showBusinessDetails === false) {
            addY(5);
            return;
        }

        const isBanner = layout.headerStyle === 'banner';
        if (isBanner) {
            doc.setFillColor(colors.bannerBg || colors.primary);
            doc.setRoundedRect(0, 0, pageWidth, 40 + (layout.logoSize/2), layout.borderRadius || 0, layout.borderRadius || 0, 'F');
            addY(5);
        }

        const logoUrl = profile?.logo || logoBase64;
        const hasLogo = !!logoUrl && layout.logoSize > 5;
        let textY = currentY;
        let textAlign: 'left' | 'center' | 'right' = 'left';
        let renderedLogoHeight = 0;
        let textX = margin;
        let logoX = margin;
        let logoY = currentY + (layout.logoOffsetY || 0);

        // Individual Spacing Values
        const logoBottomSpace = layout.elementSpacing?.logoBottom ?? 5;
        const titleBottomSpace = layout.elementSpacing?.titleBottom ?? 2;
        const addressBottomSpace = layout.elementSpacing?.addressBottom ?? 1;
        const headerBottomSpace = layout.elementSpacing?.headerBottom ?? 5;

        if (hasLogo) {
            try {
                const imgProps = doc.getImageProperties(logoUrl);
                renderedLogoHeight = layout.logoSize / (imgProps.width / imgProps.height);
                if (renderedLogoHeight > 60) renderedLogoHeight = 60;
            } catch (e) { renderedLogoHeight = layout.logoSize; }
        }

        if (layout.logoPosition === 'center') {
            logoX = (pageWidth - layout.logoSize) / 2;
            if (hasLogo) {
                try {
                    doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
                } catch(e) { console.warn("Failed to add centered logo", e); }
                textY = logoY + renderedLogoHeight + (logoBottomSpace * spacingScale);
            }
            textAlign = 'center';
            textX = pageWidth / 2;
        } else if (layout.logoPosition === 'right') {
            logoX = pageWidth - margin - layout.logoSize;
            if (hasLogo) {
                try {
                    doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
                } catch(e) { console.warn("Failed to add right logo", e); }
            }
            textAlign = 'left';
            textX = margin;
            textY += 5 * spacingScale; // Top adjustment
        } else { 
            logoX = margin;
            if (hasLogo) {
                try {
                    doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
                } catch(e) { console.warn("Failed to add left logo", e); }
            }
            textAlign = 'right';
            textX = pageWidth - margin;
            textY += 5 * spacingScale; // Top adjustment
        }

        if (profile) {
            doc.setFont(fonts.titleFont, 'bold');
            doc.setFontSize(fonts.headerSize);
            doc.setTextColor(isBanner ? (colors.bannerText || '#fff') : colors.primary);
            doc.text(profile.name, textX, textY, { align: textAlign });
            
            textY += (fonts.headerSize * 0.4 + titleBottomSpace) * spacingScale;
            
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(fonts.bodySize);
            doc.setTextColor(isBanner ? (colors.bannerText || '#fff') : colors.secondary);
            
            const addr = doc.splitTextToSize(profile.address, 90);
            doc.text(addr, textX, textY, { align: textAlign });
            textY += ((addr.length * 4) + addressBottomSpace) * spacingScale;
            
            const contact = [profile.phone && `Ph: ${profile.phone}`, profile.gstNumber && `GST: ${profile.gstNumber}`].filter(Boolean).join(' | ');
            doc.text(contact, textX, textY, { align: textAlign });
            
            const contentEnd = textY + 5;
            const logoEnd = hasLogo ? logoY + renderedLogoHeight + 5 : 0;
            currentY = Math.max(contentEnd, logoEnd);
        } else {
            addY(20);
        }

        if (!isBanner && layout.headerStyle !== 'minimal') {
            doc.setDrawColor(colors.borderColor || '#ccc');
            doc.line(margin, currentY, pageWidth - margin, currentY);
            addY(headerBottomSpace);
        }
        
        // Auto QR placement if no absolute position
        if (content.showQr && layout.qrPosition === 'header-right' && layout.qrPosX === undefined) {
            const qrImg = await getQrCodeBase64(data.qrString || data.id);
            if (qrImg) {
                try {
                    const size = layout.qrOverlaySize || 20;
                    doc.addImage(qrImg, 'PNG', pageWidth - margin - size, margin + 5, size, size);
                } catch(e) {}
            }
        }
    };

    const renderTitle = () => {
        doc.setFont(fonts.titleFont, 'bold');
        doc.setFontSize(16);
        doc.setTextColor(colors.text);
        doc.text(content.titleText, pageWidth / 2, currentY + (5 * spacingScale), { align: 'center' });
        addY(15);
    };

    const renderDetails = async () => {
        if (content.showCustomerDetails === false) {
            return;
        }
        const gridY = currentY;
        const colWidth = (pageWidth - (margin * 3)) / 2;
        const rightColX = pageWidth - margin;

        doc.setFont(fonts.bodyFont, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colors.primary);
        doc.text(data.recipient.label, margin, gridY);
        doc.text(data.sender.label, rightColX, gridY, { align: 'right' });

        doc.setFont(fonts.bodyFont, 'normal');
        doc.setFontSize(fonts.bodySize);
        doc.setTextColor(colors.text);

        const lineHeight = 5 * spacingScale;

        doc.text(data.recipient.name, margin, gridY + lineHeight + 1);
        const recipientAddr = doc.splitTextToSize(data.recipient.address, colWidth);
        doc.text(recipientAddr, margin, gridY + (lineHeight * 2) + 1);

        let infoY = gridY + lineHeight + 1;
        doc.text(`${data.sender.idLabel} ${data.id}`, rightColX, infoY, { align: 'right' });
        infoY += lineHeight;
        doc.text(`${labels.date}: ${formatDate(data.date, templateConfig.dateFormat)}`, rightColX, infoY, { align: 'right' });

        // Auto QR placement if no absolute position
        if (content.showQr && (!layout.qrPosition || layout.qrPosition === 'details-right') && layout.qrPosX === undefined) {
            const qrImg = await getQrCodeBase64(data.qrString || data.id);
            if (qrImg) {
                try {
                    const size = layout.qrOverlaySize || 22;
                    doc.addImage(qrImg, 'PNG', rightColX - size, infoY + 2, size, size);
                } catch(e) {}
            }
        }

        const recipientHeight = (lineHeight * 2) + (recipientAddr.length * lineHeight);
        const infoHeight = (lineHeight * 4); // Approximate
        currentY = Math.max(gridY + recipientHeight, gridY + infoHeight) + (5 * spacingScale);
    };

    const renderTable = () => {
        const tableHead = ['#', labels.item];
        const hideQty = layout.tableOptions?.hideQty;
        const hideRate = layout.tableOptions?.hideRate;
        if (!hideQty) tableHead.push(labels.qty);
        if (!hideRate) tableHead.push(labels.rate);
        tableHead.push(labels.amount);

        const tableBody = data.items.map((item, i) => {
            const row = [(i + 1).toString(), item.name];
            if (!hideQty) row.push(item.quantity.toString());
            if (!hideRate) row.push(formatCurrency(item.rate, currencySymbol, fonts.bodyFont));
            row.push(formatCurrency(item.amount, currencySymbol, fonts.bodyFont));
            return row;
        });

        const cw = layout.columnWidths || {};
        
        // Auto-adjust column widths for small paper (Receipts)
        const isSmallPaper = pageWidth < 100;
        
        // When using 'bordered' mode, we need to pass styles to autoTable
        const tableStyles: any = { 
            font: fonts.bodyFont, 
            fontSize: fonts.bodySize, 
            cellPadding: layout.tableOptions?.compact ? 2 : 3, 
            textColor: colors.text
        };
        
        if (layout.tableOptions?.bordered) {
            tableStyles.lineWidth = 0.1;
            tableStyles.lineColor = colors.borderColor || '#ccc';
        }

        autoTable(doc, {
            startY: currentY,
            head: [tableHead],
            body: tableBody,
            theme: layout.tableOptions?.stripedRows ? 'striped' : 'plain',
            styles: tableStyles,
            headStyles: { 
                fillColor: colors.tableHeaderBg, 
                textColor: colors.tableHeaderText, 
                fontStyle: 'bold', 
                halign: (layout.tableHeaderAlign || 'left'),
                ...(layout.borderRadius ? { minCellHeight: 8 } : {}) // Heuristic for rounded looks
            },
            columnStyles: {
                0: { cellWidth: isSmallPaper ? 6 : 10, halign: 'center' },
                [tableHead.length - 1]: { halign: 'right', cellWidth: isSmallPaper ? 20 : (cw.amount || 35) }, 
                [tableHead.length - 2]: { halign: 'right', cellWidth: hideRate ? (cw.qty || 15) : (cw.rate || 20) }, 
                [tableHead.length - 3]: { halign: 'right', cellWidth: cw.qty || 15 }, 
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).lastAutoTable.finalY + (5 * spacingScale);
    };

    const renderTotals = () => {
        const totalsX = pageWidth - margin;
        if (pageHeight - currentY < 60) { 
            doc.addPage(); 
            currentY = margin;
            // Re-draw background on new page
            if (layout.backgroundImage) {
                try {
                    doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                } catch(e) {}
            }
        }
        
        data.totals.forEach((t) => {
            doc.setFont(fonts.bodyFont, t.isBold ? 'bold' : 'normal');
            doc.setFontSize(t.size || fonts.bodySize);
            doc.setTextColor(t.color || colors.text);
            doc.text(t.label, totalsX - 40, currentY, { align: 'right' });
            doc.text(t.value, totalsX, currentY, { align: 'right' });
            addY((t.size ? t.size * 0.5 : 6));
        });
        addY(5);
    };

    const renderWords = () => {
        if (content.showAmountInWords && data.grandTotalNumeric !== undefined) {
            if (pageHeight - currentY < 20) { 
                doc.addPage(); 
                currentY = margin;
                if (layout.backgroundImage) {
                    try {
                        doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                    } catch(e) {}
                }
            }
            doc.setFont(fonts.bodyFont, 'italic');
            doc.setFontSize(fonts.bodySize - 1);
            doc.setTextColor(colors.secondary);
            doc.text("Amount in words:", margin, currentY);
            addY(5);
            doc.setFont(fonts.bodyFont, 'bold');
            doc.setTextColor(colors.text);
            const words = numberToWords(data.grandTotalNumeric);
            const splitWords = doc.splitTextToSize(words, pageWidth - (margin * 2));
            doc.text(splitWords, margin, currentY);
            addY((splitWords.length * 5) + 5);
        }
    };

    const renderBank = () => {
        if (content.bankDetails) {
            if (pageHeight - currentY < 30) { 
                doc.addPage(); 
                currentY = margin; 
                if (layout.backgroundImage) {
                    try {
                        doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                    } catch(e) {}
                }
            }
            doc.setFont(fonts.bodyFont, 'bold');
            doc.setFontSize(fonts.bodySize);
            doc.setTextColor(colors.primary);
            doc.text("Bank Details:", margin, currentY);
            addY(5);
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setTextColor(colors.text);
            const bankLines = doc.splitTextToSize(content.bankDetails, 100);
            doc.text(bankLines, margin, currentY);
            addY((bankLines.length * 5) + 5);
        }
    };

    const renderTerms = () => {
        if (content.showTerms && content.termsText) {
            if (pageHeight - currentY < 30) { 
                doc.addPage(); 
                currentY = margin; 
                if (layout.backgroundImage) {
                    try {
                        doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                    } catch(e) {}
                }
            }
            doc.setFont(fonts.bodyFont, 'bold');
            doc.setFontSize(fonts.bodySize - 2);
            doc.setTextColor(colors.secondary);
            doc.text("Terms & Conditions:", margin, currentY);
            addY(4);
            doc.setFont(fonts.bodyFont, 'normal');
            const terms = doc.splitTextToSize(content.termsText, pageWidth - (margin * 2));
            doc.text(terms, margin, currentY);
            addY((terms.length * 3.5) + 5);
        }
    };

    const renderSignature = () => {
        if (content.showSignature) {
            const sigY = Math.max(currentY + 10, pageHeight - 40);
            if (pageHeight - sigY < 30) { 
                doc.addPage(); 
                if (layout.backgroundImage) {
                    try {
                        doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                    } catch(e) {}
                }
            }
            
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(10);
            doc.setTextColor(colors.text);
            doc.text(content.signatureText || "Authorized Signatory", pageWidth - margin, sigY + 10, { align: 'right' });
            if (content.signatureImage) {
                try {
                    const sigProps = doc.getImageProperties(content.signatureImage);
                    const sigRatio = sigProps.width / sigProps.height;
                    doc.addImage(content.signatureImage, getImageType(content.signatureImage), pageWidth - margin - 40, sigY - 10, 40, 40 / sigRatio);
                } catch(e) {}
            } else {
                doc.text("___________________", pageWidth - margin, sigY, { align: 'right' });
            }
        }
    };

    const renderFooter = async () => {
        const footerHeight = 15;
        const footerY = pageHeight - footerHeight;
        
        // If content has pushed passed footer, new page
        if (currentY > footerY) { 
            doc.addPage(); 
            if (layout.backgroundImage) {
                try {
                    doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
                } catch(e) {}
            }
        }

        // Auto QR placement if no absolute position
        if (content.showQr && (layout.qrPosition === 'footer-left' || layout.qrPosition === 'footer-right') && layout.qrPosX === undefined) {
            const qrImg = await getQrCodeBase64(data.qrString || data.id);
            if (qrImg) {
                const qrSize = layout.qrOverlaySize || 18;
                const qrY = footerY - qrSize - 2;
                const qrX = layout.qrPosition === 'footer-left' ? margin : pageWidth - margin - qrSize;
                try {
                    doc.addImage(qrImg, 'PNG', qrX, qrY, qrSize, qrSize);
                } catch(e) {}
            }
        }

        if (layout.footerStyle === 'banner') {
            doc.setFillColor(colors.footerBg || '#f3f4f6');
            doc.rect(0, footerY, pageWidth, footerHeight, 'F');
            doc.setTextColor(colors.footerText || colors.secondary);
        } else {
            doc.setTextColor(colors.secondary);
        }
        
        if (content.footerText) {
            doc.setFontSize(9);
            doc.text(content.footerText, pageWidth / 2, pageHeight - 6, { align: 'center' });
        }
    };

    // --- MAIN RENDER LOOP ---
    // Ensure ALL section keys are present in ordering logic
    const order = layout.sectionOrdering && layout.sectionOrdering.length > 0 
        ? layout.sectionOrdering 
        : ['header', 'title', 'details', 'table', 'totals', 'words', 'bankDetails', 'terms', 'signature', 'footer'];

    for (const section of order) {
        switch (section) {
            case 'header': await renderHeader(); break;
            case 'title': renderTitle(); break;
            case 'details': await renderDetails(); break;
            case 'table': renderTable(); break;
            case 'totals': renderTotals(); break;
            case 'words': renderWords(); break;
            case 'bankDetails': renderBank(); break;
            case 'terms': renderTerms(); break;
            case 'signature': renderSignature(); break;
            case 'footer': await renderFooter(); break;
        }
    }

    // ABSOLUTE POSITIONING OVERLAYS (QR CODE)
    if (content.showQr && layout.qrPosX !== undefined && layout.qrPosY !== undefined) {
        const qrImg = await getQrCodeBase64(data.qrString || data.id);
        if (qrImg) {
            try {
                // Determine page to print on (usually first page unless complex logic added)
                doc.setPage(1); 
                const size = layout.qrOverlaySize || 20; 
                doc.addImage(qrImg, 'PNG', layout.qrPosX, layout.qrPosY, size, size);
            } catch(e) {}
        }
    }

    // Status Stamp Overlay (rendered last on top)
    if (content.showStatusStamp && data.balanceDue !== undefined) {
        const stampText = data.balanceDue <= 0.01 ? "PAID" : "DUE";
        const color = data.balanceDue <= 0.01 ? "#10b981" : "#ef4444";
        doc.setTextColor(color);
        doc.setFontSize(40);
        doc.setFont('helvetica', 'bold');
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.3 }));
        doc.text(stampText, pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
    }

    return doc;
};

// --- Public Generators ---

export const generateA4InvoicePdf = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig?: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const defaultConfig: InvoiceTemplateConfig = {
        id: 'default', currencySymbol: 'Rs.', dateFormat: 'DD/MM/YYYY',
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', bannerBg: '#0d9488', bannerText: '#ffffff', footerBg: '#f3f4f6', footerText: '#374151', borderColor: '#e5e7eb', alternateRowBg: '#f9fafb' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1, qrPosition: 'details-right', tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false }, elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 } },
        content: { titleText: 'TAX INVOICE', labels: defaultLabels, showQr: true, showTerms: true, showSignature: true, termsText: '', footerText: '', showBusinessDetails: true, showCustomerDetails: true, signatureText: '', showAmountInWords: false, showStatusStamp: false, showTaxBreakdown: false, showGst: true, qrType: 'INVOICE_ID', bankDetails: '' }
    };
    const config = templateConfig || defaultConfig;
    const labels = { ...defaultLabels, ...config.content.labels };
    const currency = config.currencySymbol || 'Rs.';
    
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    
    let qrString = sale.id;
    if (config.content.qrType === 'UPI_PAYMENT' && config.content.upiId) {
       const pa = config.content.upiId;
       const pn = config.content.payeeName || 'Merchant';
       const am = sale.totalAmount.toFixed(2);
       const tr = sale.id; 
       qrString = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&tr=${tr}&tn=Invoice%20${sale.id}&cu=INR`;
    }
    
    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: formatCurrency(subTotal, currency, config.fonts.bodyFont) },
        { label: labels.discount, value: `- ${formatCurrency(Number(sale.discount), currency, config.fonts.bodyFont)}` },
    ];
    if (config.content.showGst !== false) totals.push({ label: labels.gst, value: formatCurrency(Number(sale.gstAmount), currency, config.fonts.bodyFont) });
    totals.push(
        { label: labels.grandTotal, value: formatCurrency(Number(sale.totalAmount), currency, config.fonts.bodyFont), isBold: true, color: config.colors.primary, size: config.fonts.bodySize + 2 },
        { label: labels.paid, value: formatCurrency(paidAmount, currency, config.fonts.bodyFont) },
        { label: labels.balance, value: formatCurrency(dueAmount, currency, config.fonts.bodyFont), isBold: true, color: dueAmount > 0.01 ? '#dc2626' : '#16a34a', size: config.fonts.bodySize + 2 }
    );

    const data: GenericDocumentData = {
        id: sale.id, date: sale.date,
        recipient: { label: labels.billedTo, name: customer.name, address: customer.address },
        sender: { label: 'Invoice Details:', idLabel: labels.invoiceNo },
        items: sale.items.map(item => ({ name: item.productName, quantity: item.quantity, rate: Number(item.price), amount: Number(item.quantity) * Number(item.price) })),
        totals, qrString, grandTotalNumeric: Number(sale.totalAmount), balanceDue: dueAmount
    };
    return _generateConfigurablePDF(data, profile, config, customFonts);
};

// Configurable Receipt Generation
export const generateReceiptPDF = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    // Re-use the A4 logic but pass custom paper size
    const config = templateConfig;
    const labels = { ...defaultLabels, ...config.content.labels };
    const currency = config.currencySymbol || 'Rs.';
    
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    
    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: formatCurrency(subTotal, currency, config.fonts.bodyFont) },
        { label: labels.grandTotal, value: formatCurrency(Number(sale.totalAmount), currency, config.fonts.bodyFont), isBold: true, size: config.fonts.bodySize + 2 },
    ];

    const data: GenericDocumentData = {
        id: sale.id, date: sale.date,
        recipient: { label: labels.billedTo, name: customer.name, address: customer.address },
        sender: { label: 'Receipt:', idLabel: labels.invoiceNo },
        items: sale.items.map(item => ({ name: item.productName, quantity: item.quantity, rate: Number(item.price), amount: Number(item.quantity) * Number(item.price) })),
        totals, qrString: sale.id, grandTotalNumeric: Number(sale.totalAmount), balanceDue: dueAmount
    };
    
    // Receipt dimensions: 80mm width, auto height approximated by long page
    return _generateConfigurablePDF(data, profile, config, customFonts, [80, 297]); 
};

export const generateEstimatePDF = async (quote: Quote, customer: Customer, profile: ProfileData | null, templateConfig: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const labels = { ...defaultLabels, ...templateConfig.content.labels };
    const currency = templateConfig.currencySymbol || 'Rs.';
    const subTotal = quote.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: formatCurrency(subTotal, currency, templateConfig.fonts.bodyFont) },
        { label: labels.discount, value: `- ${formatCurrency(Number(quote.discount), currency, templateConfig.fonts.bodyFont)}` },
    ];
    if (templateConfig.content.showGst !== false) totals.push({ label: labels.gst, value: formatCurrency(Number(quote.gstAmount), currency, templateConfig.fonts.bodyFont) });
    totals.push({ label: labels.grandTotal, value: formatCurrency(Number(quote.totalAmount), currency, templateConfig.fonts.bodyFont), isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 });

    const data: GenericDocumentData = {
        id: quote.id, date: quote.date,
        recipient: { label: 'Estimate For:', name: customer.name, address: customer.address },
        sender: { label: 'Estimate Details:', idLabel: labels.invoiceNo },
        items: quote.items.map(item => ({ name: item.productName, quantity: item.quantity, rate: Number(item.price), amount: Number(item.quantity) * Number(item.price) })),
        totals, watermarkText: 'ESTIMATE', grandTotalNumeric: Number(quote.totalAmount)
    };
    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};

export const generateDebitNotePDF = async (returnData: Return, supplier: Supplier | undefined, profile: ProfileData | null, templateConfig: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const labels = { ...defaultLabels, ...templateConfig.content.labels };
    const currency = templateConfig.currencySymbol || 'Rs.';
    const data: GenericDocumentData = {
        id: returnData.id, date: returnData.returnDate,
        recipient: { label: labels.billedTo, name: supplier?.name || 'Unknown Supplier', address: supplier?.location || '' },
        sender: { label: 'Reference Details:', idLabel: labels.invoiceNo },
        items: returnData.items.map(item => ({ name: item.productName, quantity: item.quantity, rate: Number(item.price), amount: Number(item.quantity) * Number(item.price) })),
        totals: [{ label: 'Total Debit Value:', value: formatCurrency(Number(returnData.amount), currency, templateConfig.fonts.bodyFont), isBold: true, size: templateConfig.fonts.bodySize + 2 }],
        watermarkText: 'DEBIT NOTE', grandTotalNumeric: Number(returnData.amount)
    };
    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};

export const generateGenericReportPDF = async (title: string, subtitle: string, headers: string[], tableData: string[][], summary: any[], profile: ProfileData | null, templateConfig: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const doc = new jsPDF();
    if (customFonts) registerCustomFonts(doc, customFonts);
    const { colors, fonts, layout, content } = templateConfig;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = layout.margin || 10;
    const spacingScale = layout.spacing !== undefined ? layout.spacing : 1.0;
    let y = margin;

    // helper
    const addY = (amount: number) => {
        y += amount * spacingScale;
    };

    doc.setFont(fonts.titleFont, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(colors.primary);
    doc.text(title, pageWidth / 2, y, { align: 'center' });
    addY(7);
    doc.setFontSize(10);
    doc.setTextColor(colors.secondary);
    doc.text(subtitle, pageWidth / 2, y, { align: 'center' });
    addY(10);

    autoTable(doc, {
        startY: y,
        head: [headers],
        body: tableData,
        theme: layout.tableOptions?.stripedRows ? 'striped' : 'plain',
        styles: { font: fonts.bodyFont, fontSize: fonts.bodySize, cellPadding: 2 },
        headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText },
        margin: { left: margin, right: margin }
    });

    if (summary && summary.length) {
        y = (doc as any).lastAutoTable.finalY + (10 * spacingScale);
        summary.forEach(s => {
            doc.setFont(fonts.bodyFont, 'bold');
            doc.setTextColor(s.color || colors.text);
            doc.text(`${s.label}: ${s.value}`, pageWidth - margin, y, { align: 'right' });
            addY(6);
        });
    }
    return doc;
};

// --- New Function: Generate PDF from Images ---
export const generateImagesToPDF = (images: string[], fileName: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    images.forEach((imgData, index) => {
        if (index > 0) doc.addPage();
        
        try {
            const imgProps = doc.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            const pageRatio = (pageWidth - margin * 2) / (pageHeight - margin * 2);
            
            let finalWidth, finalHeight;

            if (imgRatio > pageRatio) {
                // Image is wider relative to page -> constrain width
                finalWidth = pageWidth - margin * 2;
                finalHeight = finalWidth / imgRatio;
            } else {
                // Image is taller relative to page -> constrain height
                finalHeight = pageHeight - margin * 2;
                finalWidth = finalHeight * imgRatio;
            }

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            // Use the detected type from getImageProperties or try to infer
            const format = getImageType(imgData);
            doc.addImage(imgData, format, x, y, finalWidth, finalHeight);
        } catch (e) {
            console.error("Error adding image to PDF", e);
            doc.setFontSize(12);
            doc.text(`Error loading image #${index + 1}`, 10, 10);
        }
    });
    
    doc.save(fileName);
};
