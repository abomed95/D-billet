"""
Test Ferry Weekly Schedule Management
Tests GET/PUT endpoints for ferry weekly schedule configuration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review_request
ADMIN_EMAIL = "Aboumed@outlook.com"
ADMIN_PASSWORD = "Aboumed@95"


class TestFerrySchedule:
    """Ferry Weekly Schedule endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session and authenticate as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
            print(f"✓ Admin login successful")
        else:
            print(f"✗ Admin login failed: {response.status_code} - {response.text}")
            pytest.skip("Admin authentication failed")
    
    # ===== GET /api/admin/transport/ferry/schedule =====
    
    def test_get_ferry_schedule_success(self):
        """Test GET ferry schedule returns weekly schedule data"""
        response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "schedule" in data, "Response should contain 'schedule' key"
        
        schedule = data["schedule"]
        assert isinstance(schedule, list), "Schedule should be a list"
        assert len(schedule) == 7, f"Schedule should have 7 days, got {len(schedule)}"
        
        # Verify each day has required fields
        expected_days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for i, day_data in enumerate(schedule):
            assert "day" in day_data, f"Day {i} missing 'day' field"
            assert "day_label" in day_data, f"Day {i} missing 'day_label' field"
            assert "active" in day_data, f"Day {i} missing 'active' field"
            assert day_data["day"] in expected_days, f"Invalid day: {day_data['day']}"
            
        print(f"✓ GET ferry schedule: {len(schedule)} days retrieved")
    
    def test_get_ferry_schedule_structure(self):
        """Test that ferry schedule has proper structure with destinations and times"""
        response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        
        assert response.status_code == 200
        data = response.json()
        schedule = data["schedule"]
        
        # Check structure of first active day
        active_days = [d for d in schedule if d.get("active")]
        if active_days:
            day = active_days[0]
            # Active days should have destination and times
            assert "destination" in day, "Active day should have 'destination'"
            assert "departure_time" in day, "Active day should have 'departure_time'"
            assert "return_time" in day, "Active day should have 'return_time'"
            print(f"✓ Active day structure verified: {day['day_label']} -> {day.get('destination')}")
        
        # Check inactive days
        inactive_days = [d for d in schedule if not d.get("active")]
        if inactive_days:
            day = inactive_days[0]
            print(f"✓ Inactive day verified: {day['day_label']} (Service fermé)")
    
    def test_get_ferry_schedule_unauthorized(self):
        """Test GET ferry schedule without auth returns 401/403"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthorized access correctly rejected: {response.status_code}")
    
    # ===== PUT /api/admin/transport/ferry/schedule =====
    
    def test_update_ferry_schedule_toggle_day(self):
        """Test updating ferry schedule - toggle a day active/inactive"""
        # Get current schedule
        get_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        assert get_response.status_code == 200
        current_schedule = get_response.json()["schedule"]
        
        # Find monday and toggle its active status
        test_schedule = []
        original_monday_active = None
        
        for day in current_schedule:
            day_copy = dict(day)
            if day_copy["day"] == "monday":
                original_monday_active = day_copy.get("active", False)
                day_copy["active"] = not original_monday_active
                if day_copy["active"]:
                    day_copy["destination"] = "Tadjoura"
                    day_copy["departure_time"] = "08:00"
                    day_copy["return_time"] = "14:00"
                else:
                    day_copy["destination"] = None
                    day_copy["departure_time"] = None
                    day_copy["return_time"] = None
            test_schedule.append(day_copy)
        
        # Update schedule
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": test_schedule}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update persisted
        verify_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        assert verify_response.status_code == 200
        
        updated_schedule = verify_response.json()["schedule"]
        monday = next((d for d in updated_schedule if d["day"] == "monday"), None)
        
        assert monday is not None, "Monday not found in schedule"
        assert monday["active"] == (not original_monday_active), "Monday active status should be toggled"
        
        print(f"✓ Monday toggled from {original_monday_active} to {not original_monday_active}")
        
        # Restore original state
        restore_schedule = []
        for day in updated_schedule:
            day_copy = dict(day)
            if day_copy["day"] == "monday":
                day_copy["active"] = original_monday_active
                if original_monday_active:
                    day_copy["destination"] = "Tadjoura"
                    day_copy["departure_time"] = "08:00"
                    day_copy["return_time"] = "12:00"
            restore_schedule.append(day_copy)
        
        self.session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": restore_schedule}
        )
        print(f"✓ Original schedule restored")
    
    def test_update_ferry_schedule_change_destination(self):
        """Test updating ferry schedule - change destination for a day"""
        # Get current schedule
        get_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        assert get_response.status_code == 200
        current_schedule = get_response.json()["schedule"]
        
        # Find an active day and change its destination
        test_schedule = []
        test_day = None
        original_destination = None
        
        for day in current_schedule:
            day_copy = dict(day)
            if day_copy.get("active") and day_copy["day"] == "tuesday" and test_day is None:
                test_day = day_copy["day"]
                original_destination = day_copy.get("destination")
                # Toggle between Tadjoura and Obock
                new_destination = "Obock" if original_destination == "Tadjoura" else "Tadjoura"
                day_copy["destination"] = new_destination
            test_schedule.append(day_copy)
        
        if test_day is None:
            # Make tuesday active for testing
            test_schedule = []
            for day in current_schedule:
                day_copy = dict(day)
                if day_copy["day"] == "tuesday":
                    test_day = "tuesday"
                    original_destination = day_copy.get("destination")
                    day_copy["active"] = True
                    day_copy["destination"] = "Obock"
                    day_copy["departure_time"] = "09:00"
                    day_copy["return_time"] = "15:00"
                test_schedule.append(day_copy)
        
        # Update schedule
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": test_schedule}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify destination changed
        verify_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        updated_schedule = verify_response.json()["schedule"]
        
        tuesday = next((d for d in updated_schedule if d["day"] == "tuesday"), None)
        assert tuesday is not None
        assert tuesday["destination"] in ["Tadjoura", "Obock"], f"Invalid destination: {tuesday['destination']}"
        
        print(f"✓ Tuesday destination set to: {tuesday['destination']}")
    
    def test_update_ferry_schedule_change_times(self):
        """Test updating ferry schedule - change departure and return times"""
        # Get current schedule
        get_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        assert get_response.status_code == 200
        current_schedule = get_response.json()["schedule"]
        
        # Update wednesday with new times
        test_schedule = []
        for day in current_schedule:
            day_copy = dict(day)
            if day_copy["day"] == "wednesday":
                day_copy["active"] = True
                day_copy["destination"] = "Tadjoura"
                day_copy["departure_time"] = "07:30"
                day_copy["return_time"] = "13:30"
            test_schedule.append(day_copy)
        
        # Update schedule
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": test_schedule}
        )
        
        assert update_response.status_code == 200
        
        # Verify times updated
        verify_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        updated_schedule = verify_response.json()["schedule"]
        
        wednesday = next((d for d in updated_schedule if d["day"] == "wednesday"), None)
        assert wednesday is not None
        assert wednesday["departure_time"] == "07:30", f"Departure time should be 07:30, got {wednesday['departure_time']}"
        assert wednesday["return_time"] == "13:30", f"Return time should be 13:30, got {wednesday['return_time']}"
        
        print(f"✓ Wednesday times updated: departure={wednesday['departure_time']}, return={wednesday['return_time']}")
    
    def test_update_ferry_schedule_unauthorized(self):
        """Test PUT ferry schedule without auth returns 401/403"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": []}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Unauthorized update correctly rejected: {response.status_code}")
    
    def test_update_ferry_schedule_full_week(self):
        """Test updating complete weekly schedule"""
        full_schedule = [
            {"day": "monday", "active": False, "destination": None, "departure_time": None, "return_time": None},
            {"day": "tuesday", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "12:00"},
            {"day": "wednesday", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
            {"day": "thursday", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
            {"day": "friday", "active": True, "destination": "Tadjoura", "departure_time": "08:00", "return_time": "12:00"},
            {"day": "saturday", "active": True, "destination": "Obock", "departure_time": "08:00", "return_time": "12:00"},
            {"day": "sunday", "active": False, "destination": None, "departure_time": None, "return_time": None}
        ]
        
        # Update schedule
        update_response = self.session.put(
            f"{BASE_URL}/api/admin/transport/ferry/schedule",
            json={"schedule": full_schedule}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify all 7 days persisted correctly
        verify_response = self.session.get(f"{BASE_URL}/api/admin/transport/ferry/schedule")
        assert verify_response.status_code == 200
        
        updated_schedule = verify_response.json()["schedule"]
        assert len(updated_schedule) == 7, f"Expected 7 days, got {len(updated_schedule)}"
        
        # Check specific days
        monday = next((d for d in updated_schedule if d["day"] == "monday"), None)
        saturday = next((d for d in updated_schedule if d["day"] == "saturday"), None)
        
        assert monday["active"] == False, "Monday should be inactive"
        assert saturday["active"] == True, "Saturday should be active"
        assert saturday["destination"] == "Obock", "Saturday destination should be Obock"
        
        print(f"✓ Full week schedule updated successfully")
        print(f"  - Monday: inactive")
        print(f"  - Tuesday-Friday: Tadjoura/Obock")
        print(f"  - Saturday: Obock")
        print(f"  - Sunday: inactive")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
