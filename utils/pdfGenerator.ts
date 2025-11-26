
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return, Quote } from '../types';
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

// --- Helper: Add Header (Common for A4/Debit Note/Reports) ---
export const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null, title?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = 10;

    // Add Logo if available
    const logoToUse = profile?.logo || logoBase64;
    if (logoToUse) {
        try {
            const format = getImageType(logoToUse);
            doc.addImage(logoToUse, format, 14, 10, 25, 25);
        } catch (e) {
            console.warn("Failed to add logo to PDF. Skipping image.", e);
        }
    }

    // 1. SACRED TEXT (Centered)
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, currentY, { align: 'center' });
    currentY += 6;

    // 2. BUSINESS DETAILS
    if (profile) {
        doc.setFont('times', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 128, 128); // Teal Color #008080
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
    } else {
        doc.setFontSize(22);
        doc.setTextColor(0, 128, 128);
        doc.text("Business Manager", centerX, currentY, { align: 'center' });
        currentY += 8;
    }
    
    // Optional Title (Used for Reports)
    if (title) {
        currentY += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor('#000000');
        doc.text(title.toUpperCase(), centerX, currentY, { align: 'center' });
        currentY += 2;
    }
    
    // Separator Line
    currentY = Math.max(currentY, 40); // Ensure we clear the logo
    currentY += 2;
    doc.setDrawColor('#cccccc');
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    
    return currentY + 5; 
};

