'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Autocomplete from 'react-google-autocomplete'; // NEW: Imported Autocomplete
import { APIProvider, Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const CATEGORIES = ['Auto Hauler', 'Boat', 'Camper', 'Conestoga', 'Container', 'Deck Over', 'Dry Van', 'Dump', 'Enclosed', 'Flatbed', 'Gooseneck', 'Horse', 'Logging', 'Low-Boy', 'Pole', 'Refrigerated', 'RGN', 'Step Deck', 'Tanker', 'Utility'];
const SUSPENSIONS = ['Air Ride', 'Spring'];
const CONDITIONS = ['New', 'Used'];
const SELLER_TYPES = ['Private Seller', 'Dealership'];
const AXLES = ['1', '2', '3', '4+'];
const BRAKE_TYPES = ['Air', 'Electric/Hydraulic', 'Drum', 'None/Other'];

const formatLength = (len) => {
    if (!len) return '';
    const str = String(len).trim();
    if (str.match(/(ft|feet|'|"|m)$/i)) return str;
    return `${str}'`;
};

export default function TrailerLionApp() {
    const router = useRouter(); 
    const [currentView, setCurrentView] = useState('browse');
    const [viewMode, setViewMode] = useState('list'); // NEW: Lifted up so the app remembers your choice!
    
    const [authMode, setAuthMode] = useState('login'); 

    const [selectedTrailer, setSelectedTrailer] = useState(null); 
    
    const [isInitializing, setIsInitializing] = useState(true);
    const [backNavSource, setBackNavSource] = useState('browse'); 
    
    // UPDATED: Added radius, lat, and lng to the filters state
    const [filters, setFilters] = useState({
        condition: '', category: [], minPrice: '', maxPrice: '', minYear: '', maxYear: '', suspension: '', 
        city: '', state: '', radius: 'Nationwide', lat: null, lng: null, 
        length: '', minGvwr: '', maxGvwr: '', seller_type: '', axles: '', brake_type: '' 
    });

    const [session, setSession] = useState(null);
    const [trailers, setTrailers] = useState([]);
    const [notification, setNotification] = useState(null);
    
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            setNotification({ type: 'success', message: 'Payment successful! Your trailer will be public once approved by an admin.' });
            window.history.replaceState(null, '', window.location.pathname);
        } else if (query.get('canceled')) {
            setNotification({ type: 'error', message: 'Payment was canceled. Your trailer has not been listed.' });
            window.history.replaceState(null, '', window.location.pathname);
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (event === 'PASSWORD_RECOVERY') {
                setCurrentView('update-password');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Trigger a database fetch whenever the location or radius changes
    useEffect(() => {
        fetchTrailers();
    }, [filters.radius, filters.lat, filters.lng]);

    async function fetchTrailers() {
        let query;

        // If they selected a radius AND we have coordinates, use PostGIS
        if (filters.radius !== 'Nationwide' && filters.lat && filters.lng) {
            query = supabase.rpc('search_trailers_in_radius', {
                search_lat: filters.lat,
                search_lng: filters.lng,
                radius_miles: parseInt(filters.radius)
            });
        } else {
            // Standard fetch for Nationwide
            query = supabase
                .from('trailers')
                .select('*')
                .eq('is_sold', false)
                .eq('is_archived', false)
                .eq('is_approved', true) 
                .order('id', { ascending: false })
                .limit(50); 
        }

        const { data, error } = await query;
        
        if (error) {
            console.error("Error fetching trailers:", error);
        } else {
            setTrailers(data || []);
            
            if (typeof window !== 'undefined') {
                const urlQuery = new URLSearchParams(window.location.search);
                const trailerIdToLoad = urlQuery.get('trailerId');
                const fromSource = urlQuery.get('from');

                if (trailerIdToLoad && data) {
                    const foundTrailer = data.find(t => t.id.toString() === trailerIdToLoad);
                    if (foundTrailer) {
                        setSelectedTrailer(foundTrailer);
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

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 text-gray-900 font-sans">
            <nav className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-3 min-h-[70px]">
                        
                        <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('browse')}>
                            <img src="/logo-white.png" alt="TrailerLion" className="h-10 md:h-14 w-auto object-contain" />
                        </div>
                        
                        <div className="hidden md:flex items-center space-x-4">
                            <button onClick={() => setCurrentView('browse')} className={`px-3 py-2 rounded-md text-sm font-medium ${currentView === 'browse' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                                <i className="fa-solid fa-magnifying-glass mr-2"></i>Browse Trailers
                            </button>
                            
                            {session ? (
                                <>
                                    <Link href="/sell" className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition">
                                        <i className="fa-solid fa-tag mr-2"></i>Post a Trailer
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
                                        Post a Trailer
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
                                <i className="fa-solid fa-magnifying-glass mr-3 w-5 text-center"></i> Browse Trailers
                            </button>
                            
                            {session ? (
                                <>
                                    <Link 
                                        href="/sell" 
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className="w-full text-left px-4 py-3 rounded-md text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white flex items-center transition"
                                    >
                                        <i className="fa-solid fa-tag mr-3 w-5 text-center"></i> Post a Trailer
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
                                        Post a Trailer
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
                                trailers={trailers} 
                                onViewDetails={(trailer) => {
                                    setSelectedTrailer(trailer);
                                    setBackNavSource('browse');
                                    setCurrentView('details');
                                }} 
                                isMobileMenuOpen={isMobileMenuOpen}
                                filters={filters} 
                                setFilters={setFilters} 
                                viewMode={viewMode}
                                setViewMode={setViewMode}
                            />
                        )}
                        
                        {currentView === 'details' && selectedTrailer && (
                            <TrailerDetailsView 
                                trailer={selectedTrailer} 
                                session={session} 
                                backNavSource={backNavSource} 
                                router={router} 
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
// AUTH VIEW 
// ---------------------------------------------------------
function AuthView({ initialMode = 'login', onModeChange }) {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        setIsLogin(initialMode === 'login');
    }, [initialMode]);

    const toggleMode = () => {
        const newMode = !isLogin;
        setIsLogin(newMode);
        if (onModeChange) onModeChange(newMode ? 'login' : 'register');
        setMessage('');
        setConfirmPassword(''); 
        setPassword('');
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        
        if (isResetting) {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/`, 
            });
            if (error) {
                setMessage(error.message);
            } else {
                setMessage('Check your email for the password reset link!');
                setIsResetting(false);
                setPassword('');
            }
        } else {
            let error;
            if (isLogin) {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                error = signInError;
            } else {
                if (password !== confirmPassword) {
                    setMessage("Passwords do not match. Please try again.");
                    setLoading(false);
                    return;
                }
                const { error: signUpError } = await supabase.auth.signUp({ email, password });
                error = signUpError;
                if (!error) setMessage('Registration successful! Logging you in...');
            }

            if (error) {
                setMessage(error.message);
            }
        }
        setLoading(false);
    };

    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 mt-10">
            <h2 className="text-2xl font-bold text-center mb-6">
                {isResetting ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create an Account')}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>
                
                {!isResetting && (
                    <>
                        <div>
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                {isLogin && (
                                    <button type="button" onClick={() => { setIsResetting(true); setMessage(''); }} className="text-xs text-red-600 hover:text-red-800 font-medium">
                                        Forgot Password?
                                    </button>
                                )}
                            </div>
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                        </div>

                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                                <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                            </div>
                        )}
                    </>
                )}
                
                <button type="submit" disabled={loading} className="w-full bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 transition">
                    {loading ? 'Processing...' : (isResetting ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Register'))}
                </button>
            </form>
            
            {message && <p className="mt-4 text-center text-sm font-medium text-red-600">{message}</p>}
            
            <div className="mt-6 text-center border-t pt-4">
                {isResetting ? (
                    <button onClick={() => { setIsResetting(false); setMessage(''); }} className="text-sm text-gray-600 hover:text-red-600 font-medium">
                        Remembered your password? Sign in here.
                    </button>
                ) : (
                    <button onClick={toggleMode} className="text-sm text-gray-600 hover:text-red-600 font-medium">
                        {isLogin ? "Don't have an account? Register here." : "Already have an account? Sign in."}
                    </button>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// UPDATE PASSWORD VIEW
// ---------------------------------------------------------
function UpdatePasswordView({ onSuccess }) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); 
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleUpdate = async (e) => {
        e.preventDefault();
        setMessage('');

        if (newPassword !== confirmPassword) {
            setMessage('Error: Passwords do not match. Please try again.');
            return;
        }

        setLoading(true);

        const { error } = await supabase.auth.updateUser({ password: newPassword });

        if (error) {
            setMessage(error.message);
            setLoading(false);
        } else {
            setMessage('Password updated successfully! Taking you to your dashboard...');
            setTimeout(() => {
                onSuccess();
            }, 2000);
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg border-t-4 border-red-600 mt-10">
            <h2 className="text-2xl font-bold text-center mb-6">Create New Password</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-red-600 text-white py-2 rounded-md font-bold hover:bg-red-700 disabled:opacity-50 transition">
                    {loading ? 'Saving...' : 'Update Password'}
                </button>
            </form>
            
            {message && (
                <p className={`mt-4 text-center text-sm font-medium ${message.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {message}
                </p>
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
            // Zoom out to the whole US
            map.panTo({ lat: 39.8283, lng: -98.5795 });
            map.setZoom(4);
        } else {
            // Fly to the newly searched city
            map.panTo({ lat: lat, lng: lng });
            
            // Adjust the zoom perfectly based on their radius dropdown
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
// UPDATED: Now accepting viewMode and setViewMode as props!
function BrowseView({ trailers, onViewDetails, isMobileMenuOpen, filters, setFilters, viewMode, setViewMode }) {
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    
    const filterContainerRef = useRef(null);
    
    const categoryCounts = useMemo(() => {
        const counts = {};
        CATEGORIES.forEach(c => counts[c] = 0);
        trailers.forEach(t => {
            if (counts[t.category] !== undefined) {
                counts[t.category]++;
            }
        });
        return counts;
    }, [trailers]);

    const sortedCategories = useMemo(() => {
        return [...CATEGORIES].sort((a, b) => {
            const countDiff = categoryCounts[b] - categoryCounts[a];
            if (countDiff !== 0) {
                return countDiff; 
            }
            return a.localeCompare(b); 
        });
    }, [categoryCounts]);

    const filteredTrailers = useMemo(() => {
        return trailers.filter(t => {
            if (filters.condition && t.condition !== filters.condition) return false;
            if (filters.category && filters.category.length > 0 && !filters.category.includes(t.category)) return false;
            if (filters.suspension && t.suspension !== filters.suspension) return false;
            if (filters.seller_type && t.seller_type !== filters.seller_type) return false;
            if (filters.axles && t.axles !== filters.axles) return false;
            if (filters.brake_type && t.brake_type !== filters.brake_type) return false;
            
            if (filters.minYear && parseInt(t.year) < parseInt(filters.minYear)) return false;
            if (filters.maxYear && parseInt(t.year) > parseInt(filters.maxYear)) return false;
            
            if (filters.minPrice && t.price < parseInt(filters.minPrice)) return false;
            if (filters.maxPrice && t.price > parseInt(filters.maxPrice)) return false;
            if (filters.minGvwr && parseInt(t.gvwr) < parseInt(filters.minGvwr)) return false;
            if (filters.maxGvwr && parseInt(t.gvwr) > parseInt(filters.maxGvwr)) return false;
            if (filters.length && (!t.length || !t.length.toLowerCase().includes(filters.length.toLowerCase()))) return false;
            
           
            return true;
        });
    }, [trailers, filters]);

    const updateFilter = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleClearFilters = () => {
        // UPDATED: Clear the new location filters as well
        setFilters({condition: '', category: [], minPrice: '', maxPrice: '', minYear: '', maxYear: '', suspension: '', city: '', state: '', radius: 'Nationwide', lat: null, lng: null, length: '', minGvwr: '', maxGvwr: '', seller_type: '', axles: '', brake_type: ''});
        
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
                        Filter Trailers
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
                
                <div className={`w-full md:w-1/4 md:sticky md:top-4 md:self-start ${showMobileFilters ? 'fixed top-[80px] left-0 w-full px-4 z-50 md:z-30 md:px-0' : 'hidden md:block z-30'}`}>
                    <div ref={filterContainerRef} className="bg-white p-6 rounded-lg shadow-2xl md:shadow-md h-fit border-t-4 border-gray-900 max-h-[75vh] md:max-h-[85vh] overflow-y-auto">
                        
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-800"><i className="fa-solid fa-filter mr-2"></i>Filter Results</h2>
                            <button 
                                onClick={() => setShowMobileFilters(false)}
                                className="md:hidden bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition text-sm font-bold shadow-sm"
                            >
                                Search
                            </button>
                        </div>
                        
                        <div className="space-y-4">
                            
                            {/* REORDERED: Location first, then Distance */}
                            <div className="space-y-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                
                                {/* 1. LOCATION SECTION */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">From Location</label>
                                    
                                    <button 
                                        onClick={() => {
                                            if (navigator.geolocation) {
                                                navigator.geolocation.getCurrentPosition(
                                                    (position) => {
                                                        updateFilter('lat', position.coords.latitude);
                                                        updateFilter('lng', position.coords.longitude);
                                                        updateFilter('city', 'Current Location');
                                                        updateFilter('state', '');
                                                        // Auto-set radius to 500 if they are still on Nationwide
                                                        if (filters.radius === 'Nationwide') updateFilter('radius', '500');
                                                    },
                                                    (error) => alert('Unable to retrieve your location. Please type a city manually.')
                                                );
                                            }
                                        }}
                                        className="w-full mb-3 bg-white border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 transition text-sm font-bold shadow-sm flex justify-center items-center gap-2"
                                    >
                                        <i className="fa-solid fa-location-crosshairs text-blue-600"></i> Use My Location
                                    </button>

                                    <div className="relative flex items-center justify-center my-3">
                                        <span className="bg-gray-50 px-2 text-xs text-gray-400 font-medium z-10">OR SEARCH</span>
                                        <div className="absolute w-full h-px bg-gray-300"></div>
                                    </div>

                                    <Autocomplete
                                        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
                                        onPlaceSelected={(place) => {
                                            if (!place.geometry) return;
                                            updateFilter('lat', place.geometry.location.lat());
                                            updateFilter('lng', place.geometry.location.lng());
                                            
                                            let newCity = "";
                                            let newState = "";
                                            place.address_components.forEach((component) => {
                                                if (component.types.includes("locality")) newCity = component.long_name;
                                                if (component.types.includes("administrative_area_level_1")) newState = component.short_name; 
                                            });
                                            updateFilter('city', newCity);
                                            updateFilter('state', newState);
                                            // Auto-set radius to 500 if they are still on Nationwide
                                            if (filters.radius === 'Nationwide') updateFilter('radius', '500');
                                        }}
                                        options={{ types: ["(cities)"], componentRestrictions: { country: "us" } }}
                                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600 text-sm"
                                        placeholder="Type a city... (e.g. Dallas, TX)"
                                    />
                                    
                                    {filters.city && (
                                        <p className="mt-2 text-xs text-green-600 font-bold">
                                            <i className="fa-solid fa-check-circle mr-1"></i> 
                                            Searching near: {filters.city} {filters.state && `, ${filters.state}`}
                                        </p>
                                    )}
                                </div>

                                {/* 2. DISTANCE SECTION */}
                                <div className="pt-3 border-t border-gray-200">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Search Distance</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600 font-medium" 
                                        value={filters.radius} 
                                        onChange={(e) => updateFilter('radius', e.target.value)}
                                    >
                                        <option value="Nationwide">Nationwide</option>
                                        <option value="50">Within 50 Miles</option>
                                        <option value="100">Within 100 Miles</option>
                                        <option value="250">Within 250 Miles</option>
                                        <option value="500">Within 500 Miles</option>
                                    </select>
                                </div>

                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                                <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.condition} onChange={(e) => updateFilter('condition', e.target.value)}>
                                    <option value="">Any Condition</option>
                                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 shadow-inner">
                                    {sortedCategories.map(c => (
                                        <label key={c} className="flex justify-between items-center cursor-pointer group">
                                            <div className="flex items-center">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-4 h-4 text-red-600 bg-white border-gray-300 rounded focus:ring-red-600 focus:ring-2 cursor-pointer"
                                                    checked={filters.category.includes(c)}
                                                    onChange={() => {
                                                        const current = filters.category || [];
                                                        const newCat = current.includes(c) ? current.filter(item => item !== c) : [...current, c];
                                                        updateFilter('category', newCat);
                                                    }}
                                                />
                                                <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 font-medium">{c}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm">
                                                {categoryCounts[c]}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Seller Type</label>
                                <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.seller_type} onChange={(e) => updateFilter('seller_type', e.target.value)}>
                                    <option value="">Any Seller</option>
                                    {SELLER_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Year</label>
                                    <input type="number" placeholder="e.g. 2015" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.minYear} onChange={(e) => updateFilter('minYear', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Year</label>
                                    <input type="number" placeholder="e.g. 2024" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.maxYear} onChange={(e) => updateFilter('maxYear', e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Length (Ft.)</label>
                                <input type="number" min="0" placeholder="e.g. 40" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.length} onChange={(e) => updateFilter('length', e.target.value)} />
                           </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
                                    <input type="number" placeholder="$0" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.minPrice} onChange={(e) => updateFilter('minPrice', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
                                    <input type="number" placeholder="$Any" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.maxPrice} onChange={(e) => updateFilter('maxPrice', e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Min GVWR</label>
                                    <input type="number" placeholder="0 lbs" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.minGvwr} onChange={(e) => updateFilter('minGvwr', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Max GVWR</label>
                                    <input type="number" placeholder="Any lbs" className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.maxGvwr} onChange={(e) => updateFilter('maxGvwr', e.target.value)} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Suspension Type</label>
                                <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.suspension} onChange={(e) => updateFilter('suspension', e.target.value)}>
                                    <option value="">Any Suspension</option>
                                    {SUSPENSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Axles</label>
                                <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.axles} onChange={(e) => updateFilter('axles', e.target.value)}>
                                    <option value="">Any Axles</option>
                                    {AXLES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Brake Type</label>
                                <select className="w-full border border-gray-300 rounded-md p-2 focus:ring-red-600 focus:border-red-600" value={filters.brake_type} onChange={(e) => updateFilter('brake_type', e.target.value)}>
                                    <option value="">Any Brakes</option>
                                    {BRAKE_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-6">
                                <button 
                                    onClick={handleClearFilters} 
                                    className="w-full bg-gray-200 text-gray-800 py-3 rounded-md hover:bg-gray-300 transition text-sm font-bold"
                                >
                                    Clear Filters
                                </button>
                                
                                <button 
                                    onClick={() => setShowMobileFilters(false)}
                                    className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition text-sm font-bold shadow-md"
                                >
                                    Search
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                {/* --- TRAILER GRID / MAP --- */}
                <div className="w-full md:w-3/4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        
                        {/* Grouping the Title and the Toggle together on the left */}
                        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                            <h1 className="text-2xl font-bold text-gray-900">Trailers for Sale</h1>
                            
                            {/* NEW: Map vs List Toggle */}
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
                        
                        {/* Pushing the Results count to the far right */}
                        <span className="text-gray-500 font-medium whitespace-nowrap">{filteredTrailers.length} Results</span>
                    </div>
                    
                    {filteredTrailers.length === 0 && viewMode === 'list' ? (
                        <div className="bg-white p-10 rounded-lg shadow text-center border border-gray-200">
                            <i className="fa-solid fa-truck-ramp-box text-5xl text-gray-300 mb-4"></i>
                            <h3 className="text-xl font-medium text-gray-900">No trailers found</h3>
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

                                    {filteredTrailers.map(trailer => (
                                        trailer.lat && trailer.lng ? (
                                           <AdvancedMarker 
                                                key={trailer.id} 
                                                position={{ lat: trailer.lat, lng: trailer.lng }}
                                                onClick={() => onViewDetails(trailer)}
                                                title={`${trailer.year ? trailer.year + ' ' : ''}${trailer.category} - $${Number(trailer.price).toLocaleString()}`}
                                                className="z-0 hover:z-50"
                                            >
                                                {/* Custom Thumbnail Pin with Hover Expansion */}
                                                <div className="relative flex flex-col items-center cursor-pointer transition-transform duration-300 ease-out hover:scale-150 origin-bottom">
                                                    <div className="w-14 h-14 bg-white rounded-lg border-2 border-red-600 shadow-lg overflow-hidden flex items-center justify-center">
                                                        {trailer.images && trailer.images.length > 0 ? (
                                                            <img src={trailer.images[0]} alt={trailer.category} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <i className="fa-solid fa-truck-ramp-box text-gray-300 text-xl"></i>
                                                        )}
                                                    </div>
                                                    {/* The little pointer arrow at the bottom */}
                                                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-600 -mt-[1px]"></div>
                                                </div>
                                            </AdvancedMarker>
                                        ) : null
                                    ))}
                                </Map>
                            </APIProvider>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-300">
                            {filteredTrailers.map(trailer => (
                                <div key={trailer.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
                                    <div className="h-48 bg-gray-200 relative overflow-hidden cursor-pointer" onClick={() => onViewDetails(trailer)}>
                                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                                            <i className="fa-solid fa-image text-4xl text-gray-600"></i>
                                            {trailer.images && trailer.images.length > 0 && (
                                                <img src={trailer.images[0]} alt={trailer.category} loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-80 hover:opacity-100 transition-opacity" />
                                            )}
                </div>
                {/* Seller Type Badge (Dealer = Green, Private Party = Blue) */}
                {trailer.seller_type && (
                    <div className="absolute top-2 left-2 z-10">
                        <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full shadow-md text-white ${
                            trailer.seller_type.toLowerCase() === 'dealership' || trailer.seller_type.toLowerCase() === 'dealer' 
                                ? 'bg-green-600 border border-green-700' 
                                : 'bg-blue-600 border border-blue-700'
                        }`}>
                            {trailer.seller_type.toLowerCase() === 'dealership' ? 'Dealer' : trailer.seller_type}
                        </span>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                    ${Number(trailer.price).toLocaleString()}
                </div>
                                    </div>
                                    <div className="p-5 flex-grow flex flex-col">
                                        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${trailer.condition === 'New' ? 'text-green-600' : trailer.condition === 'Used' ? 'text-blue-600' : 'text-red-600'}`}>
                                             {trailer.condition ? `${trailer.condition} • ` : ''}{trailer.category}
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            {trailer.year ? `${trailer.year} ` : ''}{formatLength(trailer.length)} • {trailer.gvwr} lbs GVWR
                                        </h3>
                                        
                                        <div className="text-sm text-gray-600 space-y-1 mb-4 flex-grow">
                                            <p><i className="fa-solid fa-location-dot w-5 text-gray-400"></i> {trailer.city}, {trailer.state}</p>
                                            <p><i className="fa-solid fa-cogs w-5 text-gray-400"></i> {trailer.suspension}</p>
                                        </div>
                                        
                                        <button onClick={() => onViewDetails(trailer)} className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded font-medium transition mt-auto">
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// TRAILER DETAILS VIEW
// ---------------------------------------------------------
function TrailerDetailsView({ trailer, onBack, session, backNavSource, router }) {
    const [activeImage, setActiveImage] = useState(trailer.images && trailer.images.length > 0 ? trailer.images[0] : null);
    
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const userId = session?.user?.id;

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        if (userId && trailer) {
            checkIfSaved();
        }
    }, [userId, trailer]);

    const checkIfSaved = async () => {
        const { data } = await supabase
            .from('saved_trailers')
            .select('id')
            .eq('user_id', userId)
            .eq('trailer_id', trailer.id)
            .single();
            
        if (data) setIsSaved(true);
    };

    const toggleSave = async () => {
        if (!userId) return;
        setIsSaving(true);
        
        if (isSaved) {
            await supabase.from('saved_trailers').delete().eq('user_id', userId).eq('trailer_id', trailer.id);
            setIsSaved(false);
        } else {
            await supabase.from('saved_trailers').insert({ user_id: userId, trailer_id: trailer.id });
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
                                <img src={activeImage} alt={trailer.category} className="w-full h-full object-contain" />
                            ) : (
                                <div className="text-center text-gray-400">
                                    <i className="fa-solid fa-image text-6xl mb-2"></i>
                                    <p>No images provided</p>
                                </div>
                            )}
                        </div>

                        {trailer.images && trailer.images.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {trailer.images.map((img, idx) => (
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
                                {trailer.condition ? `${trailer.condition} • ` : ''}{trailer.category}
                            </span>
                            
                            <div className="flex justify-between items-start mt-1 mb-2">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">{trailer.year ? `${trailer.year} ` : ''}{formatLength(trailer.length)} Trailer</h1>
                                    <div className="text-4xl font-bold text-gray-900 mt-2">${Number(trailer.price).toLocaleString()}</div>
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

                        {trailer.description && (
                            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                                <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">Description</h3>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{trailer.description}</p>
                            </div>
                        )}

                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm mb-6">
                            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Specifications</h3>
                            <ul className="space-y-3 text-sm">
                                {trailer.year && <li className="flex justify-between"><span className="text-gray-500">Year</span> <span className="font-medium text-gray-900">{trailer.year}</span></li>}
                                
                                <li className="flex justify-between"><span className="text-gray-500">Condition</span> <span className="font-medium text-gray-900">{trailer.condition || 'Used'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Length</span> <span className="font-medium text-gray-900">{formatLength(trailer.length)}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">GVWR</span> <span className="font-medium text-gray-900">{Number(trailer.gvwr).toLocaleString()} lbs</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Suspension</span> <span className="font-medium text-gray-900">{trailer.suspension}</span></li>
                                
                                <li className="flex justify-between"><span className="text-gray-500">Axles</span> <span className="font-medium text-gray-900">{trailer.axles || 'Not Specified'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Brakes</span> <span className="font-medium text-gray-900">{trailer.brake_type || 'Not Specified'}</span></li>
                                <li className="flex justify-between"><span className="text-gray-500">Seller Type</span> <span className="font-medium text-gray-900">{trailer.seller_type || 'Not Specified'}</span></li>

                                <li className="flex justify-between mt-2 pt-2 border-t"><span className="text-gray-500">Location</span> <span className="font-medium text-gray-900">{trailer.city}, {trailer.state}</span></li>
                            </ul>
                        </div>
                        {/* Location Map Preview */}
            {trailer.lat && trailer.lng && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Location</h3>
                    <p className="text-sm text-gray-500 mb-3 flex items-center">
                        <i className="fa-solid fa-location-dot text-red-600 mr-2"></i>
                        {trailer.city}, {trailer.state}
                    </p>
                    <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-300 shadow-inner">
                        <img 
                            src={`https://maps.googleapis.com/maps/api/staticmap?center=${trailer.lat},${trailer.lng}&zoom=7&size=600x300&markers=color:red%7C${trailer.lat},${trailer.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                            alt="Trailer Location Map"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
            )}
                        <div className="bg-gray-900 p-6 rounded-lg shadow-md text-white mt-auto">
                            <h3 className="font-bold text-lg mb-4 border-b border-gray-700 pb-2"><i className="fa-solid fa-address-card mr-2 text-red-500"></i>Contact Seller</h3>
                            
                            {trailer.seller_name && (
                                <p className="font-bold text-xl mb-4">{trailer.seller_name}</p>
                            )}
                            
                            <div className="space-y-3">
                                {trailer.seller_phone && (
                                    <a href={`tel:${trailer.seller_phone}`} className="flex items-center w-full bg-gray-800 hover:bg-gray-700 py-3 px-4 rounded-md transition border border-gray-700">
                                        <i className="fa-solid fa-phone text-red-500 text-xl mr-3 w-6 text-center"></i> 
                                        <span className="font-bold text-lg">{trailer.seller_phone}</span>
                                    </a>
                                )}
                                
                                {trailer.seller_email && (
                                    <a href={`mailto:${trailer.seller_email}`} className="flex items-center w-full bg-gray-800 hover:bg-gray-700 py-3 px-4 rounded-md transition border border-gray-700">
                                        <i className="fa-solid fa-envelope text-red-500 text-xl mr-3 w-6 text-center"></i> 
                                        <span className="font-medium truncate">{trailer.seller_email}</span>
                                    </a>
                                )}
                                
                                {!trailer.seller_phone && !trailer.seller_email && (
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