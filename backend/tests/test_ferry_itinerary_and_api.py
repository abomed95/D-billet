"""
Test Suite for D-Billet Ferry Itinerary and Core APIs
Tests ferry schedule update: Obock only, Thursday 9h/14h, Saturday 8h/13h
Tests auth, events, admin, organizer endpoints
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFerrySchedule:
    """Test ferry public schedule endpoint - GET /api/ferry/schedule"""
    
    def test_get_ferry_schedule_returns_7_days(self):
        """Verify ferry schedule returns all 7 days of the week"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "schedule" in data, "Response should contain 'schedule' key"
        
        schedule = data["schedule"]
        assert len(schedule) == 7, f"Schedule should have 7 days, got {len(schedule)}"
        
        print("✓ Ferry schedule returns 7 days")
    
    def test_thursday_service_obock_9h_14h(self):
        """Verify Thursday has service to Obock at 9h aller / 14h retour"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        thursday = next((day for day in schedule if day["day"] == "thursday"), None)
        
        assert thursday is not None, "Thursday not found in schedule"
        assert thursday["active"] == True, "Thursday should be active"
        assert thursday["destination"] == "Obock", f"Thursday destination should be Obock, got {thursday['destination']}"
        assert thursday["departure_time"] == "09:00", f"Thursday departure should be 09:00, got {thursday['departure_time']}"
        assert thursday["return_time"] == "14:00", f"Thursday return should be 14:00, got {thursday['return_time']}"
        
        print("✓ Thursday: Obock 09:00/14:00")
    
    def test_saturday_service_obock_8h_13h(self):
        """Verify Saturday has service to Obock at 8h aller / 13h retour"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        saturday = next((day for day in schedule if day["day"] == "saturday"), None)
        
        assert saturday is not None, "Saturday not found in schedule"
        assert saturday["active"] == True, "Saturday should be active"
        assert saturday["destination"] == "Obock", f"Saturday destination should be Obock, got {saturday['destination']}"
        assert saturday["departure_time"] == "08:00", f"Saturday departure should be 08:00, got {saturday['departure_time']}"
        assert saturday["return_time"] == "13:00", f"Saturday return should be 13:00, got {saturday['return_time']}"
        
        print("✓ Saturday: Obock 08:00/13:00")
    
    def test_monday_no_service(self):
        """Verify Monday has NO service (Ferme)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        monday = next((day for day in schedule if day["day"] == "monday"), None)
        
        assert monday is not None, "Monday not found in schedule"
        assert monday["active"] == False, f"Monday should be inactive (Ferme), got active={monday['active']}"
        
        print("✓ Monday: Fermé (no service)")
    
    def test_wednesday_no_service(self):
        """Verify Wednesday has NO service (Ferme)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        wednesday = next((day for day in schedule if day["day"] == "wednesday"), None)
        
        assert wednesday is not None, "Wednesday not found in schedule"
        assert wednesday["active"] == False, f"Wednesday should be inactive (Ferme), got active={wednesday['active']}"
        
        print("✓ Wednesday: Fermé (no service)")
    
    def test_sunday_no_service(self):
        """Verify Sunday has NO service (Ferme)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        sunday = next((day for day in schedule if day["day"] == "sunday"), None)
        
        assert sunday is not None, "Sunday not found in schedule"
        assert sunday["active"] == False, f"Sunday should be inactive (Ferme), got active={sunday['active']}"
        
        print("✓ Sunday: Fermé (no service)")
    
    def test_tuesday_no_service(self):
        """Verify Tuesday has NO service (Ferme)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        tuesday = next((day for day in schedule if day["day"] == "tuesday"), None)
        
        assert tuesday is not None, "Tuesday not found in schedule"
        assert tuesday["active"] == False, f"Tuesday should be inactive (Ferme), got active={tuesday['active']}"
        
        print("✓ Tuesday: Fermé (no service)")
    
    def test_friday_no_service(self):
        """Verify Friday has NO service (Ferme)"""
        response = requests.get(f"{BASE_URL}/api/ferry/schedule")
        assert response.status_code == 200
        
        schedule = response.json()["schedule"]
        friday = next((day for day in schedule if day["day"] == "friday"), None)
        
        assert friday is not None, "Friday not found in schedule"
        assert friday["active"] == False, f"Friday should be inactive (Ferme), got active={friday['active']}"
        
        print("✓ Friday: Fermé (no service)")


