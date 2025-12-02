
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Sale, Customer, ProfileData, InvoiceTemplateConfig, CustomFont, Quote, Return, Supplier } from '../types';
import { logoBase64 } from './logo';

// --- Constants & Helpers ---

const defaultLabels: any = {
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

const registerCustomFonts = (doc: jsPDF, fonts: CustomFont[]) => {
    fonts.forEach(font => {
        try {
            const fontData = font.data.split(',')[1] || font.data;
            doc.addFileToVFS(`${font.name}.ttf`, fontData);
            doc.addFont(`${font.name}.ttf`, font.name, 'normal');
            doc.addFont(`${font.name}.ttf`, font.name, 'bold');
        } catch(e) {
            console.warn(`Failed to register font ${font.name}`, e);
        }
    });
};

const getImageType = (dataUrl: string): string => {
    if (dataUrl.startsWith('data:image/png')) return 'PNG';
    if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG';
    if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
    return 'JPEG';
};

const formatDate = (dateStr: string, format: string = 'DD/MM/YYYY'): string => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
    if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
};

const formatCurrency = (amount: number, symbol: string = 'Rs.', fontName: string = 'helvetica'): string => {
    const standardFonts = ['helvetica', 'times', 'courier'];
    let displaySymbol = symbol;
    if (symbol === '₹' && standardFonts.includes(fontName.toLowerCase())) {
        displaySymbol = 'Rs.';
    }
    return `${displaySymbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

const getQrCodeBase64 = async (data: string): Promise<string> => {
    try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=200x200&margin=0`;
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        return '';
    }
};

