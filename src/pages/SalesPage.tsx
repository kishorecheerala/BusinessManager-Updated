            {isScanning && 
                <QRScannerModal 
                    onClose={() => setIsScanning(false)}
                    onScanned={handleProductScanned}
                />
            }
            <h1 className="text-2xl font-bold text-primary">{pageTitle}</h1>
            
            <Card className="relative z-20">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                        <div className="flex gap-2 items-center">
                            <div className="relative w-full" ref={customerDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                                    className="w-full p-2 border rounded bg-white text-left custom-select dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                    disabled={mode === 'edit' || (mode === 'add' && items.length > 0)}
                                    aria-haspopup="listbox"
                                    aria-expanded={isCustomerDropdownOpen}
                                >
                                    {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.area}` : 'Select a Customer'}
                                </button>

                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border dark:border-slate-700 z-[100] animate-fade-in-fast">
                                        <div className="p-2 border-b dark:border-slate-700">
                                            <input
                                                type="text"
                                                placeholder="Search by name or area..."
                                                value={customerSearchTerm}
                                                onChange={e => setCustomerSearchTerm(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <ul className="max-h-60 overflow-y-auto" role="listbox">
                                            <li
                                                key="select-customer-placeholder"
                                                onClick={() => {
                                                    setCustomerId('');
                                                    setIsCustomerDropdownOpen(false);
                                                    setCustomerSearchTerm('');
                                                }}
                                                className="px-4 py-2 hover:bg-teal-50 dark:hover:bg-slate-800 cursor-pointer text-gray-500"
                                                role="option"
                                            >
                                                Select a Customer
                                            </li>
                                            {filteredCustomers.map(c => (
                                                <li
                                                    key={c.id}
                                                    onClick={() => {
                                                        setCustomerId(c.id);
                                                        setIsCustomerDropdownOpen(false);
                                                        setCustomerSearchTerm('');
                                                    }}
                                                    className="px-4 py-2 hover:bg-teal-50 dark:hover:bg-slate-800 cursor-pointer border-t dark:border-slate-800"
                                                    role="option"
                                                >
                                                    {c.name} - {c.area}
                                                </li>
                                            ))}
                                            {filteredCustomers.length === 0 && (
                                                <li className="px-4 py-2 text-gray-400">No customers found.</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {mode === 'add' && (
                                <Button onClick={() => setIsAddingCustomer(true)} variant="secondary" className="flex-shrink-0">
                                    <Plus size={16}/> New Customer
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Date</label>
                        <input 
                            type="date" 
                            value={saleDate} 
                            onChange={e => setSaleDate(e.target.value)} 
                            className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                            disabled={mode === 'edit'}
                        />
                    </div>

                    {customerId && customerTotalDue !== null && mode === 'add' && (
                        <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-center border dark:border-slate-700">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Selected Customer's Total Outstanding Due:
                            </p>
                            <p className={`text-xl font-bold ${customerTotalDue > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                                ₹{customerTotalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    )}
                </div>
            </Card>