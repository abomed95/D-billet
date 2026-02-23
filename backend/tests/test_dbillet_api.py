"""
D-Billet API Tests - Comprehensive backend testing
Tests: Auth, Events, Train, Ferry, Cart, Checkout, Admin
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@dbillet.dj"
ADMIN_PASSWORD = "admin123"
TEST_USER_EMAIL = "test_user_dbillet@test.com"
TEST_USER_PASSWORD = "testpass123"

class TestHealthAndSeed:
    """Basic health and seed tests"""
    
    def test_seed_database(self):
        """Seed database with initial data"""
        response = requests.post(f"{BASE_URL}/api/seed")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"Seed response: {data}")

class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_admin_login_success(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        assert data["user"]["is_admin"] == True
        print(f"Admin login successful: {data['user']['full_name']}")
    
    def test_login_invalid_credentials(self):
        """Test login with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"Invalid login correctly rejected: {data['detail']}")
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"test_{datetime.now().timestamp()}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "full_name": "Test User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"User registered: {unique_email}")
    
    def test_get_current_user(self):
        """Test getting current user info"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get user info
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == ADMIN_EMAIL
        print(f"Current user: {data['full_name']}")

class TestEvents:
    """Events CRUD tests"""
    
    def test_get_events_list(self):
        """Test getting all events"""
        response = requests.get(f"{BASE_URL}/api/events")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} events")
    
    def test_get_events_by_category(self):
        """Test filtering events by category"""
        response = requests.get(f"{BASE_URL}/api/events?category=concerts")
        assert response.status_code == 200
        data = response.json()
        for event in data:
            assert event["category"] == "concerts"
        print(f"Found {len(data)} concert events")
    
    def test_get_single_event(self):
        """Test getting a single event"""
        # First get list
        list_response = requests.get(f"{BASE_URL}/api/events")
        events = list_response.json()
        if events:
            event_id = events[0]["id"]
            response = requests.get(f"{BASE_URL}/api/events/{event_id}")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == event_id
            print(f"Event details: {data['title']}")
    
    def test_get_nonexistent_event(self):
        """Test getting non-existent event returns 404"""
        response = requests.get(f"{BASE_URL}/api/events/nonexistent-id-12345")
        assert response.status_code == 404

class TestTrainBooking:
    """Train booking API tests"""
    
    def test_train_trips_even_day(self):
        """Test train trips on even day (Nagad departures)"""
        # Use an even day (e.g., 2nd of month)
        even_date = "2025-02-02"
        response = requests.get(f"{BASE_URL}/api/train/trips?date={even_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_even_day"] == True
        assert data["is_holiday"] == False
        assert "Nagad" in data["direction"]
        assert len(data["trips"]) > 0
        # Verify Nagad departures
        for trip in data["trips"]:
            assert trip["departure"] in ["Nagad", "Holl-Holl"]
        print(f"Even day trips: {len(data['trips'])} routes from Nagad direction")
    
    def test_train_trips_odd_day(self):
        """Test train trips on odd day (Ali-Sabieh departures)"""
        # Use an odd day (e.g., 3rd of month)
        odd_date = "2025-02-03"
        response = requests.get(f"{BASE_URL}/api/train/trips?date={odd_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_even_day"] == False
        assert data["is_holiday"] == False
        assert "Ali-Sabieh" in data["direction"]
        assert len(data["trips"]) > 0
        print(f"Odd day trips: {len(data['trips'])} routes from Ali-Sabieh direction")
    
    def test_train_trips_holiday(self):
        """Test train trips on 1st of month (holiday)"""
        holiday_date = "2025-02-01"
        response = requests.get(f"{BASE_URL}/api/train/trips?date={holiday_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["is_holiday"] == True
        assert len(data["trips"]) == 0
        print(f"Holiday: {data['message']}")
    
    def test_train_trips_invalid_date(self):
        """Test train trips with invalid date format"""
        response = requests.get(f"{BASE_URL}/api/train/trips?date=invalid-date")
        assert response.status_code == 400
    
    def test_train_booking_authenticated(self):
        """Test train booking with authentication"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Book train ticket
        booking_data = {
            "date": "2025-02-02",  # Even day
            "departure": "Nagad",
            "arrival": "Holl-Holl",
            "passengers": [
                {
                    "full_name": "Test Passenger",
                    "phone": "+253 77 12 34 56",
                    "passport_or_cni": "DJ123456"
                }
            ],
            "payment_method": "waafi"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/train/book",
            json=booking_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert data["total"] == 400  # Nagad to Holl-Holl price
        print(f"Train booking successful: {len(data['tickets'])} ticket(s), total: {data['total']} DJF")

class TestFerryBooking:
    """Ferry booking API tests"""
    
    def test_ferry_trips_tadjoura_day(self):
        """Test ferry trips on Tadjoura route day (Tue/Thu/Fri/Sat)"""
        # Tuesday = weekday 1
        tuesday_date = "2025-02-04"  # This is a Tuesday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={tuesday_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["has_service"] == True
        assert "Tadjoura" in data["route"]
        assert len(data["trips"]) == 2  # Aller and retour
        print(f"Tadjoura route: {data['route']}, {len(data['trips'])} trips")
    
    def test_ferry_trips_obock_day(self):
        """Test ferry trips on Obock route day (Sun/Wed)"""
        # Wednesday = weekday 2
        wednesday_date = "2025-02-05"  # This is a Wednesday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={wednesday_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["has_service"] == True
        assert "Obock" in data["route"]
        print(f"Obock route: {data['route']}")
    
    def test_ferry_trips_no_service_monday(self):
        """Test ferry trips on Monday (no service)"""
        # Monday = weekday 0
        monday_date = "2025-02-03"  # This is a Monday
        response = requests.get(f"{BASE_URL}/api/ferry/trips?date={monday_date}")
        assert response.status_code == 200
        data = response.json()
        assert data["has_service"] == False
        assert len(data["trips"]) == 0
        print(f"Monday no service: {data['message']}")
    
    def test_ferry_booking_authenticated(self):
        """Test ferry booking with authentication"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Book ferry ticket on Tuesday (Tadjoura route)
        booking_data = {
            "date": "2025-02-04",  # Tuesday
            "departure": "Djibouti",
            "arrival": "Tadjoura",
            "trip_type": "aller",
            "passengers": [
                {
                    "full_name": "Ferry Passenger",
                    "phone": "+253 77 98 76 54",
                    "passport_or_cni": "DJ789012"
                }
            ],
            "payment_method": "dmoney"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ferry/book",
            json=booking_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "tickets" in data
        assert data["total"] == 700  # Ferry price
        print(f"Ferry booking successful: {len(data['tickets'])} ticket(s), total: {data['total']} DJF")

class TestCartAndCheckout:
    """Cart and checkout tests"""
    
    def test_get_empty_cart(self):
        """Test getting empty cart"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Clear cart first
        requests.delete(
            f"{BASE_URL}/api/cart",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Get cart
        response = requests.get(
            f"{BASE_URL}/api/cart",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        print(f"Cart: {len(data['items'])} items, total: {data['total']} DJF")
    
    def test_add_to_cart(self):
        """Test adding item to cart"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get an event
        events_response = requests.get(f"{BASE_URL}/api/events")
        events = events_response.json()
        if events:
            event_id = events[0]["id"]
            
            # Add to cart
            response = requests.post(
                f"{BASE_URL}/api/cart/add",
                json={"event_id": event_id, "quantity": 2},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
            print(f"Added event {event_id} to cart")
    
    def test_checkout_flow(self):
        """Test complete checkout flow"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Clear cart
        requests.delete(f"{BASE_URL}/api/cart", headers=headers)
        
        # Get an event
        events_response = requests.get(f"{BASE_URL}/api/events")
        events = events_response.json()
        if events:
            event_id = events[0]["id"]
            
            # Add to cart
            requests.post(
                f"{BASE_URL}/api/cart/add",
                json={"event_id": event_id, "quantity": 1},
                headers=headers
            )
            
            # Checkout
            response = requests.post(
                f"{BASE_URL}/api/checkout",
                json={"payment_method": "waafi"},
                headers=headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "tickets" in data
            assert "total" in data
            print(f"Checkout successful: {len(data['tickets'])} ticket(s), total: {data['total']} DJF")

class TestAdminEndpoints:
    """Admin-only endpoint tests"""
    
    def test_admin_stats(self):
        """Test admin dashboard stats"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_revenue" in data
        assert "commission" in data
        assert "total_tickets_sold" in data
        assert "total_events" in data
        print(f"Admin stats: Revenue={data['total_revenue']} DJF, Commission={data['commission']} DJF, Tickets={data['total_tickets_sold']}")
    
    def test_admin_stats_unauthorized(self):
        """Test admin stats without auth returns 401/403"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code in [401, 403]
    
    def test_admin_create_event(self):
        """Test admin creating an event"""
        # Login as admin
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        event_data = {
            "title": "TEST Event - Delete Me",
            "description": "Test event for API testing",
            "category": "concerts",
            "price": 1000,
            "available_tickets": 100,
            "venue": "Test Venue",
            "date": "2025-12-31",
            "time": "20:00"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/events",
            json=event_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == event_data["title"]
        print(f"Created event: {data['title']} (ID: {data['id']})")
        
        # Cleanup - delete the test event
        requests.delete(
            f"{BASE_URL}/api/events/{data['id']}",
            headers={"Authorization": f"Bearer {token}"}
        )

class TestTickets:
    """Ticket-related tests"""
    
    def test_get_my_tickets(self):
        """Test getting user's tickets"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"User has {len(data)} tickets")
    
    def test_ticket_view_public(self):
        """Test public ticket view endpoint"""
        # First get a ticket
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        tickets_response = requests.get(
            f"{BASE_URL}/api/tickets",
            headers={"Authorization": f"Bearer {token}"}
        )
        tickets = tickets_response.json()
        
        if tickets:
            ticket_id = tickets[0]["id"]
            response = requests.get(f"{BASE_URL}/api/tickets/{ticket_id}/view")
            assert response.status_code == 200
            data = response.json()
            assert "qr_code_image" in data
            print(f"Ticket view: {data['event_title']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
