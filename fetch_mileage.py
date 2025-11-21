#!/usr/bin/env python3
"""Minimal script to fetch Toyota vehicle mileage.
Returns JSON with mileage data.
"""

import asyncio
import json
import sys
import os

# Add pytoyoda to path if needed
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../pytoyoda'))

from pytoyoda.client import MyT


async def fetch_mileage(username: str, password: str) -> dict:
    """Fetch current vehicle mileage from Toyota API.
    
    Args:
        username: Toyota account username/email
        password: Toyota account password
        
    Returns:
        dict: {
            'success': bool,
            'mileage': float (in km),
            'unit': str,
            'vin': str,
            'vehicle': str,
            'error': str (if success is False)
        }
    """
    try:
        client = MyT(username=username, password=password, use_metric=True, brand="T")
        
        await client.login()
        vehicles = await client.get_vehicles()
        
        if not vehicles:
            return {
                'success': False,
                'error': 'No vehicles found in account'
            }
        
        vehicle = vehicles[0]  # Get first vehicle
        
        # Get telemetry
        telemetry_response = await vehicle._api.get_telemetry(vehicle.vin)
        
        if telemetry_response.payload and telemetry_response.payload.odometer:
            odometer = telemetry_response.payload.odometer
            return {
                'success': True,
                'mileage': odometer.value,
                'unit': odometer.unit.lower(),
                'vin': vehicle.vin,
                'vehicle': vehicle._vehicle_info.display_model_description
            }
        else:
            return {
                'success': False,
                'error': 'Odometer data not available'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def main():
    """Main entry point."""
    if len(sys.argv) < 3:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python fetch_mileage.py <username> <password>'
        }))
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(fetch_mileage(username, password))
        print(json.dumps(result))
    finally:
        loop.close()


if __name__ == '__main__':
    main()