// --- Thermal Receipt Generator (80mm) ---
export const generateThermalInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    // Estimate height dynamically: Base ~150mm + items
    const estimatedHeight = 200 + (sale.items.length * 15);
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight]
    });

    const pageWidth = 80;
    const margin = 3;
    const centerX = pageWidth / 2;
    let y = 8;

    // 0. LOGO (Small centered logo for thermal)
    const logoToUse = profile?.logo || logoBase64;
    if (logoToUse) {
        try {
            const format = getImageType(logoToUse);
            // 15mm size logo centered
            doc.addImage(logoToUse, format, centerX - 7.5, y, 15, 15);
            y += 18;
        } catch (e) {
            // Ignore logo error
        }
    }

    // 1. Sacred Text
    doc.setFont('times', 'italic');
    doc.setFontSize(9);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, y, { align: 'center' });
    y += 5;

    // 2. Business Name (Teal, Times Bold)
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 128, 128); // Teal color #008080
    // Split long business names
    const busName = doc.splitTextToSize(profile?.name || 'Business Name', pageWidth - 10);
    doc.text(busName, centerX, y, { align: 'center' });
    y += (busName.length * 5) + 2;

    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // 3. Invoice Details & QR Code
    const qrSize = 20;
    const qrX = pageWidth - margin - qrSize;
    const startHeaderY = y;

    // Left side: Invoice No & Date
    doc.setFontSize(8);
    doc.text(`Inv: ${sale.id}`, margin, y);
    y += 4;
    
    // Format date as DD/MM/YYYY, HH:mm
    const d = new Date(sale.date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    doc.text(`${dateStr}`, margin, y);
    y += 4;

    // Right side: QR Code
    try {
        const qrBase64 = await getQrCodeBase64(sale.id);
        if (qrBase64) {
            doc.addImage(qrBase64, 'PNG', qrX, startHeaderY, qrSize, qrSize);
        }
    } catch (e) {
        // Ignore QR error
    }

    // Adjust Y to be below QR code or text, whichever is lower
    y = Math.max(y + 2, startHeaderY + qrSize + 2);

    // 4. Billed To
    doc.setFont('helvetica', 'bold');
    doc.text('To:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, margin + 7, y);
    y += 4;
    
    if (customer.phone) {
        doc.text(`Ph: ${customer.phone}`, margin, y);
        y += 4;
    }

    // 5. Purchase Details Header
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    
    // 6. Table Headers
    doc.setFont('helvetica', 'bold');
    doc.text('Item', margin, y);
    doc.text('Amt', pageWidth - margin, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // 7. Items
    doc.setFont('helvetica', 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        
        // Item Name
        doc.setTextColor('#000000');
        doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(item.productName, 55); 
        doc.text(nameLines, margin, y);
        
        // Total (aligned with first line of name)
        doc.text(`${itemTotal.toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
        
        y += (nameLines.length * 4);
        
        // Qty @ Rate
        doc.setTextColor('#555555');
        doc.setFontSize(8);
        doc.text(`${item.quantity} x ${Number(item.price).toLocaleString('en-IN')}`, margin, y);
        y += 4;
    });

    // 8. Separator
    y += 1;
    doc.setDrawColor(200); // Light grey
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    // 9. Totals
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
    // Grand Total in Bold
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

    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor('#555555');
    doc.text("Thank You! Visit Again.", centerX, y, { align: 'center' });

    return doc;
};

// --- A4 Invoice Generator ---
export const generateA4InvoicePdf = async (sale: Sale, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#000000');
    doc.text('TAX INVOICE', 105, startY, { align: 'center' });
    startY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', 14, startY);
    doc.text('Invoice Details:', 120, startY);
    startY += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, 14, startY);
    doc.text(`Invoice No: ${sale.id}`, 120, startY);
    startY += 5;

    const customerAddr = doc.splitTextToSize(customer.address || '', 80);
    doc.text(customerAddr, 14, startY);
    doc.text(`Date: ${new Date(sale.date).toLocaleString()}`, 120, startY);
    
    startY += Math.max((customerAddr.length * 5), 10) + 5;

    autoTable(doc, {
        startY: startY,
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: sale.items.map((item, index) => [
            index + 1,
            item.productName,
            item.quantity,
            `Rs. ${Number(item.price).toLocaleString('en-IN')}`,
            `Rs. ${(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128] }, // Teal
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    const totalsX = 196;
    const labelX = totalsX - 40;
    
    const addTotalRow = (label: string, value: string, isBold: boolean = false, color: string = '#000000') => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color);
        doc.text(label, labelX, finalY, { align: 'right' });
        doc.text(value, totalsX, finalY, { align: 'right' });
        finalY += 6;
    };

    addTotalRow('Subtotal:', `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('Discount:', `- Rs. ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('GST Included:', `Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    finalY += 2;
    addTotalRow('Grand Total:', `Rs. ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true);
    addTotalRow('Paid:', `Rs. ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    const dueColor = dueAmount > 0.01 ? '#dc2626' : '#16a34a';
    doc.setFontSize(12);
    addTotalRow('Amount Due:', `Rs. ${dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true, dueColor);

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor('#888888');
    doc.text('Thank you for your business!', 105, pageHeight - 10, { align: 'center' });

    return doc;
};

// --- Estimate/Quotation Generator ---
export const generateEstimatePDF = async (quote: Quote, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#000000');
    doc.text('ESTIMATE / QUOTATION', 105, startY, { align: 'center' });
    startY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Estimate For:', 14, startY);
    doc.text('Estimate Details:', 120, startY);
    startY += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, 14, startY);
    doc.text(`Estimate No: ${quote.id}`, 120, startY);
    startY += 5;

    const customerAddr = doc.splitTextToSize(customer.address || '', 80);
    doc.text(customerAddr, 14, startY);
    doc.text(`Date: ${new Date(quote.date).toLocaleDateString()}`, 120, startY);
    
    if (quote.validUntil) {
        startY += 5;
        doc.text(`Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`, 120, startY);
        startY -= 5; // correct for next calc
    }
    
    startY += Math.max((customerAddr.length * 5), 10) + 5;

    autoTable(doc, {
        startY: startY,
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: quote.items.map((item, index) => [
            index + 1,
            item.productName,
            item.quantity,
            `Rs. ${Number(item.price).toLocaleString('en-IN')}`,
            `Rs. ${(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [100, 116, 139] }, // Slate/Grey for Estimate
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    const subTotal = quote.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

    const totalsX = 196;
    const labelX = totalsX - 40;
    
    const addTotalRow = (label: string, value: string, isBold: boolean = false, color: string = '#000000') => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color);
        doc.text(label, labelX, finalY, { align: 'right' });
        doc.text(value, totalsX, finalY, { align: 'right' });
        finalY += 6;
    };

    addTotalRow('Subtotal:', `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('Discount:', `- Rs. ${Number(quote.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('GST Included:', `Rs. ${Number(quote.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    finalY += 2;
    addTotalRow('Total Estimate:', `Rs. ${Number(quote.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, true);
    
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor('#888888');
    doc.text('This is an estimate only, not a valid invoice for tax purposes.', 105, pageHeight - 10, { align: 'center' });

    return doc;
};

// --- Debit Note Generator ---
export const generateDebitNotePDF = async (returnData: Return, supplier: Supplier | undefined, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#000000');
    doc.text('DEBIT NOTE', 105, startY, { align: 'center' });
    startY += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('To Supplier:', 14, startY);
    doc.text('Reference Details:', 120, startY);
    startY += 5;

    doc.setFont('helvetica', 'normal');
    doc.text(supplier?.name || 'Unknown Supplier', 14, startY);
    doc.text(`Debit Note #: ${returnData.id}`, 120, startY);
    startY += 5;

    const suppAddr = doc.splitTextToSize(supplier?.location || '', 80);
    doc.text(suppAddr, 14, startY);
    doc.text(`Date: ${new Date(returnData.returnDate).toLocaleDateString()}`, 120, startY);
    startY += 5;
    doc.text(`Original Inv #: ${returnData.referenceId}`, 120, startY);
    
    startY += Math.max((suppAddr.length * 5), 10) + 5;

    autoTable(doc, {
        startY: startY,
        head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
        body: returnData.items.map((item, index) => [
            index + 1,
            item.productName,
            item.quantity,
            `Rs. ${Number(item.price).toLocaleString('en-IN')}`,
            `Rs. ${(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}`
        ]),
        theme: 'grid',
        headStyles: { fillColor: [0, 128, 128] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Debit Value: Rs. ${Number(returnData.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });

    if (returnData.notes) {
        finalY += 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', 14, finalY);
        finalY += 5;
        doc.setFont('helvetica', 'normal');
        const notes = doc.splitTextToSize(returnData.notes, 180);
        doc.text(notes, 14, finalY);
    }

    return doc;
};