class TestFerryTrips:
    """Test ferry trips endpoint - GET /api/ferry/trips?date="""
    
    def _get_next_weekday(self, weekday: int):
        """Get next date for given weekday (0=Monday, 6=Sunday)"""
        today = datetime.now()
        days_ahead = weekday - today.weekday()
        if days_ahead < 0:
            days_ahead += 7
        return (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    def test_ferry_trips_thursday(self):
        """Test ferry trips for a Thursday - should have Obock service"""
        thursday_date = self._get_next_weekday(3)  # Thursday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={thursday_date}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["has_service"] == True, f"Thursday should have service, got has_service={data['has_service']}"
        assert "Obock" in data.get("route", ""), f"Route should contain Obock, got {data.get('route')}"
        
        trips = data.get("trips", [])
        assert len(trips) == 2, f"Should have 2 trips (aller/retour), got {len(trips)}"
        
        # Check aller trip
        aller = next((t for t in trips if t["trip_type"] == "aller"), None)
        assert aller is not None, "Aller trip not found"
        assert aller["departure_time"] == "09:00", f"Aller should be 09:00, got {aller['departure_time']}"
        assert aller["arrival"] == "Obock", f"Aller destination should be Obock, got {aller['arrival']}"
        
        # Check retour trip
        retour = next((t for t in trips if t["trip_type"] == "retour"), None)
        assert retour is not None, "Retour trip not found"
        assert retour["departure_time"] == "14:00", f"Retour should be 14:00, got {retour['departure_time']}"
        
        print(f"✓ Thursday ({thursday_date}): Obock trips at 09:00/14:00")
    
    def test_ferry_trips_saturday(self):
        """Test ferry trips for a Saturday - should have Obock service"""
        saturday_date = self._get_next_weekday(5)  # Saturday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={saturday_date}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["has_service"] == True, f"Saturday should have service, got has_service={data['has_service']}"
        assert "Obock" in data.get("route", ""), f"Route should contain Obock, got {data.get('route')}"
        
        trips = data.get("trips", [])
        assert len(trips) == 2, f"Should have 2 trips (aller/retour), got {len(trips)}"
        
        # Check aller trip
        aller = next((t for t in trips if t["trip_type"] == "aller"), None)
        assert aller is not None, "Aller trip not found"
        assert aller["departure_time"] == "08:00", f"Aller should be 08:00, got {aller['departure_time']}"
        assert aller["arrival"] == "Obock", f"Aller destination should be Obock, got {aller['arrival']}"
        
        # Check retour trip
        retour = next((t for t in trips if t["trip_type"] == "retour"), None)
        assert retour is not None, "Retour trip not found"
        assert retour["departure_time"] == "13:00", f"Retour should be 13:00, got {retour['departure_time']}"
        
        print(f"✓ Saturday ({saturday_date}): Obock trips at 08:00/13:00")
    
    def test_ferry_trips_monday_no_service(self):
        """Test ferry trips for Monday - should have NO service"""
        monday_date = self._get_next_weekday(0)  # Monday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={monday_date}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == False, f"Monday should have no service, got has_service={data['has_service']}"
        assert data.get("trips", []) == [], f"Monday should have no trips, got {len(data.get('trips', []))} trips"
        
        print(f"✓ Monday ({monday_date}): No service")
    
    def test_ferry_trips_wednesday_no_service(self):
        """Test ferry trips for Wednesday - should have NO service"""
        wednesday_date = self._get_next_weekday(2)  # Wednesday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={wednesday_date}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == False, f"Wednesday should have no service, got has_service={data['has_service']}"
        
        print(f"✓ Wednesday ({wednesday_date}): No service")
    
    def test_ferry_trips_sunday_no_service(self):
        """Test ferry trips for Sunday - should have NO service"""
        sunday_date = self._get_next_weekday(6)  # Sunday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={sunday_date}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["has_service"] == False, f"Sunday should have no service, got has_service={data['has_service']}"
        
        print(f"✓ Sunday ({sunday_date}): No service")
    
    def test_ferry_trips_invalid_date_format(self):
        """Test ferry trips with invalid date format"""
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date=invalid-date")
        
        assert response.status_code == 400, f"Expected 400 for invalid date, got {response.status_code}"
        
        print("✓ Invalid date format returns 400")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_auth_login_admin(self):
        """Test admin login - POST /api/auth/login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@dbillet.dj", "password": "admin123"}
        )
        
        assert response.status_code == 200, f"Admin login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["role"] == "admin", f"User role should be admin, got {data['user']['role']}"
        
        print("✓ Admin login successful")
        return data["access_token"]
    
    def test_auth_login_organizer(self):
        """Test organizer login - POST /api/auth/login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "organizer@dbillet.dj", "password": "organizer123"}
        )
        
        assert response.status_code == 200, f"Organizer login failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "user" in data, "Response should contain user object"
        assert data["user"]["role"] == "organizer", f"User role should be organizer, got {data['user']['role']}"
        
        print("✓ Organizer login successful")
        return data["access_token"]
    
    def test_auth_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "invalid@test.com", "password": "wrongpassword"}
        )
        
        assert response.status_code == 401, f"Expected 401 for invalid credentials, got {response.status_code}"
        
        print("✓ Invalid credentials returns 401")


