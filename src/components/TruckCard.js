import React from 'react';
import Image from 'next/image';

export default function TruckCard({ Truck, onViewDetails }) {
    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow border border-gray-100 flex flex-col">
            <div className="h-48 bg-gray-200 relative overflow-hidden cursor-pointer" onClick={() => onViewDetails(Truck)}>
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                    <i className="fa-solid fa-image text-4xl text-gray-600"></i>
                    {Truck.images && Truck.images.length > 0 && (
                        <Image 
                            src={Truck.images[0]} 
                            alt={Truck.make} 
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover opacity-80 hover:opacity-100 transition-opacity z-10" 
                            quality={90}
                        />
                    )}
                </div>
                <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md z-20">
                    ${Number(Truck.price).toLocaleString()}
                </div>
            </div>
            <div className="p-5 flex-grow flex flex-col">
                <div className={`text-xs font-bold uppercase tracking-wider mb-1 text-red-600`}>
                    {Truck.make}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {Truck.year ? `${Truck.year} ` : ''}{Truck.model}
                </h3>
                
                <div className="text-sm text-gray-600 space-y-1 mb-4 flex-grow">
                    <p><i className="fa-solid fa-gauge w-5 text-gray-400"></i> {Truck.mileage ? Number(Truck.mileage).toLocaleString() + ' miles' : 'Mileage not listed'}</p>
                    <p><i className="fa-solid fa-location-dot w-5 text-gray-400"></i> {Truck.city}, {Truck.state}</p>
                </div>
                
                <button onClick={() => onViewDetails(Truck)} className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded font-medium transition mt-auto">
                    View Details
                </button>
            </div>
        </div>
    );
}