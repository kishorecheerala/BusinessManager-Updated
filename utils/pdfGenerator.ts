import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return } from '../types';

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

// --- Helper: Add Header (Common for A4/Debit Note) ---
const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = 10;

    // 1. SACRED TEXT
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
    
    // Separator Line
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

    // 1. Sacred Text
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, y, { align: 'center' });
    y += 6;

    // 2. Business Name (Teal, Times Bold)
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 128, 128); // Teal color #008080
    doc.text(profile?.name || 'Business Name', centerX, y, { align: 'center' });
    y += 7;

    doc.setTextColor('#000000');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    // 3. Invoice Details & QR Code
    const qrSize = 20;
    const qrX = pageWidth - margin - qrSize;
    const startHeaderY = y;

    // Left side: Invoice No & Date
    doc.setFontSize(8);
    doc.text(`Invoice: ${sale.id}`, margin, y);
    y += 4;
    
    // Format date as DD/MM/YYYY, HH:mm:ss
    const d = new Date(sale.date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}, ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    doc.text(`Date: ${dateStr}`, margin, y);
    y += 4;

    // Right side: QR Code
    const qrBase64 = await getQrCodeBase64(sale.id);
    if (qrBase64) {
        doc.addImage(qrBase64, 'PNG', qrX, startHeaderY, qrSize, qrSize);
    }

    // Adjust Y to be below QR code or text, whichever is lower, but typically text is on left and QR on right
    // We need some space before "Billed To"
    y = Math.max(y + 2, startHeaderY + qrSize + 2);

    // 4. Billed To
    doc.setFont('helvetica', 'bold');
    doc.text('Billed To:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(customer.name, margin, y);
    y += 4;
    const addressLines = doc.splitTextToSize(customer.address, pageWidth - (margin * 2));
    doc.text(addressLines, margin, y);
    y += (addressLines.length * 4) + 2;

    // 5. Purchase Details Header
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.text('Purchase Details', centerX, y, { align: 'center' });
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 6. Table Headers
    doc.text('Item', margin, y);
    doc.text('Total', pageWidth - margin, y, { align: 'right' });
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 7. Items
    doc.setFont('helvetica', 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        
        // Item Name
        doc.setTextColor('#000000');
        doc.setFontSize(9);
        const nameLines = doc.splitTextToSize(item.productName, 50); 
        doc.text(nameLines, margin, y);
        
        // Total (aligned with first line of name)
        doc.text(`Rs. ${itemTotal.toLocaleString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
        
        y += (nameLines.length * 4);
        
        // Qty @ Rate
        doc.setTextColor('#555555');
        doc.setFontSize(8);
        doc.text(`(x${item.quantity} @ Rs. ${Number(item.price).toLocaleString('en-IN')})`, margin, y);
        y += 5;
    });

    // 8. Separator
    y += 2;
    doc.setDrawColor(200); // Light grey
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 9. Totals
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    const addTotalRow = (label: string, value: string, isBold = false, fontSize = 9) => {
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);
        doc.setTextColor('#000000');
        doc.text(label, pageWidth - 35, y, { align: 'right' });
        doc.text(value, pageWidth - margin, y, { align: 'right' });
        y += 5;
    };

    addTotalRow('Subtotal', `Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('GST', `Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    addTotalRow('Discount', `Rs. ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    y += 1;
    // Grand Total in Bold
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', pageWidth - 35, y, { align: 'right' });
    doc.text(`Rs. ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, pageWidth - margin, y, { align: 'right' });
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    addTotalRow('Paid', `Rs. ${paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    
    doc.setFont('helvetica', 'bold');
    addTotalRow('Due', `Rs. ${dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);

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
