# Saree Business Manager

A comprehensive, offline-first Progressive Web App (PWA) designed to streamline sales, purchase, and customer management for a small saree business. This application empowers users to track dues, manage stock, and generate reports directly from their device, without needing a constant internet connection.

## ✨ Key Features

- **📊 Dashboard:** Get an at-a-glance overview of total sales, purchases, outstanding customer dues, and purchase dues. Now features a **Smart Analyst AI** that predicts revenue, monitors cash flow, and alerts you about dead stock.
- **🧠 AI-Powered Insights:** Deep dive into your business health with actionable intelligence. Features include:
    - **Revenue Prediction:** Forecasts month-end numbers based on current velocity.
    - **Strategic Alerts:** Identifies peak trading days, bundle opportunities, and churn risks.
    - **Visual Charts:** Interactive graphs for weekly trends, customer retention, and category performance.
- **🪄 Magic Paste (AI):** Instantly convert text orders (from WhatsApp/SMS) into structured Sales or Purchase items using AI processing.
- **🎨 Invoice Designer:** Design professional invoices with a real-time visual editor. Customize layouts, colors, fonts, and content to match your brand. Supports:
    - **Absolute Positioning:** Fine-tune logo and QR code placement.
    - **Dual Formats:** A4 and Thermal Receipt formats with live preview.
    - **Custom Fonts:** Upload your own TTF/OTF fonts.
- **🚀 System Optimizer:** A dedicated tool to maintain app performance.
    - **Image Compression:** Automatically compresses large product images to save storage.
    - **Performance Mode:** Reduces visual effects for low-end devices.
    - **Database Maintenance:** Cleans up old logs and notifications.
- **👥 Customer Management:** Maintain a detailed directory of customers, view their complete sales history, risk status (High/Medium/Safe), and manage their due payments.
- **🛒 Sales Management:** Create new sales invoices, add products by searching or scanning QR codes, apply discounts, and record payments.
- **📱 Mobile Optimized (PWA):** Enhanced mobile experience with native-like features:
    - **Geolocation:** 1-tap address autofill using GPS.
    - **UPI Integration:** Deep linking for instant payments via GPay/PhonePe.
    - **Offline AI:** Core analytics and insights work even without internet.
- **📈 Enterprise Reporting Suite:** A powerful business intelligence tool featuring:
    - **Drag-and-Drop Builder:** Create custom reports in seconds.
    - **50+ Templates:** Pre-built reports for Sales, Inventory, and Finance.
    - **Advanced Charts:** Funnel, Treemap, and Forecast visualizations.
    - **Export:** Download reports as PDF or CSV.
- **📦 Purchase & Supplier Management:** Track purchases from suppliers, manage supplier information, and record payments made to them.
- **👔 Product & Inventory Control:** Manage a complete product catalog of sarees. Stock is automatically updated with every sale, purchase, and return. Includes bulk barcode printing.
- **🔄 Returns Processing:** Handle both customer returns (crediting their account and adding stock back) and returns to suppliers (reducing stock and creating a credit).
- **📉 Standard Reports:** Quick access to existing CSV/PDF reports for Dues and Low Stock.
- **🔒 Data Backup & Restore:** Since all data is stored locally on the device, a robust backup (download JSON) and restore (upload JSON) system ensures data safety. Also supports **Google Drive Sync** for cloud backups.
- **⚙️ Customization:** Fully customizable UI themes (Colors, Gradients), Button Styles, and Navigation Menu ordering.
- **🌐 Offline First (PWA):** Built as a Progressive Web App, it can be "installed" on a device's home screen and works seamlessly offline.

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context API with `useReducer` for centralized logic.
- **Local Storage:** Browser `localStorage` & `IndexedDB` for robust data persistence.
- **PWA Capabilities:** Service Workers (`sw.js`) for caching and offline access.
- **Icons:** [Lucide React](https://lucide.dev/) for consistent UI.
- **PDF Generation:** [jsPDF](https://github.com/parallax/jsPDF) & [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable).
- **AI Integration:** Google Gemini API for insights and text parsing.

## 📁 Project Structure

The project is organized into a modular and scalable structure:

```
/
├── components/         # Reusable UI components (Card, Button, Charts)
├── context/            # Global state management (AppContext.tsx)
├── pages/              # Main feature pages (Dashboard, Sales, Invoice Designer, etc.)
├── utils/              # Helper functions (PDF generation, Drive Sync, Analytics)
├── App.tsx             # Main app component with navigation logic
├── index.tsx           # Application entry point
├── types.ts            # Centralized TypeScript type definitions
├── index.html          # Main HTML entry file
└── manifest.json       # PWA manifest
```

## 🚀 Core Functionality Deep Dive

### Data Persistence
The application uses a "Local First" architecture. Critical data (Sales, Products) is stored in **IndexedDB** for high capacity, while settings use **LocalStorage**. This ensures instant load times and full offline capability.

### Cloud Sync
Users can sign in with Google to sync their database to a private folder (`BusinessManager_AppData`) in their Google Drive. The sync uses a robust **"Last Write Wins"** strategy with timestamp-based conflict resolution to ensure data consistency across multiple devices.

### AI Features
- **Smart Analyst:** Analyzes transaction history to provide executive summaries.
- **Magic Paste:** Uses LLMs to parse unstructured text into structured order data.
- **Risk Profiling:** Heuristic analysis of customer payment patterns.

### Security
- **PIN Protection:** Sensitive analytics and developer tools can be locked behind a 4-digit PIN.
- **Local Data:** Data never leaves the device unless the user explicitly initiates a Cloud Backup or Export.
