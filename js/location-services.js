/**
 * BSTM Location Services
 * Geolocation for delivery and nearby products
 */

const LocationServices = {
    currentLocation: null,
    
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentLocation = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    resolve(this.currentLocation);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    },
    
    async getAddress(lat, lng) {
        // Reverse geocoding using OpenStreetMap Nominatim
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            );
            const data = await response.json();
            return data.display_name;
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return null;
        }
    },
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return distance; // in km
    },
    
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    },
    
    async findNearbyProducts(maxDistance = 10) {
        // Get user location
        const location = await this.getCurrentLocation();
        
        // TODO: Query Supabase for products near user
        // For now, return mock data
        return [];
    },
    
    isInGaborone(lat, lng) {
        // Gaborone approximate bounds
        const bounds = {
            north: -24.6,
            south: -24.7,
            east: 25.95,
            west: 25.85
        };
        
        return lat >= bounds.south && lat <= bounds.north &&
               lng >= bounds.west && lng <= bounds.east;
    }
};

window.LocationServices = LocationServices;
