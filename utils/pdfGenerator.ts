
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

// --- Helper: Safe Currency Formatting ---
const formatCurrency = (amount: number, symbol: string, fontName: string): string => {
    const isStandardFont = ['helvetica', 'times', 'courier'].includes(fontName.toLowerCase());
    // If using standard font and symbol is Rupee, fallback to Rs.
    const safeSymbol = (isStandardFont && symbol === '₹') ? 'Rs.' : symbol;
    return `${safeSymbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
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

// --- Helper: Add Header (Legacy support for Reports) ---
export const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null, title?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = 10;

    // Add Logo if available
    const logoToUse = profile?.logo || logoBase64;
    if (logoToUse) {
        try {
            const format = getImageType(logoToUse);
            const width = 25;
            let height = 25;
            // Attempt to maintain aspect ratio
            try {
                const props = doc.getImageProperties(logoToUse);
                if (props.width > 0 && props.height > 0) {
                    height = width / (props.width / props.height);
                }
            } catch(e) {}
            
            // Constrain height if aspect ratio is wild
            if (height > 40) {
                const scale = 40 / height;
                height = 40;
                // width will be smaller, but we fixed width. 
                // Actually better to fix max dimension. 
                // For simplified headers, let's just clamp height.
            }
            
            doc.addImage(logoToUse, format, 14, 10, width, height);
        } catch (e) {
            console.warn("Failed to add logo", e);
        }
    }

    if (profile) {
        doc.setFont('times', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(0, 128, 128); 
        doc.text(profile.name, centerX, currentY + 5, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setTextColor('#333333');
        doc.setFont('helvetica', 'normal');
        
        let addressY = currentY + 12;
        const address = profile.address || '';
        const addressLines = doc.splitTextToSize(address, 120);
        doc.text(addressLines, centerX, addressY, { align: 'center' });
        
        addressY += (addressLines.length * 4) + 1;
        
        const details = [];
        if (profile.phone) details.push(`Ph: ${profile.phone}`);
        if (profile.gstNumber) details.push(`GSTIN: ${profile.gstNumber}`);
        
        if (details.length > 0) {
            doc.text(details.join(' | '), centerX, addressY, { align: 'center' });
            currentY = addressY + 6;
        } else {
            currentY = addressY + 2;
        }
    } else {
        currentY += 15;
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
    
    return currentY + 8; 
};

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
    const currencySymbol = templateConfig?.currencySymbol || 'Rs.';
    const dateFormat = templateConfig?.dateFormat || 'DD/MM/YYYY';
    const labels = { ...defaultLabels, ...templateConfig?.content.labels };

    // Force 'Rs.' for thermal if no custom font, standard thermal printers often fail with special chars
    const currency = customFonts?.length ? currencySymbol : 'Rs.';

    const margin = 2;
    const pageWidth = 72; // 80mm paper usually has ~72mm printable width
    
    // Calculate estimated height to initialize doc
    const estimatedHeight = 200 + (sale.items.length * 10);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight] 
    });

    if (customFonts) registerCustomFonts(doc, customFonts);

    let y = 5;
    const centerX = 40; // Center of 80mm

    // Logo with Aspect Ratio Check
    if (profile?.logo) {
        try {
            const logoWidth = 18;
            let logoHeight = 18;
            try {
                const props = doc.getImageProperties(profile.logo);
                if (props.width > 0 && props.height > 0) {
                    logoHeight = logoWidth / (props.width / props.height);
                }
            } catch(e) {}
            
            doc.addImage(profile.logo, getImageType(profile.logo), centerX - (logoWidth/2), y, logoWidth, logoHeight);
            y += logoHeight + 3;
        } catch(e) {}
    }

    // Business Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor('#000000');
    const busName = doc.splitTextToSize(profile?.name || 'Business Name', pageWidth);
    doc.text(busName, centerX, y, { align: 'center' });
    y += (busName.length * 4) + 1;

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

    // Divider
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // Invoice Meta
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(templateConfig?.content.titleText || 'TAX INVOICE', centerX, y, { align: 'center' });
    y += 5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${labels.invoiceNo}: ${sale.id}`, margin, y);
    y += 4;
    doc.text(`${labels.date}: ${formatDate(sale.date, dateFormat)}`, margin, y);
    y += 4;
    doc.text(`${labels.billedTo}: ${customer.name}`, margin, y);
    y += 5;

    // Items Header
    doc.line(margin, y, 80 - margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(labels.item, margin, y);
    doc.text(labels.amount, 80 - margin, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // Items
    doc.setFont('helvetica', 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        const name = doc.splitTextToSize(item.productName, 50);
        doc.text(name, margin, y);
        doc.text(itemTotal.toLocaleString('en-IN'), 80 - margin, y, { align: 'right' });
        y += (name.length * 3.5);
        
        // Sub-detail
        doc.setFontSize(7);
        doc.setTextColor('#555555');
        doc.text(`${item.quantity} x ${Number(item.price).toLocaleString('en-IN')}`, margin, y);
        doc.setFontSize(8);
        doc.setTextColor('#000000');
        y += 4;
    });

    doc.line(margin, y, 80 - margin, y);
    y += 4;

    // Totals
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    
    const addRow = (label: string, value: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(label, 45, y, { align: 'right' });
        doc.text(value, 80 - margin, y, { align: 'right' });
        y += 4;
    }

    addRow(labels.subtotal, subTotal.toLocaleString('en-IN'));
    if (sale.discount > 0) addRow(labels.discount, `-${Number(sale.discount).toLocaleString('en-IN')}`);
    addRow(labels.grandTotal, `${currency} ${Number(sale.totalAmount).toLocaleString('en-IN')}`, true);
    
    if (paid < Number(sale.totalAmount)) {
        addRow(labels.balance, `${currency} ${(Number(sale.totalAmount) - paid).toLocaleString('en-IN')}`, true);
    }

    // Footer
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    const footerLines = doc.splitTextToSize(footer, pageWidth);
    doc.text(footerLines, centerX, y, { align: 'center' });
    
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

// --- Configurable PDF Engine (A4) ---
const _generateConfigurablePDF = async (
    data: GenericDocumentData,
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    
    const doc = new jsPDF();
    if (customFonts) registerCustomFonts(doc, customFonts);

    const { colors, fonts, layout, content, currencySymbol } = templateConfig;
    const labels = { ...defaultLabels, ...content.labels };
    
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = layout.margin;
    let currentY = margin;

    // --- HEADER ---
    const isBanner = layout.headerStyle === 'banner';
    if (isBanner) {
        doc.setFillColor(colors.bannerBg || colors.primary);
        // Reserve space but draw rect dynamically based on content height
        // Initial rect, will redraw if needed or assume height
        doc.rect(0, 0, pageWidth, 40 + (layout.logoSize/2), 'F');
        currentY += 5;
    }

    // Logo & Text Positioning
    const logoUrl = profile?.logo || logoBase64;
    const hasLogo = !!logoUrl && layout.logoSize > 5;
    
    let logoX = margin;
    let logoY = currentY + (layout.logoOffsetY || 0);
    let textX = margin;
    let textY = currentY;
    let textAlign: 'left' | 'center' | 'right' = 'left';
    let renderedLogoHeight = 0;

    // Calculate Logo Aspect Ratio and Dimensions
    if (hasLogo) {
        try {
            const imgProps = doc.getImageProperties(logoUrl);
            const ratio = imgProps.width / imgProps.height;
            // layout.logoSize acts as Width constraint.
            renderedLogoHeight = layout.logoSize / ratio;
            
            // Safety cap for logo height to prevent overlap
            if (renderedLogoHeight > 60) { 
                const capRatio = 60 / renderedLogoHeight;
                renderedLogoHeight = 60;
                // Width will be reduced proportionally if we were rendering by height, 
                // but here we set width fixed. If height is capped, we should probably adjust width to maintain aspect ratio
                // But `doc.addImage` takes w,h. We just need to pass consistent values.
                // If we cap height, effective width must shrink.
                // But user slider controls width. Let's just use calculated height but cap it for layout flow purposes.
            }
        } catch (e) {
            // Fallback to square if props fail
            renderedLogoHeight = layout.logoSize;
        }
    }

    // Robust layout logic
    if (layout.logoPosition === 'center') {
        logoX = (pageWidth - layout.logoSize) / 2;
        if (hasLogo) {
            doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
            textY = logoY + renderedLogoHeight + 5;
        }
        textAlign = 'center';
        textX = pageWidth / 2;
    } else if (layout.logoPosition === 'right') {
        logoX = pageWidth - margin - layout.logoSize;
        if (hasLogo) {
            doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
        }
        // Text stays left
        textAlign = 'left';
        textX = margin;
        textY += 5; 
    } else { // Left Logo
        logoX = margin;
        if (hasLogo) {
            doc.addImage(logoUrl, getImageType(logoUrl), logoX + (layout.logoOffsetX || 0), logoY, layout.logoSize, renderedLogoHeight);
        }
        // Text goes right
        textAlign = 'right';
        textX = pageWidth - margin;
        textY += 5;
    }

    // Draw Business Text
    if (profile) {
        doc.setFont(fonts.titleFont, 'bold');
        doc.setFontSize(fonts.headerSize);
        doc.setTextColor(isBanner ? (colors.bannerText || '#fff') : colors.primary);
        doc.text(profile.name, textX, textY, { align: textAlign });
        
        textY += fonts.headerSize * 0.4 + 2;
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setFontSize(fonts.bodySize);
        doc.setTextColor(isBanner ? (colors.bannerText || '#fff') : colors.secondary);
        
        const addr = doc.splitTextToSize(profile.address, 90);
        doc.text(addr, textX, textY, { align: textAlign });
        textY += (addr.length * 4) + 1;
        
        const contact = [profile.phone && `Ph: ${profile.phone}`, profile.gstNumber && `GST: ${profile.gstNumber}`].filter(Boolean).join(' | ');
        doc.text(contact, textX, textY, { align: textAlign });
        
        // Update currentY to be below the lowest element (Logo or Text)
        const contentBottom = Math.max(textY + 5, hasLogo ? logoY + renderedLogoHeight + 5 : textY + 5);
        currentY = contentBottom;
    } else {
        currentY += 20;
    }

    if (!isBanner && layout.headerStyle !== 'minimal') {
        doc.setDrawColor(colors.borderColor || '#ccc');
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;
    } else {
        currentY += 5;
    }

    // --- TITLE ---
    doc.setFont(fonts.titleFont, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(colors.text);
    doc.text(content.titleText, pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // --- DETAILS GRID (Recipient & Invoice Info) ---
    const gridY = currentY;
    const colWidth = (pageWidth - (margin * 3)) / 2;
    
    // Left Column: Recipient
    doc.setFont(fonts.bodyFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.primary);
    doc.text(data.recipient.label, margin, gridY);
    
    doc.setFont(fonts.bodyFont, 'normal');
    doc.setFontSize(fonts.bodySize);
    doc.setTextColor(colors.text);
    doc.text(data.recipient.name, margin, gridY + 6);
    const recipientAddr = doc.splitTextToSize(data.recipient.address, colWidth);
    doc.text(recipientAddr, margin, gridY + 11);
    
    // Right Column: Invoice Details & QR
    const rightColX = pageWidth - margin;
    doc.setFont(fonts.bodyFont, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.primary);
    doc.text(data.sender.label, rightColX, gridY, { align: 'right' });
    
    doc.setFont(fonts.bodyFont, 'normal');
    doc.setFontSize(fonts.bodySize);
    doc.setTextColor(colors.text);
    
    let infoY = gridY + 6;
    doc.text(`${data.sender.idLabel} ${data.id}`, rightColX, infoY, { align: 'right' });
    infoY += 5;
    doc.text(`${labels.date}: ${formatDate(data.date, templateConfig.dateFormat)}`, rightColX, infoY, { align: 'right' });
    
    // QR Code
    if (content.showQr) {
        const qrData = data.qrString || data.id;
        try {
            const qrImg = await getQrCodeBase64(qrData);
            if (qrImg) {
                // Place QR to the left of the text block in right column
                // QR Size 22mm. Text aligns right at rightColX.
                // Place QR at rightColX - width_of_qr - spacing
                doc.addImage(qrImg, 'PNG', rightColX - 22, infoY + 2, 22, 22);
            }
        } catch(e) {}
    }

    currentY = Math.max(gridY + 11 + (recipientAddr.length * 5), infoY + 25) + 5;

    // --- TABLE ---
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

    autoTable(doc, {
        startY: currentY,
        head: [tableHead],
        body: tableBody,
        theme: layout.tableOptions?.stripedRows ? 'striped' : 'plain',
        styles: { font: fonts.bodyFont, fontSize: fonts.bodySize, cellPadding: 3, textColor: colors.text },
        headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 'auto' }, // Item
            [tableHead.length - 1]: { halign: 'right', cellWidth: 35 }, // Amount
            [tableHead.length - 2]: { halign: 'right', cellWidth: hideRate ? 15 : 25 }, // Rate/Qty
            [tableHead.length - 3]: { halign: 'right', cellWidth: 15 }, // Qty (if rate exists)
        },
        margin: { left: margin, right: margin }
    });

    // --- TOTALS ---
    let finalY = (doc as any).lastAutoTable.finalY + 5;
    
    // Ensure we don't split totals page awkwardly
    if (pageHeight - finalY < 50) {
        doc.addPage();
        finalY = margin;
    }

    const totalsX = pageWidth - margin;
    const totalsLabelX = totalsX - 40;

    data.totals.forEach((t) => {
        doc.setFont(fonts.bodyFont, t.isBold ? 'bold' : 'normal');
        doc.setFontSize(t.size || fonts.bodySize);
        doc.setTextColor(t.color || colors.text);
        
        doc.text(t.label, totalsLabelX, finalY, { align: 'right' });
        doc.text(t.value, totalsX, finalY, { align: 'right' });
        finalY += (t.size ? t.size * 0.5 : 6);
    });

    // --- FOOTER SECTION ---
    const footerY = pageHeight - 20;
    
    if (content.showSignature) {
        const sigY = finalY + 15;
        if (sigY < footerY) {
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(10);
            doc.setTextColor(colors.text);
            doc.text("Authorized Signatory", pageWidth - margin, sigY + 10, { align: 'right' });
            // Placeholder line or image
            if (content.signatureImage) {
                try {
                    const sigProps = doc.getImageProperties(content.signatureImage);
                    const sigRatio = sigProps.width / sigProps.height;
                    const sigWidth = 40;
                    const sigHeight = sigWidth / sigRatio;
                    doc.addImage(content.signatureImage, getImageType(content.signatureImage), pageWidth - margin - 40, sigY - 10, sigWidth, sigHeight);
                } catch(e) {}
            } else {
                doc.text("___________________", pageWidth - margin, sigY, { align: 'right' });
            }
        }
    }

    // Terms (Bottom Left)
    if (content.showTerms && content.termsText) {
        doc.setFontSize(8);
        doc.setTextColor(colors.secondary);
        doc.text("Terms & Conditions:", margin, footerY - 15);
        const terms = doc.splitTextToSize(content.termsText, pageWidth / 2);
        doc.text(terms, margin, footerY - 10);
    }

    // Bottom Bar
    if (layout.footerStyle === 'banner') {
        doc.setFillColor(colors.footerBg || '#f3f4f6');
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setTextColor(colors.footerText || colors.secondary);
    } else {
        doc.setTextColor(colors.secondary);
    }
    doc.setFontSize(9);
    doc.text(content.footerText, pageWidth / 2, pageHeight - 6, { align: 'center' });

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
    templateConfig?: InvoiceTemplateConfig, // Made optional for backward compat
    customFonts?: CustomFont[]
): Promise<jsPDF> => {
    
    // Fallback to default config if not provided (e.g. from legacy calls)
    const defaultConfig: InvoiceTemplateConfig = {
        id: 'default', 
        currencySymbol: 'Rs.', 
        dateFormat: 'DD/MM/YYYY',
        colors: { 
            primary: '#0d9488', secondary: '#333333', text: '#000000', 
            tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', 
            bannerBg: '#0d9488', bannerText: '#ffffff',
            footerBg: '#f3f4f6', footerText: '#374151', 
            borderColor: '#e5e7eb', alternateRowBg: '#f9fafb'
        },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { 
            margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, 
            headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard',
            showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false }
        },
        content: { 
            titleText: 'TAX INVOICE', labels: defaultLabels, showQr: true, showTerms: true, showSignature: true, 
            termsText: '', footerText: '', showBusinessDetails: true, showCustomerDetails: true,
            signatureText: '', showAmountInWords: false, showStatusStamp: false, showTaxBreakdown: false, showGst: true,
            qrType: 'INVOICE_ID', bankDetails: ''
        }
    };

    const config = templateConfig || defaultConfig;

    const labels = { ...defaultLabels, ...config.content.labels };
    const currency = config.currencySymbol || 'Rs.';
    const fontName = config.fonts.bodyFont;
    
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    const dueColor = dueAmount > 0.01 ? '#dc2626' : '#16a34a';

    let qrString = sale.id;
    if (config.content.qrType === 'UPI_PAYMENT' && config.content.upiId) {
       const pa = config.content.upiId;
       const pn = config.content.payeeName || 'Merchant';
       const am = sale.totalAmount.toFixed(2);
       const tr = sale.id; 
       const tn = `Invoice ${sale.id}`; 
       qrString = `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&tr=${tr}&tn=${encodeURIComponent(tn)}&cu=INR`;
    }
    
    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: formatCurrency(subTotal, currency, fontName) },
        { label: labels.discount, value: `- ${formatCurrency(Number(sale.discount), currency, fontName)}` },
    ];

    if (config.content.showGst !== false) {
        totals.push({ label: labels.gst, value: formatCurrency(Number(sale.gstAmount), currency, fontName) });
    }

    totals.push(
        { label: labels.grandTotal, value: formatCurrency(Number(sale.totalAmount), currency, fontName), isBold: true, color: config.colors.primary, size: config.fonts.bodySize + 2 },
        { label: labels.paid, value: formatCurrency(paidAmount, currency, fontName) },
        { label: labels.balance, value: formatCurrency(dueAmount, currency, fontName), isBold: true, color: dueColor, size: config.fonts.bodySize + 2 }
    );

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
        taxBreakdown: config.content.showTaxBreakdown ? taxBreakdown : undefined
    };

    return _generateConfigurablePDF(data, profile, config, customFonts);
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
    const fontName = templateConfig.fonts.bodyFont;
    const subTotal = quote.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const totals: GenericDocumentData['totals'] = [
        { label: labels.subtotal, value: formatCurrency(subTotal, currency, fontName) },
        { label: labels.discount, value: `- ${formatCurrency(Number(quote.discount), currency, fontName)}` },
    ];

    if (templateConfig.content.showGst !== false) {
        totals.push({ label: labels.gst, value: formatCurrency(Number(quote.gstAmount), currency, fontName) });
    }

    totals.push({ label: labels.grandTotal, value: formatCurrency(Number(quote.totalAmount), currency, fontName), isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 });

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
    const fontName = templateConfig.fonts.bodyFont;
    
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
            { label: 'Total Debit Value:', value: formatCurrency(Number(returnData.amount), currency, fontName), isBold: true, size: templateConfig.fonts.bodySize + 2 }
        ],
        watermarkText: 'DEBIT NOTE',
        grandTotalNumeric: Number(returnData.amount)
    };

    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};
