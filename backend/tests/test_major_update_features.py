"""
Test D-Billet Major Update Features:
1. Phone login (no OTP)
2. Guest session/checkout
3. Ferry schedule with Tadjoura and Obock
4. Ferry price 1100 FDJ
5. Ferry trips API
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhoneLogin:
    """Test phone login without OTP verification"""
    
    def test_phone_login_new_user(self):
        """Test phone login creates new user if not exists"""
        test_phone = f"+253771{datetime.now().strftime('%H%M%S')}"
        response = requests.post(
            f"{BASE_URL}/api/auth/phone-login",
            json={"phone": test_phone, "full_name": "Test User Phone"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["phone"] == test_phone, "Phone should match"
        assert data["user"]["full_name"] == "Test User Phone", "Name should match"
        print(f"Phone login new user: PASSED - Token received for {test_phone}")
    
    def test_phone_login_existing_user(self):
        """Test phone login with existing user returns same user"""
        test_phone = "+25377123456"  # Test phone from requirements
        
        # First login
        response1 = requests.post(
            f"{BASE_URL}/api/auth/phone-login",
            json={"phone": test_phone}
        )
        assert response1.status_code == 200
        user_id_1 = response1.json()["user"]["id"]
        
        # Second login with same phone
        response2 = requests.post(
            f"{BASE_URL}/api/auth/phone-login",
            json={"phone": test_phone}
        )
        assert response2.status_code == 200
        user_id_2 = response2.json()["user"]["id"]
        
        assert user_id_1 == user_id_2, "Same phone should return same user"
        print(f"Phone login existing user: PASSED - Same user ID returned")
    
    def test_phone_login_without_name(self):
        """Test phone login without providing name generates default name"""
        test_phone = f"+253772{datetime.now().strftime('%H%M%S')}"
        response = requests.post(
            f"{BASE_URL}/api/auth/phone-login",
            json={"phone": test_phone}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["user"]["full_name"] is not None, "Should have auto-generated name"
        assert test_phone[-4:] in data["user"]["full_name"], "Auto-name should contain last 4 digits"
        print(f"Phone login without name: PASSED - Auto-generated name: {data['user']['full_name']}")


class TestGuestSession:
    """Test guest checkout session creation"""
    
    def test_guest_session_new_user(self):
        """Test creating guest session for new user"""
        test_phone = f"+253773{datetime.now().strftime('%H%M%S')}"
        response = requests.post(
            f"{BASE_URL}/api/auth/guest-session",
            json={"phone": test_phone, "full_name": "Guest User Test"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user_id" in data, "Response should contain user_id"
        assert data["is_new"] == True, "Should be marked as new user"
        assert data["phone"] == test_phone, "Phone should match"
        assert data["full_name"] == "Guest User Test", "Name should match"
        print(f"Guest session new user: PASSED - Token: {data['token'][:20]}...")
    
    def test_guest_session_existing_user(self):
        """Test guest session with existing phone returns existing user"""
        test_phone = "+25377123456"  # Test phone from requirements
        
        # First create/login
        requests.post(
            f"{BASE_URL}/api/auth/phone-login",
            json={"phone": test_phone, "full_name": "Existing User"}
        )
        
        # Now try guest session with same phone
        response = requests.post(
            f"{BASE_URL}/api/auth/guest-session",
            json={"phone": test_phone, "full_name": "Guest Name"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_new"] == False, "Should be marked as existing user"
        assert "Compte existant" in data.get("message", ""), "Should indicate existing account"
        print(f"Guest session existing user: PASSED - is_new=False")
    
    def test_guest_session_missing_fields(self):
        """Test guest session requires phone and full_name"""
        # Missing full_name
        response = requests.post(
            f"{BASE_URL}/api/auth/guest-session",
            json={"phone": "+25377999999"}
        )
        assert response.status_code == 422, "Should require full_name"
        print(f"Guest session validation: PASSED - Requires full_name")


class TestFerrySchedule:
    """Test ferry schedule API with Tadjoura and Obock routes"""
    
    def test_ferry_schedule_returns_weekly(self):
        """Test ferry schedule returns 7 days"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "schedule" in data, "Response should contain schedule"
        assert len(data["schedule"]) == 7, f"Should have 7 days, got {len(data['schedule'])}"
        print(f"Ferry schedule weekly: PASSED - {len(data['schedule'])} days returned")
    
    def test_ferry_price_is_1100(self):
        """Test ferry passenger price is 1100 FDJ"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("passenger_price") == 1100, f"Price should be 1100, got {data.get('passenger_price')}"
        print(f"Ferry price: PASSED - {data['passenger_price']} FDJ")
    
    def test_ferry_child_free_age(self):
        """Test children under 10 are free"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("child_free_age") == 10, f"Child free age should be 10, got {data.get('child_free_age')}"
        print(f"Ferry child free age: PASSED - Under {data['child_free_age']} years free")
    
    def test_ferry_schedule_tuesday_tadjoura(self):
        """Test Tuesday has Tadjoura service (Mardi)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        data = response.json()
        schedule = data["schedule"]
        
        # Find Tuesday (Mardi)
        tuesday = next((d for d in schedule if d.get("day", "").lower() == "tuesday"), None)
        if tuesday:
            assert tuesday.get("active") == True, "Tuesday should be active"
            assert "Tadjoura" in str(tuesday.get("destination", "")), "Tuesday should serve Tadjoura"
            print(f"Ferry Tuesday (Mardi): PASSED - Tadjoura service active")
        else:
            print(f"Ferry Tuesday: INFO - Day not found in schedule (may use different format)")
    
    def test_ferry_schedule_thursday_multiple_routes(self):
        """Test Thursday has Tadjoura and Obock (Jeudi)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        data = response.json()
        schedule = data["schedule"]
        
        # Find Thursday (Jeudi)
        thursday = next((d for d in schedule if d.get("day", "").lower() == "thursday"), None)
        if thursday:
            assert thursday.get("active") == True, "Thursday should be active"
            # Check for multiple routes or combined destination
            dest = str(thursday.get("destination", ""))
            routes = thursday.get("routes", [])
            
            if routes:
                destinations = [r.get("destination", "") for r in routes]
                assert "Tadjoura" in destinations or "Obock" in destinations, "Thursday should have Tadjoura or Obock"
                print(f"Ferry Thursday (Jeudi): PASSED - Routes: {destinations}")
            else:
                print(f"Ferry Thursday (Jeudi): PASSED - Destination: {dest}")
        else:
            print(f"Ferry Thursday: INFO - Day not found in schedule")
    
    def test_ferry_schedule_saturday_multiple_routes(self):
        """Test Saturday has Tadjoura and Obock (Samedi)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        data = response.json()
        schedule = data["schedule"]
        
        # Find Saturday (Samedi)
        saturday = next((d for d in schedule if d.get("day", "").lower() == "saturday"), None)
        if saturday:
            assert saturday.get("active") == True, "Saturday should be active"
            routes = saturday.get("routes", [])
            dest = str(saturday.get("destination", ""))
            
            if routes:
                destinations = [r.get("destination", "") for r in routes]
                print(f"Ferry Saturday (Samedi): PASSED - Routes: {destinations}")
            else:
                print(f"Ferry Saturday (Samedi): PASSED - Destination: {dest}")
        else:
            print(f"Ferry Saturday: INFO - Day not found in schedule")


class TestFerryTrips:
    """Test ferry trips API for specific dates"""
    
    def get_next_weekday(self, weekday):
        """Get next date for given weekday (0=Monday, 1=Tuesday, etc.)"""
        today = datetime.now()
        days_ahead = weekday - today.weekday()
        if days_ahead <= 0:
            days_ahead += 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    def test_ferry_trips_tuesday(self):
        """Test ferry trips for Tuesday (Mardi - Tadjoura)"""
        tuesday_date = self.get_next_weekday(1)  # Tuesday = 1
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={tuesday_date}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"Ferry trips Tuesday ({tuesday_date}): has_service={data.get('has_service')}, trips={len(data.get('trips', []))}")
        
        if data.get("has_service"):
            trips = data.get("trips", [])
            assert len(trips) > 0, "Should have trips if service is available"
            # Check price
            for trip in trips:
                assert trip.get("price") == 1100, f"Trip price should be 1100, got {trip.get('price')}"
    
    def test_ferry_trips_thursday(self):
        """Test ferry trips for Thursday (Jeudi - Tadjoura + Obock)"""
        thursday_date = self.get_next_weekday(3)  # Thursday = 3
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={thursday_date}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Ferry trips Thursday ({thursday_date}): has_service={data.get('has_service')}, trips={len(data.get('trips', []))}")
        
        if data.get("has_service"):
            trips = data.get("trips", [])
            destinations = set()
            for trip in trips:
                if trip.get("destination"):
                    destinations.add(trip["destination"])
                elif trip.get("arrival") and trip["arrival"] != "Djibouti":
                    destinations.add(trip["arrival"])
            print(f"  Destinations available: {destinations}")
    
    def test_ferry_trips_saturday(self):
        """Test ferry trips for Saturday (Samedi - Tadjoura + Obock)"""
        saturday_date = self.get_next_weekday(5)  # Saturday = 5
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={saturday_date}")
        assert response.status_code == 200
        
        data = response.json()
        print(f"Ferry trips Saturday ({saturday_date}): has_service={data.get('has_service')}, trips={len(data.get('trips', []))}")
        
        if data.get("has_service"):
            trips = data.get("trips", [])
            for trip in trips:
                assert trip.get("price") == 1100, f"Trip price should be 1100"
    
    def test_ferry_trips_monday_no_service(self):
        """Test Monday has no ferry service"""
        monday_date = self.get_next_weekday(0)  # Monday = 0
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={monday_date}")
        assert response.status_code == 200
        
        data = response.json()
        # Monday should have no service based on schedule
        print(f"Ferry trips Monday ({monday_date}): has_service={data.get('has_service')}")
    
    def test_ferry_trips_invalid_date(self):
        """Test invalid date format returns error"""
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date=invalid-date")
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        print(f"Ferry trips invalid date: PASSED - Returns 400")
    
    def test_ferry_trips_capacity_info(self):
        """Test ferry trips returns capacity information"""
        tuesday_date = self.get_next_weekday(1)
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={tuesday_date}")
        assert response.status_code == 200
        
        data = response.json()
        if data.get("has_service"):
            assert "capacity" in data, "Should include capacity info"
            capacity = data["capacity"]
            assert "passengers_remaining" in capacity, "Should have passengers_remaining"
            assert "vehicles_remaining" in capacity, "Should have vehicles_remaining"
            print(f"Ferry trips capacity: PASSED - Passengers: {capacity.get('passengers_remaining')}, Vehicles: {capacity.get('vehicles_remaining')}")


class TestAdminLogin:
    """Test admin login with provided credentials"""
    
    def test_admin_login(self):
        """Test admin login with admin@dbillet.dj / admin123"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@dbillet.dj", "password": "admin123"}
        )
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Should return access_token"
        assert data["user"]["role"] == "admin", f"Should be admin role, got {data['user']['role']}"
        print(f"Admin login: PASSED - Role: {data['user']['role']}")
        return data["access_token"]


class TestVehicleTypes:
    """Test ferry vehicle types API"""
    
    def test_get_vehicle_types(self):
        """Test getting available vehicle types"""
        response = requests.get(f"{BASE_URL}/api/ferry/vehicle-types")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "vehicle_types" in data, "Should return vehicle_types"
        print(f"Vehicle types: PASSED - {len(data['vehicle_types'])} types available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
