
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return, Quote, InvoiceTemplateConfig } from '../types';
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
export const generateThermalInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null, settings?: InvoiceSettings): Promise<jsPDF> => {
    const terms = settings?.terms || '';
    const footer = settings?.footer || 'Thank You! Visit Again.';
    const showQr = settings?.showQr ?? true;

    const estimatedHeight = 200 + (sale.items.length * 15) + (terms.length > 0 ? 30 : 0);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight]
    });

    const pageWidth = 80;
    const margin = 3;
    const centerX = pageWidth / 2;
    let y = 8;

    const logoToUse = profile?.logo || logoBase64;
    if (logoToUse) {
        try {
            const format = getImageType(logoToUse);
            doc.addImage(logoToUse, format, centerX - 7.5, y, 15, 15);
            y += 18;
        } catch (e) {}
    }

    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, y, { align: 'center' });
    y += 5;

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 128); 
    const busName = doc.splitTextToSize(profile?.name || 'Business Name', pageWidth - 10);
    doc.text(busName, centerX, y, { align: 'center' });
    y += (busName.length * 5) + 2;

    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    const qrSize = 20;
    const qrX = pageWidth - margin - qrSize;
    const startHeaderY = y;

    doc.setFontSize(8);
    doc.text(`Inv: ${sale.id}`, margin, y);
    y += 4;
    
    const d = new Date(sale.date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    doc.text(`${dateStr}`, margin, y);
    y += 4;

    if (showQr) {
        try {
            const qrBase64 = await getQrCodeBase64(sale.id);
            if (qrBase64) {
                doc.addImage(qrBase64, 'PNG', qrX, startHeaderY, qrSize, qrSize);
            }
        } catch (e) {}
    }

    y = Math.max(y + 2, startHeaderY + (showQr ? qrSize : 0) + 2);

    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, margin + 7, y);
    y += 4;
    
    if (customer.phone) {
        doc.text(`Ph: ${customer.phone}`, margin, y);
        y += 4;
    }

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Item', margin, y);
    doc.text('Amt', pageWidth - margin, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        doc.setTextColor('#000000');
        doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(item.productName, 55); 
        doc.text(nameLines, margin, y);
        doc.text(`${itemTotal.toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
        y += (nameLines.length * 4);
        doc.setTextColor('#555555');
        doc.setFontSize(8);
        doc.text(`${item.quantity} x ${Number(item.price).toLocaleString('en-IN')}`, margin, y);
        y += 4;
    });

    y += 1;
    doc.setDrawColor(200); 
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    const addTotalRow = (label: string, value: string, isBold = false, fontSize = 9) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor('#000000');
        doc.text(label, pageWidth - 30, y, { align: 'right' });
        doc.text(value, pageWidth - margin, y, { align: 'right' });
        y += 4;
    };

    addTotalRow('Subtotal', `${subTotal.toLocaleString('en-IN')}`);
    if (sale.discount > 0) addTotalRow('Discount', `-${Number(sale.discount).toLocaleString('en-IN')}`);
    
    y += 1;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', pageWidth - 30, y, { align: 'right' });
    doc.text(`Rs. ${Number(sale.totalAmount).toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    addTotalRow('Paid', `${paidAmount.toLocaleString('en-IN')}`);
    
    if (dueAmount > 0) {
        doc.setFont('helvetica', 'bold');
        addTotalRow('Balance', `${dueAmount.toLocaleString('en-IN')}`);
    }

    if (terms) {
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text("Terms & Conditions:", margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        const termsLines = doc.splitTextToSize(terms, pageWidth - (margin*2));
        doc.text(termsLines, margin, y);
        y += (termsLines.length * 4);
    }

    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
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
    templateConfig: InvoiceTemplateConfig
): Promise<jsPDF> => {
    
    const doc = new jsPDF();
    const { colors, fonts, layout, content } = templateConfig;

    // Conversions
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = layout.margin;
    const centerX = pageWidth / 2;
    let currentY = margin;

    // --- 1. HEADER & LOGO ---
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

    // --- 2. TITLE & METADATA ---
    doc.setFont(fonts.titleFont, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(colors.text);
    doc.text(content.titleText, centerX, currentY, { align: 'center' });
    currentY += 10;

    const colWidth = (pageWidth - (margin * 2)) / 2;
    
    // Left Col (Recipient)
    doc.setFontSize(11);
    doc.setFont(fonts.bodyFont, 'bold');
    doc.setTextColor(colors.primary);
    doc.text(data.recipient.label, margin, currentY);
    
    doc.setFont(fonts.bodyFont, 'normal');
    doc.setFontSize(fonts.bodySize);
    doc.setTextColor(colors.text);
    const recipientY = currentY + 5;
    doc.text(data.recipient.name, margin, recipientY);
    const recipientAddrLines = doc.splitTextToSize(data.recipient.address || '', colWidth - 5);
    doc.text(recipientAddrLines, margin, recipientY + 5);
    
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
    doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`, rightColX, recipientY + 5, { align: 'right' });

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
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
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

    // --- 5. TERMS & FOOTER ---
    if (pageHeight - finalY < 40) {
        doc.addPage();
        finalY = margin;
    } else {
        finalY += 10;
    }

    if (content.showTerms && content.termsText) {
        doc.setFontSize(fonts.bodySize);
        doc.setFont(fonts.bodyFont, 'bold');
        doc.setTextColor(colors.text);
        doc.text("Terms & Conditions:", margin, finalY);
        finalY += 5;
        
        doc.setFont(fonts.bodyFont, 'normal');
        doc.setTextColor(colors.secondary);
        const termsLines = doc.splitTextToSize(content.termsText, pageWidth - (margin * 2));
        doc.text(termsLines, margin, finalY);
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
    templateConfig: InvoiceTemplateConfig
): Promise<jsPDF> => {
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;
    const dueColor = dueAmount > 0.01 ? '#dc2626' : '#16a34a';

    const data: GenericDocumentData = {
        id: sale.id,
        date: sale.date,
        recipient: {
            label: 'Billed To:',
            name: customer.name,
            address: customer.address
        },
        sender: {
            label: 'Invoice Details:',
            idLabel: 'Invoice No:'
        },
        items: sale.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            rate: Number(item.price),
            amount: Number(item.quantity) * Number(item.price)
        })),
        totals: [
            { label: 'Subtotal:', value: `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Discount:', value: `- Rs. ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'GST Included:', value: `Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Grand Total:', value: `Rs. ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 },
            { label: 'Paid:', value: `Rs. ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Amount Due:', value: `Rs. ${dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: dueColor, size: templateConfig.fonts.bodySize + 2 }
        ]
    };

    return _generateConfigurablePDF(data, profile, templateConfig);
};

export const generateEstimatePDF = async (
    quote: Quote, 
    customer: Customer, 
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig
): Promise<jsPDF> => {
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
            idLabel: 'Estimate No:'
        },
        items: quote.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            rate: Number(item.price),
            amount: Number(item.quantity) * Number(item.price)
        })),
        totals: [
            { label: 'Subtotal:', value: `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Discount:', value: `- Rs. ${Number(quote.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'GST Included:', value: `Rs. ${Number(quote.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
            { label: 'Total Amount:', value: `Rs. ${Number(quote.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, isBold: true, color: templateConfig.colors.primary, size: templateConfig.fonts.bodySize + 2 },
        ],
        watermarkText: 'ESTIMATE'
    };

    return _generateConfigurablePDF(data, profile, templateConfig);
};

export const generateDebitNotePDF = async (
    returnData: Return, 
    supplier: Supplier | undefined, 
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig
): Promise<jsPDF> => {
    
    const data: GenericDocumentData = {
        id: returnData.id,
        date: returnData.returnDate,
        recipient: {
            label: 'To Supplier:',
            name: supplier?.name || 'Unknown Supplier',
            address: supplier?.location || ''
        },
        sender: {
            label: 'Reference Details:',
            idLabel: 'Debit Note #:'
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

    return _generateConfigurablePDF(data, profile, templateConfig);
};