class TestEventsEndpoint:
    """Test events endpoint - GET /api/events"""
    
    def test_get_events_public(self):
        """Test public events endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/events")
        
        assert response.status_code == 200, f"Events endpoint failed: {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Events should return a list"
        
        if len(data) > 0:
            event = data[0]
            assert "id" in event, "Event should have id"
            assert "title" in event, "Event should have title"
            print(f"✓ Events endpoint returns {len(data)} events")
        else:
            print("✓ Events endpoint returns empty list (no events)")


class TestAdminStats:
    """Test admin stats endpoint - GET /api/admin/stats"""
    
    def test_admin_stats_requires_auth(self):
        """Test that admin stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        
        print("✓ Admin stats requires authentication")
    
    def test_admin_stats_with_admin_token(self):
        """Test admin stats with valid admin token"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@dbillet.dj", "password": "admin123"}
        )
        assert login_response.status_code == 200, "Admin login failed"
        
        token = login_response.json()["access_token"]
        
        # Get stats
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Admin stats failed: {response.status_code}"
        
        data = response.json()
        assert "total_users" in data, "Stats should contain total_users"
        assert "total_events" in data, "Stats should contain total_events"
        assert "total_revenue" in data, "Stats should contain total_revenue"
        
        print(f"✓ Admin stats: {data['total_users']} users, {data['total_events']} events, {data['total_revenue']} DJF revenue")


class TestOrganizerEvents:
    """Test organizer events endpoint - GET /api/organizer/events"""
    
    def test_organizer_events_requires_auth(self):
        """Test that organizer events requires authentication"""
        response = requests.get(f"{BASE_URL}/api/organizer/events")
        
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        
        print("✓ Organizer events requires authentication")
    
    def test_organizer_events_with_token(self):
        """Test organizer events with valid token"""
        # Login first
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "organizer@dbillet.dj", "password": "organizer123"}
        )
        assert login_response.status_code == 200, "Organizer login failed"
        
        token = login_response.json()["access_token"]
        
        # Get events
        response = requests.get(
            f"{BASE_URL}/api/organizer/events",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Organizer events failed: {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Organizer events should return a list"
        
        print(f"✓ Organizer events: {len(data)} events found")


class TestHealthCheck:
    """Test health and root endpoints"""
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/health")
        
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy status, got {data.get('status')}"
        
        print("✓ Health check: healthy")
    
    def test_root_endpoint(self):
        """Test root endpoint"""
        response = requests.get(f"{BASE_URL}/")
        
        assert response.status_code == 200, f"Root endpoint failed: {response.status_code}"
        
        data = response.json()
        assert "name" in data, "Root should return service name"
        assert "version" in data, "Root should return version"
        
        print(f"✓ API: {data.get('name')} v{data.get('version')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
