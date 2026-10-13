'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DashboardPage() {
    const [myListings, setMyListings] = useState([]);
    const [savedListings, setSavedListings] = useState([]); 
    
    const [userEmail, setUserEmail] = useState('');
    const [userId, setUserId] = useState(null); // NEW: Need user ID for checkout
    const [actionLoading, setActionLoading] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [dashboardError, setDashboardError] = useState('');
    const [activeTab, setActiveTab] = useState('active');
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setDashboardError("Please sign in to view your dashboard.");
                setLoading(false);
                return;
            }
            setUserEmail(user.email);
            setUserId(user.id); // Save the ID for Stripe checkout
            
            const { data: Trucks, error } = await supabase
                .from('trucks')
                .select('*')
                .eq('seller_id', user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setMyListings(Trucks || []);

            const { data: savedData, error: savedError } = await supabase
                .from('saved_trucks')
                .select('*, Trucks(*)')
                .eq('user_id', user.id);
                
            if (!savedError && savedData) {
                const formattedSaved = savedData
                    .filter(item => item.Trucks && !item.Trucks.is_sold && !item.Trucks.is_archived && item.Trucks.is_approved)
                    .map(item => item.Trucks); 
                setSavedListings(formattedSaved);
            }

        } catch (err) {
            console.error("Error loading dashboard data:", err);
            setDashboardError("Failed to load listings.");
        } finally {
            setLoading(false);
        }
    };

    // Initial Data Fetch
    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Realtime Listener for Instant Badge Updates
    useEffect(() => {
        if (!userEmail) return;

        const channel = supabase
            .channel('dashboard-Trucks-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'trucks',
                },
                (payload) => {
                    console.log('REALTIME PAYLOAD RECEIVED:', payload); 

                    if (payload.new && payload.new.id) {
                        setMyListings((prevListings) =>
                            prevListings.map((listing) =>
                                listing.id === payload.new.id ? { ...listing, ...payload.new } : listing
                            )
                        );
                    }
                }
            )
            .subscribe((status) => {
                console.log('Realtime Subscription Status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userEmail]);

    const handleMarkSold = async (id) => {
        setActionLoading(id);
        setDashboardError('');
        try {
            const res = await fetch('/api/cancel-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ TruckId: id })
            });
            if (!res.ok) throw new Error('Failed to cancel subscription.');
            await fetchDashboardData(); 
        } catch (err) {
            console.error("Error details:", err);
            setDashboardError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleArchive = async (id) => {
        setActionLoading(`archive-${id}`);
        setDashboardError('');
        const { error } = await supabase
            .from('trucks')
            .update({ is_archived: true })
            .eq('id', id);
        if (error) setDashboardError("Error archiving Truck: " + error.message);
        else await fetchDashboardData();
        setActionLoading(null);
    };

    const handleUnsave = async (id) => {
        setActionLoading(`unsave-${id}`);
        setDashboardError('');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase
                .from('saved_trucks')
                .delete()
                .eq('user_id', user.id)
                .eq('Truck_id', id);
                
            if (error) setDashboardError("Error removing saved Truck: " + error.message);
            else setSavedListings(prev => prev.filter(t => t.id !== id));
        }
        setActionLoading(null);
    };

    // NEW: Handle Reposting an Archived Truck
    const handleRepost = async (Truck) => {
        setActionLoading(`repost-${Truck.id}`);
        setDashboardError('');
        
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    TruckData: Truck, 
                    userId: userId 
                })
            });
            
            const stripeData = await res.json();
            
            if (stripeData.url) {
                window.location.href = stripeData.url; 
            } else {
                setDashboardError("Stripe Error: " + stripeData.error);
            }
        } catch (error) {
            console.error("Fetch error:", error);
            setDashboardError("Network error when connecting to secure checkout.");
        } finally {
            setActionLoading(null);
        }
    };

    const displayListings = activeTab === 'saved' 
        ? savedListings 
        : myListings.filter(listing => activeTab === 'archived' ? listing.is_archived : !listing.is_archived);

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500 font-medium">Loading your dashboard...</p></div>;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-gray-900 text-white p-4 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <Link href="/" className="font-bold text-xl tracking-tight hover:text-gray-200">&larr; Return to TruckLion</Link>
                    <Link href="/sell" className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white shadow transition flex items-center">
                        <i className="fa-solid fa-tag mr-2"></i>Post a Truck
                    </Link>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
                <div className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Dashboard</h1>
                        {userEmail && <p className="text-gray-500 text-sm mt-1">Logged in as: <span className="font-medium text-gray-700">{userEmail}</span></p>}
                    </div>
                    
                    <div className="flex flex-wrap bg-gray-200 rounded-lg p-1 self-start">
                        <button onClick={() => setActiveTab('active')} className={`px-4 sm:px-6 py-2 rounded-md font-bold text-sm transition ${activeTab === 'active' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}>Active & Sold</button>
                        <button onClick={() => setActiveTab('archived')} className={`px-4 sm:px-6 py-2 rounded-md font-bold text-sm transition ${activeTab === 'archived' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}>Archived</button>
                        <button onClick={() => setActiveTab('saved')} className={`px-4 sm:px-6 py-2 rounded-md font-bold text-sm transition ${activeTab === 'saved' ? 'bg-white text-gray-900 shadow' : 'text-gray-600'}`}>Saved Listings</button>
                    </div>
                </div>

                {dashboardError && <div className="mb-6 bg-red-100 text-red-800 border-l-4 border-red-500 p-4 rounded-md shadow-sm">{dashboardError}</div>}

                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                        <h2 className="font-bold text-lg text-gray-800">
                            <i className={`fa-solid ${activeTab === 'active' ? 'fa-list' : activeTab === 'saved' ? 'fa-bookmark' : 'fa-box-archive'} mr-2`}></i>
                            {activeTab === 'active' ? 'My Listed Trucks' : activeTab === 'saved' ? 'My Saved Trucks' : 'Archived Trucks'}
                        </h2>
                    </div>

                    {displayListings.length === 0 ? (
                        <div className="p-10 text-center text-gray-500"><p>No {activeTab === 'active' ? 'active or sold' : activeTab === 'saved' ? 'saved' : 'archived'} Trucks found.</p></div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {displayListings.map((listing) => (
                                <div key={listing.id} className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 transition hover:bg-gray-50">
                                    
                                    <Link href={`/?TruckId=${listing.id}&from=dashboard`} className="flex items-center gap-4 w-full sm:w-auto hover:opacity-80 transition cursor-pointer group">
                                        {listing.images && listing.images.length > 0 ? (
                                            <img src={listing.images[0]} alt="Truck" className="w-20 h-20 bg-gray-200 rounded object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400"><i className="fa-solid fa-image text-xl"></i></div>
                                        )}
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900 group-hover:text-red-600 transition">{listing.condition ? `${listing.condition} - ` : ''}{listing.category}</h3>
                                            <p className="text-sm text-gray-500">{listing.city}, {listing.state} • <span className="text-blue-600 font-semibold">${Number(listing.price).toLocaleString()}</span></p>
                                            
                                            <div className="mt-2 flex gap-2 flex-wrap">
                                                {listing.is_archived ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">Archived</span>
                                                ) : !listing.is_approved ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">Pending Approval</span>
                                                ) : listing.is_sold ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">Sold</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Active</span>
                                                )}
                                            </div>
                                        </div>
                                    </Link>

                                    <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
                                        {activeTab === 'saved' ? (
                                            <button onClick={() => handleUnsave(listing.id)} className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2.5 rounded text-sm font-bold transition flex items-center z-10 relative">
                                                <i className="fa-solid fa-xmark mr-2"></i> {actionLoading === `unsave-${listing.id}` ? 'Removing...' : 'Remove'}
                                            </button>
                                        ) : (
                                            <>
                                                {/* NEW: Repost Button for Archived Trucks */}
                                                {listing.is_archived && (
                                                    <button 
                                                        onClick={() => handleRepost(listing)} 
                                                        disabled={actionLoading === `repost-${listing.id}`}
                                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded text-sm font-bold flex items-center transition z-10 relative disabled:bg-red-400"
                                                    >
                                                        {actionLoading === `repost-${listing.id}` ? (
                                                            <><i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Loading...</>
                                                        ) : (
                                                            <><i className="fa-solid fa-rotate-right mr-2"></i> Repost ($19/mo)</>
                                                        )}
                                                    </button>
                                                )}

                                                {!listing.is_sold && !listing.is_archived && (
                                                    <>
                                                        <Link href={`/edit/${listing.id}`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded text-sm font-medium flex items-center transition z-10 relative">
                                                            <i className="fa-solid fa-pen mr-2"></i>Edit
                                                        </Link>
                                                        {confirmId === listing.id ? (
                                                            <div className="flex gap-2 z-10 relative">
                                                                <button onClick={() => setConfirmId(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2.5 rounded text-sm font-medium transition">Cancel</button>
                                                                <button onClick={() => handleMarkSold(listing.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded text-sm font-medium transition">{actionLoading === listing.id ? 'Processing...' : 'Confirm Sold'}</button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center z-10 relative">
                                                                <button onClick={() => setConfirmId(listing.id)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded text-sm font-medium transition">Mark Sold</button>
                                                                <span className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider whitespace-nowrap">Cancel Sub</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {listing.is_sold && !listing.is_archived && (
                                                    <button onClick={() => handleArchive(listing.id)} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2.5 rounded text-sm font-medium transition z-10 relative">
                                                        {actionLoading === `archive-${listing.id}` ? 'Archiving...' : 'Archive Listing'}
                                                    </button>
                                                )}
                                            </>
                                        )}
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