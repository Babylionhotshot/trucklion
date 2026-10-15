'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import TruckCard from '@/components/TruckCard';
import FilterSidebar from '@/components/FilterSidebar';
import { AuthView, UpdatePasswordView } from '@/components/AuthViews';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TruckLionApp() {
    const router = useRouter(); 
    const [currentView, setCurrentView] = useState('browse');
    const [viewMode, setViewMode] = useState('list'); 
    
    const [authMode, setAuthMode] = useState('login'); 
    const [selectedTruck, setSelectedTruck] = useState(null); 
    
    const [isInitializing, setIsInitializing] = useState(true);
    const [backNavSource, setBackNavSource] = useState('browse'); 
    
    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const ITEMS_PER_PAGE = 20;
    
    // 1. Data State for Truck Makes/Models Dropdowns
    const [vehicleData, setVehicleData] = useState([]);
    const [availableMakes, setAvailableMakes] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);

    // 2. Truck Filters
    const [filterSellerType, setFilterSellerType] = useState('All Sellers');
    const [filters, setFilters] = useState({
        make: '', model: '', condition: '', minYear: '', maxYear: '', minPrice: '', maxPrice: '', 
        minMileage: '', maxMileage: '', minGvwr: '', maxGvwr: '', rearAxleCount: '', transmission: '',
        cabType: '', bedType: '',
        city: '', state: '', radius: 'Nationwide', lat: null, lng: null
    });

    const [session, setSession] = useState(null);
    const [Trucks, setTrucks] = useState([]); 
    const [notification, setNotification] = useState(null);
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // 3. Fetch Make & Model Data on Load
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

    // 4. Handle Make Selection & Cascade Models
    const handleMakeChange = (e) => {
        const selectedMake = e.target.value;
        setFilters({ ...filters, make: selectedMake, model: '' });

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

    // Standard Notifications & Auth
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        
        if (query.get('success')) {
            setNotification({ type: 'success', message: 'Payment successful! Your truck will be public once approved.' });
            window.history.replaceState(null, '', window.location.pathname);
        } else if (query.get('canceled')) {
            setNotification({ type: 'error', message: 'Payment was canceled. Your truck has not been listed.' });
            window.history.replaceState(null, '', window.location.pathname);
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            // Automatically go back to browse when successfully signed in
            if (event === 'SIGNED_IN') {
                setCurrentView('browse');
            } else if (event === 'PASSWORD_RECOVERY') {
                setCurrentView('update-password');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Trigger a database fetch whenever the location or radius changes
    useEffect(() => {
        setPage(0); // Reset pagination when location changes
        fetchTrucks(0, false); 
    }, [filters.radius, filters.lat, filters.lng]);

    // Load More Function
    const loadMoreTrucks = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchTrucks(nextPage, true);
    };

    // fetchTrucks now uses pagination ranges
    async function fetchTrucks(pageIndex = 0, isAppending = false) {
        const from = pageIndex * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;

        let query;

        // If they selected a radius AND we have coordinates, use PostGIS
        if (filters.radius !== 'Nationwide' && filters.lat && filters.lng) {
            query = supabase.rpc('search_Trucks_in_radius', {
                search_lat: filters.lat,
                search_lng: filters.lng,
                radius_miles: parseInt(filters.radius)
            }).range(from, to);
        } else {
            // Standard fetch for Nationwide
            query = supabase
                .from('trucks')
                .select('*')
                .eq('is_sold', false)
                .eq('is_archived', false)
                .eq('is_approved', true) 
                .order('id', { ascending: false })
                .range(from, to); 
        }

        const { data, error } = await query;
        
        if (error) {
            console.error("Error fetching trucks:", error);
        } else {
            // Append if loading more, overwrite if brand new search
            if (isAppending) {
                setTrucks(prev => [...prev, ...(data || [])]);
            } else {
                setTrucks(data || []);
            }

            // Hide the Load More button if we hit the end of the database
            if (!data || data.length < ITEMS_PER_PAGE) {
                setHasMore(false);
            } else {
                setHasMore(true);
            }
            
            // Only check URL params on initial load, not when appending
            if (typeof window !== 'undefined' && !isAppending) {
                const urlQuery = new URLSearchParams(window.location.search);
                const TruckIdToLoad = urlQuery.get('TruckId');
                const fromSource = urlQuery.get('from');

                if (TruckIdToLoad && data) {
                    const foundTruck = data.find(t => t.id.toString() === TruckIdToLoad);
                    if (foundTruck) {
                        setSelectedTruck(foundTruck);
                        setBackNavSource(fromSource === 'dashboard' ? 'dashboard' : 'browse');
                        setCurrentView('details');
                        window.history.replaceState(null, '', window.location.pathname);
                    }
                }
            }
        }
        setIsInitializing(false); 
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setCurrentView('browse');
        setIsMobileMenuOpen(false); 
    };

    const handleContactClick = () => {
        if (session) {
            setCurrentView('contact');
            setIsMobileMenuOpen(false);
        } else {
            window.alert("You must set up a free account to contact us.");
            setAuthMode('register');
            setCurrentView('auth');
            setIsMobileMenuOpen(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900 font-sans">
            <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-3 min-h-[70px]">
                        
                        <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('browse')}>
                            <img src="new-truck-lion-logo.png" alt="Truck Lion" className="h-[50px] md:h-[65px] w-auto object-contain" />
                        </div>
                        
                        <div className="hidden md:flex items-center space-x-4">
                            <button onClick={() => setCurrentView('browse')} className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'browse' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white transition'}`}>
                                <i className="fa-solid fa-magnifying-glass mr-2"></i>Browse Trucks
                            </button>
                            
                            <button onClick={handleContactClick} className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'contact' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white transition'}`}>
                                <i className="fa-solid fa-envelope mr-2"></i>Contact Us
                            </button>
                            
                            {session ? (
                                <>
                                    <Link href="/sell" className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition">
                                        <i className="fa-solid fa-tag mr-2"></i>Post a Truck
                                    </Link>
                                    <Link href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition">
                                        <i className="fa-solid fa-user mr-2"></i>Dashboard
                                    </Link>

                                    <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-bold transition">
                                        Sign Out
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center space-x-3 ml-2 border-l border-gray-700 pl-4">
                                    <button 
                                        onClick={() => { setAuthMode('login'); setCurrentView('auth'); }} 
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded shadow-md transition"
                                    >
                                        Sign In
                                    </button>
                                    <button 
                                        onClick={() => { setAuthMode('register'); setCurrentView('auth'); }} 
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded shadow-md transition"
                                    >
                                        Post a Truck
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="md:hidden flex items-center">
                            <button 
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-gray-800 transition"
                            >
                                <i className={`fa-solid ${isMobileMenuOpen ? 'fa-xmark' : 'fa-bars'} text-2xl`}></i>
                            </button>
                        </div>
                    </div>
                </div>

                {isMobileMenuOpen && (
                    <div className="md:hidden bg-gray-800 border-t border-gray-700 animate-in slide-in-from-top-2 duration-200">
                        <div className="px-4 pt-2 pb-4 space-y-2">
                            <button 
                                onClick={() => { setCurrentView('browse'); setIsMobileMenuOpen(false); }} 
                                className={`w-full text-left px-4 py-3 rounded-md text-base font-medium flex items-center transition ${currentView === 'browse' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                            >
                                <i className="fa-solid fa-magnifying-glass mr-3 w-5 text-center"></i> Browse Trucks
                            </button>
                            
                            <button 
                                onClick={handleContactClick} 
                                className={`w-full text-left px-4 py-3 rounded-md text-base font-medium flex items-center transition ${currentView === 'contact' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                            >
                                <i className="fa-solid fa-envelope mr-3 w-5 text-center"></i> Contact Us
                            </button>

                            {session ? (
                                <>
                                    <Link 
                                        href="/sell" 
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="w-full text-left px-4 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center transition"
                                    >
                                        <i className="fa-solid fa-tag mr-3 w-5 text-center"></i> Post a Truck
                                    </Link>
                                    <Link 
                                        href="/dashboard" 
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="w-full text-left px-4 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center transition"
                                    >
                                        <i className="fa-solid fa-user mr-3 w-5 text-center"></i> Dashboard
                                    </Link>
                                    <button 
                                        onClick={handleLogout} 
                                        className="w-full text-left px-4 py-3 mt-4 rounded-md text-base font-bold bg-red-600 hover:bg-red-700 text-white flex items-center transition shadow-sm"
                                    >
                                        <i className="fa-solid fa-right-from-bracket mr-3 w-5 text-center"></i> Sign Out
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col space-y-3 mt-4 pt-4 border-t border-gray-700">
                                    <button 
                                        onClick={() => { setAuthMode('login'); setCurrentView('auth'); setIsMobileMenuOpen(false); }} 
                                        className="w-full text-center justify-center px-4 py-3 rounded-md text-base font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center shadow-sm transition"
                                    >
                                        <i className="fa-solid fa-user mr-3 w-5 text-center"></i> Sign In
                                    </button>
                                    <button 
                                        onClick={() => { setAuthMode('register'); setCurrentView('auth'); setIsMobileMenuOpen(false); }} 
                                        className="w-full text-center px-4 py-3 rounded-md text-base font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition"
                                    >
                                        <i className="fa-solid fa-tag mr-3 w-5 text-center"></i> Post a Truck
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {notification && (
                <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6">
                    <div className={`p-4 rounded-md shadow-md flex justify-between items-center ${notification.type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 'bg-red-100 text-red-800 border-l-4 border-red-500'}`}>
                        <div className="flex items-center">
                            <i className={`fa-solid ${notification.type === 'success' ? 'fa-circle-check text-green-600' : 'fa-triangle-exclamation text-red-600'} text-xl mr-3`}></i>
                            <span className="font-bold">{notification.message}</span>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-800 transition">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>
            )}

            <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
                {isInitializing ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-4xl text-red-600 mb-4"></i>
                        <p className="font-medium">Loading...</p>
                    </div>
                ) : (
                    <>
                        {currentView === 'browse' && (
                            <BrowseView 
                                Trucks={Trucks} 
                                onViewDetails={(Truck) => {
                                    setSelectedTruck(Truck);
                                    setBackNavSource('browse');
                                    setCurrentView('details');
                                }} 
                                isMobileMenuOpen={isMobileMenuOpen}
                                filters={filters} 
                                setFilters={setFilters} 
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                                availableMakes={availableMakes}
                                availableModels={availableModels}
                                handleMakeChange={handleMakeChange}
                                filterSellerType={filterSellerType}
                                setFilterSellerType={setFilterSellerType}
                                onLoadMore={loadMoreTrucks} 
                                hasMore={hasMore}           
                            />
                        )}
                        
                        {currentView === 'details' && selectedTruck && (
                            <TruckDetailsView 
                                Truck={selectedTruck} 
                                session={session} 
                                backNavSource={backNavSource} 
                                router={router} 
                                onBack={() => setCurrentView('browse')} 
                            />
                        )}

                        {currentView === 'contact' && session && (
                            <ContactView 
                                session={session} 
                                onBack={() => setCurrentView('browse')} 
                            />
                        )}

                        {currentView === 'auth' && !session && (
                            <AuthView 
                                initialMode={authMode} 
                                onModeChange={setAuthMode} 
                            />
                        )}
                        
                        {currentView === 'update-password' && (
                            <UpdatePasswordView 
                                onSuccess={() => window.location.href = '/dashboard'} 
                            />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}

// ---------------------------------------------------------
// CONTACT VIEW
// ---------------------------------------------------------
function ContactView({ session, onBack }) {
    const [message, setMessage] = useState('');
    const [status, setStatus] = useState('idle'); // idle, sending, success, error

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        setStatus('sending');
        
        try {
            const res = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: session?.user?.email,
                    message: message.trim()
                })
            });
            
            if (res.ok) {
                setStatus('success');
                setMessage('');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setStatus('error');
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 animate-in fade-in duration-300">
            <button onClick={onBack} className="mb-6 text-gray-600 hover:text-red-600 font-medium transition flex items-center">
                <i className="fa-solid fa-arrow-left mr-2"></i> Back to Browse
            </button>

            <div className="text-center mb-8">
                <i className="fa-solid fa-envelope-open-text text-5xl text-gray-800 mb-4"></i>
                <h2 className="text-3xl font-bold text-gray-900">Send Us A Message</h2>
                <p className="text-gray-500 mt-2">Have a question or need support? We're here to help.</p>
            </div>

            {status === 'success' ? (
                <div className="bg-green-50 border border-green-200 text-green-800 p-6 rounded-md text-center">
                    <i className="fa-solid fa-circle-check text-4xl text-green-500 mb-3"></i>
                    <h3 className="text-xl font-bold mb-2">Message Sent!</h3>
                    <p>Thanks for reaching out. We will get back to you at <strong>{session?.user?.email}</strong> as soon as possible.</p>
                    <button onClick={onBack} className="mt-6 bg-green-600 text-white px-6 py-2 rounded-md font-bold hover:bg-green-700 transition">
                        Return to Browse
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                        <input 
                            type="email" 
                            disabled 
                            value={session?.user?.email || ''} 
                            className="w-full border border-gray-300 rounded-md p-3 bg-gray-100 text-gray-500 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-400 mt-1">Responses will be sent to your registered account email.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                        <textarea 
                            required
                            rows="6"
                            placeholder="How can we help you today?"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-red-600 focus:border-red-600"
                        ></textarea>
                    </div>

                    {status === 'error' && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm font-medium flex items-center">
                            <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                            There was a network error connecting to the server. Please try again.
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={status === 'sending' || !message.trim()}
                        className="w-full bg-red-600 text-white py-3 rounded-md font-bold text-lg hover:bg-red-700 disabled:bg-red-400 transition shadow-md flex items-center justify-center"
                    >
                        {status === 'sending' ? (
                            <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Sending...</>
                        ) : (
                            <><i className="fa-solid fa-paper-plane mr-2"></i> Send Message</>
                        )}
                    </button>
                </form>
            )}
        </div>
    );
}

// ---------------------------------------------------------
// MAP AUTO-PAN HELPER
// ---------------------------------------------------------
function MapAutoPan({ lat, lng, radius }) {
    const map = useMap();

    useEffect(() => {
        if (!map) return;

        if (radius === 'Nationwide' || !lat || !lng) {
            map.panTo({ lat: 39.8283, lng: -98.5795 });
            map.setZoom(4);
        } else {
            map.panTo({ lat: lat, lng: lng });
            
            let newZoom = 7;
            if (radius === '50') newZoom = 9;
            if (radius === '100') newZoom = 8;
            if (radius === '250') newZoom = 6;
            if (radius === '500') newZoom = 5;
            
            map.setZoom(newZoom);
        }
    }, [map, lat, lng, radius]);

    return null;
}

// ---------------------------------------------------------
// BROWSE VIEW
// ---------------------------------------------------------
function BrowseView({ Trucks, onViewDetails, isMobileMenuOpen, filters, setFilters, viewMode, setViewMode, availableMakes, availableModels, handleMakeChange, filterSellerType, setFilterSellerType, onLoadMore, hasMore }) {
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const filterContainerRef = useRef(null);

    // TRUCK FILTERING LOGIC
    const filteredTrucks = useMemo(() => {
        return Trucks.filter(t => {
            if (filterSellerType !== 'All Sellers' && t.seller_type !== filterSellerType) return false;
            
            if (filters.make && t.make !== filters.make) return false;
            if (filters.model && t.model !== filters.model) return false;
            if (filters.condition && t.condition !== filters.condition) return false;
            
            if (filters.minYear && parseInt(t.year) < parseInt(filters.minYear)) return false;
            if (filters.maxYear && parseInt(t.year) > parseInt(filters.maxYear)) return false;
            
            if (filters.minPrice && parseInt(t.price) < parseInt(filters.minPrice)) return false;
            if (filters.maxPrice && parseInt(t.price) > parseInt(filters.maxPrice)) return false;
            
            if (filters.minMileage && parseInt(t.mileage) < parseInt(filters.minMileage)) return false;
            if (filters.maxMileage && parseInt(t.mileage) > parseInt(filters.maxMileage)) return false;
            
            if (filters.minGvwr && parseInt(t.gvwr) < parseInt(filters.minGvwr)) return false;
            if (filters.maxGvwr && parseInt(t.gvwr) > parseInt(filters.maxGvwr)) return false;
            
            if (filters.transmission && t.transmission !== filters.transmission) return false;
            if (filters.rearAxleCount && t.rear_axle_count?.toString() !== filters.rearAxleCount) return false;
            
            if (filters.cabType && t.cab_type !== filters.cabType) return false;
            if (filters.bedType && t.bed_type !== filters.bedType) return false;

            return true;
        });
    }, [Trucks, filters, filterSellerType]);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        setFilterSellerType('All Sellers');
        setFilters({
            make: '', model: '', condition: '', minYear: '', maxYear: '', minPrice: '', maxPrice: '', 
            minMileage: '', maxMileage: '', minGvwr: '', maxGvwr: '', rearAxleCount: '', transmission: '',
            cabType: '', bedType: '',
            city: '', state: '', radius: 'Nationwide', lat: null, lng: null
        });
        
        if (filterContainerRef.current) {
            filterContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4">
            
            {!isMobileMenuOpen && !showMobileFilters && (
                <div className="md:hidden sticky top-[70px] z-40 bg-gray-50 pt-2 pb-3 -mx-4 px-4 shadow-sm border-b border-gray-200">
                    <button 
                        onClick={() => setShowMobileFilters(true)}
                        className="w-full bg-red-600 text-white py-3 rounded-md font-bold shadow-md flex justify-center items-center gap-2"
                    >
                        <i className="fas fa-filter"></i>
                        Filter Trucks
                    </button>
                </div>
            )}

            {showMobileFilters && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-60 z-40 md:hidden transition-opacity"
                    onClick={() => setShowMobileFilters(false)}
                ></div>
            )}

            <div className="flex flex-col md:flex-row gap-6 mt-4">
                
                {/* The Filter Sidebar Component that we just extracted */}
                <FilterSidebar 
                    showMobileFilters={showMobileFilters}
                    setShowMobileFilters={setShowMobileFilters}
                    filterContainerRef={filterContainerRef}
                    filterSellerType={filterSellerType}
                    setFilterSellerType={setFilterSellerType}
                    filters={filters}
                    updateFilter={updateFilter}
                    handleMakeChange={handleMakeChange}
                    availableMakes={availableMakes}
                    availableModels={availableModels}
                    handleClearFilters={handleClearFilters}
                />

                {/* --- TRUCK GRID / MAP --- */}
                <div className="w-full md:w-3/4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                            <h1 className="text-2xl font-bold text-gray-900">Trucks for Sale</h1>
                            
                            <div className="bg-gray-200 p-1 rounded-lg flex text-sm font-bold shadow-inner">
                                <button 
                                    onClick={() => setViewMode('list')}
                                    className={`px-4 py-1.5 rounded-md transition flex items-center ${viewMode === 'list' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <i className="fa-solid fa-list mr-2"></i> List
                                </button>
                                <button 
                                    onClick={() => setViewMode('map')}
                                    className={`px-4 py-1.5 rounded-md transition flex items-center ${viewMode === 'map' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <i className="fa-solid fa-map mr-2"></i> Map
                                </button>
                            </div>
                        </div>
                        
                        <span className="text-gray-500 font-medium whitespace-nowrap">{filteredTrucks.length} Results</span>
                    </div>
                    
                    {filteredTrucks.length === 0 && viewMode === 'list' ? (
                        <div className="bg-white p-10 rounded-lg shadow text-center border border-gray-200">
                            <i className="fa-solid fa-truck text-5xl text-gray-300 mb-4"></i>
                            <h3 className="text-xl font-medium text-gray-900">No trucks found</h3>
                            <p className="text-gray-500 mt-2">Try adjusting your filters, or be the first to post one!</p>
                        </div>
                    ) : viewMode === 'map' ? (
                        <div className="w-full h-[600px] rounded-lg border border-gray-300 overflow-hidden shadow-inner animate-in fade-in duration-300">
                            <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}>
                                <Map 
                                    defaultCenter={filters.lat && filters.lng ? { lat: filters.lat, lng: filters.lng } : { lat: 39.8283, lng: -98.5795 }} 
                                    defaultZoom={filters.lat && filters.lng ? 7 : 4}
                                    mapId="DEMO_MAP_ID"
                                    gestureHandling="greedy"
                                >
                                    <MapAutoPan lat={filters.lat} lng={filters.lng} radius={filters.radius} />

                                    {filteredTrucks.map(Truck => (
                                        Truck.lat && Truck.lng ? (
                                           <AdvancedMarker 
                                                key={Truck.id} 
                                                position={{ lat: Truck.lat, lng: Truck.lng }}
                                                onClick={() => onViewDetails(Truck)}
                                                title={`${Truck.year ? Truck.year + ' ' : ''}${Truck.make} ${Truck.model} - $${Number(Truck.price).toLocaleString()}`}
                                                className="z-0 hover:z-50"
                                            >
                                                <div className="relative flex flex-col items-center cursor-pointer transition-transform duration-300 ease-out hover:scale-150 origin-bottom">
                                                    <div className="w-14 h-14 bg-white rounded-lg border-2 border-red-600 shadow-lg overflow-hidden flex items-center justify-center">
                                                        {Truck.images && Truck.images.length > 0 ? (
                                                            <img src={Truck.images[0]} alt={Truck.make} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <i className="fa-solid fa-truck text-gray-300 text-xl"></i>
                                                        )}
                                                    </div>
                                                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-600 -mt-[1px]"></div>
                                                </div>
                                            </AdvancedMarker>
                                        ) : null
                                    ))}
                                </Map>
                            </APIProvider>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
                                {filteredTrucks.map(Truck => (
                                    <TruckCard 
                                        key={Truck.id} 
                                        Truck={Truck} 
                                        onViewDetails={onViewDetails} 
                                    />
                                ))}
                            </div>
                            
                            {hasMore && (
                                <div className="flex justify-center mt-10 mb-4">
                                    <button 
                                        onClick={onLoadMore} 
                                        className="bg-white border-2 border-gray-200 text-gray-800 px-8 py-3 rounded-md hover:bg-gray-50 hover:border-gray-300 font-bold shadow-sm transition"
                                    >
                                        Load More Trucks
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// Truck DETAILS VIEW (Now acts as Truck Details)
// ---------------------------------------------------------
function TruckDetailsView({ Truck, onBack, session, backNavSource, router }) {
    const [activeImage, setActiveImage] = useState(Truck.images && Truck.images.length > 0 ? Truck.images[0] : null);
    
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const userId = session?.user?.id;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (userId && Truck) {
            checkIfSaved();
        }
    }, [userId, Truck]);

    const checkIfSaved = async () => {
        const { data } = await supabase
            .from('saved_trucks')
            .select('id')
            .eq('user_id', userId)
            .eq('Truck_id', Truck.id)
            .single();
            
        if (data) setIsSaved(true);
    };

    const toggleSave = async () => {
        if (!userId) return;
        setIsSaving(true);
        
        if (isSaved) {
            await supabase.from('saved_trucks').delete().eq('user_id', userId).eq('Truck_id', Truck.id);
            setIsSaved(false);
        } else {
            await supabase.from('saved_trucks').insert({ user_id: userId, Truck_id: Truck.id });
            setIsSaved(true);
        }
        setIsSaving(false);
    };

    return (
        <div className="animate-in fade-in duration-300">
            <button 
                onClick={() => {
                    if (backNavSource === 'dashboard') {
                        router.push('/dashboard');
                    } else {
                        onBack();
                    }
                }} 
                className="mb-6 text-gray-600 hover:text-red-600 font-medium transition flex items-center"
            >
                <i className="fa-solid fa-arrow-left mr-2"></i> 
                {backNavSource === 'dashboard' ? 'Back to Dashboard' : 'Back to Browse'}
            </button>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                <div className="flex flex-col lg:flex-row">
                    <div className="w-full lg:w-3/5 p-6 border-b lg:border-b-0 lg:border-r border-gray-200">
                        <div className="w-full h-96 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center relative mb-4">
                            {activeImage ? (
                                <img src={activeImage} alt={Truck.make} className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <i className="fa-solid fa-image text-6xl mb-2"></i>
                                    <p>No images provided</p>
                                </div>
                            )}
                        </div>

                        {Truck.images && Truck.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {Truck.images.map((img, idx) => (
                                    <button 
                                        key={idx} 
                                        onClick={() => setActiveImage(img)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border-2 transition-all ${activeImage === img ? 'border-red-600 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    >
                                        <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-2/5 p-6 flex flex-col bg-gray-50">
                        <div className="mb-6">
                            <span className="text-sm text-red-600 font-bold uppercase tracking-wider">
                                {Truck.make}
                            </span>
                            
                            <div className="flex justify-between items-start mt-1 mb-2">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{Truck.year ? `${Truck.year} ` : ''}{Truck.model}</h1>
                                    <div className="text-4xl font-bold text-gray-900 mt-2">${Number(Truck.price).toLocaleString()}</div>
                                </div>
                                
                                {session && (
                                    <button 
                                        onClick={toggleSave}
                                        disabled={isSaving}
                                        className={`px-4 py-2 mt-1 rounded-md font-bold flex items-center transition shadow-sm border ${isSaved ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'}`}
                                    >
                                        {isSaving ? (
                                            <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>
                                        ) : (
                                            <i className={`fa-${isSaved ? 'solid' : 'regular'} fa-bookmark mr-2 ${isSaved ? 'text-red-600' : 'text-gray-400'}`}></i>
                                        )}
                                        <span className="hidden sm:inline">{isSaved ? 'Saved to Dashboard' : 'Save to Dashboard'}</span>
                                        <span className="sm:hidden">{isSaved ? 'Saved' : 'Save'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {Truck.description && (
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Description</h3>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{Truck.description}</p>
                            </div>
                        )}

                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Specifications</h3>
                            <ul className="space-y-3 text-sm">
                                {Truck.year && <li className="flex justify-between"><span className="text-gray-500">Year</span> <span className="font-medium text-gray-900">{Truck.year}</span></li>}
                                {Truck.condition && <li className="flex justify-between"><span className="text-gray-500">Condition</span> <span className="font-medium text-gray-900">{Truck.condition}</span></li>}
                                <li className="flex justify-between"><span className="text-gray-500">Mileage</span> <span className="font-medium text-gray-900">{Truck.mileage ? Number(Truck.mileage).toLocaleString() : 'Not Specified'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Transmission</span> <span className="font-medium text-gray-900">{Truck.transmission || 'Not Specified'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">GVWR</span> <span className="font-medium text-gray-900">{Truck.gvwr ? Number(Truck.gvwr).toLocaleString() + ' lbs' : 'Not Specified'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Rear Axles</span> <span className="font-medium text-gray-900">{Truck.rear_axle_count || 'Not Specified'}</span></li>
                                
                                {Truck.cab_type && <li className="flex justify-between"><span className="text-gray-500">Cab Type</span> <span className="font-medium text-gray-900">{Truck.cab_type}</span></li>}
                                {Truck.bed_type && <li className="flex justify-between"><span className="text-gray-500">Bed Type</span> <span className="font-medium text-gray-900">{Truck.bed_type}</span></li>}

                                <li className="flex justify-between mt-2 pt-2 border-t"><span className="text-gray-500">Location</span> <span className="font-medium text-gray-900">{Truck.city}, {Truck.state}</span></li>
                            </ul>
                        </div>
                        
                        {Truck.lat && Truck.lng && (
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-3">Location</h3>
                                <p className="text-sm text-gray-500 mb-3 flex items-center">
                                    <i className="fa-solid fa-location-dot text-red-600 mr-2"></i>
                                    {Truck.city}, {Truck.state}
                                </p>
                                <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-300 shadow-inner">
                                    <img 
                                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${Truck.lat},${Truck.lng}&zoom=7&size=600x300&markers=color:red%7C${Truck.lat},${Truck.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                                        alt="Truck Location Map"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="bg-gray-900 p-6 rounded-lg shadow-md text-white mt-auto">
                            <h3 className="font-bold text-lg mb-4 border-b border-gray-700 pb-2"><i className="fa-solid fa-address-card mr-2 text-red-500"></i>Contact Seller</h3>
                            
                            {Truck.seller_name && (
                                <p className="font-bold text-xl mb-4">{Truck.seller_name}</p>
                            )}
                            
                            <div className="space-y-3">
                                {Truck.seller_phone && (
                                    <a href={`tel:${Truck.seller_phone}`} className="flex items-center w-full bg-gray-800 hover:bg-gray-700 py-3 px-4 rounded-md transition border border-gray-700">
                                        <i className="fa-solid fa-phone text-red-500 text-xl mr-3 w-6 text-center"></i> 
                                        <span className="font-bold text-lg">{Truck.seller_phone}</span>
                                    </a>
                                )}
                                
                                {Truck.seller_email && (
                                    <a href={`mailto:${Truck.seller_email}`} className="flex items-center w-full bg-gray-800 hover:bg-gray-700 py-3 px-4 rounded-md transition border border-gray-700">
                                        <i className="fa-solid fa-envelope text-red-500 text-xl mr-3 w-6 text-center"></i> 
                                        <span className="font-medium truncate">{Truck.seller_email}</span>
                                    </a>
                                )}
                                
                                {!Truck.seller_phone && !Truck.seller_email && (
                                    <p className="text-gray-400 italic">Seller did not provide direct contact details.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}