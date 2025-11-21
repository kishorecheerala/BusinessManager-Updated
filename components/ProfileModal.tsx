
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ProfileData } from '../types';
import Card from './Card';
import Button from './Button';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch, showToast } = useAppContext();
  const [formData, setFormData] = useState<Omit<ProfileData, 'id'>>({
    name: '',
    ownerName: '',
    phone: '',
    address: '',
    gstNumber: '',
  });

  useEffect(() => {
    if (state.profile) {
      setFormData({
        name: state.profile.name || '',
        ownerName: state.profile.ownerName || '',
        phone: state.profile.phone || '',
        address: state.profile.address || '',
        gstNumber: state.profile.gstNumber || '',
      });
    }
  }, [state.profile, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const profilePayload: ProfileData = {
        id: 'userProfile',
        ...formData
    };
    dispatch({ type: 'SET_PROFILE', payload: profilePayload });
    showToast('Profile updated successfully!');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast" 
      aria-modal="true" 
      role="dialog"
    >
      <Card className="w-full max-w-lg animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-primary">My Business Profile</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <X size={24} />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This information will be used on invoices and other documents you generate.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. My Saree Shop" className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Owner Name</label>
            <input type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} placeholder="Your Name (for greetings)" className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
            <textarea name="address" value={formData.address} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" rows={3}></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST Number</label>
            <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
            <Button onClick={handleSave}>
                <Save size={16} className="mr-2" />
                Save Profile
            </Button>
        </div>
      </Card>
    </div>
  );
};

export default ProfileModal;
