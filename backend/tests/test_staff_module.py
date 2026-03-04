"""
Test suite for D-Billet Staff Module
- Staff login and authentication (24h JWT)
- Staff me endpoint
- Staff events listing  
- Staff ticket scanning
- Organizer staff management (CRUD)
- Password reset functionality
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from context
ORGANIZER_EMAIL = "organizer@dbillet.dj"
ORGANIZER_PASSWORD = "organizer123"
STAFF_USERNAME = "ali_security"
STAFF_PASSWORD = "SmScFcja"


class TestStaffLogin:
    """Tests for POST /api/staff/login - Staff authentication with 24h JWT"""
    
    def test_staff_login_success(self):
        """Staff can login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
        )
        print(f"Staff login response: {response.status_code}")
        
        # Status check
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert "staff" in data, "Response should contain staff object"
        assert data["token_type"] == "bearer", "Token type should be bearer"
        
        # Staff object validation
        staff = data["staff"]
        assert "id" in staff, "Staff should have id"
        assert "username" in staff, "Staff should have username"
        assert staff["username"] == STAFF_USERNAME, "Username should match"
        assert "full_name" in staff, "Staff should have full_name"
        assert "assigned_events" in staff, "Staff should have assigned_events"
        assert isinstance(staff["assigned_events"], list), "assigned_events should be a list"
        print(f"Staff login successful: {staff['full_name']} with {len(staff['assigned_events'])} assigned events")
    
    def test_staff_login_invalid_username(self):
        """Staff login fails with invalid username"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": "nonexistent_user", "password": "somepassword"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should return error detail"
        print(f"Invalid username correctly rejected: {data['detail']}")
    
    def test_staff_login_invalid_password(self):
        """Staff login fails with invalid password"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": "wrongpassword123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid password correctly rejected")
    
    def test_staff_login_missing_fields(self):
        """Staff login fails with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME}  # Missing password
        )
        assert response.status_code == 422, f"Expected 422 for validation error, got {response.status_code}"
        print("Missing password correctly rejected with validation error")


class TestStaffMe:
    """Tests for GET /api/staff/me - Get authenticated staff info"""
    
    @pytest.fixture
    def staff_token(self):
        """Get staff authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Staff login failed - skipping authenticated tests")
    
    def test_get_staff_me_success(self, staff_token):
        """Authenticated staff can get their info"""
        response = requests.get(
            f"{BASE_URL}/api/staff/me",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Staff /me response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "id" in data, "Should have id"
        assert "username" in data, "Should have username"
        assert data["username"] == STAFF_USERNAME, "Username should match"
        assert "full_name" in data, "Should have full_name"
        assert "organizer_id" in data, "Should have organizer_id"
        assert "assigned_events" in data, "Should have assigned_events"
        assert "active" in data, "Should have active status"
        print(f"Staff info retrieved: {data['full_name']} - Active: {data['active']}")
    
    def test_get_staff_me_unauthorized(self):
        """Staff endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/staff/me")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Unauthorized access correctly rejected")
    
    def test_get_staff_me_invalid_token(self):
        """Staff endpoint rejects invalid token"""
        response = requests.get(
            f"{BASE_URL}/api/staff/me",
            headers={"Authorization": "Bearer invalidtoken123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid token correctly rejected")


class TestStaffEvents:
    """Tests for GET /api/staff/events - Get assigned events"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Staff login failed")
    
    def test_get_staff_events_success(self, staff_token):
        """Staff can view assigned events"""
        response = requests.get(
            f"{BASE_URL}/api/staff/events",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Staff events response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of events"
        
        if len(data) > 0:
            event = data[0]
            assert "id" in event, "Event should have id"
            assert "title" in event, "Event should have title"
            assert "date" in event, "Event should have date"
            assert "venue" in event, "Event should have venue"
            assert "total_tickets" in event, "Event should have total_tickets"
            assert "scanned_tickets" in event, "Event should have scanned_tickets"
            print(f"Staff has {len(data)} assigned events. First: {event['title']}")
        else:
            print("Staff has no assigned events")
    
    def test_get_staff_events_unauthorized(self):
        """Staff events endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/staff/events")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestStaffScan:
    """Tests for POST /api/staff/scan - Ticket scanning"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Staff login failed")
    
    @pytest.fixture
    def assigned_event_id(self, staff_token):
        """Get an assigned event ID for scanning tests"""
        response = requests.get(
            f"{BASE_URL}/api/staff/events",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        if response.status_code == 200 and len(response.json()) > 0:
            return response.json()[0]["id"]
        pytest.skip("No assigned events for staff")
    
    def test_scan_invalid_qr_code(self, staff_token, assigned_event_id):
        """Scanning invalid QR code returns invalid status"""
        response = requests.post(
            f"{BASE_URL}/api/staff/scan",
            json={"qr_code": "INVALID-QR-CODE-12345", "event_id": assigned_event_id},
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Invalid QR scan response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["status"] == "invalid", "Status should be 'invalid' for non-existent QR"
        assert "message" in data, "Should have message"
        assert data["vibration"] == "error", "Vibration should be 'error'"
        print(f"Invalid QR correctly handled: {data['message']}")
    
    def test_scan_unauthorized_event(self, staff_token):
        """Staff cannot scan for events they're not assigned to"""
        fake_event_id = str(uuid.uuid4())
        response = requests.post(
            f"{BASE_URL}/api/staff/scan",
            json={"qr_code": "DBILLET-test", "event_id": fake_event_id},
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Unauthorized event scan response: {response.status_code}")
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"Unauthorized event correctly rejected: {data['detail']}")
    
    def test_scan_requires_authentication(self):
        """Scan endpoint requires staff authentication"""
        response = requests.post(
            f"{BASE_URL}/api/staff/scan",
            json={"qr_code": "test", "event_id": "test-event"}
        )
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestOrganizerStaffManagement:
    """Tests for organizer staff management endpoints"""
    
    @pytest.fixture
    def organizer_token(self):
        """Get organizer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ORGANIZER_EMAIL, "password": ORGANIZER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Organizer login failed")
    
    def test_get_organizer_staff_list(self, organizer_token):
        """Organizer can view their staff list"""
        response = requests.get(
            f"{BASE_URL}/api/organizer/staff",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        print(f"Organizer staff list response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            staff = data[0]
            assert "id" in staff, "Staff should have id"
            assert "username" in staff, "Staff should have username"
            assert "full_name" in staff, "Staff should have full_name"
            assert "active" in staff, "Staff should have active status"
            assert "password_hash" not in staff, "Password hash should not be exposed"
            print(f"Organizer has {len(data)} staff accounts")
        else:
            print("Organizer has no staff accounts yet")
    
    def test_create_staff_account(self, organizer_token):
        """Organizer can create a new staff account"""
        unique_username = f"test_staff_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/organizer/staff",
            json={
                "username": unique_username,
                "full_name": "Test Staff Member",
                "assigned_events": []
            },
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        print(f"Create staff response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain staff id"
        assert "username" in data, "Response should contain username"
        assert data["username"] == unique_username, "Username should match"
        assert "password" in data, "Response should contain generated password"
        assert len(data["password"]) == 8, "Generated password should be 8 chars"
        assert "message" in data, "Response should have a message"
        
        # Store for cleanup/verification
        created_staff_id = data["id"]
        print(f"Staff created: {unique_username} with password: {data['password']}")
        
        # Verify via GET - persistence check
        list_response = requests.get(
            f"{BASE_URL}/api/organizer/staff",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert list_response.status_code == 200
        staff_list = list_response.json()
        created_staff = next((s for s in staff_list if s["id"] == created_staff_id), None)
        assert created_staff is not None, "Created staff should appear in list"
        assert created_staff["username"] == unique_username
        
        # Cleanup - delete the test staff
        delete_response = requests.delete(
            f"{BASE_URL}/api/organizer/staff/{created_staff_id}",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert delete_response.status_code == 200, "Cleanup deletion should succeed"
        print(f"Test staff cleaned up: {unique_username}")
    
    def test_create_staff_duplicate_username(self, organizer_token):
        """Cannot create staff with duplicate username"""
        response = requests.post(
            f"{BASE_URL}/api/organizer/staff",
            json={
                "username": STAFF_USERNAME,  # Existing username
                "full_name": "Duplicate Staff",
                "assigned_events": []
            },
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        print(f"Duplicate username response: {response.status_code}")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Should have error detail"
        print(f"Duplicate username correctly rejected: {data['detail']}")
    
    def test_update_staff_account(self, organizer_token):
        """Organizer can update staff account"""
        # First get existing staff
        list_response = requests.get(
            f"{BASE_URL}/api/organizer/staff",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert list_response.status_code == 200
        staff_list = list_response.json()
        
        if len(staff_list) == 0:
            pytest.skip("No staff accounts to update")
        
        staff_to_update = staff_list[0]
        staff_id = staff_to_update["id"]
        original_name = staff_to_update["full_name"]
        
        # Update the staff
        response = requests.put(
            f"{BASE_URL}/api/organizer/staff/{staff_id}",
            json={"full_name": f"{original_name} Updated"},
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        print(f"Update staff response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "full_name" in data
        assert data["full_name"] == f"{original_name} Updated"
        
        # Revert the change
        revert_response = requests.put(
            f"{BASE_URL}/api/organizer/staff/{staff_id}",
            json={"full_name": original_name},
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert revert_response.status_code == 200
        print(f"Staff update and revert successful")
    
    def test_toggle_staff_active_status(self, organizer_token):
        """Organizer can activate/deactivate staff"""
        list_response = requests.get(
            f"{BASE_URL}/api/organizer/staff",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        staff_list = list_response.json()
        
        if len(staff_list) == 0:
            pytest.skip("No staff accounts to toggle")
        
        staff = staff_list[0]
        staff_id = staff["id"]
        original_active = staff["active"]
        
        # Toggle active status
        response = requests.put(
            f"{BASE_URL}/api/organizer/staff/{staff_id}",
            json={"active": not original_active},
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["active"] == (not original_active), "Active status should be toggled"
        
        # Revert
        revert_response = requests.put(
            f"{BASE_URL}/api/organizer/staff/{staff_id}",
            json={"active": original_active},
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert revert_response.status_code == 200
        print(f"Staff active toggle and revert successful")
    
    def test_reset_staff_password(self, organizer_token):
        """Organizer can reset staff password"""
        list_response = requests.get(
            f"{BASE_URL}/api/organizer/staff",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        staff_list = list_response.json()
        
        if len(staff_list) == 0:
            pytest.skip("No staff accounts to reset password")
        
        staff = staff_list[0]
        staff_id = staff["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/organizer/staff/{staff_id}/reset-password",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        print(f"Reset password response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "new_password" in data, "Response should contain new password"
        assert "username" in data, "Response should contain username"
        assert len(data["new_password"]) == 8, "New password should be 8 chars"
        print(f"Password reset for {data['username']}: {data['new_password']}")
    
    def test_delete_staff_not_found(self, organizer_token):
        """Deleting non-existent staff returns 404"""
        fake_id = str(uuid.uuid4())
        response = requests.delete(
            f"{BASE_URL}/api/organizer/staff/{fake_id}",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent staff deletion correctly returns 404")
    
    def test_staff_endpoints_require_organizer_auth(self):
        """Staff management endpoints require organizer authentication"""
        endpoints = [
            ("GET", f"{BASE_URL}/api/organizer/staff"),
            ("POST", f"{BASE_URL}/api/organizer/staff"),
            ("PUT", f"{BASE_URL}/api/organizer/staff/test-id"),
            ("DELETE", f"{BASE_URL}/api/organizer/staff/test-id"),
        ]
        
        for method, url in endpoints:
            if method == "GET":
                response = requests.get(url)
            elif method == "POST":
                response = requests.post(url, json={})
            elif method == "PUT":
                response = requests.put(url, json={})
            elif method == "DELETE":
                response = requests.delete(url)
            
            assert response.status_code in [401, 403, 422], f"{method} {url} should require auth"
        
        print("All organizer staff endpoints correctly require authentication")


class TestStaffCannotAccessFinances:
    """Verify staff cannot access financial endpoints"""
    
    @pytest.fixture
    def staff_token(self):
        response = requests.post(
            f"{BASE_URL}/api/staff/login",
            json={"username": STAFF_USERNAME, "password": STAFF_PASSWORD}
        )
        if response.status_code == 200:
            return response.json()["access_token"]
        pytest.skip("Staff login failed")
    
    def test_staff_cannot_access_organizer_stats(self, staff_token):
        """Staff token cannot access organizer stats (financial data)"""
        response = requests.get(
            f"{BASE_URL}/api/organizer/stats",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        print(f"Staff accessing organizer stats: {response.status_code}")
        
        # Staff token should be rejected for organizer endpoints
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Staff correctly cannot access organizer financial stats")
    
    def test_staff_cannot_access_organizer_events(self, staff_token):
        """Staff token cannot access full organizer events endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/organizer/events",
            headers={"Authorization": f"Bearer {staff_token}"}
        )
        
        # Staff token should be rejected for organizer endpoints
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("Staff correctly cannot access organizer events management")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
