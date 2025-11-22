
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, Purchase, Supplier, Return } from '../types';
import { logoBase64 } from './logo';

const addBusinessHeader = (doc: jsPDF, profile: ProfileData | null) => {
    let currentY = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // Try adding logo, fallback gracefully if it fails
    try {
        doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25);
    } catch (err) {
        console.warn("Logo add failed", err);
    }

    if (profile) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor('#0d9488'); // Primary Color
        doc.text(profile.name, centerX, currentY, { align: 'center' });
        currentY += 7;
        
        doc.setFontSize(10);
        doc.setTextColor('#333333');
        doc.setFont('helvetica', 'normal');
        const addressLines = doc.splitTextToSize(profile.address, 120);
        doc.text(addressLines, centerX, currentY, { align: 'center' });
        currentY += (addressLines.length * 5);
        
        if (profile.phone) {
            doc.text(`Phone: ${profile.phone} | GSTIN: ${profile.gstNumber || 'N/A'}`, centerX, currentY, { align: 'center' });
        }
    } else {
        doc.setFontSize(22);
        doc.setTextColor('#0d9488');
        doc.text("Business Manager", centerX, currentY, { align: 'center' });
    }
    
    // Return Y position below the header + some padding (min 40 to clear logo)
    return Math.max(currentY + 10, 40); 
};

export const generateInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile);

    doc.setDrawColor('#cccccc');
    doc.line(14, startY, 196, startY);
    startY += 10;

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

export const generateDebitNotePDF = async (returnData: Return, supplier: Supplier | undefined, profile: ProfileData | null): Promise<jsPDF> => {
    const doc = new jsPDF();
    let startY = addBusinessHeader(doc, profile);

    doc.setDrawColor('#cccccc');
    doc.line(14, startY, 196, startY);
    startY += 10;

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
