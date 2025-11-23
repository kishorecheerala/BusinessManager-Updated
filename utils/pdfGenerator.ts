import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return } from '../types';
import { logoBase64 } from './logo';

// --- Helper: Add Header ---
const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null, isThermal: boolean = false) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    let currentY = isThermal ? 5 : 10; // Tighter top margin for thermal

    // 1. SACRED TEXT
    doc.setFont('times', 'italic');
    doc.setFontSize(isThermal ? 9 : 10);
    doc.setTextColor('#000000');
    doc.text('Om Namo Venkatesaya', centerX, currentY, { align: 'center' });
    currentY += isThermal ? 4 : 6;

    // 2. LOGO (Optional)
    const logoSize = isThermal ? 15 : 20;
    try {
        if (logoBase64 && logoBase64.startsWith('data:image')) {
             // For thermal, we might center the logo or put it to the left depending on space.
             // Centering it looks better on receipts.
             const logoX = isThermal ? (pageWidth - logoSize) / 2 : 14;
             const logoY = currentY;
             doc.addImage(logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
             currentY += logoSize + (isThermal ? 2 : 5);
        }
    } catch (err) {
        console.warn("Logo add failed, skipping logo.", err);
    }

    // 3. BUSINESS DETAILS
    if (profile) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isThermal ? 14 : 20);
        doc.setTextColor('#0d9488'); // Primary Color
        doc.text(profile.name, centerX, currentY, { align: 'center' });
        currentY += isThermal ? 5 : 7;
        
        doc.setFontSize(isThermal ? 8 : 10);
        doc.setTextColor('#333333');
        doc.setFont('helvetica', 'normal');
        
        // Safe address split
        const address = profile.address || '';
        // Tighter width for thermal
        const maxAddrWidth = isThermal ? pageWidth - 4 : 120; 
        const addressLines = doc.splitTextToSize(address, maxAddrWidth);
        doc.text(addressLines, centerX, currentY, { align: 'center' });
        currentY += (addressLines.length * (isThermal ? 3.5 : 5));
        
        const details = [];
        if (profile.phone) details.push(isThermal ? `Ph: ${profile.phone}` : `Phone: ${profile.phone}`);
        if (profile.gstNumber) details.push(isThermal ? `GST: ${profile.gstNumber}` : `GSTIN: ${profile.gstNumber}`);
        
        if (details.length > 0) {
            if (isThermal) {
                // Stack details on thermal if too long
                details.forEach(d => {
                    doc.text(d, centerX, currentY, { align: 'center' });
                    currentY += 3.5;
                });
            } else {
                doc.text(details.join(' | '), centerX, currentY, { align: 'center' });
            }
        }
    } else {
        doc.setFontSize(isThermal ? 16 : 22);
        doc.setTextColor('#0d9488');
        doc.text("Business Manager", centerX, currentY, { align: 'center' });
        currentY += 8;
    }
    
    // Separator Line
    currentY += 2;
    doc.setDrawColor('#cccccc');
    doc.setLineWidth(0.5);
    doc.line(isThermal ? 2 : 14, currentY, pageWidth - (isThermal ? 2 : 14), currentY);
    
    return currentY + (isThermal ? 3 : 5); 
};

// --- A4 Invoice Generator ---
export const generateInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile, false);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#000000');
    doc.text('TAX INVOICE', 105, startY, { align: 'center' });
    startY += 10;

    // Invoice & Customer Details
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

    // Items Table
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
        headStyles: { fillColor: [13, 148, 136] }, // Primary color
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: { 
            0: { cellWidth: 10 },
            2: { halign: 'right', cellWidth: 20 }, 
            3: { halign: 'right', cellWidth: 30 }, 
            4: { halign: 'right', cellWidth: 35 } 
        }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    // Calculations
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    // Totals Section (Right aligned)
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

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(9);
    doc.setTextColor('#888888');
    doc.text('Thank you for your business!', 105, pageHeight - 10, { align: 'center' });

    return doc;
};

