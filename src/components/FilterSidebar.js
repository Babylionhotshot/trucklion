import React from 'react';
import Autocomplete from 'react-google-autocomplete';

export default function FilterSidebar({
    showMobileFilters,
    setShowMobileFilters,
    filterContainerRef,
    filterSellerType,
    setFilterSellerType,
    filters,
    updateFilter,
    handleMakeChange,
    availableMakes,
    availableModels,
    handleClearFilters
}) {
    return (
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
                    
                    {/* Seller Type */}
                    <div className="mb-4 pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Seller Type</label>
                        <select 
                            value={filterSellerType} 
                            onChange={(e) => setFilterSellerType(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-600 focus:border-red-600 p-2 border"
                        >
                            <option value="All Sellers">All Sellers</option>
                            <option value="Private Seller">Private Seller</option>
                            <option value="Dealership">Dealership</option>
                        </select>
                    </div>

                    {/* Make & Model */}
                    <div className="mb-4 pt-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                        <select 
                            value={filters.make} 
                            onChange={handleMakeChange}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-600 focus:border-red-600 p-2 border"
                        >
                            <option value="">All Makes</option>
                            {availableMakes.map(make => (
                                <option key={make} value={make}>{make}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        <select 
                            value={filters.model} 
                            onChange={(e) => updateFilter('model', e.target.value)}
                            disabled={!filters.make}
                            className={`w-full border-gray-300 rounded-md shadow-sm p-2 border ${!filters.make ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'focus:ring-red-600 focus:border-red-600'}`}
                        >
                            <option value="">All Models</option>
                            {availableModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    {/* Condition */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                        <select 
                            value={filters.condition} 
                            onChange={(e) => updateFilter('condition', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                        >
                            <option value="">Any Condition</option>
                            <option value="New">New</option>
                            <option value="Used">Used</option>
                        </select>
                    </div>

                    {/* Year Range */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Year Range</label>
                        <div className="flex space-x-2">
                            <input 
                                type="number" min="1934" max="2028" placeholder="Min" 
                                value={filters.minYear} onChange={(e) => updateFilter('minYear', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                            <input 
                                type="number" min="1934" max="2028" placeholder="Max" 
                                value={filters.maxYear} onChange={(e) => updateFilter('maxYear', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                        </div>
                    </div>

                    {/* Price Range */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                        <div className="flex space-x-2">
                            <input 
                                type="number" placeholder="Min $" 
                                value={filters.minPrice} onChange={(e) => updateFilter('minPrice', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                            <input 
                                type="number" placeholder="Max $" 
                                value={filters.maxPrice} onChange={(e) => updateFilter('maxPrice', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                        </div>
                    </div>

                    {/* Mileage Range */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mileage Range</label>
                        <div className="flex space-x-2">
                            <input 
                                type="number" placeholder="Min" 
                                value={filters.minMileage} onChange={(e) => updateFilter('minMileage', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                            <input 
                                type="number" placeholder="Max" 
                                value={filters.maxMileage} onChange={(e) => updateFilter('maxMileage', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                        </div>
                    </div>

                    {/* GVWR Range */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">GVWR (lbs)</label>
                        <div className="flex space-x-2">
                            <input 
                                type="number" min="1000" placeholder="Min" 
                                value={filters.minGvwr} onChange={(e) => updateFilter('minGvwr', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                            <input 
                                type="number" min="1000" placeholder="Max" 
                                value={filters.maxGvwr} onChange={(e) => updateFilter('maxGvwr', e.target.value)}
                                className="w-1/2 border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                            />
                        </div>
                    </div>

                    {/* Transmission */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Transmission</label>
                        <select 
                            value={filters.transmission} 
                            onChange={(e) => updateFilter('transmission', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                        >
                            <option value="">Any Transmission</option>
                            <option value="Automatic">Automatic</option>
                            <option value="Manual">Manual</option>
                            <option value="EV">EV</option>
                        </select>
                    </div>

                    {/* Rear Axle Count */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rear Axle Count</label>
                        <select 
                            value={filters.rearAxleCount} 
                            onChange={(e) => updateFilter('rearAxleCount', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                        >
                            <option value="">Any Axle Count</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                    </div>

                    {/* Cab Type */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cab Type</label>
                        <select 
                            value={filters.cabType} 
                            onChange={(e) => updateFilter('cabType', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                        >
                            <option value="">Any Cab Type</option>
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

                    {/* Bed Type */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Bed Type</label>
                        <select 
                            value={filters.bedType} 
                            onChange={(e) => updateFilter('bedType', e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm p-2 border focus:ring-red-600 focus:border-red-600"
                        >
                            <option value="">Any Bed Type</option>
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

                    {/* 1. LOCATION SECTION */}
                    <div className="space-y-4 bg-gray-50 p-3 rounded-lg border border-gray-200 mt-6">
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
    );
}