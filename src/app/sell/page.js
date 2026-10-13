'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import imageCompression from 'browser-image-compression'; 
import Autocomplete from 'react-google-autocomplete';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function SellPage() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [userEmail, setUserEmail] = useState(''); 
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);

    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(''); 
    
    const [formError, setFormError] = useState('');
    const [imageError, setImageError] = useState('');
    
    // Data State for the Dropdowns
    const [vehicleData, setVehicleData] = useState([]);
    const [availableMakes, setAvailableMakes] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);

    const [formData, setFormData] = useState({
        // Mandatory Truck Fields
        make: '', 
        model: '', 
        year: '', 
        condition: 'Used',
        price: '', 
        mileage: '', 
        rear_axle_count: '2', 
        transmission: 'Automatic',
        seller_type: 'Private Seller',
        // Optional Fields
        gvwr: '', 
        cab_type: '', 
        bed_type: '',
        // System / Standard Fields
        description: '', 
        city: '', state: '', lat: null, lng: null,
        seller_name: '', seller_phone: '', seller_email: '', images: []
    });
    
    const [imageFiles, setImageFiles] = useState([]);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/'); 
            } else {
                setUserId(user.id);
                setUserEmail(user.email); 
            }
            setIsCheckingAuth(false);
        };
        checkAuth();
    }, [router]);

    // Fetch Make & Model Data on Load
    useEffect(() => {
        async function fetchVehicleModels() {
            const { data, error } = await supabase
                .from('vehicle_models')
                .select('make, model');
            
            if (data) {
                setVehicleData(data);
                const uniqueMakes = [...new Set(data.map(v => v.make))].sort();
                setAvailableMakes(uniqueMakes);
            }
        }
        fetchVehicleModels();
    }, []);

    const handleMakeChange = (e) => {
        const selectedMake = e.target.value;
        setFormData(prev => ({ ...prev, make: selectedMake, model: '' }));

        if (selectedMake) {
            const modelsForMake = vehicleData
                .filter(v => v.make === selectedMake)
                .map(v => v.model)
                .sort();
            setAvailableModels(modelsForMake);
        } else {
            setAvailableModels([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handle Google Place Selection
    const handlePlaceSelected = (place) => {
        if (!place.geometry) return;

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        let newCity = "";
        let newState = "";

        place.address_components.forEach((component) => {
            const types = component.types;
            if (types.includes("locality")) {
                newCity = component.long_name;
            }
            if (types.includes("administrative_area_level_1")) {
                newState = component.short_name; 
            }
        });

        setFormData(prev => ({ 
            ...prev, 
            city: newCity, 
            state: newState,
            lat: lat,
            lng: lng
        }));
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (formData.images.length + files.length > 10) {
            setFormError('You can only upload up to 10 images.');
            return;
        }
        setFormError('');
        
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
        };

        try {
            const compressedFiles = [];
            const newPreviewUrls = [];

            for (const file of files) {
                const compressedFile = await imageCompression(file, options);
                compressedFiles.push(compressedFile);
                newPreviewUrls.push(URL.createObjectURL(compressedFile));
            }

            setImageFiles(prev => [...prev, ...compressedFiles]);
            setFormData(prev => ({ ...prev, images: [...prev.images, ...newPreviewUrls] }));
            
        } catch (error) {
            console.error('Error compressing image:', error);
            setFormError('There was an error processing one of your photos. Please try again.');
        }
    };

    const removeImage = (index) => {
        setFormData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
        setImageFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleProceedToPayment = (e) => {
        e.preventDefault();

        // Enforce photo requirement
        if (formData.images.length === 0) {
            setFormError("Please upload at least one photo of your truck.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        
        if (!formData.make || !formData.model) {
            setFormError("Please select a valid Make and Model.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!formData.city || !formData.state || !formData.lat) {
            setFormError("Please select a valid City and State from the location dropdown menu.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        if (!formData.seller_phone && !formData.seller_email) {
            window.alert("Action Required: Please provide at least a phone number or an email address so buyers can reach you.");
            setFormError("Please provide either a Phone Number or an Email Address so buyers can contact you.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return; 
        }

        if (formData.description.length > 200) {
            setFormError("Your description is too long. Please shorten it to 200 characters or less.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        
        setFormError('');
        setStep(2);
    };

    const handlePaymentSubmit = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const accountEmail = user?.email;
        setIsLoading(true);
        setFormError('');
        
        setLoadingStatus('Securing your photos...');
        
        let uploadedUrls = [];
        if (imageFiles.length > 0) {
            const uploadPromises = imageFiles.map(async (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${userId}/${fileName}`; 
                
                const { error: uploadError } = await supabase.storage
                    .from('truck_images')
                    .upload(filePath, file);
                    
                if (!uploadError) {
                    const { data } = supabase.storage
                        .from('truck_images')
                        .getPublicUrl(filePath);
                    return data.publicUrl; 
                }
                return null; 
            });

            const results = await Promise.all(uploadPromises);
            uploadedUrls = results.filter(url => url !== null);
        }

        setLoadingStatus('Connecting to secure checkout...');

        const truckData = {
            seller_id: userId,
            make: formData.make,
            model: formData.model,
            year: parseInt(formData.year),
            condition: formData.condition,
            price: parseFloat(formData.price),
            mileage: parseInt(formData.mileage),
            gvwr: formData.gvwr ? parseInt(formData.gvwr) : null,
            rear_axle_count: parseInt(formData.rear_axle_count),
            transmission: formData.transmission,
            cab_type: formData.cab_type,
            bed_type: formData.bed_type,
            description: formData.description.trim(),
            city: formData.city,
            state: formData.state.toUpperCase(),
            lat: formData.lat,
            lng: formData.lng,
            seller_type: formData.seller_type,
            seller_name: formData.seller_name,
            seller_phone: formData.seller_phone,
            seller_email: accountEmail,
            images: uploadedUrls,
            is_sold: false,
            is_archived: false,
            is_approved: false 
        };

        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    TruckData: truckData, 
                    userId 
                })
            });
            const stripeData = await res.json();
            
            if (stripeData.url) {
                window.location.href = stripeData.url;
            } else {
                setFormError("Stripe Error: " + stripeData.error);
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setFormError("Network error when connecting to Stripe checkout.");
            setIsLoading(false);
        }
    };

    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-red-600 mb-4"></i>
            </div>
        );
    }

    if (step === 2) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-xl border-t-8 border-red-600 animate-in fade-in duration-300">
                    {formError && (
                        <div className="mb-6 bg-red-100 text-red-800 border-l-4 border-red-500 p-3 rounded text-sm font-medium">
                            {formError}
                        </div>
                    )}
                    
                    <div className="text-center mb-6">
                        <i className="fa-solid fa-credit-card text-4xl text-gray-800 mb-3"></i>
                        <h2 className="text-2xl font-bold text-gray-900">Subscription Payment</h2>
                        <p className="text-gray-600 mt-2">The #1 Corner to Park Your Truck</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-md mb-6 border border-gray-200">
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-gray-900">Truck Listing Fee</span>
                            <span className="text-red-600">$19.00 / month</span>
                        </div>
                    </div>
                    
                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-md font-bold hover:bg-gray-300 transition">
                            Back
                        </button>
                        
                        <button type="button" onClick={handlePaymentSubmit} disabled={isLoading} className="flex-1 bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-700 transition shadow-lg flex items-center justify-center disabled:bg-green-800">
                            {isLoading ? (
                                <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> {loadingStatus || 'Loading...'}</>
                            ) : 'Proceed to Checkout'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <nav className="bg-gray-900 text-white p-4 shadow-lg mb-8">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="font-bold text-xl tracking-tight hover:text-gray-200">
                        &larr; Return to Truck Lion
                    </Link>
                    
                    {userEmail && (
                        <div className="hidden sm:block text-sm text-gray-300">
                            Logged in as: <span className="font-bold text-white ml-1">{userEmail}</span>
                        </div>
                    )}
                </div>
            </nav>

            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-gray-900 animate-in fade-in duration-300 mx-4">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-2 border-b"><i className="fa-solid fa-plus-circle mr-2 text-red-600"></i>Post a Truck</h2>
                
                {formError && (
                    <div className="mb-6 bg-red-100 text-red-800 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
                        <span className="font-bold">Error:</span> {formError}
                    </div>
                )}

                <form onSubmit={handleProceedToPayment} className="space-y-8">
                    {/* MANDATORY DETAILS SECTION */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Mandatory Details</h3>
                        
                        {/* PHOTOS SECTION */}
                        <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Truck Photos (At least 1 required) *</label>
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md relative hover:bg-gray-50 transition cursor-pointer">
                                <div className="space-y-1 text-center">
                                    <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400"></i>
                                    <div className="flex text-sm text-gray-600 justify-center">
                                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none">
                                            <span>Upload files</span>
                                        </label>
                                        <p className="pl-1">or drag and drop here</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                </div>
                                <input id="file-upload" type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="Upload Photos" />
                            </div>
                            {imageError && <p className="text-red-600 text-sm mt-2 font-medium">{imageError}</p>}
                            
                            {formData.images.length > 0 && (
                                <div className="flex flex-wrap gap-4 mt-4">
                                    {formData.images.map((img, idx) => (
                                        <div key={idx} className="relative w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                            <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-white/90 hover:bg-red-600 hover:text-white text-gray-700 w-6 h-6 rounded-full flex items-center justify-center transition shadow">
                                                <i className="fa-solid fa-xmark text-xs"></i>
                                            </button>
                                            {idx === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">Primary</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Make *</label>
                                <select name="make" required value={formData.make} onChange={handleMakeChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="">Select a Make</option>
                                    {availableMakes.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                                <select name="model" required disabled={!formData.make} value={formData.model} onChange={handleInputChange} className={`w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 ${!formData.make ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white'}`}>
                                    <option value="">Select a Model</option>
                                    {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                                <input type="number" name="year" required min="1934" max="2028" placeholder="e.g. 2024" value={formData.year} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                                <select name="condition" required value={formData.condition} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="Used">Used</option>
                                    <option value="New">New</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Asking Price ($) *</label>
                                <input type="number" name="price" required min="1" placeholder="e.g. 85000" value={formData.price} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mileage *</label>
                                <input type="number" name="mileage" required min="0" placeholder="e.g. 125000" value={formData.mileage} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rear Axle Count *</label>
                                <select name="rear_axle_count" required value={formData.rear_axle_count} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Transmission *</label>
                                <select name="transmission" required value={formData.transmission} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="Automatic">Automatic</option>
                                    <option value="Manual">Manual</option>
                                    <option value="EV">EV</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Type *</label>
                                <select name="seller_type" required value={formData.seller_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="Private Seller">Private Seller</option>
                                    <option value="Dealership">Dealership</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Location (City & State) *</label>
                                <Autocomplete
                                    apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                    onPlaceSelected={handlePlaceSelected}
                                    options={{
                                        types: ["(cities)"],
                                        componentRestrictions: { country: "us" },
                                    }}
                                    className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600"
                                    placeholder="Start typing a city... (e.g. Dallas, TX)"
                                />
                                {formData.city && formData.state && (
                                    <p className="mt-2 text-sm text-green-600 font-medium">
                                        <i className="fa-solid fa-check-circle mr-1"></i> Location set to: {formData.city}, {formData.state}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* OPTIONAL DETAILS SECTION */}
                    <div className="pt-4 mt-8 border-t-2 border-dashed border-gray-300">
                        <h3 className="text-lg font-bold text-gray-800 mb-1">Optional Details</h3>
                        <p className="text-sm text-gray-500 mb-4">Add these specifics to help buyers find your truck faster.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cab Type</label>
                                <select name="cab_type" value={formData.cab_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="">Select Cab Type...</option>
                                    <option value="(Semi Trucks) Sleeper Cab">(Semi Trucks) Sleeper Cab</option>
                                    <option value="(Semi Trucks) Day Cab">(Semi Trucks) Day Cab</option>
                                    <option value="(Chevy) Extended Cab (2 Full-Size Front Doors & 2 Half-Size Rear Doors)">(Chevy) Extended Cab (2 Full-Size Front Doors & 2 Half-Size Rear Doors)</option>
                                    <option value="(Chevy) Crew Cab (4 Full-Size Door)">(Chevy) Crew Cab (4 Full-Size Door)</option>
                                    <option value="(GM) Regular Cab (2 Doors Only)">(GM) Regular Cab (2 Doors Only)</option>
                                    <option value="(GM) Extended Cab (2 Full-Size Front Doors & 2 Rear Suicided Doors)">(GM) Extended Cab (2 Full-Size Front Doors & 2 Rear Suicided Doors)</option>
                                    <option value="(GM) Double Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)">(GM) Double Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)</option>
                                    <option value="(GM) Crew Cab (4 Full-Size Doors)">(GM) Crew Cab (4 Full-Size Doors)</option>
                                    <option value="(Ram) Regular Cab (2 Doors Only)">(Ram) Regular Cab (2 Doors Only)</option>
                                    <option value="(Ram) Club Car (2 Full-Size Front Doors & 2 Suicided Rear Doors)">(Ram) Club Car (2 Full-Size Front Doors & 2 Suicided Rear Doors)</option>
                                    <option value="(Ram) Quad Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)">(Ram) Quad Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)</option>
                                    <option value="(Ram) Crew Cab (4 Full-Size Doors)">(Ram) Crew Cab (4 Full-Size Doors)</option>
                                    <option value="(Ram) Mega Cab (4 Full-Size Doors w/ Extra Space)">(Ram) Mega Cab (4 Full-Size Doors w/ Extra Space)</option>
                                    <option value="(Ford) Regular Cab (2 Doors Only)">(Ford) Regular Cab (2 Doors Only)</option>
                                    <option value="(Ford) Extended Cab (2 Full-Size Front Doors & 2 Suicided Rear Doors)">(Ford) Extended Cab (2 Full-Size Front Doors & 2 Suicided Rear Doors)</option>
                                    <option value="(Ford) Crew Cab (4 Full-Size Doors)">(Ford) Crew Cab (4 Full-Size Doors)</option>
                                    <option value="(Nissan) Standard Cab (2 Doors Only)">(Nissan) Standard Cab (2 Doors Only)</option>
                                    <option value="(Nissan) King Cab (2 Full-Size Doors & 2 Scuicided Doors)">(Nissan) King Cab (2 Full-Size Doors & 2 Scuicided Doors)</option>
                                    <option value="(Nissan) Crew Cab (4 Full-Size Doors)">(Nissan) Crew Cab (4 Full-Size Doors)</option>
                                    <option value="(Toyota) Regular Cab (2 Doors Only)">(Toyota) Regular Cab (2 Doors Only)</option>
                                    <option value="(Toyota) Access Cab (2 Full-Size Front Doors & 2 Suicided Rear Doors)">(Toyota) Access Cab (2 Full-Size Front Doors & 2 Suicided Rear Doors)</option>
                                    <option value="(Toyota) Double Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)">(Toyota) Double Cab (2 Full-Size Front Doors & 2 Narrower Rear Doors)</option>
                                    <option value="(Toyota) Crewmax Cab (4 Full-Size Doors)">(Toyota) Crewmax Cab (4 Full-Size Doors)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type</label>
                                <select name="bed_type" value={formData.bed_type} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white">
                                    <option value="">Select Bed Type...</option>
                                    <option value="No Bed (Cab Chassi)">No Bed (Cab Chassi)</option>
                                    <option value="Short Bed">Short Bed</option>
                                    <option value="Standard Bed">Standard Bed</option>
                                    <option value="Long Bed">Long Bed</option>
                                    <option value="Flatbed">Flatbed</option>
                                    <option value="Utility/Service Bed">Utility/Service Bed</option>
                                    <option value="Hotshot Bed">Hotshot Bed</option>
                                    <option value="Dump Bed">Dump Bed</option>
                                    <option value="Tow Bed">Tow Bed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GVWR (lbs)</label>
                                <input type="number" name="gvwr" min="1000" placeholder="e.g. 26000" value={formData.gvwr} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600 bg-white" />
                            </div>

                            <div className="md:col-span-2">
                                <div className="flex justify-between items-end mb-1">
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <span className={`text-xs ${formData.description.length > 200 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                        {formData.description.length}/200
                                    </span>
                                </div>
                                <textarea 
                                    name="description" 
                                    rows="3"
                                    placeholder="Enter additional details about engine condition, recent maintenance, etc." 
                                    value={formData.description} 
                                    onChange={handleInputChange} 
                                    className={`w-full border rounded-md p-3 text-gray-900 placeholder-gray-400 focus:ring-red-600 focus:border-red-600 ${formData.description.length > 200 ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'}`}
                                ></textarea>
                                {formData.description.length > 200 && (
                                    <p className="text-red-600 text-xs mt-1 font-medium"><i className="fa-solid fa-circle-exclamation mr-1"></i>You have exceeded the 200 character limit.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CONTACT SECTION */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Seller Contact Info</h3>
                        <p className="text-sm text-gray-500 mb-4">Provide at least a phone number or an email so buyers can reach you.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                                <input type="text" name="seller_name" placeholder="John Doe or Company Name" value={formData.seller_name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                <input type="tel" name="seller_phone" placeholder="(555) 555-5555" value={formData.seller_phone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                <input type="email" name="seller_email" placeholder="john@example.com" value={formData.seller_email} onChange={handleInputChange} className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-md font-bold text-lg hover:bg-gray-800 transition shadow-lg flex items-center justify-center">
                            Review Payment ($19) <i className="fa-solid fa-arrow-right ml-2"></i>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}