// --- Thermal Receipt Generator (80mm) ---
export const generateThermalInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    // 80mm width, variable height (initially set high, will assume auto-paging or single long page concept)
    // For standard thermal printers, height is continuous. We emulate this by making a long page or multi-page.
    // jsPDF needs a fixed height. We'll estimate.
    const estimatedHeight = 150 + (sale.items.length * 10); 
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight] 
    });

    const pageWidth = 80;
    const margin = 3;
    const contentWidth = pageWidth - (margin * 2);
    const centerX = pageWidth / 2;

    let currentY = addBusinessHeader(doc, profile, true);

    // Receipt Meta
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor('#000000');
    
    const dateStr = new Date(sale.date).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    
    doc.text(`Inv: ${sale.id}`, margin, currentY);
    doc.text(dateStr, pageWidth - margin, currentY, { align: 'right' });
    currentY += 4;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`To: ${customer.name}`, margin, currentY);
    currentY += 4;
    
    // Divider
    doc.setDrawColor('#000000');
    doc.setLineDash([1, 1], 0);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 4;

    // Items Header
    doc.setFontSize(8);
    doc.text('Item', margin, currentY);
    doc.text('Qty', pageWidth - 25, currentY, { align: 'right' });
    doc.text('Amt', pageWidth - margin, currentY, { align: 'right' });
    currentY += 2;
    
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 4;

    // Items List
    doc.setFont('helvetica', 'normal');
    sale.items.forEach(item => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        
        // Item Name (Wrap if needed)
        const nameLines = doc.splitTextToSize(item.productName, 40);
        doc.text(nameLines, margin, currentY);
        
        // Qty
        doc.text(item.quantity.toString(), pageWidth - 25, currentY, { align: 'right' });
        
        // Amount
        doc.text(itemTotal.toLocaleString('en-IN'), pageWidth - margin, currentY, { align: 'right' });
        
        currentY += (nameLines.length * 3.5);
        
        // Price detail (small)
        doc.setFontSize(7);
        doc.setTextColor('#555555');
        doc.text(`@ ${Number(item.price).toLocaleString()}`, margin + 2, currentY - 0.5);
        doc.setFontSize(8);
        doc.setTextColor('#000000');
        
        currentY += 3;
    });

    // Divider
    currentY += 1;
    doc.setLineDash([], 0); // Solid
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 4;

    // Totals
    const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const paidAmount = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - paidAmount;

    const addReceiptRow = (label: string, value: string, bold: boolean = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(bold ? 9 : 8);
        doc.text(label, pageWidth - 30, currentY, { align: 'right' });
        doc.text(value, pageWidth - margin, currentY, { align: 'right' });
        currentY += 4;
    };

    addReceiptRow('Subtotal:', subTotal.toLocaleString('en-IN'));
    if (Number(sale.discount) > 0) addReceiptRow('Discount:', `-${Number(sale.discount).toLocaleString('en-IN')}`);
    
    currentY += 1;
    doc.setFontSize(10);
    addReceiptRow('Total:', `Rs.${Number(sale.totalAmount).toLocaleString('en-IN')}`, true);
    
    currentY += 1;
    doc.setFontSize(8);
    addReceiptRow('Paid:', paidAmount.toLocaleString('en-IN'));
    
    if (dueAmount > 0) {
        doc.setTextColor('#dc2626');
        addReceiptRow('Due:', dueAmount.toLocaleString('en-IN'), true);
        doc.setTextColor('#000000');
    }

    // Footer
    currentY += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Thank you! Visit Again.', centerX, currentY, { align: 'center' });

    return doc;
};

// --- Debit Note Generator ---
export const generateDebitNotePDF = async (returnData: Return, supplier: Supplier | undefined, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile, false);

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
        headStyles: { fillColor: [13, 148, 136] },
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