const numberToWords = (n: number): string => {
    const num = Math.round(n);
    if (num === 0) return "Zero";
    
    const a = ['','One ','Two ','Three ','Four ','Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
    const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

    const inWords = (num: number): string => {
        if ((num = num.toString() as any).length > 9) return 'overflow';
        const n: any = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return ""; 
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str;
    };
    return inWords(num).trim() + " Only";
};

// --- Thermal Receipt Generator (80mm Standard) ---
export const generateThermalInvoicePDF = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig?: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const currency = templateConfig?.currencySymbol || 'Rs.';
    const labels = { ...defaultLabels, ...templateConfig?.content.labels };
    const spacing = templateConfig?.layout.elementSpacing || { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 };
    
    const widthFull = 80; 
    const margin = templateConfig?.layout.margin ?? 3; // Use config margin or default 3
    const pageWidth = widthFull - (margin * 2);
    const centerX = widthFull / 2;

    let qrCodeBase64: string | null = null;
    const showQr = templateConfig?.content.showQr ?? true;
    const showWords = templateConfig?.content.showAmountInWords ?? true;
    
    // Theme configs
    const primaryColor = templateConfig?.colors.primary || '#0d9488';
    const textColor = templateConfig?.colors.text || '#000000';
    const titleFont = templateConfig?.fonts.titleFont || 'helvetica';
    const bodyFont = templateConfig?.fonts.bodyFont || 'helvetica';
    
    // Layout Options
    const hideQty = templateConfig?.layout.tableOptions?.hideQty || false;
    const hideRate = templateConfig?.layout.tableOptions?.hideRate || false;
    const headerAlign = templateConfig?.layout.headerAlignment || 'center';
    
    // Absolute Positioning
    const logoPos = templateConfig?.layout.logoPosition || 'center';
    const isAbsoluteLogo = templateConfig?.layout.logoPosX !== undefined && templateConfig?.layout.logoPosY !== undefined;
    const logoPosX = templateConfig?.layout.logoPosX ?? margin;
    const logoPosY = templateConfig?.layout.logoPosY ?? 5;

    if (showQr) {
         qrCodeBase64 = await getQrCodeBase64(sale.id);
    }

    const renderContent = (doc: jsPDF) => {
        let y = 8;
        if (customFonts) registerCustomFonts(doc, customFonts);

        // 1. Logo
        if (profile?.logo) {
            try {
                const logoSize = templateConfig?.layout.logoSize ? templateConfig.layout.logoSize : 18;
                let x = (widthFull - logoSize) / 2;
                let ly = y;

                if (isAbsoluteLogo) {
                    x = logoPosX;
                    ly = logoPosY;
                } else {
                    if (logoPos === 'left') x = margin;
                    if (logoPos === 'right') x = widthFull - margin - logoSize;
                }
                
                doc.addImage(profile.logo, getImageType(profile.logo), x, ly, logoSize, logoSize);
                
                if (!isAbsoluteLogo) {
                    y += logoSize + (spacing.logoBottom ?? 4);
                }
            } catch(e) { }
        }

        // 2. Header
        doc.setFont(titleFont, 'bold');
        doc.setFontSize(14);
        doc.setTextColor(primaryColor);
        
        let alignX = centerX;
        if (headerAlign === 'left') alignX = margin;
        if (headerAlign === 'right') alignX = widthFull - margin;
        
        doc.text(profile?.name || 'Business Name', alignX, y, { align: headerAlign });
        y += (6 + (spacing.titleBottom ?? 0));

        doc.setTextColor(textColor);
        doc.setFont(bodyFont, 'normal');
        doc.setFontSize(9);

        // 3. Meta & QR
        const startMetaY = y;
        const qrSize = 18;
        
        doc.text(`${labels.invoiceNo}: ${sale.id}`, margin, y);
        y += 4;
        doc.text(`${labels.date}: ${formatDate(sale.date, templateConfig?.dateFormat)}`, margin, y);
        y += 4;

        if (qrCodeBase64) {
            try {
                doc.addImage(qrCodeBase64, 'PNG', widthFull - margin - qrSize, startMetaY - 2, qrSize, qrSize);
            } catch(e) {}
        }
        
        y = Math.max(y, startMetaY + qrSize - 2) + 4;

        // 4. Billed To
        doc.setFont(bodyFont, 'bold');
        doc.text(labels.billedTo, margin, y);
        y += 4;
        doc.setFont(bodyFont, 'normal');
        doc.text(customer.name, margin, y);
        y += 4;
        
        const addressLines = doc.splitTextToSize(customer.address, pageWidth);
        doc.text(addressLines, margin, y);
        y += (addressLines.length * 4) + 2;

        // 5. Purchase Details Divider
        doc.setLineWidth(0.3);
        doc.setDrawColor(textColor);
        doc.line(margin, y, widthFull - margin, y);
        y += 5;
        doc.setFont(bodyFont, 'bold');
        doc.setFontSize(10);
        // Using "Item" label or generic
        doc.text('Purchase Details', centerX, y, { align: 'center' });
        y += 2;
        doc.line(margin, y, widthFull - margin, y);
        y += 5;

        // 6. Items
        doc.setFont(bodyFont, 'normal');
        sale.items.forEach(item => {
            const itemTotal = Number(item.price) * Number(item.quantity);
            
            doc.setFontSize(9);
            doc.setTextColor(textColor);
            doc.setFont(bodyFont, 'bold');
            
            const totalStr = formatCurrency(itemTotal, currency, bodyFont);
            const totalWidth = doc.getTextWidth(totalStr) + 2;
            const nameWidth = pageWidth - totalWidth - 2;
            
            const nameLines = doc.splitTextToSize(item.productName, nameWidth);
            doc.text(nameLines, margin, y);
            
            doc.text(totalStr, widthFull - margin, y, { align: 'right' });
            
            y += (nameLines.length * 4);
            
            // Sub-details line (Qty/Rate) if not hidden
            let detailsText = '';
            if (!hideQty && !hideRate) {
                detailsText = `(x${item.quantity} @ ${formatCurrency(Number(item.price), currency, bodyFont)})`;
            } else if (!hideQty) {
                detailsText = `(${labels.qty}: ${item.quantity})`;
            } else if (!hideRate) {
                detailsText = `(@ ${formatCurrency(Number(item.price), currency, bodyFont)})`;
            }

            if (detailsText) {
                doc.setFontSize(8);
                doc.setTextColor('#555555');
                doc.setFont(bodyFont, 'normal');
                doc.text(detailsText, margin + 2, y); 
                y += 5;
            } else {
                y += 2; 
            }
        });
        
        doc.setTextColor(textColor);
        doc.setLineWidth(0.2);
        doc.line(margin, y, widthFull - margin, y);
        y += 5;

        // 7. Totals
        const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const due = Number(sale.totalAmount) - paid;

        const addTotalRow = (label: string, value: string, bold: boolean = false, fontSize: number = 9) => {
            doc.setFont(bodyFont, bold ? 'bold' : 'normal');
            doc.setFontSize(fontSize);
            doc.text(label, widthFull - margin - 25, y, { align: 'right' }); 
            doc.text(value, widthFull - margin, y, { align: 'right' });
            y += 5;
        };

        if (sale.discount > 0 || sale.gstAmount > 0) {
            addTotalRow(labels.subtotal, formatCurrency(subTotal, currency, bodyFont));
            if (templateConfig?.content.showGst !== false && sale.gstAmount > 0) {
                addTotalRow(labels.gst, formatCurrency(Number(sale.gstAmount), currency, bodyFont));
            }
            if (sale.discount > 0) addTotalRow(labels.discount, `-${formatCurrency(Number(sale.discount), currency, bodyFont)}`);
            y += 1;
        }
        
        addTotalRow(labels.grandTotal, formatCurrency(Number(sale.totalAmount), currency, bodyFont), true, 11);
        if (paid > 0) addTotalRow(labels.paid, formatCurrency(paid, currency, bodyFont));
        if (due > 0.01) {
            addTotalRow(labels.balance, formatCurrency(due, currency, bodyFont), true, 10);
        } else {
            addTotalRow(labels.balance, `${currency} 0.00`, true, 10);
        }

        // Amount In Words
        if (showWords) {
            y += 3;
            doc.setFont(bodyFont, 'italic');
            doc.setFontSize(8);
            doc.setTextColor('#333333');
            const words = numberToWords(Number(sale.totalAmount));
            const wordLines = doc.splitTextToSize(words, pageWidth);
            doc.text(wordLines, widthFull - margin, y, { align: 'right' });
            y += (wordLines.length * 3.5) + 3;
            doc.setTextColor(textColor);
        }

        // 8. Footer
        y += 2;
        doc.setFont(bodyFont, 'italic');
        doc.setFontSize(8);
        const footerText = templateConfig?.content.footerText || 'Thank You!';
        const footerLines = doc.splitTextToSize(footerText, pageWidth);
        doc.text(footerLines, centerX, y, { align: 'center' });
        y += (footerLines.length * 4);
        
        return y + 5;
    };

    const dummyDoc = new jsPDF({ orientation: 'p', unit: 'mm', format: [widthFull, 1000] });
    const height = renderContent(dummyDoc);

    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: [widthFull, height] });
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

