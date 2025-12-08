import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Camera, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ProfileData } from '../types';
import Card from './Card';
import Button from './Button';
import { compressImage } from '../utils/imageUtils';
import Input from './Input';
import Textarea from './Textarea';

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
    logo: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.profile) {
      setFormData({
        name: state.profile.name || '',
        ownerName: state.profile.ownerName || '',
        phone: state.profile.phone || '',
        address: state.profile.address || '',
        gstNumber: state.profile.gstNumber || '',
        logo: state.profile.logo || '',
      });
    }
  }, [state.profile, isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          try {
              // Use standard compression for logo too
              const base64 = await compressImage(e.target.files[0], 300, 0.8);
              setFormData(prev => ({ ...prev, logo: base64 }));
          } catch (error) {
              showToast("Error processing image.", 'error');
          }
      }
  };

  const handleSave = () => {
    const profilePayload: ProfileData = {
        id: 'userProfile',
        ...formData
    };
    dispatch({ type: 'SET_PROFILE', payload: profilePayload });
    showToast('Profile updated successfully!', 'success');
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
        aria-modal="true" 
        role="dialog"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg animate-scale-in overflow-hidden flex flex-col max-h-full">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h2 className="text-xl font-bold text-primary">My Business Profile</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow space-y-4 pr-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">This information will be used on invoices and other documents you generate.</p>
            
            {/* Logo Section */}
            <div className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-gray-300 dark:border-slate-600">
                <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 flex items-center justify-center overflow-hidden mb-3 relative group">
                    {formData.logo ? (
                        <img src={formData.logo} alt="Business Logo" className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon size={32} className="text-gray-300 dark:text-slate-500" />
                    )}
                </div>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        accept="image/*" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleLogoUpload}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="text-xs h-8">
                        <Camera size={14} className="mr-1" /> {formData.logo ? 'Change Logo' : 'Upload Logo'}
                    </Button>
                    {formData.logo && (
                        <Button onClick={() => setFormData(prev => ({...prev, logo: ''}))} variant="secondary" className="text-xs h-8 text-red-600 hover:bg-red-50 border-red-200">
                            <Trash2 size={14} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
            <div>
                <Input label="Business Name" type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. My Saree Shop" />
            </div>
            <div>
                <Input label="Owner Name" type="text" name="ownerName" value={formData.ownerName} onChange={handleInputChange} placeholder="Your Name (for greetings)" />
            </div>
            <div>
                <Input label="Phone Number" type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
            </div>
            <div>
                <Textarea label="Address" name="address" value={formData.address} onChange={handleInputChange} rows={3} />
            </div>
            <div>
                <Input label="GST Number" type="text" name="gstNumber" value={formData.gstNumber} onChange={handleInputChange} />
            </div>
            </div>
        </div>

        <div className="mt-6 flex justify-end pt-4 border-t dark:border-slate-700 shrink-0">
            <Button onClick={handleSave}>
                <Save size={16} className="mr-2" />
                Save Profile
            </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default ProfileModal;
