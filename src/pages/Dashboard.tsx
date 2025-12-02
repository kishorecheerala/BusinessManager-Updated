    const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const processRestore = async () => {
            const confirmed = await showConfirm("Restoring will OVERWRITE all current data. Are you sure you want to restore from this backup?", {
                title: "Restore Backup",
                confirmText: "Yes, Restore",
                variant: "danger"
            });
            
            if (confirmed) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await db.importData(data);
                    window.location.reload();
                } catch (err) {
                    showAlert("Failed to restore backup. The file might be invalid or corrupted.");
                }
            }
        };

        runSecureAction(processRestore);
        e.target.value = ''; 
    };

    const handleLoadTestData = async () => {
        const confirmed = await showConfirm("This will OVERWRITE your current data with sample test data. Proceed?", {
          title: "Load Test Data",
          confirmText: "Overwrite",
          variant: "danger"
        });
    
        if (confirmed) {
          try {
            await db.importData(testData as any);
            await db.saveCollection('profile', [testProfile]);
            window.location.reload();
          } catch (error) {
            console.error("Failed to load test data:", error);
            showToast("Failed to load test data.", 'info');
          }
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <CheckpointsModal isOpen={isCheckpointsModalOpen} onClose={() => setIsCheckpointsModalOpen(false)} />
            
            {isPinModalOpen && (
                <PinModal
                    mode="enter"
                    correctPin={state.pin}
                    onCorrectPin={handlePinSuccess}
                    onCancel={() => {
                        setIsPinModalOpen(false);
                        setPendingAction(null);
                    }}
                />
            )}
            
            {/* Header Section */}
            <div className="flex flex-row items-center justify-between gap-2 relative mb-6">
                <div className="flex-shrink-0">
                     <span className="text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-sm cursor-default flex flex-col items-start gap-0.5 max-w-full">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{getTimeBasedGreeting()},</span>
                        <strong className="truncate max-w-[120px] sm:max-w-[150px] text-sm">{profile?.ownerName || 'Owner'}</strong>
                    </span>
                </div>

                <div className="flex-grow text-center">
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-primary tracking-tight drop-shadow-sm truncate">
                        Dashboard
                    </h1>
                </div>
                
                <div className="flex-shrink-0">
                    <DatePill />
                </div>
            </div>

            {/* Install Prompt Banner */}
            {(isInstallable || (isIOS && !isInstalled)) && (
                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-down-fade mb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Download size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base">Install App for Offline Use</h3>
                            <p className="text-xs opacity-90">Get the best experience with full screen & faster loading.</p>
                        </div>
                    </div>
                    {isIOS ? (
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                            <p className="text-xs font-bold text-white">Tap <Share size={12} className="inline mx-1"/> then "Add to Home Screen"</p>
                        </div>
                    ) : (
                        <button onClick={install} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-gray-100 transition-colors whitespace-nowrap w-full sm:w-auto">
                            Install Now
                        </button>
                    )}
                </div>
            )}
            
            <SmartAnalystCard 
                sales={sales} 
                products={products} 
                customers={customers} 
                purchases={purchases} 
                returns={returns} 
                expenses={expenses}
                ownerName={profile?.ownerName || 'Owner'}
            />
            
            {/* Toolbar for Period Selectors */}
            <div className="flex justify-end items-center mb-1">
                 <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                     <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                    >
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                    >
                        {getYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={IndianRupee} title="Sales" value={stats.monthSalesTotal} subValue={`${stats.salesCount} orders`} color="bg-primary/5 dark:bg-primary/10" iconBgColor="bg-primary/20" textColor="text-primary" onClick={() => setCurrentPage('SALES')} delay={0} />
                <MetricCard icon={Package} title="Purchases" value={stats.monthPurchasesTotal} subValue="Inventory cost" color="bg-blue-50 dark:bg-blue-900/20" iconBgColor="bg-blue-100 dark:bg-blue-800" textColor="text-blue-700 dark:text-blue-100" onClick={() => setCurrentPage('PURCHASES')} delay={100} />
                <MetricCard icon={User} title="Cust. Dues" value={stats.totalCustomerDues} subValue="Total Receivable" color="bg-purple-50 dark:bg-purple-900/20" iconBgColor="bg-purple-100 dark:bg-purple-800" textColor="text-purple-700 dark:text-purple-100" onClick={() => setCurrentPage('CUSTOMERS')} delay={200} />
                <MetricCard icon={ShoppingCart} title="My Payables" value={stats.totalSupplierDues} subValue="Total Payable" color="bg-amber-50 dark:bg-amber-900/20" iconBgColor="bg-amber-100 dark:bg-amber-800" textColor="text-amber-700 dark:text-amber-100" onClick={() => setCurrentPage('PURCHASES')} delay={300} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OverdueDuesCard sales={sales} customers={customers} onNavigate={(id) => handleNavigate('CUSTOMERS', id)} />
                <UpcomingPurchaseDuesCard purchases={purchases} suppliers={suppliers} onNavigate={(id) => handleNavigate('PURCHASES', id)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <LowStockCard products={products} onNavigate={(id) => handleNavigate('PRODUCTS', id)} />
                 <div className="space-y-6">
                    <Card title="Data Management">
                        <BackupStatusAlert lastBackupDate={lastBackupDate} lastSyncTime={state.lastSyncTime} />
                        <div className="space-y-4 mt-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Your data is stored locally. Please create regular backups.
                            </p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button onClick={handleBackup} className="w-full" disabled={isGeneratingReport}>
                                    <Download className="w-4 h-4 mr-2" /> {isGeneratingReport ? 'Preparing...' : 'Backup Data Now'}
                                </Button>
                                <label htmlFor="restore-backup" className="px-4 py-2 rounded-md font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm flex items-center justify-center gap-2 bg-secondary hover:bg-teal-500 focus:ring-secondary cursor-pointer w-full text-center dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                                    <Upload className="w-4 h-4 mr-2" /> Restore from Backup
                                </label>
                                <input 
                                    id="restore-backup" 
                                    type="file" 
                                    accept="application/json" 
                                    className="hidden" 
                                    onChange={handleFileRestore} 
                                />
                                <Button onClick={() => runSecureAction(handleLoadTestData)} variant="secondary" className="w-full bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
                                    <TestTube2 className="w-4 h-4 mr-2" /> Load Test Data
                                </Button>
                            </div>

                             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-700 mt-4">
                                <div className="flex gap-2">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        <strong>Tip:</strong> Send the backup file to your email or save it to Google Drive for safe keeping.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                 </div>
            </div>
        </div>
    );
};