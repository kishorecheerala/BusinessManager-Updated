
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
    
    const labels = { ...defaultLabels, ...templateConfig?.content.labels };

    const margin = templateConfig?.layout.margin || 3;
    const logoSize = templateConfig?.layout.logoSize || 15;
    const logoPos = templateConfig?.layout.logoPosition || 'center';
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
                
                doc.addImage(logoToUse, format, logoX, y, logoSize, logoSize);
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
    
    const d = new Date(sale.date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    doc.text(`${labels.date}: ${dateStr}`, margin, y);
    y += 4;

    if (showQr) {
        try {
            const qrBase64 = await getQrCodeBase64(sale.id);
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
        doc.text(`${item.quantity} x ${Number(item.price).toLocaleString('en-IN')}`, margin, y);
        y += 4;
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
    
    y += 1;
    doc.setFontSize(bodyFontSize + 2);
    doc.setFont(bodyFont, 'bold');
    doc.setTextColor(primaryColor);
    doc.text(labels.grandTotal, pageWidth - 30, y, { align: 'right' });
    doc.text(`Rs. ${Number(sale.totalAmount).toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
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

interface GenericDocumentData {
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

    const { colors, fonts, layout, content } = templateConfig;
    const labels = { ...defaultLabels, ...content.labels };

    // Conversions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = layout.margin;
    const centerX = pageWidth / 2;
    let currentY = margin;

    const showBusiness = content.showBusinessDetails ?? true;
    const showCustomer = content.showCustomerDetails ?? true;

    // --- 1. HEADER & LOGO ---
    if (showBusiness) {
        const logoToUse = profile?.logo || logoBase64;
        
        if (logoToUse) {
            try {
                const format = getImageType(logoToUse);
                let logoX = margin;
                
                if (layout.logoPosition === 'center') {
                    logoX = (pageWidth - layout.logoSize) / 2;
                } else if (layout.logoPosition === 'right') {
                    logoX = pageWidth - margin - layout.logoSize;
                }

                doc.addImage(logoToUse, format, logoX, currentY, layout.logoSize, layout.logoSize);
                
                if (layout.logoPosition === 'center') {
                    currentY += layout.logoSize + 5;
                }
            } catch (e) {}
        }

        // Business Details
        const headerAlign = layout.headerAlignment;
        const headerX = headerAlign === 'center' ? centerX : (headerAlign === 'right' ? pageWidth - margin : margin);
        let textY = layout.logoPosition === 'center' ? currentY : margin;
        let textXOffset = (layout.logoPosition === 'left' && headerAlign === 'left') ? (layout.logoSize + 5) : 0;
        
        if (profile) {
            doc.setFont(fonts.titleFont, 'bold');
            doc.setFontSize(fonts.headerSize);
            doc.setTextColor(colors.primary);
            doc.text(profile.name, headerX + textXOffset, textY, { align: headerAlign });
            
            textY += (fonts.headerSize * 0.4) + 2;
            
            doc.setFont(fonts.bodyFont, 'normal');
            doc.setFontSize(fonts.bodySize);
            doc.setTextColor(colors.secondary);
            
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

        currentY = Math.max(currentY, textY, layout.logoPosition !== 'center' ? margin + layout.logoSize + 5 : 0);

        doc.setDrawColor(colors.secondary);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;
    } else {
        // Even if hidden, add some top margin
        currentY += 10;
    }

    // --- 2. TITLE & METADATA ---
    doc.setFont(fonts.titleFont, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(colors.text);
    doc.text(content.titleText, centerX, currentY, { align: 'center' });
    currentY += 10;

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
    doc.text(`${labels.date}: ${new Date(data.date).toLocaleDateString()}`, rightColX, recipientY + 5, { align: 'right' });

    if (content.showQr) {
        try {
            const qrBase64 = await getQrCodeBase64(data.id);
            if (qrBase64) {
                doc.addImage(qrBase64, 'PNG', rightColX - 55, currentY, 20, 20);
            }
        } catch (e) {}
    }

    currentY = Math.max(recipientY + 5 + (recipientAddrLines.length * 4), recipientY + 25) + 5;

    // --- 3. TABLE ---
    autoTable(doc, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['#', labels.item, labels.qty, labels.rate, labels.amount]],
        body: data.items.map((item, index) => [
            index + 1,
            item.name,
            item.quantity,
            `Rs. ${item.rate.toLocaleString('en-IN')}`,
            `Rs. ${item.amount.toLocaleString('en-IN')}`
        ]),
        theme: 'grid',
        styles: {
            font: fonts.bodyFont,
            fontSize: fonts.bodySize,
            textColor: colors.text,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
        },
        headStyles: { 
            fillColor: colors.tableHeaderBg,
            textColor: colors.tableHeaderText,
            fontStyle: 'bold'
        },
        columnStyles: { 
            0: { halign: 'center', cellWidth: 10 },
            2: { halign: 'center', cellWidth: 20 }, 
            3: { halign: 'right', cellWidth: 30 }, 
            4: { halign: 'right', cellWidth: 35 } 
        }
    });

    // --- 4. TOTALS ---
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - margin;
    const labelX = totalsX - 40;
    
    data.totals.forEach((row, index) => {
        // Draw line before the last item (usually Grand Total or Balance) if it's bold
        if (row.isBold && index === data.totals.length - 1) {
             doc.setDrawColor(colors.secondary);
             doc.line(labelX - 20, finalY - 4, totalsX, finalY - 4);
        }

        doc.setFont(fonts.bodyFont, row.isBold ? 'bold' : 'normal');
        doc.setFontSize(row.size || fonts.bodySize);
        doc.setTextColor(row.color || colors.text);
        doc.text(row.label, labelX, finalY, { align: 'right' });
        doc.text(row.value, totalsX, finalY, { align: 'right' });
        finalY += (row.size && row.size > fonts.bodySize ? 8 : 6);
    });

    // --- 5. SIGNATURE, TERMS & FOOTER ---
    // Check space for signature + terms (approx 50mm needed)
    if (pageHeight - finalY < 50) {
        doc.addPage();
        finalY = margin;
    } else {
        finalY += 10;
    }

    // Signature Section
    if (content.showSignature) {
        const sigY = finalY + 10; // Give some breathing room
        const sigX = pageWidth - margin - 40;
        
        if (content.signatureImage) {
            try {
                const format = getImageType(content.signatureImage);
                // Render signature image (approx 40x20mm)
                doc.addImage(content.signatureImage, format, sigX - 20, sigY - 15, 40, 20);
            } catch(e) {}
        } else {
            // Text signature line
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
        
        // Update finalY to ensure terms/footer don't overlap signature area if they are placed below
        // However, terms usually go on left side. 
        // If signature is on right, terms can start at same Y on left.
    }

    if (content.showTerms && content.termsText) {
        // Start Terms at same Y as signature block start
        let termsY = finalY;
        
        doc.setFontSize(fonts.bodySize);
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setTextColor(colors.text);
        doc.text("Terms & Conditions:", margin, termsY);
        termsY += 5;
        
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setTextColor(colors.secondary);
        // Wrap width: exclude signature area approx 60mm from right
        const termsWidth = pageWidth - margin - 70; 
        const termsLines = doc.splitTextToSize(content.termsText, termsWidth);
        doc.text(termsLines, margin, termsY);
    }

    if (layout.showWatermark) {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.setFontSize(60);
        doc.setTextColor(colors.primary);
        const watermark = data.watermarkText || profile?.name || 'INVOICE';
        doc.text(watermark, pageWidth/2, pageHeight/2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();
    }

    doc.setFontSize(9);
    doc.setTextColor(colors.secondary);
    doc.text(content.footerText, centerX, pageHeight - 10, { align: 'center' });

    return doc;
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
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    const dueColor = dueAmount > 0.01 ? '#dc2626' : '#16a34a';

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
        totals: [
            { label: labels.subtotal, value: `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.discount, value: `- Rs. ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.gst, value: `Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.grandTotal, value: `Rs. ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 },
            { label: labels.paid, value: `Rs. ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.balance, value: `Rs. ${dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: dueColor, size: templateConfig.fonts.bodySize + 2 }
        ]
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
    const subTotal = quote.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

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
        totals: [
            { label: labels.subtotal, value: `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.discount, value: `- Rs. ${Number(quote.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.gst, value: `Rs. ${Number(quote.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: labels.grandTotal, value: `Rs. ${Number(quote.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 },
        ],
        watermarkText: 'ESTIMATE'
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
            { label: 'Total Debit Value:', value: `Rs. ${Number(returnData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, size: templateConfig.fonts.bodySize + 2 }
        ],
        watermarkText: 'DEBIT NOTE'
    };

    return _generateConfigurablePDF(data, profile, templateConfig, customFonts);
};