const _generateConfigurablePDF = async (
    data: GenericDocumentData,
    profile: ProfileData | null,
    templateConfig: InvoiceTemplateConfig,
    customFonts?: CustomFont[],
    customPaperSize?: [number, number]
): Promise<jsPDF> => {
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

    const addY = (amount: number) => {
        currentY += amount * spacingScale;
    };

    if (layout.backgroundImage) {
        try {
            doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight);
        } catch(e) {}
    }

    const renderHeader = async () => {
        if (content.showBusinessDetails === false) { addY(5); return; }

        const isBanner = layout.headerStyle === 'banner';
        if (isBanner) {
            doc.setFillColor(colors.bannerBg || colors.primary);
            doc.roundedRect(0, 0, pageWidth, 40 + (layout.logoSize/2), layout.borderRadius || 0, layout.borderRadius || 0, 'F');
            addY(5);
        }

        const logoUrl = profile?.logo || logoBase64;
        const isAbsoluteLogo = layout.logoPosX !== undefined && layout.logoPosY !== undefined;
        const hasLogo = !!logoUrl && layout.logoSize > 5;
        
        let textY = currentY;
        let textAlign: 'left' | 'center' | 'right' = 'left';
        let renderedLogoHeight = 0;
        let textX = margin;
        let logoX = margin;
        let logoY = currentY + (layout.logoOffsetY || 0);

        if (isAbsoluteLogo) {
             logoX = layout.logoPosX!;
             logoY = layout.logoPosY!;
        }

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

        if (!isAbsoluteLogo) {
            if (layout.logoPosition === 'center') {
                logoX = (pageWidth - layout.logoSize) / 2;
                if (hasLogo) textY = logoY + renderedLogoHeight + (logoBottomSpace * spacingScale);
                textAlign = 'center';
                textX = pageWidth / 2;
            } else if (layout.logoPosition === 'right') {
                logoX = pageWidth - margin - layout.logoSize;
                textAlign = 'left';
                textX = margin;
                textY += 5 * spacingScale;
            } else { 
                logoX = margin;
                textAlign = 'right';
                textX = pageWidth - margin;
                textY += 5 * spacingScale;
            }
        } else {
            if (layout.headerAlignment === 'center') { textAlign = 'center'; textX = pageWidth / 2; } 
            else if (layout.headerAlignment === 'right') { textAlign = 'right'; textX = pageWidth - margin; } 
            else { textAlign = 'left'; textX = margin; }
        }

        if (hasLogo) {
            try { doc.addImage(logoUrl, getImageType(logoUrl), logoX, logoY, layout.logoSize, renderedLogoHeight); } catch(e) {}
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
            const logoEnd = (hasLogo && !isAbsoluteLogo) ? logoY + renderedLogoHeight + 5 : 0;
            currentY = Math.max(contentEnd, logoEnd);
        } else { if (!isAbsoluteLogo) addY(20); }

        if (!isBanner && layout.headerStyle !== 'minimal') {
            doc.setDrawColor(colors.borderColor || '#ccc');
            doc.line(margin, currentY, pageWidth - margin, currentY);
            addY(headerBottomSpace);
        }
        
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
        if (content.showCustomerDetails === false) return;
        const lineHeight = 5 * spacingScale;
        const colWidth = (pageWidth - (margin * 3)) / 2;
        const rightColX = pageWidth - margin;

        doc.setFont(fonts.bodyFont, 'bold');
        doc.setFontSize(11);
        doc.setTextColor(colors.primary);
        doc.text(data.recipient.label, margin, currentY);
        doc.text(data.sender.label, rightColX, currentY, { align: 'right' });

        doc.setFont(fonts.bodyFont, 'normal');
        doc.setFontSize(fonts.bodySize);
        doc.setTextColor(colors.text);

        doc.text(data.recipient.name, margin, currentY + lineHeight + 1);
        const recipientAddr = doc.splitTextToSize(data.recipient.address, colWidth);
        doc.text(recipientAddr, margin, currentY + (lineHeight * 2) + 1);

        let infoY = currentY + lineHeight + 1;
        doc.text(`${data.sender.idLabel} ${data.id}`, rightColX, infoY, { align: 'right' });
        infoY += lineHeight;
        doc.text(`${labels.date}: ${formatDate(data.date, templateConfig.dateFormat)}`, rightColX, infoY, { align: 'right' });

        if (content.showQr && (!layout.qrPosition || layout.qrPosition === 'details-right') && layout.qrPosX === undefined) {
            const qrImg = await getQrCodeBase64(data.qrString || data.id);
            if (qrImg) {
                try {
                    const size = layout.qrOverlaySize || 22;
                    doc.addImage(qrImg, 'PNG', rightColX - size, infoY + 2, size, size);
                } catch(e) {}
            }
        }
        currentY = Math.max(currentY + (lineHeight * 2) + (recipientAddr.length * lineHeight), currentY + (lineHeight * 4)) + (5 * spacingScale);
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
        const tableStyles: any = { font: fonts.bodyFont, fontSize: fonts.bodySize, cellPadding: layout.tableOptions?.compact ? 2 : 3, textColor: colors.text };
        if (layout.tableOptions?.bordered) { tableStyles.lineWidth = 0.1; tableStyles.lineColor = colors.borderColor || '#ccc'; }

        autoTable(doc, {
            startY: currentY,
            head: [tableHead],
            body: tableBody,
            theme: layout.tableOptions?.stripedRows ? 'striped' : 'plain',
            styles: tableStyles,
            headStyles: { fillColor: colors.tableHeaderBg, textColor: colors.tableHeaderText, fontStyle: 'bold', halign: (layout.tableHeaderAlign || 'left'), ...(layout.borderRadius ? { minCellHeight: 8 } : {}) },
            columnStyles: {
                0: { cellWidth: 10, halign: 'center' },
                [tableHead.length - 1]: { halign: 'right', cellWidth: (cw.amount || 35) }, 
                [tableHead.length - 2]: { halign: 'right', cellWidth: hideRate ? (cw.qty || 15) : (cw.rate || 20) }, 
                [tableHead.length - 3]: { halign: 'right', cellWidth: cw.qty || 15 }, 
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).lastAutoTable.finalY + (5 * spacingScale);
    };

    const renderTotals = () => {
        const totalsX = pageWidth - margin;
        if (pageHeight - currentY < 60) { doc.addPage(); currentY = margin; if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }
        
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
        const shouldShow = content.showAmountInWords !== false;
        if (shouldShow && data.grandTotalNumeric !== undefined) {
            if (pageHeight - currentY < 20) { doc.addPage(); currentY = margin; if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }
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
            if (pageHeight - currentY < 30) { doc.addPage(); currentY = margin; if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }
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
            if (pageHeight - currentY < 30) { doc.addPage(); currentY = margin; if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }
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
            if (pageHeight - sigY < 30) { doc.addPage(); if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }
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
        if (currentY > footerY) { doc.addPage(); if (layout.backgroundImage) try { doc.addImage(layout.backgroundImage, getImageType(layout.backgroundImage), 0, 0, pageWidth, pageHeight); } catch(e) {} }

        if (content.showQr && (layout.qrPosition === 'footer-left' || layout.qrPosition === 'footer-right') && layout.qrPosX === undefined) {
            const qrImg = await getQrCodeBase64(data.qrString || data.id);
            if (qrImg) {
                const qrSize = layout.qrOverlaySize || 18;
                const qrY = footerY - qrSize - 2;
                const qrX = layout.qrPosition === 'footer-left' ? margin : pageWidth - margin - qrSize;
                try { doc.addImage(qrImg, 'PNG', qrX, qrY, qrSize, qrSize); } catch(e) {}
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

    if (content.showQr && layout.qrPosX !== undefined && layout.qrPosY !== undefined) {
        const qrImg = await getQrCodeBase64(data.qrString || data.id);
        if (qrImg) {
            try {
                doc.setPage(1); 
                const size = layout.qrOverlaySize || 20; 
                doc.addImage(qrImg, 'PNG', layout.qrPosX, layout.qrPosY, size, size);
            } catch(e) {}
        }
    }

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

export const generateA4InvoicePdf = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig?: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    const defaultConfig: InvoiceTemplateConfig = {
        id: 'default', currencySymbol: 'Rs.', dateFormat: 'DD/MM/YYYY',
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', bannerBg: '#0d9488', bannerText: '#ffffff', footerBg: '#f3f4f6', footerText: '#374151', borderColor: '#e5e7eb', alternateRowBg: '#f9fafb' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1, qrPosition: 'details-right', tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false }, elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 } },
        content: { titleText: 'TAX INVOICE', labels: defaultLabels, showQr: true, showTerms: true, showSignature: true, termsText: '', footerText: '', showBusinessDetails: true, showCustomerDetails: true, signatureText: '', showAmountInWords: true, showStatusStamp: false, showTaxBreakdown: false, showGst: true, qrType: 'INVOICE_ID', bankDetails: '' }
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

export const generateReceiptPDF = async (sale: Sale, customer: Customer, profile: ProfileData | null, templateConfig: InvoiceTemplateConfig, customFonts?: CustomFont[]) => {
    return generateThermalInvoicePDF(sale, customer, profile, templateConfig, customFonts);
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
                finalWidth = pageWidth - margin * 2;
                finalHeight = finalWidth / imgRatio;
            } else {
                finalHeight = pageHeight - margin * 2;
                finalWidth = finalHeight * imgRatio;
            }

            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

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
