
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return, Quote, InvoiceTemplateConfig, CustomFont, InvoiceLabels } from '../types';
import { logoBase64 } from './logo'; // Fallback logo

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
        console.warn("Failed to generate QR code", e);
        return '';
    }
};

// --- Helper: Detect Image Type ---
const getImageType = (dataUrl: string): string => {
    if (!dataUrl) return 'PNG';
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    if (dataUrl.startsWith('data:image/jpeg')) return 'JPEG';
    if (dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    return 'PNG'; // default fallback
};

// --- Helper: Register Custom Fonts ---
const registerCustomFonts = (doc: jsPDF, fonts: CustomFont[]) => {
    if (!fonts || fonts.length === 0) return;
    
    fonts.forEach(font => {
        try {
            let cleanData = font.data;
            // Remove data URI prefix if present
            if (cleanData.includes(',')) {
                cleanData = cleanData.split(',')[1];
            }
            
            const filename = `${font.name}.ttf`;
            // Add file to VFS
            doc.addFileToVFS(filename, cleanData);
            
            // Register font for normal, bold, italic styles mapping all to the same file for simplicity
            // (unless separate bold/italic files are supported later)
            doc.addFont(filename, font.name, 'normal');
            doc.addFont(filename, font.name, 'bold');
            doc.addFont(filename, font.name, 'italic');
            doc.addFont(filename, font.name, 'bolditalic');
        } catch (e) {
            console.error(`Failed to register font ${font.name}`, e);
        }
    });
};

// --- Helper: Date Formatter ---
const formatDate = (dateString: string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'DD/MM/YYYY') => {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    
    if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}`; // Default DD/MM/YYYY
};

// --- Helper: Convert Number to Words (Indian format) ---
const convertNumberToWords = (amount: number): string => {
    const a = [
        '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const numToWords = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        if (n < 100) return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
        if (n < 1000) return a[Math.floor(n / 100)] + "Hundred " + (n % 100 === 0 ? "" : "and " + numToWords(n % 100));
        return "";
    };

    if (amount === 0) return "Zero Rupees Only";

    const crore = Math.floor(amount / 10000000);
    amount -= crore * 10000000;
    const lakh = Math.floor(amount / 100000);
    amount -= lakh * 100000;
    const thousand = Math.floor(amount / 1000);
    amount -= thousand * 1000;
    
    let str = "";
    if (crore > 0) str += numToWords(crore) + "Crore ";
    if (lakh > 0) str += numToWords(lakh) + "Lakh ";
    if (thousand > 0) str += numToWords(thousand) + "Thousand ";
    if (amount > 0) str += numToWords(amount);

    return str.trim() + " Rupees Only";
};

// --- Default Labels Fallback ---
const defaultLabels: InvoiceLabels = {
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

// --- Helper: Add Header (Legacy support for other docs, updated to be flexible) ---
export const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null, title?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = 10;

    // Default Layout for legacy docs (reports, returns)
    const logoToUse = profile?.logo || logoBase64;
    if (logoToUse) {
        try {
            const format = getImageType(logoToUse);
            doc.addImage(logoToUse, format, 14, 10, 25, 25);
        } catch (e) {
            console.warn("Failed to add logo", e);
        }
    }

    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, currentY, { align: 'center' });
    currentY += 6;

    if (profile) {
        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 128, 128); 
        doc.text(profile.name, centerX, currentY, { align: 'center' });
        currentY += 8;
        
        doc.setFontSize(10);
        doc.setTextColor('#333333');
        doc.setFont('helvetica', 'normal');
        
        const address = profile.address || '';
        const addressLines = doc.splitTextToSize(address, 120);
        doc.text(addressLines, centerX, currentY, { align: 'center' });
        currentY += (addressLines.length * 5);
        
        const details = [];
        if (profile.phone) details.push(`Phone: ${profile.phone}`);
        if (profile.gstNumber) details.push(`GSTIN: ${profile.gstNumber}`);
        
        if (details.length > 0) {
            doc.text(details.join(' | '), centerX, currentY, { align: 'center' });
        }
    }
    
    if (title) {
        currentY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor('#000000');
        doc.text(title.toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 2;
    }
    
    currentY = Math.max(currentY, 40);
    currentY += 2;
    doc.setDrawColor('#cccccc');
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    
    return currentY + 5; 
};

interface InvoiceSettings {
    terms?: string;
    footer?: string;
    showQr?: boolean;
}

// --- Thermal Receipt Generator ---
export const generateThermalInvoicePDF = async (
    sale: Sale, 
    customer: Customer, 
    profile: ProfileData | null, 
    templateConfig?: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    
    const terms = templateConfig?.content.termsText || '';
    const footer = templateConfig?.content.footerText || 'Thank You! Visit Again.';
    const showQr = templateConfig?.content.showQr ?? true;
    const showTerms = templateConfig?.content.showTerms ?? false;
    const showBusiness = templateConfig?.content.showBusinessDetails ?? true;
    const showCustomer = templateConfig?.content.showCustomerDetails ?? true;
    const currency = templateConfig?.currencySymbol || 'Rs.';
    const dateFormat = templateConfig?.dateFormat || 'DD/MM/YYYY';
    const showGst = templateConfig?.content.showGst !== false; // Default true if undefined
    
    const labels = { ...defaultLabels, ...templateConfig?.content.labels };

    const margin = templateConfig?.layout.margin || 3;
    const logoSize = templateConfig?.layout.logoSize || 15;
    const logoPos = templateConfig?.layout.logoPosition || 'center';
    const logoOffsetX = templateConfig?.layout.logoOffsetX || 0;
    const logoOffsetY = templateConfig?.layout.logoOffsetY || 0;
    const titleText = templateConfig?.content.titleText || 'TAX INVOICE';
    
    // Colors
    const textColor = templateConfig?.colors.text || '#000000';
    const primaryColor = templateConfig?.colors.primary || '#000000';

    // Fonts
    const headerFontSize = templateConfig?.fonts.headerSize || 12;
    const bodyFontSize = templateConfig?.fonts.bodySize || 9;
    const titleFont = templateConfig?.fonts.titleFont || 'helvetica';
    const bodyFont = templateConfig?.fonts.bodyFont || 'helvetica';

    const estimatedHeight = 250 + (sale.items.length * 10) + (terms.length > 0 ? 30 : 0);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight]
    });

    // Register custom fonts
    if (customFonts) {
        registerCustomFonts(doc, customFonts);
    }

    const pageWidth = 80;
    const centerX = pageWidth / 2;
    let y = 8;

    if (showBusiness) {
        // --- Logo ---
        const logoToUse = profile?.logo || logoBase64;
        if (logoToUse && logoSize > 5) {
            try {
                const format = getImageType(logoToUse);
                let logoX = margin;
                if (logoPos === 'center') logoX = (pageWidth - logoSize) / 2;
                else if (logoPos === 'right') logoX = pageWidth - margin - logoSize;
                
                doc.addImage(logoToUse, format, logoX + logoOffsetX, y + logoOffsetY, logoSize, logoSize);
                y += logoSize + 3;
            } catch (e) {}
        }

        // --- Business Header ---
        // Always center business details on thermal for readability
        doc.setFont(titleFont, 'bold');
        doc.setFontSize(headerFontSize);
        doc.setTextColor(primaryColor); 
        const busName = doc.splitTextToSize(profile?.name || 'Business Name', pageWidth - (margin * 2));
        doc.text(busName, centerX, y, { align: 'center' });
        y += (busName.length * (headerFontSize * 0.35)) + 2;

        // Address
        doc.setTextColor(textColor);
        doc.setFont(bodyFont, 'normal');
        doc.setFontSize(bodyFontSize - 1);
        if (profile?.address) {
            const addr = doc.splitTextToSize(profile.address, pageWidth - (margin * 2));
            doc.text(addr, centerX, y, { align: 'center' });
            y += (addr.length * 3) + 1;
        }
        if (profile?.phone) {
            doc.text(`Ph: ${profile.phone}`, centerX, y, { align: 'center' });
            y += 4;
        }
        if (profile?.gstNumber) {
            doc.text(`GSTIN: ${profile.gstNumber}`, centerX, y, { align: 'center' });
            y += 4;
        }
    }

    // --- Title ---
    y += 2;
    doc.setFont(titleFont, 'bold');
    doc.setFontSize(bodyFontSize + 2);
    doc.text(titleText, centerX, y, { align: 'center' });
    y += 5;

    // --- Invoice Meta ---
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(bodyFontSize);

    const qrSize = 20;
    const qrX = pageWidth - margin - qrSize;
    const startHeaderY = y;

    doc.text(`${labels.invoiceNo}: ${sale.id}`, margin, y);
    y += 4;
    
    const dateStr = formatDate(sale.date, dateFormat);
    doc.text(`${labels.date}: ${dateStr}`, margin, y);
    y += 4;

    if (showQr) {
        try {
            let qrData = sale.id;
            // Support UPI QR on Thermal if configured
            if (templateConfig?.content.qrType === 'UPI_PAYMENT' && templateConfig?.content.upiId) {
                const pa = templateConfig.content.upiId;
                const pn = templateConfig.content.payeeName || 'Merchant';
                const am = sale.totalAmount.toFixed(2);
                const tr = sale.id;
                const tn = `Invoice ${sale.id}`;
                qrData = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&tr=${tr}&tn=${encodeURIComponent(tn)}&cu=INR`;
            }

            const qrBase64 = await getQrCodeBase64(qrData);
            if (qrBase64) {
                doc.addImage(qrBase64, 'PNG', qrX, startHeaderY, qrSize, qrSize);
            }
        } catch (e) {}
    }

    // Adjust Y if QR overlapped
    if (showQr && y < startHeaderY + qrSize) {
        // If text is short, jump below QR
        y = startHeaderY + qrSize + 2;
    } else {
        y += 2;
    }

    // --- Customer ---
    if (showCustomer) {
        doc.setFont(bodyFont, 'bold');
        doc.text('To:', margin, y);
        doc.setFont(bodyFont, 'normal');
        doc.text(customer.name, margin + 8, y);
        y += 4;
        
        if (customer.phone) {
            doc.text(`Ph: ${customer.phone}`, margin, y);
            y += 4;
        }
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    
    // --- Items Header ---
    doc.setFont(bodyFont, 'bold');
    doc.text(labels.item, margin, y);
    doc.text(labels.amount, pageWidth - margin, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // --- Items List ---
    doc.setFont(bodyFont, 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        doc.setTextColor(textColor);
        doc.setFontSize(bodyFontSize);
        const nameLines = doc.splitTextToSize(item.productName, 55); 
        doc.text(nameLines, margin, y);
        doc.text(`${itemTotal.toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
        y += (nameLines.length * 4);
        doc.setTextColor('#555555');
        doc.setFontSize(bodyFontSize - 1);
        
        // Only show Qty x Rate if configured, but on thermal space is tight so we usually show it
        // We respect hideQty/hideRate if passed, but fallback to showing if critical
        const showDetails = !(templateConfig?.layout.tableOptions?.hideQty && templateConfig?.layout.tableOptions?.hideRate);
        
        if (showDetails) {
             const qtyStr = templateConfig?.layout.tableOptions?.hideQty ? '' : `${item.quantity} x `;
             const rateStr = templateConfig?.layout.tableOptions?.hideRate ? '' : `${currency} ${Number(item.price).toLocaleString('en-IN')}`;
             doc.text(`${qtyStr}${rateStr}`, margin, y);
             y += 4;
        }
    });

    y += 1;
    doc.setDrawColor(200); 
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // --- Totals ---
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    const addTotalRow = (label: string, value: string, isBold = false, fontSize = bodyFontSize) => {
        doc.setFont(bodyFont, isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor(textColor);
        doc.text(label, pageWidth - 30, y, { align: 'right' });
        doc.text(value, pageWidth - margin, y, { align: 'right' });
        y += 4;
    };

    addTotalRow(labels.subtotal, `${subTotal.toLocaleString('en-IN')}`);
    if (sale.discount > 0) addTotalRow(labels.discount, `-${Number(sale.discount).toLocaleString('en-IN')}`);
    
    // Conditionally add GST line for thermal
    if (showGst) {
        addTotalRow(labels.gst, `${currency} ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    }

    y += 1;
    doc.setFontSize(bodyFontSize + 2);
    doc.setFont(bodyFont, 'bold');
    doc.setTextColor(primaryColor);
    doc.text(labels.grandTotal, pageWidth - 30, y, { align: 'right' });
    doc.text(`${currency} ${Number(sale.totalAmount).toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(textColor);
    addTotalRow(labels.paid, `${paidAmount.toLocaleString('en-IN')}`);
    
    if (dueAmount > 0) {
        doc.setFont(bodyFont, 'bold');
        addTotalRow(labels.balance, `${dueAmount.toLocaleString('en-IN')}`);
    }

    // --- Terms ---
    if (showTerms && terms) {
        y += 4;
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(bodyFontSize - 1);
        doc.text("Terms & Conditions:", margin, y);
        y += 4;
        doc.setFont(bodyFont, 'normal');
        const termsLines = doc.splitTextToSize(terms, pageWidth - (margin*2));
        doc.text(termsLines, margin, y);
        y += (termsLines.length * 4);
    }

    // --- Footer ---
    y += 5;
    doc.setFontSize(bodyFontSize - 1);
    doc.setFont(bodyFont, 'italic');
    doc.setTextColor('#555555');
    doc.text(footer, centerX, y, { align: 'center' });

    return doc;
};

export interface GenericDocumentData {
    id: string;
    date: string;
    recipient: {
        label: string; // e.g. "Billed To:"
        name: string;
        address: string;
        contact?: string;
    };
    sender: {
        label: string; // e.g. "Invoice Details:"
        idLabel: string; // e.g. "Invoice No:"
    };
    items: {
        name: string;
        quantity: number;
        rate: number;
        amount: number;
    }[];
    totals: {
        label: string;
        value: string; // Formatted value
        isBold?: boolean;
        color?: string;
        size?: number;
    }[];
    watermarkText?: string;
    qrString?: string; // Optional override for QR data (e.g. UPI string)
    grandTotalNumeric?: number; // For Amount in Words
    balanceDue?: number; // For Status Stamp
    taxBreakdown?: { rate: number, taxable: number, tax: number }[]; // Optional Tax Breakdown
}

// --- Core Configurable PDF Engine ---
const _generateConfigurablePDF = async (
    data: GenericDocumentData,
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    
    const doc = new jsPDF();
    
    // Register custom fonts
    if (customFonts) {
        registerCustomFonts(doc, customFonts);
    }

    const { colors, fonts, layout, content, currencySymbol, dateFormat } = templateConfig;
    const labels = { ...defaultLabels, ...content.labels };
    const tableOpts = layout.tableOptions || { hideQty: false, hideRate: false, stripedRows: false };

    // Conversions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = layout.margin;
    const centerX = pageWidth / 2;
    let currentY = margin;

    const showBusiness = content.showBusinessDetails ?? true;
    const showCustomer = content.showCustomerDetails ?? true;
    
    // Header styles
    const isBannerHeader = layout.headerStyle === 'banner';
    const isMinimalHeader = layout.headerStyle === 'minimal';
    
    // --- 1. HEADER BACKGROUND (Banner Mode) ---
    if (isBannerHeader) {
        doc.setFillColor(colors.bannerBg || colors.primary);
        // Height is dynamic but lets allocate ~40-50mm based on content
        const bannerHeight = Math.max(40, layout.logoSize + 20);
        doc.rect(0, 0, pageWidth, bannerHeight, 'F');
        // Reset Y to provide padding inside banner
        currentY = margin + 5;
    } else {
        // Standard/Minimal: Add some top margin
        currentY = margin + 5;
    }

    // --- 2. LOGO & BUSINESS DETAILS ---
    if (showBusiness) {
        const logoToUse = profile?.logo || logoBase64;
        const logoOffsetX = layout.logoOffsetX || 0;
        const logoOffsetY = layout.logoOffsetY || 0;
        
        if (logoToUse) {
            try {
                const format = getImageType(logoToUse);
                let logoX = margin;
                
                if (layout.logoPosition === 'center') {
                    logoX = (pageWidth - layout.logoSize) / 2;
                } else if (layout.logoPosition === 'right') {
                    logoX = pageWidth - margin - layout.logoSize;
                }

                doc.addImage(logoToUse, format, logoX + logoOffsetX, currentY + logoOffsetY, layout.logoSize, layout.logoSize);
                
                if (layout.logoPosition === 'center') {
                    currentY += layout.logoSize + 5;
                }
            } catch (e) {}
        }

        // Business Details
        const headerAlign = layout.headerAlignment;
        const headerX = headerAlign === 'center' ? centerX : (headerAlign === 'right' ? pageWidth - margin : margin);
        
        // Calculate vertical centering for text if banner is active
        let textY = layout.logoPosition === 'center' ? currentY : currentY;
        
        // If logo is Left/Right, align text vertically with logo roughly
        if (layout.logoPosition !== 'center' && isBannerHeader) {
             textY += 5; // Slight padding
        }
        
        let textXOffset = (layout.logoPosition === 'left' && headerAlign === 'left') ? (layout.logoSize + 5) : 0;
        
        if (profile) {
            doc.setFont(fonts.titleFont, 'bold');
            doc.setFontSize(fonts.headerSize);
            // If banner, use bannerText color, else primary
            doc.setTextColor(isBannerHeader ? (colors.bannerText || '#ffffff') : colors.primary);
            
            doc.text(profile.name, headerX + textXOffset, textY, { align: headerAlign });
            
            textY += (fonts.headerSize * 0.4) + 2;
            
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(fonts.bodySize);
            // Secondary color for address
            doc.setTextColor(isBannerHeader ? (colors.bannerText || '#ffffff') : colors.secondary);
            
            const addressLines = doc.splitTextToSize(profile.address, (pageWidth / 2));
            doc.text(addressLines, headerX + textXOffset, textY, { align: headerAlign });
            textY += (addressLines.length * 4);
            
            const contactLine = [
                profile.phone ? `Ph: ${profile.phone}` : '',
                profile.gstNumber ? `GSTIN: ${profile.gstNumber}` : ''
            ].filter(Boolean).join(' | ');
            
            doc.text(contactLine, headerX + textXOffset, textY, { align: headerAlign });
            textY += 6;
        }

        // Adjust currentY based on what took more vertical space: Logo or Text
        // If logo is center, text is below it, so currentY is already updated.
        // If logo is side, we compare textY vs logo height.
        const headerContentHeight = Math.max(textY, layout.logoPosition !== 'center' ? currentY + layout.logoSize + 5 : currentY);
        
        // If banner, ensure we jump below it
        if (isBannerHeader) {
             currentY = Math.max(40, layout.logoSize + 20) + 5; 
        } else {
             currentY = headerContentHeight;
             // Divider line for Standard mode only
             if (!isMinimalHeader) {
                doc.setDrawColor(colors.borderColor || colors.secondary);
                doc.setLineWidth(0.5);
                doc.line(margin, currentY, pageWidth - margin, currentY);
                currentY += 10;
             } else {
                 currentY += 5;
             }
        }
    } else {
        currentY += 10;
    }

    // --- 3. DOCUMENT TITLE ---
    doc.setFont(fonts.titleFont, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(colors.text);
    doc.text(content.titleText, centerX, currentY, { align: 'center' });
    currentY += 10;

    // --- 4. RECIPIENT & METADATA ---
    const colWidth = (pageWidth - (margin * 2)) / 2;
    let recipientY = currentY + 5;
    let recipientAddrLines: string[] = [];

    // Left Col (Recipient)
    if (showCustomer) {
        doc.setFontSize(11);
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setTextColor(colors.primary);
        doc.text(data.recipient.label, margin, currentY);
        
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setFontSize(fonts.bodySize);
        doc.setTextColor(colors.text);
        
        doc.text(data.recipient.name, margin, recipientY);
        recipientAddrLines = doc.splitTextToSize(data.recipient.address || '', colWidth - 5);
        doc.text(recipientAddrLines, margin, recipientY + 5);
    }
    
    // Right Col (Doc Details)
    const rightColX = pageWidth - margin;
    doc.setFont(fonts.bodyFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.primary);
    doc.text(data.sender.label, rightColX, currentY, { align: 'right' });
    
    doc.setFont(fonts.bodyFont, 'normal');
    doc.setFontSize(fonts.bodySize);
    doc.setTextColor(colors.text);
    doc.text(`${data.sender.idLabel} ${data.id}`, rightColX, recipientY, { align: 'right' });
    doc.text(`${labels.date}: ${formatDate(data.date, dateFormat)}`, rightColX, recipientY + 5, { align: 'right' });

    if (content.showQr) {
        try {
            // Prioritize UPI string if provided, else ID
            const qrData = data.qrString || data.id;
            const qrBase64 = await getQrCodeBase64(qrData);
            if (qrBase64) {
                doc.addImage(qrBase64, 'PNG', rightColX - 55, currentY, 20, 20);
            }
        } catch (e) {}
    }

    currentY = Math.max(recipientY + 5 + (recipientAddrLines.length * 4), recipientY + 25) + 5;

    // --- 5. TABLE ---
    // Dynamic Columns
    const tableHead = ['#', labels.item];
    if (!tableOpts.hideQty) tableHead.push(labels.qty);
    if (!tableOpts.hideRate) tableHead.push(labels.rate);
    tableHead.push(labels.amount);

    const tableBody = data.items.map((item, index) => {
        const row = [(index + 1).toString(), item.name];
        if (!tableOpts.hideQty) row.push(item.quantity.toString());
        if (!tableOpts.hideRate) row.push(`${currencySymbol} ${item.rate.toLocaleString('en-IN')}`);
        row.push(`${currencySymbol} ${item.amount.toLocaleString('en-IN')}`);
        return row;
    });

    // Determine Table Theme
    let theme: 'striped' | 'grid' | 'plain' = 'plain';
    if (tableOpts.bordered) theme = 'grid';
    else if (tableOpts.stripedRows) theme = 'striped';

    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [tableHead],
        body: tableBody,
        theme: theme,
        styles: {
            font: fonts.bodyFont,
            fontSize: fonts.bodySize,
            textColor: colors.text,
            lineColor: colors.borderColor ? hexToRgbArray(colors.borderColor) : [200, 200, 200],
            lineWidth: 0.1,
            cellPadding: tableOpts.compact ? 1 : 3
        },
        headStyles: { 
            fillColor: colors.tableHeaderBg,
            textColor: colors.tableHeaderText,
            fontStyle: 'bold',
            lineColor: colors.borderColor ? hexToRgbArray(colors.borderColor) : [200, 200, 200]
        },
        alternateRowStyles: {
            fillColor: tableOpts.stripedRows ? (colors.alternateRowBg || '#f9fafb') : '#ffffff'
        },
        columnStyles: { 
            0: { halign: 'center', cellWidth: 10 },
            // Dynamically align columns based on presence
            [tableHead.length - 1]: { halign: 'right', cellWidth: 35 }, // Amount always right
            [tableHead.length - 2]: { halign: 'right' }, // Rate or Qty
        }
    });

    // --- 6. TOTALS ---
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - margin;
    const labelX = totalsX - 40;
    
    // Tax Breakdown Table (Optional)
    if (content.showTaxBreakdown && data.taxBreakdown && data.taxBreakdown.length > 0) {
        const breakdownY = finalY;
        autoTable(doc, {
            startY: breakdownY,
            margin: { left: margin, right: pageWidth/2 + 10 }, // Limit width to left side
            head: [['Rate', 'Taxable', 'Tax Amt']],
            body: data.taxBreakdown.map(t => [
                `${t.rate}%`, 
                `${currencySymbol}${t.taxable.toLocaleString('en-IN')}`, 
                `${currencySymbol}${t.tax.toLocaleString('en-IN')}`
            ]),
            theme: 'grid',
            styles: { fontSize: fonts.bodySize - 2, cellPadding: 1 },
            headStyles: { fillColor: colors.secondary, textColor: '#ffffff' },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } }
        });
        // Don't advance finalY too much, let totals stack on right
    }

    data.totals.forEach((row, index) => {
        // Draw line before the last item (usually Grand Total or Balance) if it's bold
        if (row.isBold && index === data.totals.length - 1) {
             doc.setDrawColor(colors.borderColor || colors.secondary);
             doc.line(labelX - 20, finalY - 4, totalsX, finalY - 4);
        }

        doc.setFont(fonts.bodyFont, row.isBold ? 'bold' : 'normal');
        doc.setFontSize(row.size || fonts.bodySize);
        doc.setTextColor(row.color || colors.text);
        doc.text(row.label, labelX, finalY, { align: 'right' });
        doc.text(row.value, totalsX, finalY, { align: 'right' });
        finalY += (row.size && row.size > fonts.bodySize ? 8 : 6);
    });
    
    // --- 6a. AMOUNT IN WORDS ---
    if (content.showAmountInWords && data.grandTotalNumeric) {
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setFontSize(fonts.bodySize);
        doc.setTextColor(colors.primary);
        const words = convertNumberToWords(Math.round(data.grandTotalNumeric));
        // Place below the table, aligned left
        // Ensure we are below the tax table too if it exists
        const wordY = Math.max((doc as any).lastAutoTable.finalY + 10, finalY + 5); 
        doc.text(`Amount in Words: ${words}`, margin, wordY);
        finalY = wordY; // Update pointer
    }

    // --- 6b. STATUS STAMP ---
    if (content.showStatusStamp && typeof data.balanceDue !== 'undefined') {
        const isPaid = data.balanceDue <= 0;
        const stampText = isPaid ? "PAID" : "DUE";
        const stampColor = isPaid ? "#22c55e" : "#ef4444"; // Green or Red
        
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.25 }));
        
        doc.setDrawColor(stampColor);
        doc.setTextColor(stampColor);
        doc.setLineWidth(1);
        doc.setFontSize(30);
        doc.setFont('helvetica', 'bold');
        
        // Position stamp roughly over the totals area
        const stampX = pageWidth - margin - 40;
        const stampY = finalY - 20; // Move up slightly into totals
        
        // Draw rotated text
        doc.text(stampText, stampX, stampY, { align: 'center', angle: 30 });
        
        doc.restoreGraphicsState();
    }

    // --- 7. SIGNATURE, TERMS, BANK DETAILS ---
    
    // Check space for footer block (approx 50mm needed)
    if (pageHeight - finalY < 60) {
        doc.addPage();
        finalY = margin;
    } else {
        finalY += 10;
    }

    // Signature Section
    if (content.showSignature) {
        const sigY = finalY + 10; 
        const sigX = pageWidth - margin - 40;
        
        if (content.signatureImage) {
            try {
                const format = getImageType(content.signatureImage);
                doc.addImage(content.signatureImage, format, sigX - 20, sigY - 15, 40, 20);
            } catch(e) {}
        } else {
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(fonts.bodySize);
            doc.setTextColor(colors.text);
            doc.text("______________________", sigX, sigY + 15, { align: 'center' });
        }
        
        if (content.signatureText) {
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(fonts.bodySize);
            doc.setTextColor(colors.text);
            doc.text(content.signatureText, sigX, sigY + 20, { align: 'center' });
        }
    }

    let leftColY = finalY;
    const contentLeftWidth = pageWidth - margin - 80; // Available width for left content

    if (content.bankDetails) {
        doc.setFontSize(fonts.bodySize);
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setTextColor(colors.text);
        doc.text("Bank Details:", margin, leftColY);
        leftColY += 5;
        
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setTextColor(colors.secondary);
        const bankLines = doc.splitTextToSize(content.bankDetails, contentLeftWidth);
        doc.text(bankLines, margin, leftColY);
        leftColY += (bankLines.length * 4) + 5;
    }

    if (content.showTerms && content.termsText) {
        doc.setFontSize(fonts.bodySize);
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setTextColor(colors.text);
        doc.text("Terms & Conditions:", margin, leftColY);
        leftColY += 5;
        
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setTextColor(colors.secondary);
        const termsLines = doc.splitTextToSize(content.termsText, contentLeftWidth);
        doc.text(termsLines, margin, leftColY);
    }

    if (layout.showWatermark) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: layout.watermarkOpacity || 0.1 }));
        doc.setFontSize(60);
        doc.setTextColor(colors.primary);
        const watermark = data.watermarkText || profile?.name || 'INVOICE';
        doc.text(watermark, pageWidth/2, pageHeight/2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
    }

    // --- 8. FOOTER ---
    const isBannerFooter = layout.footerStyle === 'banner';
    const footerY = pageHeight - 15;
    
    if (isBannerFooter) {
        doc.setFillColor(colors.footerBg || '#f3f4f6');
        doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
        doc.setTextColor(colors.footerText || colors.secondary);
    } else {
        doc.setTextColor(colors.secondary);
    }

    doc.setFontSize(9);
    doc.text(content.footerText, centerX, footerY, { align: 'center' });

    return doc;
};

// Helper: Convert hex to RGB array for jspdf-autotable
const hexToRgbArray = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
};

// --- Helper: Calculate Tax Breakdown ---
const calculateTaxBreakdown = (items: any[]) => {
    const breakdown: Record<number, { taxable: number, tax: number }> = {};
    
    items.forEach(item => {
        const rate = Number(item.gstPercent) || 0;
        const itemTotal = Number(item.price) * Number(item.quantity);
        // Back-calculate taxable value from total assuming inclusive tax
        const taxable = itemTotal / (1 + (rate / 100));
        const tax = itemTotal - taxable;
        
        if (!breakdown[rate]) {
            breakdown[rate] = { taxable: 0, tax: 0 };
        }
        breakdown[rate].taxable += taxable;
        breakdown[rate].tax += tax;
    });
    
    return Object.entries(breakdown).map(([rate, val]) => ({
        rate: Number(rate),
        taxable: val.taxable,
        tax: val.tax
    })).sort((a,b) => a.rate - b.rate);
};

// --- Public Generators ---

export const generateA4InvoicePdf = async (
    sale: Sale, 
    customer: Customer, 
    profile: ProfileData | null, 
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    const labels = { ...defaultLabels, ...templateConfig.content.labels };
    const currency = templateConfig.currencySymbol || 'Rs.';
    
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    const dueColor = dueAmount > 0.01 ? '#dc2626' : '#16a34a';

    let qrString = sale.id;
    if (templateConfig.content.qrType === 'UPI_PAYMENT' && templateConfig.content.upiId) {
       const pa = templateConfig.content.upiId;
       const pn = templateConfig.content.payeeName || 'Merchant';
       const am = sale.totalAmount.toFixed(2);
       const tr = sale.id; 
       const tn = `Invoice ${sale.id}`; 
       qrString = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&tr=${tr}&tn=${encodeURIComponent(tn)}&cu=INR`;
    }
    
    // Construct Totals Array with explicit type
    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: `${currency} ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: labels.discount, value: `- ${currency} ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    ];

    // Conditionally add GST line
    if (templateConfig.content.showGst !== false) {
        totals.push({ label: labels.gst, value: `${currency} ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` });
    }

    totals.push(
        { label: labels.grandTotal, value: `${currency} ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 },
        { label: labels.paid, value: `${currency} ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: labels.balance, value: `${currency} ${dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: dueColor, size: templateConfig.fonts.bodySize + 2 }
    );

    // Generate Tax Breakdown if needed
    // For now, only for Designer dummy items or if real items have gstPercent
    const enrichedItems = sale.items.map(i => ({...i, gstPercent: (i as any).gstPercent || 0 })); 
    const taxBreakdown = calculateTaxBreakdown(enrichedItems);

    const data: GenericDocumentData = {
        id: sale.id,
        date: sale.date,
        recipient: {
            label: labels.billedTo,
            name: customer.name,
            address: customer.address
        },
        sender: {
            label: 'Invoice Details:',
            idLabel: labels.invoiceNo
        },
        items: sale.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            rate: Number(item.price),
            amount: Number(item.quantity) * Number(item.price)
        })),
        totals: totals,
        qrString: qrString,
        grandTotalNumeric: Number(sale.totalAmount),
        balanceDue: dueAmount,
        taxBreakdown: templateConfig.content.showTaxBreakdown ? taxBreakdown : undefined
    };

    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};

export const generateEstimatePDF = async (
    quote: Quote, 
    customer: Customer, 
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    const labels = { ...defaultLabels, ...templateConfig.content.labels };
    const currency = templateConfig.currencySymbol || 'Rs.';
    const subTotal = quote.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: `${currency} ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
        { label: labels.discount, value: `- ${currency} ${Number(quote.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    ];

    if (templateConfig.content.showGst !== false) {
        totals.push({ label: labels.gst, value: `${currency} ${Number(quote.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` });
    }

    totals.push({ label: labels.grandTotal, value: `${currency} ${Number(quote.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 });

    const data: GenericDocumentData = {
        id: quote.id,
        date: quote.date,
        recipient: {
            label: 'Estimate For:',
            name: customer.name,
            address: customer.address
        },
        sender: {
            label: 'Estimate Details:',
            idLabel: labels.invoiceNo
        },
        items: quote.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            rate: Number(item.price),
            amount: Number(item.quantity) * Number(item.price)
        })),
        totals: totals,
        watermarkText: 'ESTIMATE',
        grandTotalNumeric: Number(quote.totalAmount)
    };

    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};

export const generateDebitNotePDF = async (
    returnData: Return, 
    supplier: Supplier | undefined, 
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    const labels = { ...defaultLabels, ...templateConfig.content.labels };
    const currency = templateConfig.currencySymbol || 'Rs.';
    
    const data: GenericDocumentData = {
        id: returnData.id,
        date: returnData.returnDate,
        recipient: {
            label: labels.billedTo,
            name: supplier?.name || 'Unknown Supplier',
            address: supplier?.location || ''
        },
        sender: {
            label: 'Reference Details:',
            idLabel: labels.invoiceNo
        },
        items: returnData.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            rate: Number(item.price),
            amount: Number(item.quantity) * Number(item.price)
        })),
        totals: [
            { label: 'Total Debit Value:', value: `${currency} ${Number(returnData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, size: templateConfig.fonts.bodySize + 2 }
        ],
        watermarkText: 'DEBIT NOTE',
        grandTotalNumeric: Number(returnData.amount)
    };

    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};
