
import React, { useState } from 'react';
import { X } from 'lucide-react';
import Card from './Card';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const helpContent = {
  en: {
    title: 'Help & Documentation',
    sections: [
      {
        title: 'Dashboard',
        content: (
          <div className="space-y-2">
            <p>The dashboard provides a quick overview of your business metrics like sales, dues, and low stock items.</p>
            <h4 className="font-semibold mt-2">Smart Analyst (AI)</h4>
            <p className="text-sm">The top card on the dashboard uses basic AI rules to help you:</p>
            <ul className="list-disc list-inside pl-4 text-sm">
                <li><strong>Revenue Projection:</strong> Predicts where your sales will land by the end of the month.</li>
                <li><strong>Stock Alerts:</strong> Warns you about items selling too fast or sitting on the shelf for too long (Dead Stock).</li>
                <li><strong>Cash Flow:</strong> Monitors if you are spending more on purchases than you are earning from sales.</li>
            </ul>
            <h4 className="font-semibold mt-2">Data Backup & Restore</h4>
            <ol className="list-decimal list-inside pl-4 text-sm">
              <li>Regularly click <strong>"Backup Data Now"</strong> to download a file containing all your app data.</li>
              <li>Store this file in a safe place (like Google Drive, your computer, or a pen drive).</li>
              <li>To restore data on this or another device, click <strong>"Restore from Backup"</strong> and select your saved backup file.</li>
            </ol>
            <p className="font-bold text-red-600 mt-2">Important: All data is saved only on your device. Always backup your data to prevent loss!</p>
          </div>
        )
      },
      {
        title: 'Business Insights & Security',
        content: (
          <div className="space-y-2 text-sm">
            <p>The Insights page offers deeper analytics. It is protected by a <strong>4-digit PIN</strong> to keep your financial data private.</p>
            <ul className="list-disc list-inside pl-4">
                <li><strong>Strategic Insights:</strong> AI analysis of your peak trading days, customer retention rates, and bundle opportunities.</li>
                <li><strong>Risk Analysis:</strong> Shows a breakdown of your customer base by credit risk (High, Medium, Low).</li>
                <li><strong>Visual Charts:</strong> View trends for sales vs. profit, category distribution, and daily activity.</li>
            </ul>
          </div>
        )
      },
      {
        title: 'Customers & Risk Badges',
        content: (
          <div className="space-y-2 text-sm">
            <ol className="list-decimal list-inside pl-4">
                <li>Click <strong>"Add Customer"</strong> to open the form and enter details. Customer ID must be unique.</li>
                <li><strong>Risk Badges:</strong> You will see a colored badge next to each customer name:
                    <ul className="list-disc list-inside pl-6 mt-1">
                        <li><span className="text-red-600 font-bold">High Risk:</span> They owe more than 50% of their purchase value and the amount is significant. Caution advised.</li>
                        <li><span className="text-amber-600 font-bold">Medium Risk:</span> They have moderate pending dues.</li>
                        <li><span className="text-emerald-600 font-bold">Good Standing:</span> They pay on time and have low dues.</li>
                    </ul>
                </li>
                <li>Click on any customer to view their full history and record payments.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'Sales',
        content: (
          <div className="space-y-2 text-sm">
            <p>This page is for creating new sales or recording payments from customers for their past dues.</p>
            <h4 className="font-semibold mt-2">Creating a New Sale:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>Select a customer from the dropdown. You can also add a new customer from here.</li>
              <li>Add products to the cart using <strong>"Select Product"</strong> or by scanning a QR code with <strong>"Scan Product"</strong>.</li>
              <li>Enter any discount and the amount the customer is paying now.</li>
              <li>Click <strong>"Create Sale & Share Invoice"</strong> to finish. This will generate a PDF and open your phone's share menu.</li>
            </ol>
            <h4 className="font-semibold mt-2">Recording a Payment for Dues:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>Select the customer.</li>
              <li>Do NOT add any items to the cart.</li>
              <li>Enter the amount they are paying in the "Amount Paid" field.</li>
              <li>Click <strong>"Record Standalone Payment"</strong>. The app will automatically apply the payment to their oldest dues first.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'Purchases & Suppliers',
        content: (
          <div className="space-y-2 text-sm">
            <p>Manage your suppliers and record new stock purchases.</p>
            <ol className="list-decimal list-inside pl-4">
              <li>First, add your suppliers using the <strong>"Add New Supplier"</strong> button.</li>
              <li>To record a new purchase, click <strong>"Create New Purchase"</strong>.</li>
              <li>Select the supplier and add the items you purchased. You can add a completely new product to your inventory or select an existing one to add stock.</li>
              <li>Enter the total amount and any payment made to the supplier.</li>
              <li>Click <strong>"Complete Purchase"</strong> to update your stock levels.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'Products',
        content: (
          <div className="space-y-2 text-sm">
             <p>View all your products and their current stock levels.</p>
             <ol className="list-decimal list-inside pl-4">
                <li>Click on a product to see more details like its purchase price and sale price.</li>
                <li>Use the <strong>"Stock Adjustment"</strong> feature to manually correct the stock count if you find a mismatch during a physical stock check. This is for corrections only and does not create a financial record.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'Returns',
        content: (
          <div className="space-y-2 text-sm">
             <p>Process returns from customers or returns you make to a supplier.</p>
             <h4 className="font-semibold mt-2">Customer Return:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>Go to the "Customer Return" tab.</li>
              <li>Select the customer and the original sales invoice.</li>
              <li>Enter the quantity of the items being returned.</li>
              <li>Enter the refund amount. The stock will be automatically added back to your inventory, and a credit will be applied to the customer's account for that sale.</li>
            </ol>
             <h4 className="font-semibold mt-2">Return to Supplier:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>Go to the "Return to Supplier" tab.</li>
              <li>Select the supplier and the original purchase invoice.</li>
              <li>Enter the quantity of items being returned.</li>
              <li>Enter the credit note value. This will generate a <strong>Debit Note PDF</strong>.</li>
              <li>The stock will be automatically deducted from your inventory, and a credit will be applied to your account for that purchase.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'Reports',
        content: (
          <div className="space-y-2 text-sm">
             <p>Generate a report of all customers who have outstanding dues.</p>
            <ol className="list-decimal list-inside pl-4">
              <li>Use the filters to select a specific area or a date range for sales.</li>
              <li>The table will show all customers with dues based on your filters.</li>
              <li>You can export this list as a <strong>PDF</strong> or <strong>CSV</strong> file for printing or sharing.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'Universal Search',
        content: (
          <div className="space-y-2 text-sm">
             <p>The search button in the top header allows you to find anything in the app quickly.</p>
            <ol className="list-decimal list-inside pl-4">
                <li>Tap the <strong>Search</strong> icon.</li>
                <li>Type a customer name, product name, invoice ID, etc.</li>
                <li>Tap on a result to navigate directly to that page.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'My Business Profile',
        content: (
          <div className="space-y-2 text-sm">
            <p>Set up your business details to be used on official documents.</p>
            <ol className="list-decimal list-inside pl-4">
                <li>Click the <strong>Menu</strong> icon (three horizontal lines) in the top-left corner.</li>
                <li>Select "My Business Profile".</li>
                <li>Fill in your business name, address, phone, and GST number.</li>
                <li>This information will automatically appear on documents like the <strong>Debit Note</strong> you generate when returning items to a supplier.</li>
            </ol>
          </div>
        )
      },
    ]
  },
  te: {
    title: 'సహాయం & డాక్యుమెంటేషన్',
    sections: [
      {
        title: 'డాష్‌బోర్డ్',
        content: (
          <div className="space-y-2">
            <p>డాష్‌బోర్డ్ మీ వ్యాపారం యొక్క అమ్మకాలు, బకాయిలు మరియు తక్కువ స్టాక్ ఉన్న వస్తువుల వంటి వాటి శీఘ్ర అవలోకనాన్ని అందిస్తుంది.</p>
             <h4 className="font-semibold mt-2">స్మార్ట్ అనలిస్ట్ (AI)</h4>
            <p className="text-sm">AI ఉపయోగించి మీ ఆదాయాన్ని అంచనా వేయడం మరియు స్టాక్ హెచ్చరికలను ఇవ్వడం దీని పని.</p>
            <h4 className="font-semibold mt-2">డేటా బ్యాకప్ & పునరుద్ధరణ</h4>
            <ol className="list-decimal list-inside pl-4 text-sm">
              <li>మీ యాప్ డేటా మొత్తాన్ని ఒక ఫైల్‌లో డౌన్‌లోడ్ చేయడానికి <strong>"Backup Data Now"</strong> పై క్లిక్ చేయండి.</li>
              <li>ఈ ఫైల్‌ను సురక్షితమైన స్థలంలో (Google Drive, మీ కంప్యూటర్, లేదా పెన్ డ్రైవ్ వంటివి) నిల్వ చేయండి.</li>
              <li>ఈ లేదా మరొక పరికరంలో డేటాను పునరుద్ధరించడానికి, <strong>"Restore from Backup"</strong> పై క్లిక్ చేసి, మీరు సేవ్ చేసిన బ్యాకప్ ఫైల్‌ను ఎంచుకోండి.</li>
            </ol>
            <p className="font-bold text-red-600 mt-2">ముఖ్యమైనది: మొత్తం డేటా మీ పరికరంలో మాత్రమే సేవ్ చేయబడుతుంది. నష్టాన్ని నివారించడానికి మీ డేటాను ఎల్లప్పుడూ బ్యాకప్ చేయండి!</p>
          </div>
        )
      },
      {
        title: 'వ్యాపార అంతర్దృష్టులు (Insights)',
        content: (
          <div className="space-y-2 text-sm">
            <p>ఈ పేజీని చూడటానికి 4-అంకెల <strong>PIN</strong> అవసరం.</p>
            <ul className="list-disc list-inside pl-4">
                <li><strong>వ్యూహాత్మక అంతర్దృష్టులు:</strong> మీ వ్యాపారం ఏ రోజుల్లో ఎక్కువగా జరుగుతుందో మరియు కస్టమర్ల విధేయతను విశ్లేషిస్తుంది.</li>
                <li><strong>ప్రమాద విశ్లేషణ (Risk Analysis):</strong> ఏ కస్టమర్లు ఎక్కువ బకాయిలు కలిగి ఉన్నారో (High Risk) మీకు చూపుతుంది.</li>
            </ul>
          </div>
        )
      },
      {
        title: 'కస్టమర్లు & రిస్క్ బ్యాడ్జ్‌లు',
        content: (
          <div className="space-y-2 text-sm">
            <ol className="list-decimal list-inside pl-4">
                <li>ఫారమ్‌ను తెరిచి వివరాలను నమోదు చేయడానికి <strong>"Add Customer"</strong> పై క్లిక్ చేయండి. కస్టమర్ ID ప్రత్యేకంగా ఉండాలి.</li>
                <li><strong>రిస్క్ బ్యాడ్జ్‌లు:</strong> కస్టమర్ పేరు పక్కన రంగు బ్యాడ్జ్ కనిపిస్తుంది:
                     <ul className="list-disc list-inside pl-6 mt-1">
                        <li><span className="text-red-600 font-bold">High Risk:</span> ఎక్కువ బకాయిలు ఉన్నాయి.</li>
                        <li><span className="text-emerald-600 font-bold">Good Standing:</span> సకాలంలో చెల్లిస్తారు.</li>
                    </ul>
                </li>
                <li>జాబితాలోని ఏ కస్టమర్‌పైనైనా వారి వివరణాత్మక అమ్మకాల చరిత్ర మరియు వ్యక్తిగత సమాచారాన్ని చూడటానికి క్లిక్ చేయండి.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'అమ్మకాలు (Sales)',
        content: (
          <div className="space-y-2 text-sm">
            <p>ఈ పేజీ కొత్త అమ్మకాలను సృష్టించడానికి లేదా కస్టమర్ల నుండి వారి పాత బకాయిల కోసం చెల్లింపులను రికార్డ్ చేయడానికి.</p>
            <h4 className="font-semibold mt-2">కొత్త అమ్మకాన్ని సృష్టించడం:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>డ్రాప్‌డౌన్ నుండి ఒక కస్టమర్‌ను ఎంచుకోండి. మీరు ఇక్కడ నుండి కొత్త కస్టమర్‌ను కూడా జోడించవచ్చు.</li>
              <li><strong>"Select Product"</strong> ఉపయోగించి లేదా <strong>"Scan Product"</strong> తో QR కోడ్‌ను స్కాన్ చేయడం ద్వారా కార్ట్‌కు ఉత్పత్తులను జోడించండి.</li>
              <li>ఏదైనా తగ్గింపు మరియు కస్టమర్ ఇప్పుడు చెల్లిస్తున్న మొత్తాన్ని నమోదు చేయండి.</li>
              <li>పూర్తి చేయడానికి <strong>"Create Sale & Share Invoice"</strong> పై క్లిక్ చేయండి. ఇది ఒక PDF ను రూపొందించి, మీ ఫోన్ యొక్క షేర్ మెనూను తెరుస్తుంది.</li>
            </ol>
            <h4 className="font-semibold mt-2">బకాయిల కోసం చెల్లింపును రికార్డ్ చేయడం:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>కస్టమర్‌ను ఎంచుకోండి.</li>
              <li>కార్ట్‌కు ఏ వస్తువులనూ జోడించవద్దు.</li>
              <li>వారు చెల్లిస్తున్న మొత్తాన్ని "Amount Paid" ఫీల్డ్‌లో నమోదు చేయండి.</li>
              <li><strong>"Record Standalone Payment"</strong> పై క్లిక్ చేయండి. యాప్ స్వయంచాలకంగా చెల్లింపును వారి పాత బకాయిలకు ముందుగా వర్తింపజేస్తుంది.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'కొనుగోళ్లు (Purchases) & సరఫరాదారులు',
        content: (
          <div className="space-y-2 text-sm">
            <p>మీ సరఫరాదారులను నిర్వహించండి మరియు కొత్త స్టాక్ కొనుగోళ్లను రికార్డ్ చేయండి.</p>
            <ol className="list-decimal list-inside pl-4">
              <li>మొదట, <strong>"Add New Supplier"</strong> బటన్‌ను ఉపయోగించి మీ సరఫరాదారులను జోడించండి.</li>
              <li>కొత్త కొనుగోలును రికార్డ్ చేయడానికి, <strong>"Create New Purchase"</strong> పై క్లిక్ చేయండి.</li>
              <li>సరఫరాదారుని ఎంచుకుని, మీరు కొనుగోలు చేసిన వస్తువులను జోడించండి. మీరు మీ ఇన్వెంటరీకి పూర్తిగా కొత్త ఉత్పత్తిని జోడించవచ్చు లేదా స్టాక్‌ను జోడించడానికి ఉన్నదాన్ని ఎంచుకోవచ్చు.</li>
              <li>మొత్తం మొత్తం మరియు సరఫరాదారునికి చేసిన ఏదైనా చెల్లింపును నమోదు చేయండి.</li>
              <li>మీ స్టాక్ స్థాయిలను నవీకరించడానికి <strong>"Complete Purchase"</strong> పై క్లిక్ చేయండి.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'ఉత్పత్తులు (Products)',
        content: (
          <div className="space-y-2 text-sm">
             <p>మీ అన్ని ఉత్పత్తులను మరియు వాటి ప్రస్తుత స్టాక్ స్థాయిలను వీక్షించండి.</p>
             <ol className="list-decimal list-inside pl-4">
                <li>ఒక ఉత్పత్తిపై క్లిక్ చేసి దాని కొనుగోలు ధర మరియు అమ్మకపు ధర వంటి మరిన్ని వివరాలను చూడండి.</li>
                <li>భౌతిక స్టాక్ తనిఖీ సమయంలో మీకు సరిపోలనిది కనిపిస్తే, స్టాక్ గణనను మాన్యువల్‌గా సరిచేయడానికి <strong>"Stock Adjustment"</strong> ఫీచర్‌ను ఉపయోగించండి. ఇది సవరణల కోసం మాత్రమే మరియు ఆర్థిక రికార్డును సృష్టించదు.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'వాపసులు (Returns)',
        content: (
          <div className="space-y-2 text-sm">
             <p>కస్టమర్ల నుండి వాపసులను లేదా మీరు సరఫరాదారునికి చేసే వాపసులను ప్రాసెస్ చేయండి.</p>
             <h4 className="font-semibold mt-2">కస్టమర్ వాపసు:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>"Customer Return" ట్యాబ్‌కు వెళ్లండి.</li>
              <li>కస్టమర్‌ను మరియు అసలు అమ్మకాల ఇన్‌వాయిస్‌ను ఎంచుకోండి.</li>
              <li>వాపసు చేయబడుతున్న వస్తువుల పరిమాణాన్ని నమోదు చేయండి.</li>
              <li>తిరిగి చెల్లించే మొత్తాన్ని నమోదు చేయండి. స్టాక్ స్వయంచాలకంగా మీ ఇన్వెంటరీకి తిరిగి జోడించబడుతుంది మరియు ఆ అమ్మకం కోసం కస్టమర్ ఖాతాకు క్రెడిట్ వర్తింపజేయబడుతుంది.</li>
            </ol>
            <h4 className="font-semibold mt-2">సరఫరాదారునికి వాపసు:</h4>
            <ol className="list-decimal list-inside pl-4">
              <li>"Return to Supplier" ట్యాబ్‌కు వెళ్లండి.</li>
              <li>సరఫరాదారుని మరియు అసలు కొనుగోలు ఇన్‌వాయిస్‌ను ఎంచుకోండి.</li>
              <li>వాపసు చేయబడుతున్న వస్తువుల పరిమాణాన్ని నమోదు చేయండి.</li>
              <li>క్రెడిట్ నోట్ విలువను నమోదు చేయండి. ఇది ఒక <strong>డెబిట్ నోట్ PDF</strong>ని రూపొందిస్తుంది.</li>
              <li>స్టాక్ స్వయంచాలకంగా మీ ఇన్వెంటరీ నుండి తీసివేయబడుతుంది మరియు ఆ కొనుగోలు కోసం మీ ఖాతాకు క్రెడిట్ వర్తింపజేయబడుతుంది.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'నివేదికలు (Reports)',
        content: (
          <div className="space-y-2 text-sm">
             <p>బకాయిలు ఉన్న కస్టమర్లందరి నివేదికను రూపొందించండి.</p>
            <ol className="list-decimal list-inside pl-4">
              <li>నిర్దిష్ట ప్రాంతాన్ని లేదా అమ్మకాల కోసం తేదీ పరిధిని ఎంచుకోవడానికి ఫిల్టర్‌లను ఉపయోగించండి.</li>
              <li>పట్టిక మీ ఫిల్టర్‌ల ఆధారంగా బకాయిలు ఉన్న కస్టమర్లందరినీ చూపుతుంది.</li>
              <li>మీరు ఈ జాబితాను ప్రింటింగ్ లేదా షేరింగ్ కోసం <strong>PDF</strong> లేదా <strong>CSV</strong> ఫైల్‌గా ఎగుమతి చేయవచ్చు.</li>
            </ol>
          </div>
        )
      },
       {
        title: 'యూనివర్సల్ సెర్చ్',
        content: (
          <div className="space-y-2 text-sm">
             <p>ఎగువ హెడర్‌లోని సెర్చ్ బటన్ యాప్‌లో ఏదైనా త్వరగా కనుగొనడానికి మిమ్మల్ని అనుమతిస్తుంది.</p>
            <ol className="list-decimal list-inside pl-4">
                <li><strong>సెర్చ్</strong> ఐకాన్‌పై నొక్కండి.</li>
                <li>కస్టమర్ పేరు, ఉత్పత్తి పేరు, ఇన్‌వాయిస్ ID మొదలైనవి టైప్ చేయండి.</li>
                <li>ఆ పేజీకి నేరుగా నావిగేట్ చేయడానికి ఫలితంపై నొక్కండి.</li>
            </ol>
          </div>
        )
      },
      {
        title: 'నా వ్యాపార ప్రొఫైల్',
        content: (
          <div className="space-y-2 text-sm">
            <p>అధికారిక పత్రాలలో ఉపయోగించడానికి మీ వ్యాపార వివరాలను సెటప్ చేయండి.</p>
            <ol className="list-decimal list-inside pl-4">
                <li>ఎగువ-ఎడమ మూలలో ఉన్న <strong>మెనూ</strong> ఐకాన్ (మూడు అడ్డ గీతలు) పై క్లిక్ చేయండి.</li>
                <li>"My Business Profile" ఎంచుకోండి.</li>
                <li>మీ వ్యాపారం పేరు, చిరునామా, ఫోన్ మరియు GST నంబర్‌ను పూరించండి.</li>
                <li>ఈ సమాచారం మీరు సరఫరాదారునికి వస్తువులను వాపసు చేసేటప్పుడు రూపొందించే <strong>డెబిట్ నోట్</strong> వంటి పత్రాలపై స్వయంచాలకంగా కనిపిస్తుంది.</li>
            </ol>
          </div>
        )
      },
    ]
  }
};


const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [language, setLanguage] = useState<'en' | 'te'>('en');

  if (!isOpen) return null;

  const content = helpContent[language];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast" 
      aria-modal="true" 
      role="dialog"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <Card className="w-full flex-shrink-0 animate-scale-in">
           <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold text-primary">{content.title}</h2>
              <div className="mt-2">
                <button 
                  onClick={() => setLanguage('en')}
                  className={`px-3 py-1 text-sm rounded-l-md ${language === 'en' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700'}`}
                >
                  English
                </button>
                <button 
                  onClick={() => setLanguage('te')}
                  className={`px-3 py-1 text-sm rounded-r-md ${language === 'te' ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-slate-700'}`}
                >
                  తెలుగు
                </button>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <X size={24} />
            </button>
          </div>
        </Card>
        <div className="overflow-y-auto mt-2 pr-2">
            <div className="space-y-4">
              {content.sections.map((section, index) => (
                <Card key={index} title={section.title} className="animate-slide-up-fade" style={{ animationDelay: `${index * 50}ms` }}>
                  <div className="dark:text-slate-300">{section.content}</div>
                </Card>
              ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;