'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Form Dropdown Options for Trucks
const CONDITIONS = ['Used', 'New'];
const SELLER_TYPES = ['Private Seller', 'Dealership'];
const TRANSMISSIONS = ['Automatic', 'Manual'];
const CAB_TYPES = ['Day Cab', 'Sleeper', 'Crew Cab', 'Extended Cab', 'Regular Cab', 'Other'];
const BED_TYPES = ['Flatbed', 'Service Body', 'Dump', 'Box', 'Pickup', 'Chassis', 'Other'];

export default function EditPage() {
    const params = useParams();
    const router = useRouter();
    const TruckId = params.id;

    const [isFetching, setIsFetching] = useState(true);
    const [userId, setUserId] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [imageError, setImageError] = useState('');
    
    // We will store the original data here to compare later
    const [originalData, setOriginalData] = useState(null);

    const [formData, setFormData] = useState({
        make: '',
        model: '',
        year: '',
        condition: CONDITIONS[0],
        mileage: '',
        gvwr: '',
        rear_axle_count: '',
        transmission: TRANSMISSIONS[0],
        cab_type: CAB_TYPES[0],
        bed_type: BED_TYPES[0],
        price: '',
        description: '',
        city: '',
        state: '',
        seller_type: SELLER_TYPES[0], 
        seller_name: '',
        seller_phone: '',
        seller_email: ''
    });
    
    const [keptImages, setKeptImages] = useState([]);
    const [newImageFiles, setNewImageFiles] = useState([]);
    const [newImagePreviews, setNewImagePreviews] = useState([]);

    useEffect(() => {
        const loadTruckData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/');
                    return;
                }
                setUserId(user.id);

                const { data: Truck, error } = await supabase
                    .from('trucks')
                    .select('*')
                    .eq('id', TruckId)
                    .single();

                if (error) throw error;

                if (Truck.seller_id !== user.id) {
                    setFormError("You do not have permission to edit this listing.");
                    setIsFetching(false);
                    return;
                }

                // Store a copy of the exact original database row for comparison
                setOriginalData(Truck);

                setFormData({
                    make: Truck.make || '',
                    model: Truck.model || '',
                    year: Truck.year || '',
                    condition: Truck.condition || CONDITIONS[0],
                    mileage: Truck.mileage || '',
                    gvwr: Truck.gvwr || '',
                    rear_axle_count: Truck.rear_axle_count || '',
                    transmission: Truck.transmission || TRANSMISSIONS[0],
                    cab_type: Truck.cab_type || CAB_TYPES[0],
                    bed_type: Truck.bed_type || BED_TYPES[0],
                    price: Truck.price || '',
                    description: Truck.description || '',
                    city: Truck.city || '',
                    state: Truck.state || '',
                    seller_type: Truck.seller_type || SELLER_TYPES[0],
                    seller_name: Truck.seller_name || '',
                    seller_phone: Truck.seller_phone || '',
                    seller_email: Truck.seller_email || ''
                });
                
                setKeptImages(Truck.images || []);
            } catch (err) {
                console.error("Failed to load Truck:", err);
                setFormError("Failed to load Truck data.");
            } finally {
                setIsFetching(false);
            }
        };

        loadTruckData();
    }, [TruckId, router]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (keptImages.length + newImageFiles.length + files.length > 10) {
            setFormError('You can only have up to 10 images total.');
            return;
        }
        setFormError('');
        
        setNewImageFiles(prev => [...prev, ...files]);
        
        const newUrls = files.map(file => URL.createObjectURL(file));
        setNewImagePreviews(prev => [...prev, ...newUrls]);
    };

    const removeKeptImage = (index) => {
        setKeptImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index) => {
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
        setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSaveChanges = async (e) => {
        e.preventDefault();
        
        if (!formData.seller_phone && !formData.seller_email) {
            window.alert("Action Required: Please provide at least a phone number or an email address so buyers can reach you.");
            setFormError("Please provide either a Phone Number or an Email Address.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        
        setIsLoading(true);
        setFormError('');

        // --- CALCULATE EXACTLY WHAT CHANGED ---
        let changedFields = [];
        const fieldLabels = {
            make: 'Make', model: 'Model', year: 'Year', condition: 'Condition', 
            mileage: 'Mileage', gvwr: 'GVWR', rear_axle_count: 'Rear Axles', 
            transmission: 'Transmission', cab_type: 'Cab Type', bed_type: 'Bed Type', 
            price: 'Price', description: 'Description', city: 'City', state: 'State', 
            seller_type: 'Seller Type', seller_name: 'Seller Name',
            seller_phone: 'Phone', seller_email: 'Email'
        };

        if (originalData) {
            for (const key in formData) {
                let oldVal = String(originalData[key] || '').trim();
                let newVal = String(formData[key] || '').trim();
                
                if (key === 'price' && oldVal !== newVal) {
                    changedFields.push(`Price: $${oldVal} ➔ $${newVal}`);
                } else if (oldVal !== newVal && key !== 'price') {
                    changedFields.push(`${fieldLabels[key] || key}: "${oldVal}" ➔ "${newVal}"`);
                }
            }

            const oldImagesCount = originalData.images ? originalData.images.length : 0;
            if (newImageFiles.length > 0 || keptImages.length !== oldImagesCount) {
                changedFields.push(`Images: Changed (Now has ${keptImages.length + newImageFiles.length} photos)`);
            }

            if (changedFields.length === 0) {
                changedFields.push("No specific fields were changed.");
            }
        }
        
        // 1. Handle image uploads
        let uploadedUrls = [];
        if (newImageFiles.length > 0) {
            for (const file of newImageFiles) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${userId}/${fileName}`; 
                
                const { error: uploadError } = await supabase.storage
                    .from('Truck_images') // Make sure this matches your Supabase storage bucket name
                    .upload(filePath, file);
                    
                if (!uploadError) {
                    const { data } = supabase.storage
                        .from('Truck_images')
                        .getPublicUrl(filePath);
                    uploadedUrls.push(data.publicUrl);
                }
            }
        }

        const finalImagesList = [...keptImages, ...uploadedUrls];

        // 2. Update Database and revert to Pending Approval
        const { error: updateError } = await supabase
            .from('trucks')
            .update({
                make: formData.make,
                model: formData.model,
                year: formData.year ? parseInt(formData.year) : null,
                condition: formData.condition,
                mileage: formData.mileage ? parseInt(formData.mileage) : null,
                gvwr: formData.gvwr ? parseInt(formData.gvwr) : null,
                rear_axle_count: formData.rear_axle_count ? parseInt(formData.rear_axle_count) : null,
                transmission: formData.transmission,
                cab_type: formData.cab_type,
                bed_type: formData.bed_type,
                price: parseFloat(formData.price),
                description: formData.description,
                city: formData.city,
                state: formData.state.toUpperCase(),
                seller_type: formData.seller_type,
                seller_name: formData.seller_name,
                seller_phone: formData.seller_phone,
                seller_email: formData.seller_email,
                images: finalImagesList,
                is_approved: false 
            })
            .eq('id', TruckId);

        if (updateError) {
            setFormError("Error updating Truck: " + updateError.message);
            setIsLoading(false);
            return;
        }

        // 3. Trigger Backend to send Admin & Customer Emails
        const { data: { user } } = await supabase.auth.getUser();
        
        await fetch('/api/edit-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                category: `${formData.year} ${formData.make} ${formData.model}`, 
                price: formData.price, 
                customerEmail: user?.email,
                changedFields: changedFields 
            })
        }).catch(e => console.error("Edit Alert Failed:", e));

        // 4. Redirect back to dashboard on success
        router.push('/dashboard');
    };

    if (isFetching) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-red-600 mb-4"></i>
                <p className="text-gray-500 font-medium">Loading listing data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4">
            <div className="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-6 pb-2 border-b">
                    <h2 className="text-2xl font-bold text-gray-900">
                        <i className="fa-solid fa-pen-to-square mr-2 text-red-600"></i>Edit Truck Listing
                    </h2>
                    <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-800 transition">Cancel</button>
                </div>
                
                <div className="mb-6 bg-yellow-50 text-yellow-800 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm text-sm">
                    <i className="fa-solid fa-circle-info mr-2"></i>
                    <strong>Note:</strong> Editing your listing will hide it from the public site until an admin reviews and approves your changes.
                </div>

                {formError && (
                    <div className="mb-6 bg-red-100 text-red-800 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
                        <span className="font-bold">Error:</span> {formError}
                    </div>
                )}

                <form onSubmit={handleSaveChanges} className="space-y-8">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Truck Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                                <input type="text" name="make" required value={formData.make} onChange={handleInputChange} placeholder="e.g. Ford" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                                <input type="text" name="model" required value={formData.model} onChange={handleInputChange} placeholder="e.g. F-350" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                                <input type="number" name="year" required value={formData.year} onChange={handleInputChange} placeholder="YYYY" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                                <select name="condition" required value={formData.condition} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600">
                                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mileage</label>
                                <input type="number" name="mileage" value={formData.mileage} onChange={handleInputChange} placeholder="e.g. 150000" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GVWR (lbs)</label>
                                <input type="number" name="gvwr" value={formData.gvwr} onChange={handleInputChange} placeholder="e.g. 26000" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rear Axles</label>
                                <input type="number" name="rear_axle_count" value={formData.rear_axle_count} onChange={handleInputChange} placeholder="e.g. 2" className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                                <select name="transmission" value={formData.transmission} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600">
                                    {TRANSMISSIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cab Type</label>
                                <select name="cab_type" value={formData.cab_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600">
                                    {CAB_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type</label>
                                <select name="bed_type" value={formData.bed_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600">
                                    {BED_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Asking Price ($) *</label>
                                <input type="number" name="price" required value={formData.price} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea name="description" rows="4" value={formData.description} onChange={handleInputChange} placeholder="Tell buyers more about the truck..." className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600"></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                                <input type="text" name="city" required value={formData.city} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">State (2 letters) *</label>
                                <input type="text" name="state" required maxLength={2} value={formData.state} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Seller Contact Info</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Type *</label>
                                <select name="seller_type" required value={formData.seller_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600">
                                    {SELLER_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                                <input type="text" name="seller_name" value={formData.seller_name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input type="tel" name="seller_phone" value={formData.seller_phone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input type="email" name="seller_email" value={formData.seller_email} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Photos</h3>
                        
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative hover:bg-gray-50 transition cursor-pointer">
                            <div className="space-y-1 text-center">
                                <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400"></i>
                                <div className="flex text-sm text-gray-600 justify-center">
                                    <label htmlFor="edit-file-upload" className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                                        <span>Upload additional files</span>
                                    </label>
                                </div>
                            </div>
                            <input id="edit-file-upload" type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Upload Photos" />
                        </div>
                        {imageError && <p className="text-red-600 text-sm mt-2 font-medium">{imageError}</p>}
                        
                        {(keptImages.length > 0 || newImagePreviews.length > 0) && (
                            <div className="flex flex-wrap gap-4 mt-4">
                                {keptImages.map((img, idx) => (
                                    <div key={`kept-${idx}`} className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={img} alt={`Existing ${idx + 1}`} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => removeKeptImage(idx)} className="absolute top-1 right-1 bg-white/90 hover:bg-red-600 hover:text-white text-gray-700 w-6 h-6 rounded-full flex items-center justify-center transition shadow">
                                            <i className="fa-solid fa-xmark text-xs"></i>
                                        </button>
                                    </div>
                                ))}
                                {newImagePreviews.map((img, idx) => (
                                    <div key={`new-${idx}`} className="relative w-24 h-24 bg-red-50 rounded-lg overflow-hidden border-2 border-red-400 shadow-sm">
                                        <img src={img} alt={`New Preview ${idx + 1}`} className="w-full h-full object-cover opacity-80" />
                                        <span className="absolute bottom-0 left-0 right-0 bg-red-600 text-white text-[10px] text-center py-0.5">NEW</span>
                                        <button type="button" onClick={() => removeNewImage(idx)} className="absolute top-1 right-1 bg-white/90 hover:bg-red-600 hover:text-white text-gray-700 w-6 h-6 rounded-full flex items-center justify-center transition shadow">
                                            <i className="fa-solid fa-xmark text-xs"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t flex gap-4">
                        <button type="button" onClick={() => router.push('/dashboard')} className="flex-1 bg-gray-200 text-gray-800 py-4 rounded-md font-bold hover:bg-gray-300 transition">
                            Cancel
                        </button>
                        <button type="submit" disabled={isLoading} className="flex-1 bg-red-600 text-white py-4 rounded-md font-bold text-lg hover:bg-red-700 transition shadow-lg flex items-center justify-center">
                            {isLoading ? <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Saving...</> : 'Save & Submit for Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}